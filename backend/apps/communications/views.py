from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.db.models import Q

from apps.communications.models import (
    CommunicationEvent,
)
from apps.communications.serializers import (
    CommunicationEventSerializer,
)


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
        from django.conf import settings
        from django.http import HttpResponse

        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")

        expected_token = getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
        if mode == "subscribe" and token == expected_token:
            return HttpResponse(challenge, status=200)
        return Response({"detail": "Forbidden"}, status=403)

    def post(self, request):
        data = request.data
        if data.get("object") != "whatsapp_business_account":
            return Response(status=status.HTTP_404_NOT_FOUND)

        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                field = change.get("field")

                if field == "message_template_status_update":
                    template_id = value.get("message_template_id")
                    meta_status = value.get("event")  # e.g., APPROVED, REJECTED, PAUSED
                    if template_id and meta_status:
                        # Find the Template by searching inside the JSON provider_data
                        from apps.campaigns.models import Template
                        # Using raw lookup or __contains because it's a JSONField
                        # We can do provider_data__meta_template_id=template_id
                        template = Template.objects.filter(provider_data__meta_template_id=template_id).first()
                        if template:
                            template.provider_data["meta_status"] = meta_status
                            
                            # Update reason if rejected
                            if "reason" in value:
                                template.provider_data["meta_rejection_reason"] = value["reason"]
                                
                            template.save()

                if "statuses" in value:
                    for status_obj in value["statuses"]:
                        message_id = status_obj.get("id")
                        msg_status = status_obj.get("status")  # delivered, read, failed

                        event = CommunicationEvent.objects.filter(provider_message_id=message_id).first()
                        if event:
                            status_map = {
                                "sent": "SENT",
                                "delivered": "DELIVERED",
                                "read": "READ",
                                "failed": "FAILED"
                            }
                            new_status = status_map.get(msg_status)
                            if new_status:
                                event.status = new_status
                                if new_status == "FAILED" and "errors" in status_obj:
                                    event.metadata["errors"] = status_obj["errors"]
                                event.save()

        return Response(status=status.HTTP_200_OK)
