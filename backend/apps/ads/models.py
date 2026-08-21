"""
This module handles all paid advertising entities for the Meta Ads integration.
"""
from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel

class MetaAdAccount(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meta_ad_accounts"
    )
    account_id = models.CharField(
        max_length=255,
        unique=True,
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

    def __str__(self):
        return f"{self.name} ({self.account_id})"


class MetaUserCredential(TimeStampedUUIDModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meta_credential"
    )
    access_token = models.TextField()
    meta_user_id = models.CharField(max_length=255, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ACTIVE')

    class Meta:
        db_table = "ads_meta_credentials"

