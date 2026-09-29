import uuid

from django.conf import settings
from django.db import models


class WhatsAppConnection(models.Model):
    """
    Stores Meta WhatsApp Cloud API credentials per organization.
    Access tokens are encrypted at rest using Fernet symmetric encryption.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    organization = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="whatsapp_connections",
    )
    phone_number_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Meta WhatsApp Phone Number ID",
    )
    encrypted_access_token = models.TextField(
        help_text="Encrypted Meta WhatsApp Access Token",
    )
    is_active = models.BooleanField(
        default=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "whatsapp_connection"
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["phone_number_id"]),
        ]
        unique_together = [("organization", "phone_number_id")]

    def __str__(self):
        return f"WhatsApp Connection: {self.phone_number_id} ({self.organization})"

    def get_access_token(self) -> str:
        """Decrypts and returns the raw access token."""
        from apps.integrations.utils.crypto import decrypt_token
        return decrypt_token(self.encrypted_access_token)

    def set_access_token(self, token: str):
        """Encrypts and stores the access token."""
        from apps.integrations.utils.crypto import encrypt_token
        self.encrypted_access_token = encrypt_token(token)


class CommunicationEvent(models.Model):
    CHANNELS = [
        ("EMAIL", "Email"),
        ("SMS", "SMS"),
        ("WHATSAPP", "WhatsApp"),
        ("NOTIFICATION", "Notification"),
    ]
    STATUSES = [
        ("SENT", "Sent"),
        ("DELIVERED", "Delivered"),
        ("OPENED", "Opened"),
        ("CLICKED", "Clicked"),
        ("READ", "Read"),
        ("REPLIED", "Replied"),
        ("RECEIVED", "Received"),
        ("BOUNCED", "Bounced"),
        ("UNSUBSCRIBED", "Unsubscribed"),
        ("FAILED", "Failed"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    execution = models.ForeignKey(
        "automation.AutomationExecution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="communication_events",
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="communication_events",
    )
    whatsapp_connection = models.ForeignKey(
        WhatsAppConnection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="communication_events",
    )
    channel = models.CharField(
        max_length=30,
        choices=CHANNELS,
        db_index=True,
    )
    event_name = models.CharField(
        max_length=100,
        db_index=True,
    )
    recipient = models.CharField(
        max_length=255,
        db_index=True,
    )
    status = models.CharField(
        max_length=30,
        choices=STATUSES,
        db_index=True,
    )
    provider_message_id = models.CharField(
        max_length=255,
        blank=True,
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        db_table = "communication_event"
        indexes = [
            models.Index(fields=["channel", "status"]),
            models.Index(fields=["event_name"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.channel} - {self.event_name} - {self.recipient}"


class DomainAuthentication(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending Verification"),
        ("VERIFIED", "Verified"),
        ("FAILED", "Verification Failed"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="domain_authentications",
    )
    domain = models.CharField(max_length=255, db_index=True)
    verification_token = models.CharField(max_length=100)
    dns_record_type = models.CharField(max_length=10, default="TXT")
    dns_record_name = models.CharField(max_length=50, default="@")
    dns_record_value = models.CharField(max_length=255)
    dkim_records = models.JSONField(default=list, blank=True)
    dkim_status = models.CharField(max_length=30, default="PENDING")
    mail_from_domain = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="PENDING",
        db_index=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "domain_authentication"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["domain"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["domain"], name="unique_domain_global"),
        ]

    def __str__(self):
        return f"{self.domain} ({self.status})"


class SenderIdentity(models.Model):
    PROVIDER_CHOICES = [
        ("AWS_SES", "Amazon SES (Verified Domain)"),
        ("CUSTOM_SMTP", "Custom SMTP"),
        ("WHATSAPP_CLOUD", "WhatsApp Cloud API"),
        ("TWILIO_SMS", "Twilio SMS"),
        ("CUSTOM_SMS", "Custom SMS Gateway"),
    ]

    CONNECTION_TYPE_CHOICES = [
        ("AWS_SES", "Amazon SES"),
        ("SMTP", "SMTP"),
        ("API_KEY", "API Key / Token"),
    ]

    STATUS_CHOICES = [
        ("CONNECTED", "Connected"),
        ("NOT_CONNECTED", "Not Connected"),
        ("FAILED", "Connection Failed"),
        ("RECONNECT_REQUIRED", "Reconnect Required"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sender_identities",
    )
    domain_auth = models.ForeignKey(
        DomainAuthentication,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sender_identities",
    )
    email = models.EmailField(db_index=True)
    display_name = models.CharField(max_length=255, blank=True, default="")
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES)
    connection_type = models.CharField(max_length=30, choices=CONNECTION_TYPE_CHOICES)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="CONNECTED")
    
    # Store encrypted credentials (tokens, app passwords, host, port, security settings)
    encrypted_credentials = models.JSONField(default=dict, blank=True)
    
    # Meta WhatsApp explicit fields for fast lookup & multi-tenant isolation
    waba_id = models.CharField(max_length=255, blank=True, default="", db_index=True)
    phone_number_id = models.CharField(max_length=255, blank=True, default="", db_index=True)
    business_id = models.CharField(max_length=255, blank=True, default="")
    quality_rating = models.CharField(max_length=50, blank=True, default="")
    verified_name = models.CharField(max_length=255, blank=True, default="")
    code_verification_status = models.CharField(max_length=50, blank=True, default="")
    account_review_status = models.CharField(max_length=50, blank=True, default="")

    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sender_identity"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "provider"]),
            models.Index(fields=["email"]),
            models.Index(fields=["phone_number_id"]),
            models.Index(fields=["waba_id"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.provider}) - {self.status}"



