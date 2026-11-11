"""Centralized image model capability registry, parameter mapper, and credit pricing."""

from dataclasses import dataclass
from typing import Any
from django.conf import settings

from .exceptions import UnsupportedImageOptionError


class ImageModelKey:
    GOOGLE_NANO_BANANA = "google_nano_banana"
    OPENAI_GPT_IMAGE_2_5 = "openai_gpt_image_2_5"


class ImageQuality:
    STANDARD = "STANDARD"
    HIGH = "HIGH"
    ULTRA = "ULTRA"


class ImageAspectRatio:
    RATIO_1_1 = "1:1"
    RATIO_4_5 = "4:5"
    RATIO_9_16 = "9:16"
    RATIO_16_9 = "16:9"


VALID_MODEL_KEYS = {
    ImageModelKey.GOOGLE_NANO_BANANA,
    ImageModelKey.OPENAI_GPT_IMAGE_2_5,
}
VALID_QUALITIES = {
    ImageQuality.STANDARD,
    ImageQuality.HIGH,
    ImageQuality.ULTRA,
}
VALID_ASPECT_RATIOS = {
    ImageAspectRatio.RATIO_1_1,
    ImageAspectRatio.RATIO_4_5,
    ImageAspectRatio.RATIO_9_16,
    ImageAspectRatio.RATIO_16_9,
}

MODEL_DISPLAY_LABELS = {
    ImageModelKey.GOOGLE_NANO_BANANA: "Google Nano Banana",
    ImageModelKey.OPENAI_GPT_IMAGE_2_5: "OpenAI GPT Image 2.5",
}

QUALITY_DISPLAY_LABELS = {
    ImageQuality.STANDARD: "Standard",
    ImageQuality.HIGH: "High",
    ImageQuality.ULTRA: "Ultra",
}

# Google Nano Banana (gemini-nano-banana-2.1 / gemini-3.1-flash-image-preview / gemini-3-pro-image)
# supports 1K, 2K, 4K (uppercase K required). Legacy gemini-2.5-flash-image only reliably guarantees 1K.
GOOGLE_MODEL_SUPPORTED_QUALITIES = {
    "gemini-2.5-flash-image": {ImageQuality.STANDARD},
}

GOOGLE_QUALITY_TO_IMAGE_SIZE = {
    ImageQuality.STANDARD: "1K",
    ImageQuality.HIGH: "2K",
    ImageQuality.ULTRA: "4K",
}

# OpenAI GPT Image 2.5 supports quality values: low, medium, high, xhigh, max.
OPENAI_QUALITY_MAP = {
    ImageQuality.STANDARD: "medium",
    ImageQuality.HIGH: "high",
    ImageQuality.ULTRA: "max",
}

# OpenAI GPT Image 2.5 size constraints:
# - Both edges must be exact multiples of 16
# - Max edge <= 3840px, total pixels between 655,360 and 8,294,400
# - Ratios > 2560x1440 are marked experimental by OpenAI, so we keep sizes within stable 16-aligned grids.
OPENAI_SIZE_MAP = {
    ImageQuality.STANDARD: {
        ImageAspectRatio.RATIO_1_1: "1024x1024",
        ImageAspectRatio.RATIO_4_5: "1024x1280",
        ImageAspectRatio.RATIO_9_16: "864x1536",
        ImageAspectRatio.RATIO_16_9: "1536x864",
    },
    ImageQuality.HIGH: {
        ImageAspectRatio.RATIO_1_1: "1536x1536",
        ImageAspectRatio.RATIO_4_5: "1024x1280",
        ImageAspectRatio.RATIO_9_16: "1152x2048",
        ImageAspectRatio.RATIO_16_9: "2048x1152",
    },
    ImageQuality.ULTRA: {
        ImageAspectRatio.RATIO_1_1: "2048x2048",
        ImageAspectRatio.RATIO_4_5: "1280x1600",
        ImageAspectRatio.RATIO_9_16: "1152x2048",
        ImageAspectRatio.RATIO_16_9: "2560x1440",
    },
}

DEFAULT_CREDIT_PRICING = {
    ImageModelKey.GOOGLE_NANO_BANANA: {
        ImageQuality.STANDARD: 5,
        ImageQuality.HIGH: 10,
        ImageQuality.ULTRA: 20,
    },
    ImageModelKey.OPENAI_GPT_IMAGE_2_5: {
        ImageQuality.STANDARD: 8,
        ImageQuality.HIGH: 15,
        ImageQuality.ULTRA: 25,
    },
}


@dataclass(frozen=True)
class ResolvedImageSpec:
    model_key: str
    provider: str
    provider_model_id: str
    quality: str
    aspect_ratio: str
    mapped_parameters: dict[str, Any]
    max_reference_images: int


def get_google_image_model_id() -> str:
    return getattr(settings, "GEMINI_IMAGE_MODEL", "gemini-nano-banana-2.1") or "gemini-nano-banana-2.1"


def get_openai_image_model_id(quality: str) -> str:
    if quality == ImageQuality.ULTRA:
        return getattr(settings, "OPENAI_IMAGE_MODEL_ULTRA", "gpt-image-2.5-sunburst") or "gpt-image-2.5-sunburst"
    if quality == ImageQuality.HIGH:
        return getattr(settings, "OPENAI_IMAGE_MODEL_HIGH", "gpt-image-2.5-flare") or "gpt-image-2.5-flare"
    return getattr(settings, "OPENAI_IMAGE_MODEL_STANDARD", "gpt-image-2.5-flare") or "gpt-image-2.5-flare"


