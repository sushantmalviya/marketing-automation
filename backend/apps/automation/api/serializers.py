from rest_framework import serializers

from apps.automation.models import (
    Automation,
)


class AutomationSerializer(
    serializers.ModelSerializer
):

    owner_email = serializers.CharField(
        source="owner.email",
        read_only=True,
    )

    class Meta:

        model = Automation

        fields = [
            "id",
            "name",
            "description",
            "owner",
            "owner_email",
            "status",
            "is_active",
            "is_template",
            "is_public",
            "version",
            "published_at",
            "workflow_graph",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "owner",
            "created_at",
            "updated_at",
            "published_at",
        ]