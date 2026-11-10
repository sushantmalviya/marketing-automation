from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel





class BrandVoice(TimeStampedUUIDModel):

    organization = models.OneToOneField(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="brand_voice",
    )
    brand_description = models.TextField(blank=True, help_text="What does your brand do?")
    target_audience = models.TextField(blank=True, help_text="Who is your target audience?")
    tone = models.CharField(max_length=255, default="Professional", help_text="How do you want your brand to sound on social media?")
    content_pillars = models.TextField(blank=True, help_text="What topics should your content focus on?")
    unique_value = models.TextField(blank=True, help_text="What makes your brand different from competitors?")
    guidelines = models.TextField(blank=True, help_text="Are there any words, phrases, or styles the AI should always use or avoid?")
    call_to_action = models.TextField(blank=True, help_text="What action should your social media posts encourage?")
    logo_url = models.URLField(max_length=2048, blank=True, help_text="Saved brand logo URL.")
    logo_asset = models.ForeignKey(
        "asset_library.Asset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brand_logos",
    )
    include_logo_in_images = models.BooleanField(
        default=False,
        help_text="Inject saved logo as a visual reference during AI image generation (uses extra credits/tokens).",
    )
    reference_images = models.JSONField(
        default=list,
        blank=True,
        help_text="List of {asset_id, url, name} reference images injected for brand visual consistency.",
    )
    include_reference_images = models.BooleanField(
        default=False,
        help_text="Inject saved reference images during AI image generation (uses extra credits/tokens).",
    )
    brand_colors = models.JSONField(
        default=list,
        blank=True,
        help_text="Saved brand color palette (hex codes or descriptive names).",
    )
    visual_style = models.CharField(
        max_length=255,
        blank=True,
        help_text="Preferred brand visual aesthetic, lighting, and photography style.",
    )

    class Meta:
        db_table = "brand_voices"

    def __str__(self):
        return f"Brand Voice ({self.organization.name})" if self.organization_id else "Brand Voice"


class ContentTemplate(TimeStampedUUIDModel):

    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    prompt_template = models.TextField(help_text="Use {{variables}} for dynamic injection")
    
    content_type = models.CharField(
        max_length=20,
        choices=[
            ("EMAIL", "Email"),
            ("BLOG", "Blog"),
            ("AD_COPY", "Ad Copy"),
            ("SOCIAL", "Social Media"),
            ("CAPTION", "Caption")
        ],
        blank=True,
        null=True
    )
    

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "content_templates"
        ordering = ["name"]

    def __str__(self):
        return self.name


# --- New Campaign Workflow Models ---

class ContentDraft(TimeStampedUUIDModel):
    class WorkflowState(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        IN_REVIEW = "IN_REVIEW", "In Review"
        APPROVED = "APPROVED", "Approved"
        PUBLISHED = "PUBLISHED", "Published"

    class ContentType(models.TextChoices):
        EMAIL = "EMAIL", "Email"
        BLOG = "BLOG", "Blog"
        AD_COPY = "AD_COPY", "Ad Copy"
        SOCIAL = "SOCIAL", "Social Media"
        CAPTION = "CAPTION", "Caption"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_drafts"
    )

    content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        db_index=True,
        default=ContentType.SOCIAL
    )

    original_prompt = models.TextField(blank=True)
    enhanced_prompt = models.TextField(blank=True)
    image_model = models.CharField(max_length=64, default="google_nano_banana")
    image_quality = models.CharField(max_length=16, default="STANDARD")
    image_aspect_ratio = models.CharField(max_length=16, default="1:1")
    
    workflow_state = models.CharField(
        max_length=20,
        choices=WorkflowState.choices,
        default=WorkflowState.DRAFT,
        db_index=True
    )
    
    current_version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "content_draft_drafts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ContentDraft {self.id} by {self.owner.email}"