def get_model_capabilities() -> list[dict[str, Any]]:
    """Return frontend-consumable metadata for the strictly allowed options."""
    google_model_id = get_google_image_model_id()
    google_qualities = sorted(
        GOOGLE_MODEL_SUPPORTED_QUALITIES.get(google_model_id, VALID_QUALITIES),
        key=lambda q: ["STANDARD", "HIGH", "ULTRA"].index(q),
    )
    return [
        {
            "key": ImageModelKey.GOOGLE_NANO_BANANA,
            "label": MODEL_DISPLAY_LABELS[ImageModelKey.GOOGLE_NANO_BANANA],
            "provider": "google",
            "provider_model_id": google_model_id,
            "supported_qualities": google_qualities,
            "supported_aspect_ratios": ["1:1", "4:5", "9:16", "16:9"],
        },
        {
            "key": ImageModelKey.OPENAI_GPT_IMAGE_2_5,
            "label": MODEL_DISPLAY_LABELS[ImageModelKey.OPENAI_GPT_IMAGE_2_5],
            "provider": "openai",
            "provider_model_id": get_openai_image_model_id(ImageQuality.STANDARD),
            "supported_qualities": ["STANDARD", "HIGH", "ULTRA"],
            "supported_aspect_ratios": ["1:1", "4:5", "9:16", "16:9"],
        },
    ]


def resolve_image_spec(model_key: str, quality: str, aspect_ratio: str) -> ResolvedImageSpec:
    """Validate requested options against model capabilities and map provider parameters."""
    norm_model = (model_key or "").strip().lower()
    norm_quality = (quality or "").strip().upper()
    norm_ratio = (aspect_ratio or "").strip()

    if norm_model not in VALID_MODEL_KEYS:
        raise UnsupportedImageOptionError(
            f"Unsupported AI model '{model_key}'. Choose Google Nano Banana or OpenAI GPT Image 2.5."
        )
    if norm_quality not in VALID_QUALITIES:
        raise UnsupportedImageOptionError(
            f"Unsupported image quality '{quality}'. Choose Standard, High, or Ultra."
        )
    if norm_ratio not in VALID_ASPECT_RATIOS:
        raise UnsupportedImageOptionError(
            f"Unsupported aspect ratio '{aspect_ratio}'. Supported ratios: 1:1, 4:5, 9:16, 16:9."
        )

    if norm_model == ImageModelKey.GOOGLE_NANO_BANANA:
        provider_model_id = get_google_image_model_id()
        allowed_qualities = GOOGLE_MODEL_SUPPORTED_QUALITIES.get(provider_model_id, VALID_QUALITIES)
        if norm_quality not in allowed_qualities:
            raise UnsupportedImageOptionError(
                f"Configured Google model '{provider_model_id}' does not support '{norm_quality}' quality."
            )
        image_size = GOOGLE_QUALITY_TO_IMAGE_SIZE[norm_quality]
        return ResolvedImageSpec(
            model_key=norm_model,
            provider="google",
            provider_model_id=provider_model_id,
            quality=norm_quality,
            aspect_ratio=norm_ratio,
            mapped_parameters={
                "model": provider_model_id,
                "aspectRatio": norm_ratio,
                "imageSize": image_size,
                "responseModalities": ["IMAGE"],
            },
            max_reference_images=14,
        )

    provider_model_id = get_openai_image_model_id(norm_quality)
    mapped_quality = OPENAI_QUALITY_MAP[norm_quality]
    mapped_size = OPENAI_SIZE_MAP[norm_quality][norm_ratio]
    return ResolvedImageSpec(
        model_key=norm_model,
        provider="openai",
        provider_model_id=provider_model_id,
        quality=norm_quality,
        aspect_ratio=norm_ratio,
        mapped_parameters={
            "model": provider_model_id,
            "size": mapped_size,
            "quality": mapped_quality,
            "output_format": "png",
            "n": 1,
        },
        max_reference_images=16,
    )


class CreditPricingService:
    """Authoritative server-side credit pricing resolver (DB overrides -> Django settings -> defaults)."""

    @staticmethod
    def calculate_cost(
        model_key: str,
        quality: str,
        reference_image_count: int = 0,
    ) -> dict[str, int]:
        norm_model = (model_key or "").strip().lower()
        norm_quality = (quality or "").strip().upper()

        base_credits = None
        surcharge_per_ref = None

        try:
            from apps.content_studio.models import ImageCreditRate

            rate = ImageCreditRate.objects.filter(
                model_key=norm_model,
                quality=norm_quality,
                is_active=True,
            ).first()
            if rate is not None:
                base_credits = int(rate.credits)
                surcharge_per_ref = int(rate.reference_image_surcharge)
        except Exception:
            # Allow fallback to settings when migrations haven't run or DB is unavailable in unit tests
            pass

        if base_credits is None:
            configured_pricing = getattr(settings, "AI_IMAGE_CREDIT_PRICING", DEFAULT_CREDIT_PRICING)
            model_rates = configured_pricing.get(norm_model) or DEFAULT_CREDIT_PRICING.get(norm_model, {})
            if norm_quality not in model_rates:
                raise UnsupportedImageOptionError(
                    f"No credit pricing configured for {norm_model} ({norm_quality})."
                )
            base_credits = int(model_rates[norm_quality])

        if surcharge_per_ref is None:
            surcharge_per_ref = int(getattr(settings, "AI_IMAGE_REFERENCE_SURCHARGE", 2))

        ref_count = max(0, int(reference_image_count or 0))
        reference_surcharge = ref_count * max(0, surcharge_per_ref)
        total_credits = base_credits + reference_surcharge

        return {
            "base_credits": base_credits,
            "reference_surcharge": reference_surcharge,
            "reference_image_count": ref_count,
            "total_credits": total_credits,
        }

