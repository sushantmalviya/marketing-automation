"""Centralized AI Image Generation Service coordinating Brand Identity, providers, credits, storage, and history."""

from __future__ import annotations

import ipaddress
import logging
import mimetypes
import os
import socket
import uuid
from typing import Any
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction

from apps.accounts.services import UsageMeterService
from apps.asset_library.models import Asset
from apps.billing.services import BillingService

from ..models import BrandVoice, ImageGenerationJob, ImageReference
from ..services.content_draft_service import ContentDraftService
from .exceptions import (
    AIError,
    AIProviderError,
    DuplicateImageRequestError,
)
from .image_specs import (
    CreditPricingService,
    MODEL_DISPLAY_LABELS,
    get_model_capabilities,
    resolve_image_spec,
)
from .prompt_builders.image_prompt import ImagePromptBuilder
from .providers.gemini_provider import GeminiProvider
from .providers.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)

MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB safety ceiling per reference image


def get_brand_voice_for_user(user) -> BrandVoice | None:
    """Resolve the tenant-scoped BrandVoice for a user (with non-org fallback)."""
    organization = getattr(user, "organization", None)
    if organization is not None:
        return BrandVoice.objects.filter(organization=organization).first()
    return BrandVoice.objects.filter(organization__isnull=True).order_by("created_at").first()


def serialize_brand_identity(brand_voice: BrandVoice | None) -> dict[str, Any]:
    if not brand_voice:
        return {}
    return {
        "brand_description": brand_voice.brand_description or "",
        "target_audience": brand_voice.target_audience or "",
        "tone": brand_voice.tone or "",
        "content_pillars": brand_voice.content_pillars or "",
        "unique_value": brand_voice.unique_value or "",
        "guidelines": brand_voice.guidelines or "",
        "call_to_action": brand_voice.call_to_action or "",
        "logo_url": brand_voice.logo_url or (brand_voice.logo_asset.file_url if brand_voice.logo_asset_id else ""),
        "logo_asset_id": str(brand_voice.logo_asset_id) if brand_voice.logo_asset_id else None,
        "include_logo_in_images": bool(brand_voice.include_logo_in_images),
        "reference_images": list(brand_voice.reference_images or []),
        "include_reference_images": bool(brand_voice.include_reference_images),
        "brand_colors": list(brand_voice.brand_colors or []),
        "visual_style": brand_voice.visual_style or "",
    }


def _has_meaningful_brand_identity(brand_dict: dict[str, Any]) -> bool:
    return any(
        [
            bool(brand_dict.get("brand_description")),
            bool(brand_dict.get("target_audience")),
            bool(brand_dict.get("tone")),
            bool(brand_dict.get("guidelines")),
            bool(brand_dict.get("visual_style")),
            bool(brand_dict.get("brand_colors")),
            bool(brand_dict.get("include_logo_in_images") and brand_dict.get("logo_url")),
            bool(brand_dict.get("include_reference_images") and brand_dict.get("reference_images")),
        ]
    )


def _get_configured_reference_entries(brand_dict: dict[str, Any], max_items: int = 14) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    if brand_dict.get("include_logo_in_images") and brand_dict.get("logo_url"):
        entries.append({"url": brand_dict["logo_url"], "label": "brand_logo"})

    if brand_dict.get("include_reference_images"):
        for idx, item in enumerate(brand_dict.get("reference_images") or []):
            if isinstance(item, dict) and item.get("url"):
                entries.append({"url": item["url"], "label": f"brand_ref_{idx + 1}"})
            elif isinstance(item, str) and item.strip():
                entries.append({"url": item.strip(), "label": f"brand_ref_{idx + 1}"})

    return entries[:max_items]


def _is_safe_remote_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "127.0.0.1", "::1"}:
        # Allow explicit PUBLIC_URL host in dev/testing if needed, block arbitrary local loopback
        public_host = urlparse(getattr(settings, "PUBLIC_URL", "")).hostname
        if not public_host or hostname != public_host.lower():
            return False
    try:
        ip_obj = ipaddress.ip_address(hostname)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
            return False
    except ValueError:
        try:
            for info in socket.getaddrinfo(hostname, None):
                addr = info[4][0]
                ip_obj = ipaddress.ip_address(addr)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                    return False
        except OSError:
            return False
    return True


