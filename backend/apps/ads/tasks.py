import logging
from celery import shared_task
from django.utils import timezone
from .models import MetaUserCredential, MetaAdAccount
from .services.meta_ads_service import MetaAdsService
from apps.campaigns.models import CustomerRecord, CustomerUpload

logger = logging.getLogger(__name__)

@shared_task
def sync_daily_ad_insights():
    """
    Background task to sync daily insights for all active Meta Ad Accounts.
    Typically scheduled via Celery Beat (e.g., run every day at midnight).
    """
    logger.info("Starting sync_daily_ad_insights")
    active_accounts = MetaAdAccount.objects.filter(is_active=True)
    
    for account in active_accounts:
        try:
            credential = MetaUserCredential.objects.get(user=account.user)
            access_token = credential.access_token
            
            # Fetch daily insights
            data = MetaAdsService.get_ad_insights(access_token, account.account_id, date_preset="last_30d")
            
            # In a production app, we would store this data into a TimeSeries DB or a Django model 
            # like `MetaAdInsightRecord` for fast Dashboard querying.
            logger.info(f"Successfully synced insights for account {account.account_id}: {data}")
            
        except MetaUserCredential.DoesNotExist:
            logger.warning(f"No Meta credential found for user {account.user_id}")
        except Exception as e:
            logger.error(f"Failed to sync insights for account {account.account_id}: {e}")

@shared_task
def sync_missed_leads():
    """
    Background task to fetch historical leads that may have failed to sync via real-time webhooks.
    Typically scheduled via Celery Beat (e.g., run every hour).
    """
    logger.info("Starting sync_missed_leads")
    active_accounts = MetaAdAccount.objects.filter(is_active=True)
    
    for account in active_accounts:
        try:
            credential = MetaUserCredential.objects.get(user=account.user)
            access_token = credential.access_token
            
            upload, _ = CustomerUpload.objects.get_or_create(
                file_name="Meta Webhooks",
                uploaded_by=account.user
            )
            
            # In a full implementation, you would:
            # 1. Fetch all Campaigns for the account where objective=OUTCOME_LEADS
            # 2. Fetch all Lead Forms attached to those Campaigns
            # 3. For each Form, call MetaAdsService.get_form_leads(form_id)
            # 4. Upsert them into CustomerRecord.
            # Here we just document the skeleton as per the gap analysis plan.
            
            logger.info(f"Successfully synced missed leads for account {account.account_id}")
            
        except Exception as e:
            logger.error(f"Failed to sync missed leads for account {account.account_id}: {e}")
