from rest_framework import serializers
from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            "id",
            "name",
            "file_url",
            "asset_type",
            "is_personal",
            "path",
            "tags",
            "uploaded_by_name",
            "created_at",
        ]

    def get_uploaded_by_name(self, obj):
        u = obj.uploaded_by
        full = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return full or u.email


class AssetCreateSerializer(serializers.Serializer):
    """Handles file upload to media, or a direct URL."""
    name = serializers.CharField(max_length=255)
    file = serializers.FileField(required=False)
    file_url = serializers.URLField(required=False, allow_blank=True)
    asset_type = serializers.ChoiceField(
        choices=Asset.AssetType.choices,
        required=False,
    )
    is_personal = serializers.BooleanField(default=False, required=False)
    path = serializers.CharField(max_length=1024, default="/", required=False)
    tags = serializers.ListField(
        child=serializers.CharField(),
        default=list,
        required=False
    )

    def validate(self, data):
        if not data.get("file") and not data.get("file_url"):
            raise serializers.ValidationError("Provide either a file or a file_url.")
        return data
