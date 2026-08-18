from rest_framework import serializers

from apps.events.models import SystemEvent


class WebsiteEventTrackSerializer(serializers.Serializer):
    event_name = serializers.ChoiceField(
        choices=SystemEvent.SUPPORTED_EVENTS
    )
    user_identifier = serializers.CharField(
        max_length=255,
    )
    session_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )
    url = serializers.CharField(
        max_length=2048,
        required=False,
        allow_blank=True,
    )
    metadata = serializers.JSONField(
        required=False,
    )


class SystemEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemEvent
        fields = "__all__"
        read_only_fields = [
            "id",
            "organization",
            "created_at",
        ]
