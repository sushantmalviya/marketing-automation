import os
import logging
import urllib.parse
from django.shortcuts import render, redirect
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.integrations.models import SocialConnection
from apps.integrations.serializers import SocialConnectionSerializer, OAuthCallbackSerializer
from apps.integrations.services.oauth_service import OAuthService
from apps.accounts.permissions import IsAdminOrSuperAdmin, get_request_role
from apps.common.ownership import get_user_organization, scope_queryset_by_org


logger = logging.getLogger(__name__)


def _build_oauth_redirect_url(base_url: str, params: dict, portal_prefix: str = None) -> str:
    parsed = urllib.parse.urlsplit(base_url)
    path = parsed.path
    if portal_prefix in ("admin", "user"):
        if path.startswith("/admin/"):
            path = f"/{portal_prefix}/" + path[len("/admin/"):]
        elif path.startswith("/user/"):
            path = f"/{portal_prefix}/" + path[len("/user/"):]

    existing_qs = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    for k, v in params.items():
        existing_qs[k] = [v]
    query_str = urllib.parse.urlencode(existing_qs, doseq=True)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, query_str, parsed.fragment))


class SocialConnectionViewSet(viewsets.ModelViewSet):
    """
    API endpoints for managing social media connections scoped to the user's organization.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SocialConnectionSerializer
    
    def get_queryset(self):
        return scope_queryset_by_org(
            SocialConnection.objects.all(),
            self.request.user,
            user_field="user__user",
        )

    @action(detail=False, methods=['get'], url_path='connect/(?P<platform>[^/.]+)')
    def connect(self, request, platform=None):
        """
        Redirects the browser to the authorization URL for the requested platform,
        or returns JSON for API clients.
        """
        try:
            org = get_user_organization(request.user)
            ma_user = request.user.ma_users.first() if hasattr(request.user, "ma_users") else None
            if not ma_user and org is None:
                return Response({"error": "No organization or profile found for user."}, status=status.HTTP_400_BAD_REQUEST)

            portal_prefix = "admin" if get_request_role(request.user) == "ADMIN" else "user"
            url = OAuthService.generate_auth_url(request.user, platform, portal_prefix=portal_prefix)
            
            # Check if API client expects JSON
            accept_header = request.META.get('HTTP_ACCEPT', '')
            is_json_request = 'application/json' in accept_header or request.query_params.get('format') == 'json'
            
            if is_json_request:
                return Response({"authorization_url": url}, status=status.HTTP_200_OK)
            return redirect(url)
        except ValueError as e:
            logger.error(f"OAuth initialization failed for {platform}: {str(e)}")
            return Response({"error": "OAuth initialization failed", "reason": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f"Unexpected error during OAuth connect for {platform}")
            return Response({"error": "OAuth initialization failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get', 'post'], url_path='callback/(?P<platform>[^/.]+)', permission_classes=[])
    def callback(self, request, platform=None):
        """
        Handles the OAuth callback from the platform and redirects to the frontend.
        """
        success_url = os.environ.get("OAUTH_SUCCESS_REDIRECT_URL")
        if not success_url:
            logger.error("OAUTH_SUCCESS_REDIRECT_URL environment variable is missing.")
            return Response({"error": "Server misconfiguration"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        # In OAuth 2.0, errors are sometimes returned directly in the query parameters
        if request.method == 'GET' and 'error' in request.GET:
            error_msg = request.GET.get('error', 'access_denied')
            logger.warning(f"OAuth error received in callback: {error_msg}")
            return redirect(_build_oauth_redirect_url(success_url, {platform.lower(): "failed", "reason": error_msg}))

        data = request.GET if request.method == 'GET' else request.data
        serializer = OAuthCallbackSerializer(data=data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid callback data: {serializer.errors}")
            return redirect(_build_oauth_redirect_url(success_url, {platform.lower(): "failed", "reason": "invalid_callback"}))
            
        state = serializer.validated_data['state']
        code = serializer.validated_data['code']
        
        try:
            connection = OAuthService.handle_callback(state, code, platform)
            portal_prefix = getattr(connection, "_portal_prefix", None)
            return redirect(_build_oauth_redirect_url(success_url, {platform.lower(): "connected"}, portal_prefix=portal_prefix))
        except ValueError as e:
            # e.g., 'invalid_state', 'token_exchange_failed'
            return redirect(_build_oauth_redirect_url(success_url, {platform.lower(): "failed", "reason": str(e)}))
        except Exception as e:
            logger.exception(f"Unexpected error handling OAuth callback for {platform}")
            return redirect(_build_oauth_redirect_url(success_url, {platform.lower(): "failed", "reason": "internal_error"}))

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """
        Validates if the connection's token is still active.
        """
        connection = self.get_object()
        is_valid = OAuthService.validate_connection(str(connection.id), request.user)
        
        # Refresh from db to get updated status
        connection.refresh_from_db()
        return Response({
            "is_valid": is_valid,
            "status": connection.connection_status
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Disconnects the social account.
        """
        connection = self.get_object()
        try:
            OAuthService.disconnect_account(str(connection.id), request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.exception("Failed to disconnect account.")
            return Response({"error": "Failed to disconnect account.", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
