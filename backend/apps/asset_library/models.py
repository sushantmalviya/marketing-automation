from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel


class Asset(TimeStampedUUIDModel):
    class AssetType(models.TextChoices):
        IMAGE = "IMAGE", "Image"
        DOCUMENT = "DOCUMENT", "Document"
        VIDEO = "VIDEO", "Video"
        OTHER = "OTHER", "Other"


    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_assets"
    )

    name = models.CharField(max_length=255, db_index=True)
    file_url = models.URLField(max_length=2048)
    asset_type = models.CharField(max_length=20, choices=AssetType.choices, default=AssetType.OTHER)
    
    is_personal = models.BooleanField(
        default=False,
        help_text="If True, only the uploaded_by user can view this."
    )

    path = models.CharField(
        max_length=1024,
        default="/",
        db_index=True,
        help_text="Virtual folder path, e.g. /images/campaign2024/"
    )
    
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="List of string tags"
    )

    class Meta:
        db_table = "assets"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
