import logging
from celery import shared_task
from django.utils import timezone
from apps.content_studio.models import ContentPlatform, ContentDraft
from apps.integrations.models import SocialConnection, PublishLog
from apps.integrations.providers.factory import ProviderFactory

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def publish_social_post_task(self, platform_record_id: str, user_id: str):
    """
    Background task to publish a social media post to a specific platform.
    """
    try:
        platform_record = ContentPlatform.objects.select_related('draft', 'caption').get(id=platform_record_id)
        draft = platform_record.draft
    except ContentPlatform.DoesNotExist:
        logger.error(f"ContentPlatform {platform_record_id} not found.")
        return

    if platform_record.status == ContentPlatform.PlatformStatus.POSTED:
        logger.info(f"Platform {platform_record_id} already posted.")
        return

    log = None
    try:
        # Resolve the tenant owner
        from django.contrib.auth import get_user_model
        from apps.common.ownership import get_tenant_owner_profile
        User = get_user_model()
        user = User.objects.filter(id=user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
            
        tenant_owner = get_tenant_owner_profile(user)
        if not tenant_owner:
            raise ValueError(f"No tenant owner found for user {user_id}")

        connection = SocialConnection.objects.filter(
            user=tenant_owner, 
            platform=platform_record.platform
        ).first()

        if not connection:
            raise ValueError(f"No SocialConnection found for tenant owner {tenant_owner.id} and platform {platform_record.platform}")

        # Create initial PublishLog
        log = PublishLog.objects.create(
            connection=connection,
            draft_id=str(draft.id),
            platform=platform_record.platform,
            status=PublishLog.PublishStatus.PENDING
        )

        provider = ProviderFactory.get_provider(platform_record.platform)
        if not provider:
            raise ValueError(f"Provider not found for {platform_record.platform}")

        # Check for token expiration
        from django.utils import timezone
        import datetime
        if connection.token_expires_at and connection.token_expires_at < timezone.now() + datetime.timedelta(minutes=5):
            refreshed = getattr(provider, 'refresh_access_token', lambda c: False)(connection)
            if not refreshed:
                raise ValueError(f"Access token is expired and could not be refreshed for {connection.platform}.")

        # Determine content and image
        content = platform_record.caption.caption_text if hasattr(platform_record, 'caption') else draft.enhanced_prompt
        
        image_url = None
        img_ref = platform_record.images.first()
        if img_ref and img_ref.asset:
            image_url = img_ref.asset.file_url
            if image_url and image_url.startswith('/'):
                import os
                backend_url = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
                image_url = f"{backend_url}{image_url}"

        # Publish
        response = provider.publish_post(connection, content, image_url)
        log.response_payload = response
        
        if response.get("success"):
            platform_record.status = ContentPlatform.PlatformStatus.POSTED
            platform_record.external_post_id = response.get("platform_post_id", "")
            platform_record.published_datetime = timezone.now()
            platform_record.error_message = ""
            platform_record.save(update_fields=['status', 'external_post_id', 'published_datetime', 'error_message'])
            
            log.status = PublishLog.PublishStatus.SUCCESS
            log.published_at = timezone.now()
            log.external_post_id = platform_record.external_post_id
        else:
            error_msg = response.get("error", "Unknown error")
            platform_record.status = ContentPlatform.PlatformStatus.FAILED
            platform_record.error_message = error_msg
            platform_record.save(update_fields=['status', 'error_message'])
            
            log.status = PublishLog.PublishStatus.FAILED
            log.error_message = error_msg
            
    except Exception as e:
        logger.error(f"Error publishing to {platform_record.platform}: {str(e)}")
        if log:
            log.status = PublishLog.PublishStatus.FAILED
            log.error_message = str(e)
            log.retry_count = self.request.retries
            log.save()
        
        platform_record.status = ContentPlatform.PlatformStatus.FAILED
        platform_record.error_message = str(e)
        platform_record.save(update_fields=['status', 'error_message'])
        
        # Optionally retry
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries)) # Exponential backoff
        
    finally:
        if log:
            log.save()
        
    # Check if all platforms are posted to update draft workflow state
    all_success = not draft.platforms.exclude(status=ContentPlatform.PlatformStatus.POSTED).exists()
    if all_success:
        draft.workflow_state = ContentDraft.WorkflowState.PUBLISHED
        draft.save(update_fields=['workflow_state'])
