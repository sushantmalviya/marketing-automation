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
    ConnectSESSenderSerializer,
    ConnectSMTPSerializer,
    DomainAuthenticationSerializer,
    WhatsAppEmbeddedSignupSerializer,
    ConnectSMSSerializer,
    SenderIdentitySerializer,
)
from apps.communications.services.aws_ses import AWSSESService
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

        # Register domain with AWS SES
        ses_service = AWSSESService()
        ses_res = ses_service.create_domain_identity(domain_name)

        token_suffix = secrets.token_hex(8)
        verification_value = f"automarket-verify={token_suffix}"
        dkim_records = ses_res.get("dkim_records", [])
        dkim_status = ses_res.get("dkim_status", "PENDING")
        mail_from_domain = ses_res.get("mail_from_domain", f"bounces.{domain_name}")

        domain_auth = DomainAuthentication.objects.create(
            user=request.user,
            domain=domain_name,
            verification_token=token_suffix,
            dns_record_type="TXT",
            dns_record_name="@",
            dns_record_value=verification_value,
            dkim_records=dkim_records,
            dkim_status=dkim_status,
            mail_from_domain=mail_from_domain,
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

        # 1. Check AWS SES DKIM Verification Status first
        ses_service = AWSSESService()
        ses_res = ses_service.get_domain_verification_status(domain_auth.domain)

        is_ses_verified = ses_res.get("status") == "VERIFIED" or ses_res.get("dkim_status") == "SUCCESS"
        dkim_records = ses_res.get("dkim_records") or domain_auth.dkim_records

        if dkim_records:
            domain_auth.dkim_records = dkim_records
        if ses_res.get("dkim_status"):
            domain_auth.dkim_status = ses_res.get("dkim_status")

        if is_ses_verified:
            domain_auth.status = "VERIFIED"
            domain_auth.verified_at = timezone.now()
            domain_auth.save(update_fields=["status", "verified_at", "dkim_records", "dkim_status"])
            return Response({
                "success": True,
                "message": f"Domain '{domain_auth.domain}' verified successfully via AWS SES Easy DKIM!",
                "domain": DomainAuthenticationSerializer(domain_auth).data
            })

        # 2. Fallback check via DNS TXT record if SES is pending
        is_txt_verified, msg, found_records = verify_domain_dns(domain_auth.domain, domain_auth.verification_token)
        if is_txt_verified:
            domain_auth.status = "VERIFIED"
            domain_auth.verified_at = timezone.now()
            domain_auth.save(update_fields=["status", "verified_at", "dkim_records", "dkim_status"])
            return Response({
                "success": True,
                "message": msg,
                "domain": DomainAuthenticationSerializer(domain_auth).data
            })

        domain_auth.status = "FAILED"
        domain_auth.save(update_fields=["status", "dkim_records", "dkim_status"])
        return Response({
            "success": False,
            "detail": ses_res.get("detail") or "DKIM CNAME / TXT record verification pending in DNS.",
            "found_records": found_records,
            "domain": DomainAuthenticationSerializer(domain_auth).data
        }, status=status.HTTP_400_BAD_REQUEST)


class DomainAuthenticationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            domain_auth = DomainAuthentication.objects.get(pk=pk, user=request.user)
            AWSSESService().delete_domain_identity(domain_auth.domain)
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


class ConnectSESView(APIView):
    """
    Connect a Sender Email address on a verified SES domain.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConnectSESSenderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        domain_auth, error_msg = validate_user_domain_verified(request.user, data["email"])
        if not domain_auth:
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        identity, _ = SenderIdentity.objects.update_or_create(
            user=request.user,
            email=data["email"],
            defaults={
                "domain_auth": domain_auth,
                "display_name": data.get("display_name", ""),
                "provider": "AWS_SES",
                "connection_type": "AWS_SES",
                "status": "CONNECTED",
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

