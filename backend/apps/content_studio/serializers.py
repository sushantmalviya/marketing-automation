from rest_framework import serializers
from .models import BrandVoice, ContentTemplate

class BrandVoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandVoice
        fields = [
            'id', 'brand_description', 'target_audience', 'tone',
            'content_pillars', 'unique_value', 'guidelines', 'call_to_action', 
            'created_at', 'updated_at'
        ]

class ContentTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentTemplate
        fields = ['id', 'name', 'description', 'prompt_template', 'content_type', 'is_active', 'created_at', 'updated_at']

# --- New Campaign Workflow Serializers ---

from .models import ContentDraft, ContentDraftVersion, ContentPlatform, Approval, ImageReference


class ImageReferenceSerializer(serializers.ModelSerializer):
    asset_url = serializers.CharField(source='asset.file_url', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)

    class Meta:
        model = ImageReference
        fields = ['id', 'asset', 'asset_url', 'asset_name']


class ContentPlatformSerializer(serializers.ModelSerializer):
    images = ImageReferenceSerializer(many=True, read_only=True)

    class Meta:
        model = ContentPlatform
        fields = [
            'id', 'platform', 'image_size', 'status', 'approval_status',
            'scheduled_datetime', 'published_datetime', 'error_message',
            'caption_text', 'hashtags', 'cta', 'is_manually_edited', 'images'
        ]


class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Approval
        fields = ['id', 'status', 'reviewer', 'review_notes', 'reviewed_at', 'created_at']


class ContentDraftVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentDraftVersion
        fields = ['id', 'version_number', 'enhanced_prompt_snapshot', 'regeneration_reason', 'text_content', 'image_url', 'created_at']


class ContentDraftSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    platforms = ContentPlatformSerializer(many=True, read_only=True)
    approvals = ApprovalSerializer(many=True, read_only=True)
    versions = ContentDraftVersionSerializer(many=True, read_only=True)

    class Meta:
        model = ContentDraft
        fields = [
            'id', 'owner', 'owner_name', 'content_type', 'original_prompt', 'enhanced_prompt',
            'workflow_state', 'current_version', 'platforms', 'approvals', 'versions',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['owner', 'workflow_state', 'current_version']

    def get_owner_name(self, obj):
        return obj.owner.get_full_name().strip() or obj.owner.email

class ContentDraftCreateSerializer(serializers.Serializer):
    original_prompt = serializers.CharField(required=True, allow_blank=False)
    platforms = serializers.ListField(
        child=serializers.ChoiceField(choices=ContentPlatform.PlatformChoices.choices),
        min_length=1
    )
    preset_image_id = serializers.UUIDField(required=False, allow_null=True)

class ContentDraftUpdateSerializer(serializers.Serializer):
    original_prompt = serializers.CharField(required=False, allow_blank=True)
    enhanced_prompt = serializers.CharField(required=False, allow_blank=True)

class AnalyzePromptSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=True)

class EnhancePromptSerializer(serializers.Serializer):
    content_spec = serializers.DictField(required=True)
    user_answers = serializers.DictField(required=True)

class ContentScheduleSerializer(serializers.Serializer):
    schedules = serializers.DictField(
        child=serializers.DateTimeField(),
        help_text="Dictionary of platform to scheduled_datetime"
    )

    def validate_schedules(self, value):
        from django.utils import timezone
        now = timezone.now()
        for k, v in value.items():
            if v and v <= now:
                raise serializers.ValidationError(f"Scheduled time for {k} must be in the future.")
        return value
