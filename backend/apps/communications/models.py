import uuid

from django.conf import settings
from django.db import models





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


class SenderIdentity(models.Model):
    PROVIDER_CHOICES = [
        ("GMAIL", "Gmail"),
        ("MICROSOFT", "Microsoft Outlook"),
        ("YAHOO", "Yahoo"),
        ("CUSTOM_SMTP", "Custom SMTP"),
    ]

    CONNECTION_TYPE_CHOICES = [
        ("OAUTH", "OAuth 2.0"),
        ("SMTP", "SMTP"),
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
    email = models.EmailField(db_index=True)
    display_name = models.CharField(max_length=255, blank=True, default="")
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES)
    connection_type = models.CharField(max_length=30, choices=CONNECTION_TYPE_CHOICES)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="CONNECTED")
    
    # Store encrypted credentials (tokens, app passwords, host, port, security settings)
    encrypted_credentials = models.JSONField(default=dict, blank=True)
    
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sender_identity"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "provider"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.provider}) - {self.status}"


