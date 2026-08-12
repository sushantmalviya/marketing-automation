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
from apps.integrations.services.meta_ads_service import MetaAdsService
from apps.accounts.permissions import IsAdminOrSuperAdmin


logger = logging.getLogger(__name__)

class SocialConnectionViewSet(viewsets.ModelViewSet):
    """
    API endpoints for managing social media connections.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SocialConnectionSerializer
    
    def get_queryset(self):
        from apps.common.ownership import get_tenant_owner_profile
        tenant_owner = get_tenant_owner_profile(self.request.user)
            
        if tenant_owner:
            return SocialConnection.objects.filter(user=tenant_owner)
            
        return SocialConnection.objects.none()

    @action(detail=False, methods=['get'], url_path='connect/(?P<platform>[^/.]+)')
    def connect(self, request, platform=None):
        """
        Redirects the browser to the authorization URL for the requested platform,
        or returns JSON for API clients.
        """
        try:
            from apps.common.ownership import get_tenant_owner_profile
            tenant_owner = get_tenant_owner_profile(request.user)
            if not tenant_owner:
                return Response({"error": "No tenant owner found for user."}, status=status.HTTP_400_BAD_REQUEST)
                
            url = OAuthService.generate_auth_url(tenant_owner, platform)
            
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
            return redirect(f"{success_url}?{platform.lower()}=failed&reason={urllib.parse.quote(error_msg)}")

        data = request.GET if request.method == 'GET' else request.data
        serializer = OAuthCallbackSerializer(data=data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid callback data: {serializer.errors}")
            return redirect(f"{success_url}?{platform.lower()}=failed&reason=invalid_callback")
            
        state = serializer.validated_data['state']
        code = serializer.validated_data['code']
        
        try:
            connection = OAuthService.handle_callback(state, code, platform)
            return redirect(f"{success_url}?{platform.lower()}=connected")
        except ValueError as e:
            # e.g., 'invalid_state', 'token_exchange_failed'
            return redirect(f"{success_url}?{platform.lower()}=failed&reason={urllib.parse.quote(str(e))}")
        except Exception as e:
            logger.exception(f"Unexpected error handling OAuth callback for {platform}")
            return redirect(f"{success_url}?{platform.lower()}=failed&reason=internal_error")

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """
        Validates if the connection's token is still active.
        """
        connection = self.get_object()
        from apps.common.ownership import get_tenant_owner_profile
        tenant_owner = get_tenant_owner_profile(request.user)
        is_valid = OAuthService.validate_connection(str(connection.id), tenant_owner)
        
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
            from apps.common.ownership import get_tenant_owner_profile
            tenant_owner = get_tenant_owner_profile(request.user)
            OAuthService.disconnect_account(str(connection.id), tenant_owner)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.exception("Failed to disconnect account.")
            return Response({"error": "Failed to disconnect account.", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MetaAuthURLView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = MetaAdsService.get_auth_url()
        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


class MetaAdAccountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = MetaAdsService.get_ad_accounts(request.user)
        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


class MetaAdInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account_id = request.query_params.get("account_id")
        date_preset = request.query_params.get("date_preset", "last_30d")
        data = MetaAdsService.get_ad_insights(account_id, date_preset)
        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)

