from django.db import models
from apps.common.models import TimeStampedUUIDModel


class Wallet(TimeStampedUUIDModel):

    organization = models.OneToOneField(
        "accounts.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="credit_wallet",
    )
    balance = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "wallets"

    def __str__(self):
        org_label = self.organization.name if self.organization_id else "Default"
        return f"Wallet ({org_label}) - Balance: {self.balance}"


class Transaction(TimeStampedUUIDModel):
    class Type(models.TextChoices):
        CREDIT = "CREDIT", "Credit"
        DEBIT = "DEBIT", "Debit"

    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name="transactions"
    )
    transaction_type = models.CharField(
        max_length=10,
        choices=Type.choices,
        db_index=True
    )
    amount = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    reference_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="ID of the related entity (e.g. GeneratedContent ID or Payment ID)"
    )
    idempotency_key = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        help_text="Unique key preventing duplicate debits or refunds."
    )

    class Meta:
        db_table = "billing_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transaction_type} {self.amount}"
