from rest_framework import serializers
from ..models import CustomerUpload, Campaign, Audience

class CampaignCreateSerializer(serializers.ModelSerializer):
    audience = serializers.PrimaryKeyRelatedField(
        queryset=Audience.objects.all(),
        source="target_audience",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Campaign
        fields = [
            "name",
            "description",
            "audience",
        ]

    def validate_name(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError(
                "Campaign name must be at least 3 characters."
            )

        return value


class CampaignRetrieveUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "description",
            "status",
        ]
        read_only_fields = ["id", "status"]

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Campaign name must be at least 3 characters."
            )
        return value
    

class CampaignUpdateSerializer(serializers.ModelSerializer):
    audience = serializers.PrimaryKeyRelatedField(
        queryset=Audience.objects.all(),
        source="target_audience",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Campaign
        fields = [
            "name",
            "description",
            "audience",
        ]
        
    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Campaign name must be at least 3 characters."
            )
        return value
    

class CampaignPreviewSerializer(serializers.Serializer):

    campaign = serializers.PrimaryKeyRelatedField(
        queryset=Campaign.objects.all(),
    )

class CampaignSendSerializer(serializers.Serializer):

    campaign = serializers.PrimaryKeyRelatedField(
        queryset=Campaign.objects.filter(
            is_active=True,
            is_deleted=False,
        )
    )



class CampaignInfoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.CharField()
    scheduled_at = serializers.DateTimeField(allow_null=True)
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)


class CampaignSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    sent = serializers.IntegerField()
    failed = serializers.IntegerField()
    pending = serializers.IntegerField()
    delivered = serializers.IntegerField()
    success_rate = serializers.FloatField()


class ChannelAnalyticsSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    total = serializers.IntegerField()
    sent = serializers.IntegerField()
    failed = serializers.IntegerField()
    pending = serializers.IntegerField()
    delivered = serializers.IntegerField()


class CustomerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    data = serializers.JSONField()


class RecentDeliverySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    customer = CustomerSerializer()
    channel = serializers.CharField()
    status = serializers.CharField()
    provider_message_id = serializers.CharField(
        allow_null=True,
        allow_blank=True,
    )
    sent_at = serializers.DateTimeField(
        allow_null=True,
    )


class CampaignSubmitSerializer(serializers.Serializer):
    pass

class CampaignApproveSerializer(serializers.Serializer):
    pass

class CampaignRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(required=True)
    review_comments = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class PendingApprovalSerializer(serializers.ModelSerializer):
    task_name = serializers.CharField(source="task.title", read_only=True)
    owner_email = serializers.CharField(source="created_by.email", read_only=True)
    submitted_by_email = serializers.CharField(source="submitted_by.email", read_only=True)
    audience_name = serializers.CharField(source="task.audience.name", read_only=True)
    channels = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "task_name",
            "owner_email",
            "submitted_by_email",
            "submitted_at",
            "audience_name",
            "channels",
            "status",
        ]

    def get_channels(self, obj):
        return [c.channel.name for c in obj.campaign_channels.all()]

class MyCampaignListSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="name", read_only=True)
    task_id = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    audience_name = serializers.SerializerMethodField()
    approved_by = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    channels = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()
    contacts = serializers.IntegerField(read_only=True)
    sent = serializers.IntegerField(read_only=True)
    delivered = serializers.IntegerField(read_only=True)
    opened = serializers.IntegerField(read_only=True)
    clicked = serializers.IntegerField(read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id",
            "campaign_name",
            "task_id",
            "task_name",
            "audience_name",
            "channels",
            "status",
            "scheduled_at",
            "contacts",
            "sent",
            "delivered",
            "opened",
            "clicked",
            "created_at",
            "updated_at",
            "submitted_at",
            "approved_at",
            "approved_by",
            "submitted_by_name",
            "rejection_reason",
            "review_comments",
            "available_actions",
        ]

    def get_task_id(self, obj):
        return None

    def get_task_name(self, obj):
        return ""

    def get_audience_name(self, obj):
        if getattr(obj, "target_audience", None):
            return obj.target_audience.name
        aud_rel = getattr(obj, "campaign_audiences", None) or getattr(obj, "audience", None)
        if aud_rel and hasattr(aud_rel, "first"):
            first_aud = aud_rel.first()
            if first_aud:
                if hasattr(first_aud, "audience") and first_aud.audience:
                    return first_aud.audience.name
                if hasattr(first_aud, "name"):
                    return first_aud.name
                if hasattr(first_aud, "customer") and first_aud.customer and hasattr(first_aud.customer, "upload") and first_aud.customer.upload:
                    from apps.campaigns.models import Audience
                    aud = Audience.objects.filter(customer_upload=first_aud.customer.upload).first()
                    if aud:
                        return aud.name
                    return first_aud.customer.upload.file_name
        return ""

    def get_approved_by(self, obj):
        return obj.approved_by.email if obj.approved_by else ""

    def get_channels(self, obj):
        return [c.channel.name for c in obj.campaign_channels.all()]

    def get_submitted_by_name(self, obj):
        user = obj.submitted_by or obj.created_by
        if not user:
            return ""
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.email

    def get_available_actions(self, obj):
        if obj.status in [Campaign.Status.DRAFT, Campaign.Status.APPROVED]:
            return ["edit", "delete", "send", "schedule", "submit"]
        elif obj.status == Campaign.Status.PENDING_APPROVAL:
            return ["approve", "reject", "view", "send", "schedule"]
        elif obj.status == Campaign.Status.REJECTED:
            return ["edit", "submit"]
        elif obj.status == Campaign.Status.COMPLETED:
            return ["view"]
        return ["edit", "delete", "send", "schedule"]

class DailySeriesSerializer(serializers.Serializer):
    date = serializers.CharField()
    sent = serializers.IntegerField()
    delivered = serializers.IntegerField()
    failed = serializers.IntegerField()


class CampaignAnalyticsSerializer(serializers.Serializer):
    campaign = CampaignInfoSerializer()
    summary = CampaignSummarySerializer()
    channels = ChannelAnalyticsSerializer(many=True)
    daily_series = DailySeriesSerializer(many=True)
    recent_deliveries = RecentDeliverySerializer(many=True)
