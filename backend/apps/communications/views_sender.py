import json
import logging
import urllib.parse
import urllib.request
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.communications.models import SenderIdentity
from apps.communications.providers.sender_abstraction import (
    SMTPEmailSender,
    get_sender_provider,
)
from apps.communications.serializers_sender import (
    ConnectSMTPSerializer,
    SenderIdentitySerializer,
)
from apps.integrations.utils.crypto import encrypt_token

logger = logging.getLogger(__name__)


class SenderIdentityListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        identities = SenderIdentity.objects.filter(user=request.user)
        serializer = SenderIdentitySerializer(identities, many=True)
        return Response(serializer.data)


class SenderIdentityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            identity = SenderIdentity.objects.get(pk=pk, user=request.user)
            identity.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except SenderIdentity.DoesNotExist:
            return Response({"detail": "Sender identity not found."}, status=status.HTTP_404_NOT_FOUND)


class TestSMTPConnectionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConnectSMTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        temp_identity = SenderIdentity(
            user=request.user,
            email=data["email"],
            display_name=data.get("display_name", ""),
            provider=data["provider"],
            connection_type="SMTP",
            encrypted_credentials={
                "host": data["host"],
                "port": data["port"],
                "security": data["security"],
                "username": data["username"],
                "password": encrypt_token(data["password"]),
            }
        )
        sender = SMTPEmailSender(temp_identity)
        ok, msg = sender.test_connection()
        if ok:
            return Response({"success": True, "message": msg})
        return Response({"success": False, "message": msg}, status=status.HTTP_400_BAD_REQUEST)


class ConnectSMTPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConnectSMTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        encrypted_pwd = encrypt_token(data["password"])
        credentials = {
            "host": data["host"],
            "port": data["port"],
            "security": data["security"],
            "username": data["username"],
            "password": encrypted_pwd,
        }

        # Test first
        temp_identity = SenderIdentity(
            user=request.user,
            email=data["email"],
            display_name=data.get("display_name", ""),
            provider=data["provider"],
            connection_type="SMTP",
            encrypted_credentials=credentials
        )
        sender = SMTPEmailSender(temp_identity)
        ok, msg = sender.test_connection()
        if not ok:
            return Response({"success": False, "message": f"SMTP Test Failed: {msg}"}, status=status.HTTP_400_BAD_REQUEST)

        # Update existing or create new
        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=data["email"],
            defaults={
                "display_name": data.get("display_name", ""),
                "provider": data["provider"],
                "connection_type": "SMTP",
                "status": "CONNECTED",
                "encrypted_credentials": credentials,
                "last_verified_at": timezone.now(),
            }
        )
        return Response(SenderIdentitySerializer(identity).data, status=status.HTTP_201_CREATED)


class GoogleOAuthUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", os_env("GOOGLE_CLIENT_ID", ""))
        redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", os_env("GOOGLE_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/google/callback"))

        if not client_id:
            return Response({"detail": "Google OAuth client ID is not configured in backend."}, status=status.HTTP_400_BAD_REQUEST)

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
            "access_type": "offline",
            "prompt": "consent",
            "state": str(request.user.id),
        }
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
        return Response({"url": url})


class GoogleOAuthCallbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"detail": "Authorization code is required."}, status=status.HTTP_400_BAD_REQUEST)

        client_id = getattr(settings, "GOOGLE_CLIENT_ID", os_env("GOOGLE_CLIENT_ID", ""))
        client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", os_env("GOOGLE_CLIENT_SECRET", ""))
        redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", os_env("GOOGLE_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/google/callback"))

        # Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        data = urllib.parse.urlencode({
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }).encode("utf-8")

        req = urllib.request.Request(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                tokens = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            return Response({"detail": f"Failed to exchange code with Google: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")

        if not access_token:
            return Response({"detail": "Google did not return an access token."}, status=status.HTTP_400_BAD_REQUEST)

        # Get authenticated user email
        profile_req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        try:
            with urllib.request.urlopen(profile_req, timeout=10) as p_resp:
                profile = json.loads(p_resp.read().decode("utf-8"))
                email = profile.get("email")
                display_name = profile.get("name", "")
        except Exception as e:
            return Response({"detail": f"Failed to fetch Google profile: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        if not email:
            return Response({"detail": "Could not retrieve email address from Google."}, status=status.HTTP_400_BAD_REQUEST)

        credentials = {}
        if refresh_token:
            credentials["refresh_token"] = encrypt_token(refresh_token)

        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=email,
            defaults={
                "display_name": display_name,
                "provider": "GMAIL",
                "connection_type": "OAUTH",
                "status": "CONNECTED",
                "encrypted_credentials": credentials,
                "last_verified_at": timezone.now(),
            }
        )
        return Response(SenderIdentitySerializer(identity).data, status=status.HTTP_201_CREATED)


class MicrosoftOAuthUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client_id = getattr(settings, "MICROSOFT_CLIENT_ID", os_env("MICROSOFT_CLIENT_ID", ""))
        redirect_uri = getattr(settings, "MICROSOFT_REDIRECT_URI", os_env("MICROSOFT_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/microsoft/callback"))

        if not client_id:
            return Response({"detail": "Microsoft OAuth client ID is not configured in backend."}, status=status.HTTP_400_BAD_REQUEST)

        params = {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": "https://graph.microsoft.com/Mail.Send offline_access User.Read",
            "state": str(request.user.id),
        }
        url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + urllib.parse.urlencode(params)
        return Response({"url": url})


class MicrosoftOAuthCallbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"detail": "Authorization code is required."}, status=status.HTTP_400_BAD_REQUEST)

        client_id = getattr(settings, "MICROSOFT_CLIENT_ID", os_env("MICROSOFT_CLIENT_ID", ""))
        client_secret = getattr(settings, "MICROSOFT_CLIENT_SECRET", os_env("MICROSOFT_CLIENT_SECRET", ""))
        redirect_uri = getattr(settings, "MICROSOFT_REDIRECT_URI", os_env("MICROSOFT_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/microsoft/callback"))

        token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        data = urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "scope": "https://graph.microsoft.com/Mail.Send offline_access User.Read",
        }).encode("utf-8")

        req = urllib.request.Request(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                tokens = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            return Response({"detail": f"Failed to exchange code with Microsoft: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")

        if not access_token:
            return Response({"detail": "Microsoft did not return an access token."}, status=status.HTTP_400_BAD_REQUEST)

        profile_req = urllib.request.Request(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        try:
            with urllib.request.urlopen(profile_req, timeout=10) as p_resp:
                profile = json.loads(p_resp.read().decode("utf-8"))
                email = profile.get("mail") or profile.get("userPrincipalName")
                display_name = profile.get("displayName", "")
        except Exception as e:
            return Response({"detail": f"Failed to fetch Microsoft profile: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        if not email:
            return Response({"detail": "Could not retrieve email from Microsoft account."}, status=status.HTTP_400_BAD_REQUEST)

        credentials = {}
        if refresh_token:
            credentials["refresh_token"] = encrypt_token(refresh_token)

        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=email,
            defaults={
                "display_name": display_name,
                "provider": "MICROSOFT",
                "connection_type": "OAUTH",
                "status": "CONNECTED",
                "encrypted_credentials": credentials,
                "last_verified_at": timezone.now(),
            }
        )
        return Response(SenderIdentitySerializer(identity).data, status=status.HTTP_201_CREATED)


class SendTestEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            identity = SenderIdentity.objects.get(pk=pk, user=request.user)
        except SenderIdentity.DoesNotExist:
            return Response({"detail": "Sender identity not found."}, status=status.HTTP_404_NOT_FOUND)

        recipient = request.data.get("recipient") or request.user.email
        subject = request.data.get("subject", "Test Email from Marketing Automation")
        html_body = "<p>Hello!</p><p>This is a test email sent from your connected sender account: <strong>" + identity.email + "</strong>.</p>"

        sender_provider = get_sender_provider(identity)
        if not sender_provider:
            return Response({"detail": "No sender provider configured for this identity."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sender_provider.send(subject, html_body, recipient)
            identity.last_verified_at = timezone.now()
            identity.status = "CONNECTED"
            identity.save(update_fields=["last_verified_at", "status"])
            return Response({"success": True, "message": f"Test email sent to {recipient}"})
        except Exception as e:
            logger.error(f"Failed to send test email from {identity.email}: {e}")
            identity.status = "FAILED"
            identity.save(update_fields=["status"])
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


def os_env(key, default=""):
    import os
    return os.getenv(key, default)
