import uuid
from django.db import models
from django.conf import settings

class Contact(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        UNSUBSCRIBED = "Unsubscribed", "Unsubscribed"
        BOUNCED = "Bounced", "Bounced"
        ARCHIVED = "Archived", "Archived"

    class Source(models.TextChoices):
        IMPORT = "imported", "CSV Import"
        FORM = "form", "Form Submission"
        META = "meta", "Meta Ad Lead"
        MANUAL = "manual", "Manual Entry"
        API = "api", "API / Integration"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contacts",
    )

    email = models.EmailField(blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=50, blank=True, default="", db_index=True)
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")
    name = models.CharField(max_length=255, blank=True, default="")

    source = models.CharField(
        max_length=50,
        choices=Source.choices,
        default=Source.MANUAL,
        db_index=True,
    )
    sub_source_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
    )
    sub_source_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
    )
    sub_source_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    score = models.IntegerField(default=50)
    tags = models.JSONField(default=list, blank=True)

    attributes = models.JSONField(default=dict, blank=True)
    initial_upload = models.ForeignKey(
        "CustomerUpload",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contacts",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "contacts"
        unique_together = [("owner", "email")]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "email"]),
            models.Index(fields=["owner", "phone"]),
            models.Index(fields=["status"]),
            models.Index(fields=["source"]),
            models.Index(fields=["sub_source_type", "sub_source_id"]),
        ]

    def __str__(self):
        return f"{self.name or self.email} ({self.owner.email})"



class CustomerUpload(models.Model):
    class Status(models.TextChoices):
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    original_file = models.FileField(
    upload_to="customer_uploads/",
    null=True,
    blank=True,
    )

    file_name = models.CharField(max_length=255)
    file_type = models.CharField(
    max_length=10,
    default="unknown",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_uploads",
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)

    total_records = models.PositiveIntegerField(default=0)
    imported_records = models.PositiveIntegerField(default=0)
    failed_records = models.PositiveIntegerField(default=0)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING,
    )

    def __str__(self):
        return self.file_name


class CustomerRecord(models.Model):
    upload = models.ForeignKey(
        CustomerUpload,
        on_delete=models.CASCADE,
        related_name="records",
    )
    data = models.JSONField()
    routing_logs = models.JSONField(blank=True, default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Record {self.id}"
    


class Campaign(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_APPROVAL = "PENDING_APPROVAL", "Pending Approval"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SCHEDULED = "SCHEDULED", "Scheduled"
        SENDING = "SENDING", "Sending"
        COMPLETED = "COMPLETED", "Completed"
        PAUSED = "PAUSED", "Paused"
        CANCELLED = "CANCELLED", "Cancelled"
        FAILED = "FAILED", "Failed"

    target_audience = models.ForeignKey(
        "campaigns.Audience",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_campaigns",
    )

    name = models.CharField(
        max_length=255,
        db_index=True,
    )

    description = models.TextField(
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="campaigns",
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_campaigns",
        null=True,
        blank=True,
    )

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="submitted_campaigns",
        null=True,
        blank=True,
    )

    rejection_reason = models.TextField(
        blank=True,
        null=True,
    )

    review_comments = models.TextField(
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    is_deleted = models.BooleanField(
        default=False,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    started_at = models.DateTimeField(
        db_column="processing_started_at",
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "campaigns"
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["created_by"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.name
    
class Channel(models.Model):
    """
    Master table for communication channels.
    """

    name = models.CharField(
        max_length=100,
        unique=True,
    )

    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    description = models.TextField(
        blank=True,
        null=True,
    )

    icon = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    display_order = models.PositiveIntegerField(
        default=1,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "channels"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name

class CampaignChannel(models.Model):
    """
    Channels selected for a campaign.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENDING = "SENDING", "Sending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="campaign_channels",
    )

    channel = models.ForeignKey(
        Channel,
        on_delete=models.PROTECT,
        related_name="campaign_channels",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "campaign_channels"

        unique_together = [
            ("campaign", "channel")
        ]

    def __str__(self):
        return f"{self.campaign.name} - {self.channel.name}"
    
class CampaignAudience(models.Model):

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="audience",
    )

    customer = models.ForeignKey(
        CustomerRecord,
        on_delete=models.CASCADE,
        related_name="campaigns",
        null=True,
        blank=True,
    )

    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name="campaigns",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "campaign_audience"

        unique_together = [
            ("campaign", "customer")
        ]

    def __str__(self):
        return f"{self.campaign.name} - Customer {self.customer.id}"
    
class Audience(models.Model):
    """
    Reusable audience definition.
    """

    name = models.CharField(
        max_length=255,
    )

    customer_upload = models.ForeignKey(
        CustomerUpload,
        on_delete=models.SET_NULL,
        related_name="audiences",
        null=True,
        blank=True,
    )

    definition = models.JSONField(
        default=dict,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="audiences",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    class Meta:
        db_table = "audiences"
        ordering = ["name"]

    def __str__(self):
        return self.name
    
class Template(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    name = models.CharField(
        max_length=255,
    )

    channel = models.ForeignKey(
        Channel,
        on_delete=models.PROTECT,
        related_name="templates",
    )

    content_draft = models.ForeignKey(
        "content_studio.ContentDraft",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_templates",
    )

    asset = models.ForeignKey(
        "asset_library.Asset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_templates",
    )

    subject = models.TextField(
        blank=True,
        null=True,
    )

    body = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    provider_data = models.JSONField(
        default=dict,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="templates",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "templates"
        ordering = ["name"]

    def __str__(self):
        return self.name
    
class CampaignTemplate(models.Model):

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="campaign_templates",
    )

    channel = models.ForeignKey(
        Channel,
        on_delete=models.PROTECT,
        related_name="campaign_templates",
    )

    template = models.ForeignKey(
        Template,
        on_delete=models.CASCADE,
        related_name="campaign_templates",
    )

    assigned_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "channel"],
                name="unique_campaign_channel_template",
            )
        ]

    def __str__(self):
        return f"{self.campaign.name} - {self.channel.name}"
    

class CampaignDelivery(models.Model):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        DELIVERED = "DELIVERED", "Delivered"
        FAILED = "FAILED", "Failed"

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )

    customer = models.ForeignKey(
        CustomerRecord,
        on_delete=models.CASCADE,
        related_name="deliveries",
        null=True,
        blank=True,
    )

    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name="deliveries",
        null=True,
        blank=True,
    )

    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )

    rendered_message = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    provider_message_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    error_message = models.TextField(
        blank=True,
        null=True,
    )

    sent_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "campaign_delivery"

        indexes = [
            models.Index(fields=["campaign"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["status"]),
            models.Index(fields=["channel"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "campaign",
                    "customer",
                    "channel",
                ],
                name="unique_campaign_customer_channel",
            ),
        ]
