from rest_framework import serializers

from apps.communications.models import (
    CommunicationEvent,
)

class CommunicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunicationEvent
        fields = "__all__"
        read_only_fields = [
            "id",
            "organization",
            "execution",
            "created_at",
        ]