def _load_reference_image_bytes(url: str, label: str) -> tuple[bytes, str, str]:
    """Load reference image bytes either from local media storage or safe HTTPS URL."""
    media_url = getattr(settings, "MEDIA_URL", "/media/") or "/media/"
    parsed = urlparse(url)

    # Local storage path (e.g. /media/assets/foo.png or http://localhost:8000/media/...)
    if url.startswith(media_url) or (parsed.path and parsed.path.startswith(media_url)):
        rel_path = (parsed.path if parsed.path else url)[len(media_url):].lstrip("/")
        if ".." in rel_path.split("/"):
            raise AIProviderError("Invalid brand reference image path.")
        if default_storage.exists(rel_path):
            with default_storage.open(rel_path, "rb") as fh:
                data = fh.read(MAX_REFERENCE_IMAGE_BYTES + 1)
            if len(data) > MAX_REFERENCE_IMAGE_BYTES:
                raise AIProviderError("Brand reference image exceeds maximum 10 MB size.")
            mime_type, _ = mimetypes.guess_type(rel_path)
            return data, mime_type or "image/png", label

    if not _is_safe_remote_url(url):
        raise AIProviderError(f"Unsupported or unsafe brand reference image URL for {label}.")

    try:
        resp = requests.get(url, timeout=20, stream=True)
        resp.raise_for_status()
        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type and not content_type.startswith("image/"):
            raise AIProviderError(f"Brand reference '{label}' did not return an image content type.")
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=65536):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_REFERENCE_IMAGE_BYTES:
                raise AIProviderError("Brand reference image exceeds maximum 10 MB size.")
            chunks.append(chunk)
        data = b"".join(chunks)
        if not data:
            raise AIProviderError(f"Empty response when loading brand reference '{label}'.")
        mime_type = content_type or mimetypes.guess_type(parsed.path)[0] or "image/png"
        return data, mime_type, label
    except AIProviderError:
        raise
    except requests.RequestException as exc:
        raise AIProviderError(f"Failed to download brand reference '{label}': {exc}") from exc


