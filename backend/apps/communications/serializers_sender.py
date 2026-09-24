from rest_framework import serializers
from apps.communications.models import DomainAuthentication, SenderIdentity


class DomainAuthenticationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DomainAuthentication
        fields = [
            "id",
            "domain",
            "verification_token",
            "dns_record_type",
            "dns_record_name",
            "dns_record_value",
            "status",
            "verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "verification_token",
            "dns_record_type",
            "dns_record_name",
            "dns_record_value",
            "status",
            "verified_at",
            "created_at",
            "updated_at",
        ]


class AddDomainSerializer(serializers.Serializer):
    domain = serializers.CharField(max_length=255)

    def validate_domain(self, value):
        import urllib.parse
        val = value.strip().lower()
        if val.startswith("http://") or val.startswith("https://"):
            val = urllib.parse.urlparse(val).netloc
        if val.startswith("www."):
            val = val[4:]
        if "." not in val or len(val) < 4:
            raise serializers.ValidationError("Enter a valid domain name, e.g. company.com")
        return val


class SenderIdentitySerializer(serializers.ModelSerializer):
    domain = serializers.SerializerMethodField()

    class Meta:
        model = SenderIdentity
        fields = [
            "id",
            "domain_auth",
            "domain",
            "email",
            "display_name",
            "provider",
            "connection_type",
            "status",
            "waba_id",
            "phone_number_id",
            "business_id",
            "quality_rating",
            "verified_name",
            "code_verification_status",
            "account_review_status",
            "last_verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_domain(self, obj):
        if obj.domain_auth:
            return obj.domain_auth.domain
        if obj.email and "@" in obj.email:
            return obj.email.split("@")[-1]
        return ""


class ConnectSMTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    display_name = serializers.CharField(required=False, allow_blank=True, default="")
    provider = serializers.ChoiceField(choices=["YAHOO", "CUSTOM_SMTP"], default="CUSTOM_SMTP")
    host = serializers.CharField()
    port = serializers.IntegerField(default=587)
    security = serializers.ChoiceField(choices=["SSL/TLS", "STARTTLS", "NONE"], default="STARTTLS")
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class WhatsAppEmbeddedSignupSerializer(serializers.Serializer):
    code = serializers.CharField(required=False, allow_blank=True, default="")
    waba_id = serializers.CharField(required=True)
    phone_number_id = serializers.CharField(required=True)
    access_token = serializers.CharField(required=False, allow_blank=True, default="", write_only=True)


class ConnectSMSSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    display_name = serializers.CharField(required=False, allow_blank=True, default="")
    provider = serializers.ChoiceField(choices=["TWILIO_SMS", "CUSTOM_SMS"], default="TWILIO_SMS")
    account_sid = serializers.CharField(required=False, allow_blank=True, default="")
    auth_token = serializers.CharField(write_only=True)


