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


