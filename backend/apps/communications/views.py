import hmac
import hashlib
import logging
from django.conf import settings
from django.http import HttpResponse
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from apps.communications.models import CommunicationEvent, SenderIdentity
from apps.communications.serializers import CommunicationEventSerializer

logger = logging.getLogger(__name__)


def verify_meta_hmac_signature(request) -> bool:
    """
    Validate Meta Webhook X-Hub-Signature-256 HMAC header.
    """
    app_secret = getattr(settings, "META_APP_SECRET", "")
    if not app_secret:
        # If secret not configured in local environment, bypass to avoid breaking dev test
        return True

    signature_header = request.headers.get("X-Hub-Signature-256") or request.META.get("HTTP_X_HUB_SIGNATURE_256")
    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning("Missing or invalid X-Hub-Signature-256 header in Meta webhook request.")
        return False

    expected_signature = signature_header.split("sha256=")[1].strip()
    calculated_signature = hmac.new(
        key=app_secret.encode("utf-8"),
        msg=request.body,
        digestmod=hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_signature, calculated_signature)


class CommunicationEventListView(APIView):
    def get(self, request):
        events = CommunicationEvent.objects.filter(
            Q(campaign__task__created_by=request.user) | 
            Q(execution__automation__owner=request.user)
        ).order_by("-created_at")[:200]
        serializer = CommunicationEventSerializer(
            events,
            many=True,
        )
        return Response(serializer.data)


class WhatsAppWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")

        expected_token = getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
        if mode == "subscribe" and token == expected_token:
            return HttpResponse(challenge, status=200, content_type="text/plain")
        return Response({"detail": "Forbidden"}, status=403)

    def post(self, request):
        # 1. HMAC Verification for security
        if not verify_meta_hmac_signature(request):
            return Response({"detail": "Invalid webhook signature"}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        if not isinstance(data, dict) or data.get("object") != "whatsapp_business_account":
            return Response(status=status.HTTP_404_NOT_FOUND)

        for entry in data.get("entry", []):
            entry_waba_id = entry.get("id", "")

            for change in entry.get("changes", []):
                value = change.get("value", {})
                field = change.get("field")

                receiving_phone_id = value.get("metadata", {}).get("phone_number_id", "")
                display_phone_number = value.get("metadata", {}).get("display_phone_number", "")

                # Multi-tenant resolution: match SenderIdentity by phone_number_id or waba_id
                identity = None
                if receiving_phone_id:
                    identity = SenderIdentity.objects.filter(phone_number_id=receiving_phone_id).first()
                if not identity and entry_waba_id:
                    identity = SenderIdentity.objects.filter(waba_id=entry_waba_id).first()

                # 2. Template Status Updates
                if field == "message_template_status_update":
                    template_id = value.get("message_template_id")
                    meta_status = value.get("event")  # APPROVED, REJECTED, PAUSED
                    if template_id and meta_status:
                        from apps.campaigns.models import Template
                        template = Template.objects.filter(provider_data__meta_template_id=template_id).first()
                        if template:
                            template.provider_data["meta_status"] = meta_status
                            if "reason" in value:
                                template.provider_data["meta_rejection_reason"] = value["reason"]
                            template.save()

                # 3. Outbound Message Delivery & Read Status Updates
                if "statuses" in value:
                    for status_obj in value["statuses"]:
                        message_id = status_obj.get("id")
                        msg_status = status_obj.get("status")  # sent, delivered, read, failed

                        event = CommunicationEvent.objects.filter(provider_message_id=message_id).first()
                        if event:
                            status_map = {
                                "sent": "SENT",
                                "delivered": "DELIVERED",
                                "read": "READ",
                                "failed": "FAILED",
                            }
                            new_status = status_map.get(msg_status)
                            if new_status:
                                event.status = new_status
                                if new_status == "FAILED" and "errors" in status_obj:
                                    event.metadata["errors"] = status_obj["errors"]
                                event.save()

                # 4. Inbound Customer Messages Handling
                if "messages" in value:
                    for msg_obj in value["messages"]:
                        sender_phone = msg_obj.get("from", "")
                        message_id = msg_obj.get("id", "")
                        timestamp = msg_obj.get("timestamp", "")
                        msg_type = msg_obj.get("type", "text")

                        text_body = ""
                        if msg_type == "text":
                            text_body = msg_obj.get("text", {}).get("body", "")
                        elif msg_type == "button":
                            text_body = msg_obj.get("button", {}).get("text", "")
                        elif msg_type == "interactive":
                            text_body = msg_obj.get("interactive", {}).get("button_reply", {}).get("title", "")

                        # Avoid creating duplicate inbound events
                        existing_event = CommunicationEvent.objects.filter(provider_message_id=message_id).exists()
                        if not existing_event and message_id:
                            CommunicationEvent.objects.create(
                                channel="WHATSAPP",
                                event_name="WHATSAPP_RECEIVED",
                                recipient=sender_phone,
                                status="RECEIVED",
                                provider_message_id=message_id,
                                metadata={
                                    "receiving_phone_id": receiving_phone_id,
                                    "display_phone_number": display_phone_number,
                                    "waba_id": entry_waba_id,
                                    "type": msg_type,
                                    "text": text_body,
                                    "timestamp": timestamp,
                                    "tenant_user_id": str(identity.user_id) if identity else None,
                                }
                            )

        return Response(status=status.HTTP_200_OK)
