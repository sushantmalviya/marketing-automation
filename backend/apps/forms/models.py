import uuid

from django.conf import settings
from django.db import models


class FormStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class FieldType(models.TextChoices):
    TEXT = "text", "Text"
    TEXTAREA = "textarea", "Textarea"
    EMAIL = "email", "Email"
    PHONE = "phone", "Phone"
    NUMBER = "number", "Number"
    DATE = "date", "Date"
    RADIO = "radio", "Radio"
    CHECKBOX = "checkbox", "Checkbox"
    DROPDOWN = "dropdown", "Dropdown"
    FILE = "file", "File Upload"
    IMAGE = "image", "Image"
    URL = "url", "URL"
    SWITCH = "switch", "Switch / Toggle"


class Form(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True
    )

    title = models.CharField(
        max_length=255
    )

    description = models.TextField(
        blank=True
    )

    slug = models.SlugField(
        max_length=255,
        blank=True
    )

    subdomain = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    custom_domain = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    status = models.CharField(
        max_length=20,
        choices=FormStatus.choices,
        default=FormStatus.DRAFT
    )

    allow_multiple_submissions = models.BooleanField(
        default=True
    )

    collect_ip = models.BooleanField(
        default=True
    )

    collect_device = models.BooleanField(
        default=True
    )

    collect_location = models.BooleanField(
        default=False
    )

    submission_limit = models.PositiveIntegerField(
        blank=True,
        null=True
    )

    start_date = models.DateTimeField(
        blank=True,
        null=True
    )

    end_date = models.DateTimeField(
        blank=True,
        null=True
    )

    thank_you_message = models.TextField(
        blank=True
    )

    redirect_url = models.URLField(
        blank=True
    )

    published_at = models.DateTimeField(
        blank=True,
        null=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forms"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    fields_schema = models.JSONField(
        default=list,
        blank=True
    )

    class Meta:
        db_table = "forms"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

class FormSubmission(models.Model):
    form = models.ForeignKey(
        Form,
        on_delete=models.CASCADE,
        related_name="submissions"
    )

    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True
    )

    user_agent = models.TextField(
        blank=True
    )

    submitted_at = models.DateTimeField(
        auto_now_add=True
    )

    answers = models.JSONField(
        default=dict,
        blank=True
    )

    class Meta:
        db_table = "form_submissions"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.form.title} - {self.id}"


