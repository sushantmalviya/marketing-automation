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

