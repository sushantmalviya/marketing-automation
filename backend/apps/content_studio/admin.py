from django.contrib import admin
from .models import BrandVoice, ImageCreditRate, ImageGenerationJob


@admin.register(BrandVoice)
class BrandVoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "organization", "tone", "include_logo_in_images", "include_reference_images", "updated_at")


@admin.register(ImageCreditRate)
class ImageCreditRateAdmin(admin.ModelAdmin):
    list_display = ("model_key", "provider", "quality", "credits", "reference_image_surcharge", "is_active")
    list_filter = ("provider", "model_key", "quality", "is_active")
    list_editable = ("credits", "reference_image_surcharge", "is_active")


@admin.register(ImageGenerationJob)
class ImageGenerationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "model_key", "quality", "aspect_ratio", "status", "charged_credits", "refunded_credits", "created_at")
    list_filter = ("provider", "model_key", "quality", "aspect_ratio", "status")
    search_fields = ("prompt", "idempotency_key", "user__email")
    readonly_fields = ("created_at", "updated_at")
