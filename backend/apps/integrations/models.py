from django.db import models
from apps.common.models import TimeStampedUUIDModel


class IntegrationProvider(TimeStampedUUIDModel):
    class ProviderType(models.TextChoices):
        OPENAI = "OPENAI", "OpenAI"
        AWS_S3 = "AWS_S3", "AWS S3"
        FACEBOOK = "FACEBOOK", "Facebook"
        INSTAGRAM = "INSTAGRAM", "Instagram"
        LINKEDIN = "LINKEDIN", "LinkedIn"
        X = "X", "X (Twitter)"
        SMTP = "SMTP", "SMTP"
        AWS_SES = "AWS_SES", "Amazon SES"
        MSG91 = "MSG91", "MSG91"
        META_WHATSAPP = "META_WHATSAPP", "Meta WhatsApp Business Platform"
        FCM = "FCM", "Firebase Cloud Messaging"
        VAPID = "VAPID", "Web Push (VAPID)"



    provider_type = models.CharField(
        max_length=20,
        choices=ProviderType.choices,
        unique=True,
        db_index=True
    )

    credentials = models.JSONField(
        default=dict,
        help_text="Store API keys, secrets, or OAuth tokens here"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "integration_providers"


    def __str__(self):
        return f"{self.provider_type}"

class SocialConnection(TimeStampedUUIDModel):
    class PlatformChoices(models.TextChoices):
        FACEBOOK = "FACEBOOK", "Facebook"
        INSTAGRAM = "INSTAGRAM", "Instagram"
        LINKEDIN = "LINKEDIN", "LinkedIn"
        X = "X", "X (Twitter)"

    class ConnectionStatus(models.TextChoices):
        CONNECTED = "CONNECTED", "Connected"
        EXPIRED = "EXPIRED", "Expired"
        REVOKED = "REVOKED", "Revoked"
        ERROR = "ERROR", "Error"

    user = models.ForeignKey(
        'accounts.MAUser',
        on_delete=models.CASCADE,
        related_name="social_connections"
    )
    
    platform = models.CharField(max_length=20, choices=PlatformChoices.choices, db_index=True)
    platform_account_id = models.CharField(max_length=255, help_text="ID on the external platform")
    account_name = models.CharField(max_length=255, help_text="Display name (e.g. Page Name, Handle)")
    
    encrypted_access_token = models.TextField()
    encrypted_refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    
    connection_status = models.CharField(
        max_length=20, 
        choices=ConnectionStatus.choices,
        default=ConnectionStatus.CONNECTED
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Platform-specific data (e.g. scopes, profile picture URL, page details)"
    )

    class Meta:
        db_table = "integration_social_connections"
        unique_together = [("user", "platform", "platform_account_id")]

    def __str__(self):
        return f"{self.platform} - {self.account_name} ({self.user.user.email})"

    def get_access_token(self):
        from apps.integrations.utils.crypto import decrypt_token
        return decrypt_token(self.encrypted_access_token)

    def get_refresh_token(self):
        from apps.integrations.utils.crypto import decrypt_token
        return decrypt_token(self.encrypted_refresh_token) if self.encrypted_refresh_token else None

    def set_tokens(self, access_token: str, refresh_token: str = None):
        from apps.integrations.utils.crypto import encrypt_token
        self.encrypted_access_token = encrypt_token(access_token)
        if refresh_token:
            self.encrypted_refresh_token = encrypt_token(refresh_token)
        else:
            self.encrypted_refresh_token = None

class PublishLog(TimeStampedUUIDModel):
    class PublishStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    connection = models.ForeignKey(
        SocialConnection,
        on_delete=models.CASCADE,
        related_name="publish_logs"
    )
    
    # We store the draft ID instead of direct FK to keep integrations somewhat decoupled
    # but we can also do a direct FK. Let's do a direct string/UUID to keep it decoupled.
    draft_id = models.CharField(max_length=255, db_index=True)
    platform = models.CharField(max_length=20, choices=SocialConnection.PlatformChoices.choices)
    
    published_at = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(
        max_length=20,
        choices=PublishStatus.choices,
        default=PublishStatus.PENDING
    )
    
    external_post_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    retry_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "integration_publish_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.platform} Log for Draft {self.draft_id} - {self.status}"


