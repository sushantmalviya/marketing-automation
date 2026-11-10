"""
This module handles all paid advertising entities for the Meta Ads integration.
"""
from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel

class MetaAdAccount(TimeStampedUUIDModel):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="meta_ad_accounts",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meta_ad_accounts"
    )
    account_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Meta Ad Account ID"
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the Ad Account"
    )
    currency = models.CharField(
        max_length=10,
        default="USD"
    )
    account_status = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )
    amount_spent = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0.00
    )
    is_active = models.BooleanField(
        default=True
    )

    class Meta:
        db_table = "ads_meta_ad_accounts"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "account_id"],
                condition=models.Q(organization__isnull=False),
                name="uniq_meta_ad_account_org_id",
            ),
            models.UniqueConstraint(
                fields=["user", "account_id"],
                condition=models.Q(organization__isnull=True, user__isnull=False),
                name="uniq_meta_ad_account_user_id",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.organization_id is None and self.user_id:
            org_id = getattr(self.user, "organization_id", None)
            if org_id is not None:
                self.organization_id = org_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.account_id})"


class MetaUserCredential(TimeStampedUUIDModel):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="meta_credentials",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meta_credentials"
    )
    access_token = models.TextField()
    meta_user_id = models.CharField(max_length=255, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ACTIVE')

    class Meta:
        db_table = "ads_meta_credentials"
        constraints = [
            models.UniqueConstraint(
                fields=["organization"],
                condition=models.Q(organization__isnull=False),
                name="uniq_meta_credential_org",
            ),
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(organization__isnull=True, user__isnull=False),
                name="uniq_meta_credential_user",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.organization_id is None and self.user_id:
            org_id = getattr(self.user, "organization_id", None)
            if org_id is not None:
                self.organization_id = org_id
        super().save(*args, **kwargs)


class MetaPixelSettings(TimeStampedUUIDModel):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="meta_pixel_settings",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meta_pixel_settings"
    )
    pixel_id = models.CharField(max_length=255, blank=True, null=True)
    access_token = models.TextField(blank=True, null=True)
    test_event_code = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = "ads_meta_pixel_settings"
        constraints = [
            models.UniqueConstraint(
                fields=["organization"],
                condition=models.Q(organization__isnull=False),
                name="uniq_meta_pixel_org",
            ),
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(organization__isnull=True, user__isnull=False),
                name="uniq_meta_pixel_user",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.organization_id is None and self.user_id:
            org_id = getattr(self.user, "organization_id", None)
            if org_id is not None:
                self.organization_id = org_id
        super().save(*args, **kwargs)


class MetaCapiEventLog(TimeStampedUUIDModel):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="meta_capi_event_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meta_capi_event_logs"
    )
    event_name = models.CharField(max_length=100)
    pixel_id = models.CharField(max_length=255)
    test_event_code = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=50, default='Success')
    response_payload = models.JSONField(blank=True, null=True)

    class Meta:
        db_table = "ads_meta_capi_event_logs"

    def save(self, *args, **kwargs):
        if self.organization_id is None and self.user_id:
            org_id = getattr(self.user, "organization_id", None)
            if org_id is not None:
                self.organization_id = org_id
        super().save(*args, **kwargs)


class MetaLeadTrigger(TimeStampedUUIDModel):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="meta_lead_triggers",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meta_lead_triggers"
    )
    page_id = models.CharField(max_length=255)
    page_name = models.CharField(max_length=255)
    page_access_token = models.TextField()
    form_id = models.CharField(max_length=255, default="all")  # "all" or specific form_id
    form_name = models.CharField(max_length=255, default="All Forms")
    is_active = models.BooleanField(default=True)
    last_lead_at = models.DateTimeField(null=True, blank=True)
    leads_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ads_meta_lead_triggers"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "page_id", "form_id"],
                condition=models.Q(organization__isnull=False),
                name="uniq_meta_lead_trigger_org_page_form",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.organization_id is None and self.user_id:
            org_id = getattr(self.user, "organization_id", None)
            if org_id is not None:
                self.organization_id = org_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.page_name} - {self.form_name} ({'Active' if self.is_active else 'Inactive'})"



