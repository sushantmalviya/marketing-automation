from rest_framework import serializers

from apps.communications.models import (
    CommunicationEvent,
    WhatsAppConnection,
)


class WhatsAppConnectionSerializer(serializers.ModelSerializer):
    """
    Serializer for WhatsAppConnection.
    Never exposes raw or encrypted access tokens in read operations.
    """
    access_token = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Raw Meta WhatsApp Cloud API access token to be encrypted and stored."
    )   

    class Meta:
        model = WhatsAppConnection
        fields = [
            "id",
            "organization",
            "phone_number_id",
            "access_token",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        raw_token = validated_data.pop("access_token", "")
        connection = WhatsAppConnection(**validated_data)
        if raw_token:
            connection.set_access_token(raw_token)
        connection.save()
        return connection

    def update(self, instance, validated_data):
        raw_token = validated_data.pop("access_token", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if raw_token:
            instance.set_access_token(raw_token)
        instance.save()
        return instance


class CommunicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunicationEvent
        fields = "__all__"
        read_only_fields = [
            "id",
            "execution",
            "campaign",
            "whatsapp_connection",
            "created_at",
        ]


