from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.events.models import SystemEvent
from apps.events.serializers import WebsiteEventTrackSerializer
from apps.events.services.dispatcher import dispatch_website_event


class TrackEventView(APIView):
    def post(self, request):
        serializer = WebsiteEventTrackSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )

        data = serializer.validated_data
        event = SystemEvent.objects.create(
            event_type=SystemEvent.EventType.WEBSITE,
            event_name=data["event_name"],
            user_identifier=data["user_identifier"],
            session_id=data.get("session_id", ""),
            url=data.get("url", ""),
            metadata=data.get("metadata", {}),
        )

        executions = dispatch_website_event(event)

        return Response(
            {
                "success": True,
                "event_id": event.id,
                "execution_ids": [
                    execution.id
                    for execution in executions
                ],
            },
            status=status.HTTP_201_CREATED,
        )


import base64
import json
from django.http import HttpResponse, HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

TRANSPARENT_1X1_PNG = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

from apps.communications.models import CommunicationEvent

@method_decorator(csrf_exempt, name='dispatch')
class EmailOpenTrackingView(APIView):
    permission_classes = [] # Publicly accessible
    
    def get(self, request, payload):
        try:
            # payload is actually the event.id (UUID)
            comm_event = CommunicationEvent.objects.get(id=payload)
            SystemEvent.objects.create(
                event_type=SystemEvent.EventType.COMMUNICATION,
                event_name="EMAIL_OPENED",
                user_identifier=comm_event.recipient, # We use the email as identifier
                metadata={"communication_event_id": str(comm_event.id)},
            )
        except CommunicationEvent.DoesNotExist:
            pass
            
        return HttpResponse(TRANSPARENT_1X1_PNG, content_type="image/png")

@method_decorator(csrf_exempt, name='dispatch')
class EmailClickTrackingView(APIView):
    permission_classes = [] # Publicly accessible
    
    def get(self, request, payload):
        target_url = request.GET.get("url", "/")
        try:
            comm_event = CommunicationEvent.objects.get(id=payload)
            SystemEvent.objects.create(
                event_type=SystemEvent.EventType.COMMUNICATION,
                event_name="EMAIL_CLICKED",
                user_identifier=comm_event.recipient,
                metadata={
                    "communication_event_id": str(comm_event.id),
                    "target_url": target_url
                },
            )
        except CommunicationEvent.DoesNotExist:
            pass
            
        return HttpResponseRedirect(target_url)

