import logging
from django.core.exceptions import ObjectDoesNotExist
from apps.common.models import atomic_transaction
from ..models import ContentDraft, ContentDraftVersion, ContentPlatform

logger = logging.getLogger(__name__)

class ContentDraftService:
    @staticmethod
    def create_content_draft(
        user,
        original_prompt="",
        platforms=None,
        preset_image_id=None,
        content_type="SOCIAL",
        image_model="google_nano_banana",
        image_quality="STANDARD",
        image_aspect_ratio="1:1",
    ) -> ContentDraft:
        """
        Creates a new ContentDraft and its related platforms.
        `platforms` is a list of PlatformChoices strings.
        """
        with atomic_transaction():
            draft = ContentDraft.objects.create(
                owner=user,
                content_type=content_type,
                original_prompt=original_prompt,
                image_model=image_model,
                image_quality=image_quality,
                image_aspect_ratio=image_aspect_ratio,
                workflow_state=ContentDraft.WorkflowState.DRAFT
            )
            
            # If preset_image_id is provided, try to fetch the asset
            preset_asset = None
            if preset_image_id:
                from apps.asset_library.models import Asset
                try:
                    preset_asset = Asset.objects.get(id=preset_image_id)
                except ObjectDoesNotExist:
                    logger.warning(f"Preset image {preset_image_id} not found.")

            for platform_name in (platforms or []):
                platform = ContentPlatform.objects.create(
                    draft=draft,
                    platform=platform_name
                )
                
                if preset_asset:
                    from ..models import ImageReference
                    ImageReference.objects.create(
                        platform=platform,
                        asset=preset_asset
                    )
                
            logger.info(f"Created ContentDraft {draft.id} with platforms {platforms}")
            return draft

    @staticmethod
    def update_content_partial(draft, update_fields):
        """
        Handles partial updates efficiently, e.g., for autosaving.
        `update_fields` is a dict of fields to update on the draft.
        """
        allowed_fields = {'original_prompt', 'enhanced_prompt', 'image_model', 'image_quality', 'image_aspect_ratio'}
        
        to_save = False
        for field, value in update_fields.items():
            if field in allowed_fields:
                setattr(draft, field, value)
                to_save = True
                
        if to_save:
            draft.save(update_fields=list(update_fields.keys()))
            logger.info(f"Autosaved ContentDraft {draft.id}")
            
        return draft

    @staticmethod
    def create_content_version(draft, user, reason="") -> ContentDraftVersion:
        """
        Captures a snapshot of the current enhanced_prompt into a ContentDraftVersion.
        """
        with atomic_transaction():
            draft.current_version += 1
            draft.save(update_fields=['current_version'])
            
            version = ContentDraftVersion.objects.create(
                draft=draft,
                version_number=draft.current_version,
                enhanced_prompt_snapshot=draft.enhanced_prompt,
                regeneration_reason=reason,
                created_by=user
            )
            
            logger.info(f"Created version {version.version_number} for ContentDraft {draft.id}")
            return version