class ContentDraftVersion(TimeStampedUUIDModel):
    draft = models.ForeignKey(
        ContentDraft,
        on_delete=models.CASCADE,
        related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    enhanced_prompt_snapshot = models.TextField(blank=True)
    regeneration_reason = models.TextField(blank=True)
    text_content = models.TextField(blank=True, null=True)
    image_url = models.URLField(max_length=2048, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="content_versions_created"
    )

    class Meta:
        db_table = "content_draft_versions"
        unique_together = [("draft", "version_number")]
        ordering = ["-version_number"]


class ContentPlatform(TimeStampedUUIDModel):
    class PlatformChoices(models.TextChoices):
        FACEBOOK = "FACEBOOK", "Facebook"
        INSTAGRAM = "INSTAGRAM", "Instagram"
        LINKEDIN = "LINKEDIN", "LinkedIn"
        X = "X", "X (Twitter)"

    class PlatformStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        POSTED = "POSTED", "Posted"
        FAILED = "FAILED", "Failed"

    class ApprovalStatus(models.TextChoices):
        NONE = "NONE", "None"
        REQUESTED = "REQUESTED", "Requested"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    draft = models.ForeignKey(
        ContentDraft,
        on_delete=models.CASCADE,
        related_name="platforms"
    )
    platform = models.CharField(
        max_length=20,
        choices=PlatformChoices.choices
    )
    
    image_size = models.CharField(max_length=50, blank=True)
    status = models.CharField(
        max_length=20, 
        choices=PlatformStatus.choices, 
        default=PlatformStatus.PENDING
    )
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.NONE
    )
    
    scheduled_datetime = models.DateTimeField(null=True, blank=True)
    published_datetime = models.DateTimeField(null=True, blank=True)
    external_post_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    caption_text = models.TextField(blank=True)
    hashtags = models.TextField(blank=True)
    cta = models.CharField(max_length=255, blank=True)
    location_id = models.CharField(max_length=255, blank=True)
    first_comment = models.TextField(blank=True)
    is_manually_edited = models.BooleanField(default=False)

    class Meta:
        db_table = "content_draft_platforms"
        unique_together = [("draft", "platform")]

    def __str__(self):
        return f"{self.draft.id} - {self.platform}"





class Approval(TimeStampedUUIDModel):
    class ApprovalState(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    draft = models.ForeignKey(
        ContentDraft,
        on_delete=models.CASCADE,
        related_name="approvals"
    )
    status = models.CharField(
        max_length=20,
        choices=ApprovalState.choices,
        default=ApprovalState.REQUESTED
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="content_reviews"
    )
    review_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "content_approvals"
        ordering = ["-created_at"]


class ImageReference(TimeStampedUUIDModel):
    platform = models.ForeignKey(
        ContentPlatform,
        on_delete=models.CASCADE,
        related_name="images"
    )
    asset = models.ForeignKey(
        "asset_library.Asset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="content_images"
    )

    class Meta:
        db_table = "content_image_references"


class ImageCreditRate(TimeStampedUUIDModel):
    """Database-configurable AI credit pricing per model and quality tier."""

    provider = models.CharField(max_length=32, db_index=True)
    model_key = models.CharField(max_length=64, db_index=True)
    quality = models.CharField(max_length=16, db_index=True)
    credits = models.PositiveIntegerField()
    reference_image_surcharge = models.PositiveIntegerField(
        default=0,
        help_text="Extra credits charged per injected brand logo/reference image.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "content_image_credit_rates"
        unique_together = [("provider", "model_key", "quality")]
        ordering = ["model_key", "quality"]

    def __str__(self):
        return f"{self.model_key} ({self.quality}): {self.credits} credits"


class ImageGenerationJob(TimeStampedUUIDModel):
    """Audit, idempotency, and history record for every AI image generation."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="image_generation_jobs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="image_generation_jobs",
    )
    draft = models.ForeignKey(
        ContentDraft,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="image_jobs",
    )
    asset = models.ForeignKey(
        "asset_library.Asset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generation_jobs",
    )
    idempotency_key = models.CharField(max_length=128, blank=True, db_index=True)
    prompt = models.TextField()
    final_prompt = models.TextField(blank=True)
    brand_identity_applied = models.BooleanField(default=False)
    brand_identity_snapshot = models.JSONField(default=dict, blank=True)
    reference_image_count = models.PositiveIntegerField(default=0)
    provider = models.CharField(max_length=32, db_index=True)
    model_key = models.CharField(max_length=64, db_index=True)
    provider_model_id = models.CharField(max_length=128, blank=True)
    quality = models.CharField(max_length=16)
    aspect_ratio = models.CharField(max_length=16)
    mapped_parameters = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    estimated_credits = models.PositiveIntegerField(default=0)
    charged_credits = models.PositiveIntegerField(default=0)
    refunded_credits = models.PositiveIntegerField(default=0)
    image_url = models.URLField(max_length=2048, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "content_image_generation_jobs"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "idempotency_key"],
                condition=~models.Q(idempotency_key=""),
                name="uniq_content_image_job_idempotency",
            )
        ]

    def __str__(self):
        return f"{self.model_key} [{self.quality} {self.aspect_ratio}] - {self.status}"