class ImageGenerationService:
    """
    Single centralized service for AI image estimation, credit deduction,
    Brand Identity integration, provider dispatch, storage persistence, and refunds.
    """

    def __init__(self, gemini_provider=None, openai_provider=None):
        self.gemini_provider = gemini_provider or GeminiProvider()
        self.openai_provider = openai_provider or OpenAIProvider()
        self.prompt_builder = ImagePromptBuilder()

    @staticmethod
    def estimate_for_user(
        *,
        user,
        model_key: str,
        quality: str,
        aspect_ratio: str,
        generate_image: bool = True,
        caption_count: int = 0,
    ) -> dict[str, Any]:
        spec = resolve_image_spec(model_key=model_key, quality=quality, aspect_ratio=aspect_ratio)
        brand_voice = get_brand_voice_for_user(user)
        brand_dict = serialize_brand_identity(brand_voice)
        ref_entries = _get_configured_reference_entries(brand_dict, max_items=spec.max_reference_images)

        if generate_image:
            pricing = CreditPricingService.calculate_cost(
                model_key=spec.model_key,
                quality=spec.quality,
                reference_image_count=len(ref_entries),
            )
            image_credits = pricing["total_credits"]
            base_credits = pricing["base_credits"]
            reference_surcharge = pricing["reference_surcharge"]
            ref_count = pricing["reference_image_count"]
        else:
            image_credits = 0
            base_credits = 0
            reference_surcharge = 0
            ref_count = 0

        caption_unit_credits = max(0, int(getattr(settings, "AI_CAPTION_CREDITS_PER_PLATFORM", 5)))
        safe_caption_count = max(0, int(caption_count or 0))
        caption_credits = safe_caption_count * caption_unit_credits
        total_credits = image_credits + caption_credits

        organization = getattr(user, "organization", None)
        balance = BillingService.get_balance(organization=organization)

        return {
            "model": spec.model_key,
            "model_label": MODEL_DISPLAY_LABELS[spec.model_key],
            "provider": spec.provider,
            "provider_model_id": spec.provider_model_id,
            "quality": spec.quality,
            "aspect_ratio": spec.aspect_ratio,
            "mapped_parameters": spec.mapped_parameters,
            "credits": total_credits,
            "image_credits": image_credits,
            "caption_credits": caption_credits,
            "caption_count": safe_caption_count,
            "caption_unit_credits": caption_unit_credits,
            "base_credits": base_credits,
            "reference_surcharge": reference_surcharge,
            "reference_image_count": ref_count,
            "wallet_balance": balance,
            "sufficient_credits": balance >= total_credits,
            "remaining_after_generation": max(0, balance - total_credits),
            "brand_identity_active": _has_meaningful_brand_identity(brand_dict),
            "brand_logo_injected": bool(brand_dict.get("include_logo_in_images") and brand_dict.get("logo_url")),
            "brand_reference_count": len(ref_entries),
            "capabilities": get_model_capabilities(),
        }

    def generate_for_user(
        self,
        *,
        user,
        prompt: str,
        model_key: str,
        quality: str,
        aspect_ratio: str,
        idempotency_key: str | None = None,
        draft=None,
        platform_records=None,
        platform_label: str | None = None,
        reason: str = "AI Image Generation",
    ) -> dict[str, Any]:
        clean_prompt = (prompt or "").strip()
        if not clean_prompt:
            raise AIProviderError("Image prompt cannot be empty.")

        clean_idem = (idempotency_key or "").strip() or uuid.uuid4().hex
        spec = resolve_image_spec(model_key=model_key, quality=quality, aspect_ratio=aspect_ratio)

        # 1. Idempotency check BEFORE charging credits or calling provider
        existing_job = ImageGenerationJob.objects.filter(user=user, idempotency_key=clean_idem).first()
        if existing_job:
            if existing_job.status == ImageGenerationJob.Status.COMPLETED:
                organization = getattr(user, "organization", None)
                return {
                    "job": existing_job,
                    "asset": existing_job.asset,
                    "image_url": existing_job.image_url,
                    "credits_charged": existing_job.charged_credits,
                    "remaining_balance": BillingService.get_balance(organization=organization),
                    "deduplicated": True,
                }
            if existing_job.status == ImageGenerationJob.Status.PENDING:
                raise DuplicateImageRequestError(
                    "An image generation request with this idempotency key is already in progress."
                )

        # 2. Compute authoritative cost server-side (never trust client calculations)
        brand_voice = get_brand_voice_for_user(user)
        brand_dict = serialize_brand_identity(brand_voice)
        ref_entries = _get_configured_reference_entries(brand_dict, max_items=spec.max_reference_images)

        pricing = CreditPricingService.calculate_cost(
            model_key=spec.model_key,
            quality=spec.quality,
            reference_image_count=len(ref_entries),
        )
        total_cost = pricing["total_credits"]
        organization = getattr(user, "organization", None)

        has_logo_ref = any(e["label"] == "brand_logo" for e in ref_entries)
        extra_ref_count = sum(1 for e in ref_entries if e["label"] != "brand_logo")
        final_prompt = self.prompt_builder.build(
            user_prompt=clean_prompt,
            brand_identity=brand_dict,
            platform=platform_label,
            aspect_ratio=spec.aspect_ratio,
            has_logo_reference=has_logo_ref,
            reference_count=extra_ref_count,
        )
        brand_applied = _has_meaningful_brand_identity(brand_dict)

        # 3. Short atomic DB transaction: create job & reserve/debit credits, then release lock
        try:
            with transaction.atomic():
                job = ImageGenerationJob.objects.create(
                    organization=organization,
                    user=user,
                    draft=draft,
                    idempotency_key=clean_idem,
                    prompt=clean_prompt,
                    final_prompt=final_prompt,
                    brand_identity_applied=brand_applied,
                    brand_identity_snapshot=brand_dict if brand_applied else {},
                    reference_image_count=len(ref_entries),
                    provider=spec.provider,
                    model_key=spec.model_key,
                    provider_model_id=spec.provider_model_id,
                    quality=spec.quality,
                    aspect_ratio=spec.aspect_ratio,
                    mapped_parameters=spec.mapped_parameters,
                    status=ImageGenerationJob.Status.PENDING,
                    estimated_credits=total_cost,
                )

                BillingService.consume_credits(
                    amount=total_cost,
                    description=(
                        f"AI Image ({MODEL_DISPLAY_LABELS[spec.model_key]}, "
                        f"{spec.quality}, {spec.aspect_ratio})"
                    ),
                    reference_id=str(job.id),
                    organization=organization,
                    idempotency_key=f"img_debit:{job.id}",
                )
                job.charged_credits = total_cost
                job.save(update_fields=["charged_credits", "updated_at"])
        except IntegrityError as exc:
            existing = ImageGenerationJob.objects.filter(user=user, idempotency_key=clean_idem).first()
            if existing and existing.status == ImageGenerationJob.Status.COMPLETED:
                return {
                    "job": existing,
                    "asset": existing.asset,
                    "image_url": existing.image_url,
                    "credits_charged": existing.charged_credits,
                    "remaining_balance": BillingService.get_balance(organization=organization),
                    "deduplicated": True,
                }
            raise DuplicateImageRequestError("Duplicate image generation request detected.") from exc

        # 4. Perform slow external I/O outside transaction; refund atomically on any failure
        try:
            loaded_refs: list[tuple[bytes, str, str]] = [
                _load_reference_image_bytes(entry["url"], entry["label"]) for entry in ref_entries
            ]

            if spec.provider == "google":
                image_bytes, mime_type = self.gemini_provider.generate_image_bytes(
                    final_prompt,
                    model_id=spec.provider_model_id,
                    aspect_ratio=spec.mapped_parameters["aspectRatio"],
                    image_size=spec.mapped_parameters["imageSize"],
                    reference_images=loaded_refs or None,
                )
            else:
                image_bytes, mime_type = self.openai_provider.generate_image_bytes(
                    final_prompt,
                    model_id=spec.provider_model_id,
                    size=spec.mapped_parameters["size"],
                    quality=spec.mapped_parameters["quality"],
                    output_format=spec.mapped_parameters["output_format"],
                    reference_images=loaded_refs or None,
                )

            extension = "jpg" if "jpeg" in mime_type else ("webp" if "webp" in mime_type else "png")
            saved_path = default_storage.save(
                f"generated_images/{uuid.uuid4()}.{extension}",
                ContentFile(image_bytes),
            )
            image_url = default_storage.url(saved_path)

            asset_name = f"{MODEL_DISPLAY_LABELS[spec.model_key]} - {clean_prompt[:60]}"
            tags = [
                "ai-generated",
                spec.provider,
                spec.model_key,
                spec.quality.lower(),
                spec.aspect_ratio,
            ]
            if brand_applied:
                tags.append("brand-identity")

            with transaction.atomic():
                asset = Asset.objects.create(
                    uploaded_by=user,
                    name=asset_name[:255],
                    file_url=image_url,
                    asset_type=Asset.AssetType.IMAGE,
                    path="/ai-generated/",
                    tags=tags,
                )
                job.status = ImageGenerationJob.Status.COMPLETED
                job.asset = asset
                job.image_url = image_url
                job.save(update_fields=["status", "asset", "image_url", "updated_at"])

                if draft is not None:
                    version = ContentDraftService.create_content_version(draft, user, reason=reason)
                    version.image_url = image_url
                    version.save(update_fields=["image_url", "updated_at"])

                    if platform_records:
                        for platform_record in platform_records:
                            platform_record.images.all().delete()
                            ImageReference.objects.create(platform=platform_record, asset=asset)

            # Usage reporting ledger (non-blocking if organization is absent)
            try:
                UsageMeterService.record_usage(
                    user=user,
                    action_type="AI_IMAGE_GEN",
                    quantity=1,
                    unit_cost=0.0,
                    metadata={
                        "job_id": str(job.id),
                        "provider": spec.provider,
                        "model_key": spec.model_key,
                        "provider_model_id": spec.provider_model_id,
                        "quality": spec.quality,
                        "aspect_ratio": spec.aspect_ratio,
                        "credits_charged": total_cost,
                    },
                )
            except Exception as usage_exc:
                logger.warning("Non-fatal usage meter logging failure for job %s: %s", job.id, usage_exc)

            return {
                "job": job,
                "asset": asset,
                "image_url": image_url,
                "credits_charged": total_cost,
                "remaining_balance": BillingService.get_balance(organization=organization),
                "deduplicated": False,
            }

        except Exception as exc:
            # Always refund charged credits on failed generation
            try:
                BillingService.refund_credits(
                    amount=total_cost,
                    description=(
                        f"Automatic refund for failed {MODEL_DISPLAY_LABELS[spec.model_key]} "
                        f"image generation"
                    ),
                    reference_id=str(job.id),
                    organization=organization,
                    idempotency_key=f"img_refund:{job.id}",
                )
                job.refunded_credits = total_cost
            except Exception as refund_exc:
                logger.exception("Failed to refund credits for job %s: %s", job.id, refund_exc)

            job.status = ImageGenerationJob.Status.FAILED
            job.error_message = str(exc)
            job.save(update_fields=["status", "refunded_credits", "error_message", "updated_at"])

            # Attach refund context so API view can communicate clearly
            setattr(exc, "job_id", str(job.id))
            setattr(exc, "refunded", job.refunded_credits > 0)
            setattr(exc, "refunded_credits", job.refunded_credits)
            setattr(exc, "remaining_balance", BillingService.get_balance(organization=organization))
            raise

