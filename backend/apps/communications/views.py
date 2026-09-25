import hashlib
import hmac
import logging
from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.communications.models import (
    CommunicationEvent,
    WhatsAppConnection,
)
from apps.communications.serializers import (
    CommunicationEventSerializer,
    WhatsAppConnectionSerializer,
)

logger = logging.getLogger(__name__)


class WhatsAppConnectionViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for managing WhatsApp Cloud API connections per organization.
    Enforces tenant isolation: users only see and manage their own organization's connections.
    """
    serializer_class = WhatsAppConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from apps.common.ownership import is_super_admin, get_managed_user_ids
        user = self.request.user
        if is_super_admin(user):
            return WhatsAppConnection.objects.all().order_by("-created_at")

        managed_ids = get_managed_user_ids(user)
        managed_ids.append(user.id)
        return WhatsAppConnection.objects.filter(
            organization_id__in=managed_ids
        ).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user)


class CommunicationEventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        events = CommunicationEvent.objects.filter(
            Q(campaign__created_by=request.user) |
            Q(campaign__task__created_by=request.user) |
            Q(execution__automation__owner=request.user) |
            Q(whatsapp_connection__organization=request.user)
        ).order_by("-created_at")[:200]
        serializer = CommunicationEventSerializer(
            events,
            many=True,
        )
        return Response(serializer.data)


class WhatsAppWebhookView(APIView):
    """
    Webhook handler for Meta WhatsApp Cloud API events.
    Supports:
    - Challenge verification (GET)
    - Delivery status tracking: SENT -> DELIVERED -> READ, FAILED (POST)
    - Template status updates (POST)
    - X-Hub-Signature-256 HMAC-SHA256 signature verification.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def _verify_signature(self, request) -> bool:
        """
        Validates the X-Hub-Signature-256 header using META_APP_SECRET.
        """
        app_secret = getattr(settings, "META_APP_SECRET", "")
        if not app_secret:
            # If no app secret is configured (e.g. initial dev), pass
            return True

        signature_header = (
            request.headers.get("X-Hub-Signature-256")
            or request.META.get("HTTP_X_HUB_SIGNATURE_256", "")
        )
        if not signature_header or not signature_header.startswith("sha256="):
            logger.warning("WhatsApp webhook missing or invalid X-Hub-Signature-256 header.")
            return False

        expected_sig = signature_header.split("sha256=", 1)[1].strip()
        raw_body = request.body
        computed_sig = hmac.new(
            app_secret.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed_sig, expected_sig)

    def get(self, request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")

        expected_token = getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
        if mode == "subscribe" and token == expected_token:
            return HttpResponse(challenge, status=200)
        return Response({"detail": "Forbidden"}, status=403)

    def post(self, request):
        if not self._verify_signature(request):
            return Response(
                {"detail": "Invalid signature."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data
        if data.get("object") != "whatsapp_business_account":
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Progression weights for idempotent status transitions
        status_weights = {
            "SENT": 10,
            "DELIVERED": 20,
            "READ": 30,
            "FAILED": 40,
        }

        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                field = change.get("field")

                if field == "message_template_status_update":
                    template_id = value.get("message_template_id")
                    meta_status = value.get("event")
                    if template_id and meta_status:
                        from apps.campaigns.models import Template
                        template = Template.objects.filter(
                            provider_data__meta_template_id=template_id
                        ).first()
                        if template:
                            template.provider_data["meta_status"] = meta_status
                            if "reason" in value:
                                template.provider_data["meta_rejection_reason"] = value["reason"]
                            template.save()

                if "statuses" in value:
                    for status_obj in value["statuses"]:
                        message_id = status_obj.get("id")
                        msg_status = (status_obj.get("status") or "").lower()

                        event = CommunicationEvent.objects.filter(
                            provider_message_id=message_id
                        ).first()
                        if event:
                            status_map = {
                                "sent": "SENT",
                                "delivered": "DELIVERED",
                                "read": "READ",
                                "failed": "FAILED",
                            }
                            new_status = status_map.get(msg_status)
                            if new_status:
                                current_weight = status_weights.get(event.status, 0)
                                new_weight = status_weights.get(new_status, 0)

                                # Idempotency: only advance status forward, or allow failure
                                if new_weight >= current_weight or new_status == "FAILED":
                                    event.status = new_status
                                    if new_status == "FAILED" and "errors" in status_obj:
                                        event.metadata["errors"] = status_obj["errors"]
                                    if "timestamp" in status_obj:
                                        event.metadata["status_timestamp"] = status_obj["timestamp"]
                                    event.save()

                                    # Also update matching CampaignDelivery status if exists
                                    if event.campaign_id and event.recipient:
                                        from apps.campaigns.models import CampaignDelivery
                                        CampaignDelivery.objects.filter(
                                            campaign_id=event.campaign_id,
                                            customer__data__phone=event.recipient,
                                        ).update(status=new_status)

        return Response(status=status.HTTP_200_OK)

