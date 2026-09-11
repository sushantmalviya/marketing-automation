from rest_framework import serializers
from apps.communications.models import SenderIdentity


class SenderIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SenderIdentity
        fields = [
            "id",
            "email",
            "display_name",
            "provider",
            "connection_type",
            "status",
            "last_verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ConnectSMTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    display_name = serializers.CharField(required=False, allow_blank=True, default="")
    provider = serializers.ChoiceField(choices=["YAHOO", "CUSTOM_SMTP"], default="CUSTOM_SMTP")
    host = serializers.CharField()
    port = serializers.IntegerField(default=587)
    security = serializers.ChoiceField(choices=["SSL/TLS", "STARTTLS", "NONE"], default="STARTTLS")
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
