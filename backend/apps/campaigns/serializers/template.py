from rest_framework import serializers

from apps.campaigns.models import (
    Template,
    Channel,
    CampaignTemplate
)


class TemplateCreateSerializer(serializers.ModelSerializer):

    channel = serializers.PrimaryKeyRelatedField(
        queryset=Channel.objects.filter(
            is_active=True,
        )
    )

    class Meta:
        model = Template

        fields = [
            "id",
            "name",
            "channel",
            "subject",
            "body",
            "status",
        ]


class TemplateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = [
            "subject",
            "body",
        ]


class TemplateSerializer(serializers.ModelSerializer):

    channel_name = serializers.CharField(
        source="channel.name",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.email",
        read_only=True,
    )

    class Meta:
        model = Template

        fields = [
            "id",

            "name",

            "channel",
            "channel_name",

            "subject",
            "body",

            "status",
            "provider_data",

            "created_by",
            "created_by_name",

            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        raw_provider_data = ret.get("provider_data")
        if isinstance(raw_provider_data, dict):
            # Whitelist only safe non-sensitive keys to prevent credential or token leakage
            safe_keys = {
                "waba_id",
                "meta_template_id",
                "meta_template_name",
                "meta_status",
                "meta_category",
                "meta_rejection_reason",
                "submitted_at",
                "header_handle",
            }
            ret["provider_data"] = {
                k: v for k, v in raw_provider_data.items()
                if k in safe_keys
            }
        return ret


class CampaignTemplateAssignSerializer(serializers.ModelSerializer):

    class Meta:
        model = CampaignTemplate
        fields = [
            "campaign",
            "channel",
            "template",
        ]
        validators=[]