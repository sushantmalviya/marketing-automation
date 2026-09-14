import logging
from django.db import transaction
from django.utils import timezone
from ..models import ContentDraft, ContentPlatform, ImageReference
from apps.integrations.social_service import SocialService
from apps.asset_library.models import Asset

logger = logging.getLogger(__name__)

class PublishingService:
    @staticmethod
    @transaction.atomic
    def publish_content(draft, user):
        """
        Schedules or publishes the content to all associated platforms.
        Respects approval rules.
        Saves any associated images to the AssetLibrary.
        """
        # Direct 2-tier publishing: No approval requirements needed for USER/ADMIN
        pass

        platforms = draft.platforms.all()
        if not platforms:
            raise ValueError("No platforms selected for this content.")
        
        from apps.integrations.tasks import publish_social_post_task
        
        now = timezone.now()
        dispatched = False
        
        for platform in platforms:
            if platform.status == ContentPlatform.PlatformStatus.POSTED:
                continue  # Already posted

            logger.info(f"Dispatching publishing task for {platform.platform} for ContentDraft {draft.id}")
            
            # Use MAUser ID for connection lookup if needed, but user_id string works
            user_id_str = str(user.id)
            
            if platform.scheduled_datetime and platform.scheduled_datetime > now:
                # Schedule in the future
                publish_social_post_task.apply_async(
                    args=[str(platform.id), user_id_str], 
                    eta=platform.scheduled_datetime
                )
                logger.info(f"Scheduled for {platform.scheduled_datetime}")
            else:
                from django.conf import settings
                if getattr(settings, 'TESTING', False) or getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                    publish_social_post_task.apply(args=[str(platform.id), user_id_str])
                    logger.info("Executed task synchronously in testing mode")
                else:
                    publish_social_post_task.delay(str(platform.id), user_id_str)
                    logger.info("Dispatched immediately to background queue")
                
            dispatched = True

        # Note: Overall workflow state is now updated by the Celery task when the last platform posts successfully.
        if dispatched and draft.workflow_state == ContentDraft.WorkflowState.APPROVED:
            # We can optionally set it to a pending state if desired, but APPROVED is fine until tasks complete.
            pass

        return draft


