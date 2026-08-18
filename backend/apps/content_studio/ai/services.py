import logging
from django.db import transaction
from .orchestrator import AIOrchestrator
from apps.billing.services import BillingService
from ..models import ContentDraft, BrandVoice, ImageReference
from ..services.content_draft_service import ContentDraftService

logger = logging.getLogger(__name__)

class AILifecycleService:
    """
    Coordinates the higher-level lifecycle of an AI operation.
    Manages billing deductions and version tracking around the AIOrchestrator calls.
    """
    
    def __init__(self):
        self.orchestrator = AIOrchestrator()
        
    def _get_brand_identity(self) -> dict:
        try:
            bv = BrandVoice.objects.first()
            if bv:
                return {
                    "brand_description": bv.brand_description,
                    "target_audience": bv.target_audience,
                    "tone": bv.tone,
                    "content_pillars": bv.content_pillars,
                    "unique_value": bv.unique_value,
                    "guidelines": bv.guidelines,
                    "call_to_action": bv.call_to_action
                }
            return {}
        except Exception:
            return {}

    @transaction.atomic
    def process_content_spec_and_questions(self, user_prompt: str) -> dict:
        """
        Deducts credits, extracts the spec, and generates questions in one workflow step.
        Uses a single combined Gemini call instead of two sequential ones for faster response.
        """
        BillingService.consume_credits(
            amount=5,
            description="Extracted content spec and generated questions"
        )

        brand_identity = self._get_brand_identity()
        result = self.orchestrator.extract_spec_and_questions(user_prompt, brand_identity)

        return {
            "content_spec": result["content_spec"],
            "questions": result["questions"],
        }

    @transaction.atomic
    def enhance_content_prompt(self, draft: ContentDraft, content_spec: dict, user_answers: dict, user):
        """
        Merges the content spec and user answers into an enhanced prompt string.
        Uses fast local string merging — no extra AI call needed here.
        The expensive AI work already happened in process_content_spec_and_questions.
        """
        BillingService.consume_credits(
            amount=3,
            description=f"Enhanced prompt for ContentDraft {draft.id}",
            reference_id=str(draft.id)
        )

        enhanced_prompt = self._merge_spec_and_answers(content_spec, user_answers)

        # Update draft
        draft.enhanced_prompt = enhanced_prompt
        draft.save(update_fields=['enhanced_prompt'])

        # Capture Version
        version = ContentDraftService.create_content_version(draft, user, reason="Prompt Enhancement")

        return enhanced_prompt, version

    @staticmethod
    def _merge_spec_and_answers(content_spec: dict, user_answers: dict) -> str:
        """
        Deterministically merge spec fields and user answers into a concise
        Key = Value prompt string. No AI call — instant execution.
        """
        lines = []

        # Spec fields first
        for key, value in content_spec.items():
            if value is None or value == "" or value == []:
                continue
            clean_key = str(key).replace("_", " ").title()
            clean_val = ", ".join(value) if isinstance(value, list) else str(value)
            lines.append(f"{clean_key} = {clean_val}")

        # User answers override / supplement
        for question, answer in user_answers.items():
            if not answer or answer == [] or answer == "":
                continue
            # Derive a short key from the question (first 4 words)
            words = str(question).strip().rstrip("?").split()
            short_key = " ".join(words[:5]).title() if len(words) > 3 else str(question).rstrip("?").title()
            clean_val = ", ".join(answer) if isinstance(answer, list) else str(answer)
            lines.append(f"{short_key} = {clean_val}")

        return "\n".join(lines)

    @transaction.atomic
    def generate_image_for_platform(self, platform_record, user, reason="Image Generation"):
        """
        Generates an image for a specific platform and saves a reference.
        """
        draft = platform_record.draft
        
        BillingService.consume_credits(
            amount=10,
            description=f"Generated Image for {platform_record.platform}",
            reference_id=str(draft.id)
        )
        
        brand_identity = self._get_brand_identity()
        
        # Determine size logic based on platform
        size = platform_record.image_size or "1024x1024"
        
        image_url = self.orchestrator.build_and_generate_image(
            enhanced_prompt=draft.enhanced_prompt,
            brand_identity=brand_identity,
            platform=platform_record.platform,
            size=size,
            reason=reason if reason != "Image Generation" else ""
        )
        
        # Capture version snapshot since content changed
        ContentDraftService.create_content_version(draft, user, reason=reason)
        
        # In a real system, we'd upload `image_url` to Asset Library.
        # Now we create an Asset object with the local url.
        from apps.asset_library.models import Asset
        
        asset = Asset.objects.create(
            uploaded_by=user,
            name=f"Generated Image for {platform_record.platform}",
            file_url=image_url,
            asset_type=Asset.AssetType.IMAGE
        )
        
        image_ref = ImageReference.objects.create(
            platform=platform_record,
            asset=asset
        )
        
        return image_url, image_ref

    @transaction.atomic
    def generate_shared_image_for_draft(self, draft, user, reason="Image Generation"):
        """
        Generates a single image for the draft and links it to all associated platforms.
        """
        platforms = draft.platforms.all()
        if not platforms:
            return None
            
        BillingService.consume_credits(
            amount=10,
            description=f"Generated Shared Image for Draft {draft.id}",
            reference_id=str(draft.id)
        )
        
        brand_identity = self._get_brand_identity()
        size = "1024x1024" # Default size for shared image
        
        # We can just pass "Multi-Platform" or the first platform name to the orchestrator
        image_url = self.orchestrator.build_and_generate_image(
            enhanced_prompt=draft.enhanced_prompt,
            brand_identity=brand_identity,
            platform="Multi-Platform",
            size=size,
            reason=reason if reason != "Image Generation" else ""
        )
        
        ContentDraftService.create_content_version(draft, user, reason=reason)
        
        from apps.asset_library.models import Asset
        asset = Asset.objects.create(
            uploaded_by=user,
            name=f"Generated Shared Image for Draft {draft.id}",
            file_url=image_url,
            asset_type=Asset.AssetType.IMAGE
        )
        
        image_refs = []
        for platform_record in platforms:
            # Delete old ones to avoid duplicates if regenerating
            platform_record.images.all().delete()
            
            image_refs.append(ImageReference.objects.create(
                platform=platform_record,
                asset=asset
            ))
            
        return image_url, image_refs

    @transaction.atomic
    def generate_caption_for_platform(self, platform_record, user, reason="Caption Generation"):
        """
        Generates a caption for a specific platform.
        """
        draft = platform_record.draft
        
        BillingService.consume_credits(
            amount=5,
            description=f"Generated Caption for {platform_record.platform}",
            reference_id=str(draft.id)
        )
        
        brand_identity = self._get_brand_identity()
        
        caption_text = self.orchestrator.build_and_generate_caption(
            enhanced_prompt=draft.enhanced_prompt,
            platform=platform_record.platform,
            brand_identity=brand_identity,
            reason=reason if reason != "Caption Generation" else ""
        )
        
        # Create or update caption record
        caption, created = Caption.objects.get_or_create(platform=platform_record)
        caption.caption_text = caption_text
        caption.is_manually_edited = False
        caption.save()
        
        # Capture version snapshot
        ContentDraftService.create_content_version(draft, user, reason=reason)
        
        return caption
