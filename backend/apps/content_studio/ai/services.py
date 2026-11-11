import logging
from django.conf import settings
from apps.common.models import atomic_transaction
from .orchestrator import AIOrchestrator
from .image_generation_service import (
    ImageGenerationService,
    get_brand_voice_for_user,
    serialize_brand_identity,
)
from .image_specs import ImageAspectRatio, ImageModelKey, ImageQuality
from apps.billing.services import BillingService
from ..models import ContentDraft, ImageReference
from ..services.content_draft_service import ContentDraftService

logger = logging.getLogger(__name__)


class AILifecycleService:
    """
    Coordinates the higher-level lifecycle of an AI operation.
    Manages billing deductions and version tracking around the AIOrchestrator and ImageGenerationService calls.
    """

    def __init__(self):
        self.orchestrator = AIOrchestrator()
        self.image_service = ImageGenerationService()

    def _get_brand_identity(self, user=None) -> dict:
        try:
            bv = get_brand_voice_for_user(user) if user is not None else None
            if bv is None and user is None:
                from ..models import BrandVoice
                bv = BrandVoice.objects.first()
            return serialize_brand_identity(bv)
        except Exception:
            return {}

    def process_content_spec_and_questions(self, user_prompt: str, user=None) -> dict:
        """
        Deducts credits, extracts the spec, and generates 10 contextual questions in one workflow step.
        Uses a single combined AI call instead of two sequential ones for faster response.
        """
        with atomic_transaction():
            organization = getattr(user, "organization", None) if user is not None else None
            BillingService.consume_credits(
                amount=5,
                description="Extracted content spec and generated questions",
                organization=organization,
            )

            brand_identity = self._get_brand_identity(user=user)
            result = self.orchestrator.extract_spec_and_questions(user_prompt, brand_identity)

            return {
                "content_spec": result["content_spec"],
                "questions": result["questions"],
            }

    def enhance_content_prompt(self, draft: ContentDraft, content_spec: dict, user_answers: dict, user):
        """
        Merges the content spec and user answers into an enhanced prompt string.
        Uses fast local string merging — no extra AI call needed here.
        """
        with atomic_transaction():
            organization = getattr(user, "organization", None) if user is not None else None
            BillingService.consume_credits(
                amount=3,
                description=f"Enhanced prompt for ContentDraft {draft.id}",
                reference_id=str(draft.id),
                organization=organization,
            )

            enhanced_prompt = self._merge_spec_and_answers(content_spec, user_answers)

            setattr(draft, "enhanced_prompt", enhanced_prompt)
            draft.save(update_fields=["enhanced_prompt"])

            version = ContentDraftService.create_content_version(draft, user, reason="Prompt Enhancement")

            return enhanced_prompt, version

    @staticmethod
    def _merge_spec_and_answers(content_spec: dict, user_answers: dict) -> str:
        """
        Deterministically merge spec fields and user answers into a concise
        Key = Value prompt string. No AI call — instant execution.
        """
        lines = []

        for key, value in content_spec.items():
            if value is None or value == "" or value == []:
                continue
            clean_key = str(key).replace("_", " ").title()
            clean_val = ", ".join(value) if isinstance(value, list) else str(value)
            lines.append(f"{clean_key} = {clean_val}")

        for question, answer in user_answers.items():
            if not answer or answer == [] or answer == "":
                continue
            words = str(question).strip().rstrip("?").split()
            short_key = " ".join(words[:5]).title() if len(words) > 3 else str(question).rstrip("?").title()
            clean_val = ", ".join(answer) if isinstance(answer, list) else str(answer)
            lines.append(f"{short_key} = {clean_val}")

        return "\n".join(lines)

    def generate_image_for_platform(self, platform_record, user, reason="Image Generation", model=None, quality=None, aspect_ratio=None):
        """
        Generates an image for a specific platform and saves a reference.
        Routes to centralized ImageGenerationService when model/quality/aspect_ratio are provided,
        while preserving backward compatibility with legacy callers.
        """
        with atomic_transaction():
            draft = platform_record.draft

            if model or quality or aspect_ratio:
                result = self.image_service.generate_for_user(
                    user=user,
                    prompt=draft.enhanced_prompt or draft.original_prompt,
                    model_key=model or ImageModelKey.GOOGLE_NANO_BANANA,
                    quality=quality or ImageQuality.HIGH,
                    aspect_ratio=aspect_ratio or ImageAspectRatio.RATIO_1_1,
                    draft=draft,
                    platform_records=[platform_record],
                    platform_label=platform_record.platform,
                    reason=reason,
                )
                image_ref = platform_record.images.order_by("-created_at").first()
                return result["image_url"], image_ref

            organization = getattr(user, "organization", None) if user is not None else None
            BillingService.consume_credits(
                amount=10,
                description=f"Generated Image for {platform_record.platform}",
                reference_id=str(draft.id),
                organization=organization,
            )

            brand_identity = self._get_brand_identity(user=user)
            size = platform_record.image_size or "1024x1024"

            image_url = self.orchestrator.build_and_generate_image(
                enhanced_prompt=draft.enhanced_prompt,
                brand_identity=brand_identity,
                platform=platform_record.platform,
                size=size,
                reason=reason if reason != "Image Generation" else "",
            )

            version = ContentDraftService.create_content_version(draft, user, reason=reason)
            setattr(version, "image_url", image_url)
            version.save(update_fields=["image_url", "updated_at"])

            from apps.asset_library.models import Asset

            asset = Asset.objects.create(
                uploaded_by=user,
                name=f"Generated Image for {platform_record.platform}",
                file_url=image_url,
                asset_type=Asset.AssetType.IMAGE,
                path="/ai-generated/",
                tags=["ai-generated", platform_record.platform.lower()],
            )

            image_ref = ImageReference.objects.create(
                platform=platform_record,
                asset=asset,
            )

            return image_url, image_ref

    def generate_shared_image_for_draft(
        self,
        draft,
        user,
        reason="Image Generation",
        model=None,
        quality=None,
        aspect_ratio=None,
        idempotency_key=None,
    ):
        """
        Generates a single shared image for the draft using the centralized ImageGenerationService
        and links the resulting Asset to all associated platforms.
        """
        platforms = list(draft.platforms.all())
        if not platforms:
            return None

        resolved_model = model or getattr(draft, "image_model", None) or ImageModelKey.GOOGLE_NANO_BANANA
        resolved_quality = quality or getattr(draft, "image_quality", None) or ImageQuality.STANDARD
        resolved_ratio = aspect_ratio or getattr(draft, "image_aspect_ratio", None) or ImageAspectRatio.RATIO_1_1

        if (
            getattr(draft, "image_model", None) != resolved_model
            or getattr(draft, "image_quality", None) != resolved_quality
            or getattr(draft, "image_aspect_ratio", None) != resolved_ratio
        ):
            setattr(draft, "image_model", resolved_model)
            setattr(draft, "image_quality", resolved_quality)
            setattr(draft, "image_aspect_ratio", resolved_ratio)
            draft.save(update_fields=["image_model", "image_quality", "image_aspect_ratio", "updated_at"])

        prompt_text = (draft.enhanced_prompt or draft.original_prompt or "").strip()
        if reason and reason not in ("Image Generation", "Initial content generation"):
            prompt_text = f"{prompt_text}\n\nRefinement note: {reason}".strip()

        result = self.image_service.generate_for_user(
            user=user,
            prompt=prompt_text,
            model_key=resolved_model,
            quality=resolved_quality,
            aspect_ratio=resolved_ratio,
            idempotency_key=idempotency_key,
            draft=draft,
            platform_records=platforms,
            platform_label="Multi-Platform",
            reason=reason,
        )

        image_refs = list(ImageReference.objects.filter(platform__in=platforms, asset=result["asset"]))
        return result["image_url"], image_refs

    def generate_caption_for_platform(self, platform_record, user, reason="Caption Generation"):
        """
        Generates a caption for a specific platform and persists it on ContentPlatform.
        """
        with atomic_transaction():
            draft = platform_record.draft
            organization = getattr(user, "organization", None) if user is not None else None
            caption_cost = max(0, int(getattr(settings, "AI_CAPTION_CREDITS_PER_PLATFORM", 5)))

            BillingService.consume_credits(
                amount=caption_cost,
                description=f"Generated Caption for {platform_record.platform}",
                reference_id=str(draft.id),
                organization=organization,
            )

            brand_identity = self._get_brand_identity(user=user)

            caption_text = self.orchestrator.build_and_generate_caption(
                enhanced_prompt=draft.enhanced_prompt or draft.original_prompt,
                platform=platform_record.platform,
                brand_identity=brand_identity,
                reason=reason if reason != "Caption Generation" else "",
            )

            platform_record.caption_text = caption_text
            platform_record.is_manually_edited = False
            platform_record.save(update_fields=["caption_text", "is_manually_edited", "updated_at"])

            ContentDraftService.create_content_version(draft, user, reason=reason)

            return platform_record
