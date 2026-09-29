import json
import logging
import os
import secrets
import urllib.parse
import urllib.request
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.communications.models import DomainAuthentication, SenderIdentity
from apps.communications.providers.sender_abstraction import (
    SMTPEmailSender,
    get_sender_provider,
)
from apps.communications.serializers_sender import (
    AddDomainSerializer,
    ConnectSMTPSerializer,
    DomainAuthenticationSerializer,
    WhatsAppEmbeddedSignupSerializer,
    ConnectSMSSerializer,
    SenderIdentitySerializer,
)
from apps.communications.services.dns_verifier import verify_domain_dns
from apps.communications.services.meta_api import MetaAPIService
from apps.integrations.utils.crypto import encrypt_token

logger = logging.getLogger(__name__)


def validate_user_domain_verified(user, email):
    if not email or "@" not in email:
        return None, "Invalid email address format."
    domain = email.split("@")[-1].strip().lower()
    domain_auth = DomainAuthentication.objects.filter(
        user=user,
        domain__iexact=domain,
        status="VERIFIED"
    ).first()
    if not domain_auth:
        return None, f"Domain '{domain}' is not verified. Please verify ownership of '{domain}' via DNS before connecting '{email}'."
    return domain_auth, None


class DomainAuthenticationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        domains = DomainAuthentication.objects.filter(user=request.user)
        serializer = DomainAuthenticationSerializer(domains, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = AddDomainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        domain_name = serializer.validated_data["domain"]

        # Prevent hijacking domains verified by another user
        existing_other = DomainAuthentication.objects.filter(
            domain__iexact=domain_name, status="VERIFIED"
        ).exclude(user=request.user).first()
        if existing_other:
            return Response(
                {"detail": f"Domain '{domain_name}' is already verified by another account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check existing domain for this user
        existing_domain = DomainAuthentication.objects.filter(
            user=request.user, domain__iexact=domain_name
        ).first()

        if existing_domain:
            return Response(DomainAuthenticationSerializer(existing_domain).data, status=status.HTTP_200_OK)

        # Create new token
        token_suffix = secrets.token_hex(8)
        verification_value = f"automarket-verify={token_suffix}"

        domain_auth = DomainAuthentication.objects.create(
            user=request.user,
            domain=domain_name,
            verification_token=token_suffix,
            dns_record_type="TXT",
            dns_record_name="@",
            dns_record_value=verification_value,
            status="PENDING",
        )
        return Response(DomainAuthenticationSerializer(domain_auth).data, status=status.HTTP_201_CREATED)


class DomainAuthenticationVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            domain_auth = DomainAuthentication.objects.get(pk=pk, user=request.user)
        except DomainAuthentication.DoesNotExist:
            return Response({"detail": "Domain authentication record not found."}, status=status.HTTP_404_NOT_FOUND)

        is_verified, msg, found_records = verify_domain_dns(domain_auth.domain, domain_auth.verification_token)
        if is_verified:
            domain_auth.status = "VERIFIED"
            domain_auth.verified_at = timezone.now()
            domain_auth.save(update_fields=["status", "verified_at"])
            return Response({
                "success": True,
                "message": msg,
                "domain": DomainAuthenticationSerializer(domain_auth).data
            })
        else:
            domain_auth.status = "FAILED"
            domain_auth.save(update_fields=["status"])
            return Response({
                "success": False,
                "detail": msg,
                "found_records": found_records,
                "domain": DomainAuthenticationSerializer(domain_auth).data
            }, status=status.HTTP_400_BAD_REQUEST)


class DomainAuthenticationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            domain_auth = DomainAuthentication.objects.get(pk=pk, user=request.user)
            domain_auth.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DomainAuthentication.DoesNotExist:
            return Response({"detail": "Domain record not found."}, status=status.HTTP_404_NOT_FOUND)


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

        domain_auth, error_msg = validate_user_domain_verified(request.user, data["email"])
        if not domain_auth:
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

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
            domain_auth=domain_auth,
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
                "domain_auth": domain_auth,
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
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", os.getenv("GOOGLE_CLIENT_ID", ""))
        redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/google/callback"))

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

        client_id = getattr(settings, "GOOGLE_CLIENT_ID", os.getenv("GOOGLE_CLIENT_ID", ""))
        client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", os.getenv("GOOGLE_CLIENT_SECRET", ""))
        redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/google/callback"))

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

        domain_auth, error_msg = validate_user_domain_verified(request.user, email)
        if not domain_auth:
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        credentials = {}
        if refresh_token:
            credentials["refresh_token"] = encrypt_token(refresh_token)

        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=email,
            defaults={
                "domain_auth": domain_auth,
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
        client_id = getattr(settings, "MICROSOFT_CLIENT_ID", os.getenv("MICROSOFT_CLIENT_ID", ""))
        redirect_uri = getattr(settings, "MICROSOFT_REDIRECT_URI", os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/microsoft/callback"))

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

        client_id = getattr(settings, "MICROSOFT_CLIENT_ID", os.getenv("MICROSOFT_CLIENT_ID", ""))
        client_secret = getattr(settings, "MICROSOFT_CLIENT_SECRET", os.getenv("MICROSOFT_CLIENT_SECRET", ""))
        redirect_uri = getattr(settings, "MICROSOFT_REDIRECT_URI", os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:3000/admin/account/oauth/microsoft/callback"))

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

        domain_auth, error_msg = validate_user_domain_verified(request.user, email)
        if not domain_auth:
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        credentials = {}
        if refresh_token:
            credentials["refresh_token"] = encrypt_token(refresh_token)

        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=email,
            defaults={
                "domain_auth": domain_auth,
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


class WhatsAppEmbeddedSignupCallbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WhatsAppEmbeddedSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        code = data.get("code")
        waba_id = data["waba_id"]
        phone_number_id = data["phone_number_id"]
        access_token = data.get("access_token", "")

        meta_api = MetaAPIService()

        if code and not access_token:
            try:
                token_data = meta_api.exchange_code_for_token(code)
                access_token = token_data.get("access_token")
            except Exception as exc:
                logger.error(f"Embedded signup token exchange failed for user {request.user.id}: {exc}")
                return Response(
                    {"detail": f"Meta token exchange failed: {str(exc)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not access_token:
            return Response(
                {"detail": "Access token or authorization code is required for WhatsApp setup."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Auto-subscribe WABA to webhook application
        meta_api.subscribe_waba_to_app(waba_id, access_token)

        # 2. Register Phone Number if required
        meta_api.register_phone_number(phone_number_id, access_token)

        # 3. Fetch phone details & quality rating from Meta Graph API
        phone_info = meta_api.get_phone_number_details(phone_number_id, access_token)
        display_phone = phone_info.get("display_phone_number") or phone_number_id
        verified_name = phone_info.get("verified_name") or ""
        quality_rating = phone_info.get("quality_rating") or "UNKNOWN"
        code_verification_status = phone_info.get("code_verification_status") or "UNKNOWN"
        account_review_status = phone_info.get("account_review_status") or "UNKNOWN"

        credentials = {
            "phone_number_id": phone_number_id,
            "waba_id": waba_id,
            "access_token": encrypt_token(access_token),
        }

        # 4. Save/Update SenderIdentity scoped to request.user (strict multi-tenant isolation)
        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            phone_number_id=phone_number_id,
            defaults={
                "email": display_phone,
                "display_name": verified_name or f"WhatsApp ({display_phone})",
                "provider": "WHATSAPP_CLOUD",
                "connection_type": "OAUTH",
                "status": "CONNECTED",
                "waba_id": waba_id,
                "quality_rating": quality_rating,
                "verified_name": verified_name,
                "code_verification_status": code_verification_status,
                "account_review_status": account_review_status,
                "encrypted_credentials": credentials,
                "last_verified_at": timezone.now(),
            }
        )

        return Response(SenderIdentitySerializer(identity).data, status=status.HTTP_201_CREATED)


class ConnectSMSView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConnectSMSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        credentials = {
            "account_sid": data.get("account_sid", ""),
            "auth_token": encrypt_token(data["auth_token"]),
        }

        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=data["phone_number"], # Store sender number or ID in identifier field
            defaults={
                "display_name": data.get("display_name") or f"SMS Sender ({data['phone_number']})",
                "provider": data["provider"],
                "connection_type": "API_KEY",
                "status": "CONNECTED",
                "encrypted_credentials": credentials,
                "last_verified_at": timezone.now(),
            }
        )
        return Response(SenderIdentitySerializer(identity).data, status=status.HTTP_201_CREATED)


def os_env(key, default=""):
    import os
    return os.getenv(key, default)

