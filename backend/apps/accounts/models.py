import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from .managers import UserManager


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    external_company_id = models.CharField(max_length=255, unique=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("SUSPENDED", "Suspended"),
            ("CANCELLED", "Cancelled"),
            ("RENT_EXPIRED", "Rent Expired"),
        ],
        default="ACTIVE",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.external_company_id})"


class OrganizationSubscription(models.Model):
    RENT_STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("RENT_DUE", "Rent Due"),
        ("EXPIRED", "Expired"),
        ("SUSPENDED", "Suspended"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    rent_status = models.CharField(
        max_length=20,
        choices=RENT_STATUS_CHOICES,
        default="ACTIVE",
    )
    rent_start_date = models.DateTimeField(null=True, blank=True)
    rent_end_date = models.DateTimeField(null=True, blank=True)
    rental_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    wallet_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default="USD")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_rent_valid(self):
        from django.utils import timezone
        if self.rent_status != "ACTIVE":
            return False
        if self.rent_end_date and self.rent_end_date < timezone.now():
            return False
        return True

    def __str__(self):
        return f"Subscription for {self.organization.name} - Status: {self.rent_status}"


class OrganizationUsageLedger(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="usage_ledgers",
    )
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    emails_sent = models.PositiveIntegerField(default=0)
    sms_sent = models.PositiveIntegerField(default=0)
    whatsapp_sent = models.PositiveIntegerField(default=0)
    social_posts_published = models.PositiveIntegerField(default=0)
    ai_images_generated = models.PositiveIntegerField(default=0)
    ai_prompts_processed = models.PositiveIntegerField(default=0)
    total_payg_cost_deducted = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "period_start", "period_end")

    def __str__(self):
        return f"Usage Ledger: {self.organization.name} ({self.period_start.strftime('%Y-%m')})"


class UserUsageLedger(models.Model):
    ACTION_CHOICES = [
        ("EMAIL_SENT", "Email Sent"),
        ("SMS_SENT", "SMS Sent"),
        ("WHATSAPP_SENT", "WhatsApp Sent"),
        ("SOCIAL_POST", "Social Post Published"),
        ("AI_IMAGE_GEN", "AI Image Generated"),
        ("AI_TEXT_GEN", "AI Text Prompt Processed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="user_usage_logs",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usage_logs",
    )
    action_type = models.CharField(max_length=50, choices=ACTION_CHOICES)
    quantity = models.PositiveIntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0.00)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.user} - {self.action_type} x{self.quantity} (${self.total_cost})"


class User(AbstractUser):
    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
    )

    email = models.EmailField(unique=True)

    mobile_no = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users",
    )

    department = models.ForeignKey(
        "common.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class MAUser(models.Model):

    ROLE_CHOICES = [
        ("ADMIN", "Admin"),
        ("USER", "User"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ma_users",
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ma_users",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="USER",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    requires_approval = models.BooleanField(
        default=True,
        help_text="If True, the user's content must be approved before publishing."
    )

    def __str__(self):
        if self.user_id:
            return f"{self.user.email} ({self.role})"
        return "No User"

    
