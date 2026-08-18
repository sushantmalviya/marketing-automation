from typing import Dict, List, Any, Optional
import requests
from django.conf import settings
class MetaAdsService:
    """
    Service class to handle Meta Ads business logic and Meta Graph API interactions.
    """
    GRAPH_API_VERSION = "v19.0"
    BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

    @staticmethod
    def get_auth_url() -> Dict[str, str]:
        """
        Generate Meta OAuth authorization URL and CSRF state.

        Returns:
            Dict containing 'auth_url' and 'csrf_state'.
        """
        app_id = getattr(settings, 'META_APP_ID', '123456789012345')
        redirect_uri = getattr(settings, 'META_REDIRECT_URI', 'http://localhost:8000/api/v1/integrations/meta/callback/')
        return {
            "auth_url": (
                f"https://www.facebook.com/{MetaAdsService.GRAPH_API_VERSION}/dialog/oauth?"
                f"client_id={app_id}&"
                f"redirect_uri={redirect_uri}&"
                "scope=ads_management,ads_read,read_insights&"
                "state=abc123xyz"
            ),
            "csrf_state": "abc123xyz",
        }

    @staticmethod
    def exchange_code_for_token(code: str) -> str:
        app_id = getattr(settings, 'META_APP_ID', '123456789012345')
        app_secret = getattr(settings, 'META_APP_SECRET', 'secret')
        redirect_uri = getattr(settings, 'META_REDIRECT_URI', 'http://localhost:8000/api/v1/integrations/meta/callback/')
        
        response = requests.get(
            f"{MetaAdsService.BASE_URL}/oauth/access_token",
            params={
                "client_id": app_id,
                "redirect_uri": redirect_uri,
                "client_secret": app_secret,
                "code": code,
            }
        )
        response.raise_for_status()
        data = response.json()
        return data["access_token"]

    @staticmethod
    def get_ad_accounts(access_token: str) -> List[Dict[str, Any]]:
        """
        Fetch Meta Ad Accounts associated with the user.

        Args:
            access_token: Meta OAuth access token.

        Returns:
            List of dictionaries containing ad account details.
        """
        response = requests.get(
            f"{MetaAdsService.BASE_URL}/me/adaccounts",
            params={
                "access_token": access_token,
                "fields": "account_id,name,currency,account_status",
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])

    @staticmethod
    def get_ad_insights(access_token: str, account_id: str, date_preset: str = "last_30d") -> Dict[str, Any]:
        """
        Fetch advertising metrics and insights for a given Meta Ad Account.

        Args:
            access_token: Meta OAuth access token.
            account_id: Meta Ad Account ID string.
            date_preset: Date range preset (e.g. 'last_30d', 'last_7d').

        Returns:
            Dict containing aggregated metrics.
        """
        endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/insights"
        params = {
            "access_token": access_token,
            "date_preset": date_preset,
            "fields": "spend,impressions,clicks"
        }
        
        response = requests.get(endpoint, params=params)
        
        if response.status_code == 200:
            data = response.json().get('data', [])
            if data:
                return data[0]
            else:
                return {"spend": "0", "impressions": "0", "clicks": "0"}
        else:
            raise Exception(f"Meta API error: {response.text}")

    @staticmethod
    def get_ad_insights_timeseries(access_token: str, account_id: str, date_preset: str) -> list:
        endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/insights"
        params = {
            "access_token": access_token,
            "date_preset": date_preset,
            "fields": "spend,impressions,clicks",
            "time_increment": "1"
        }
        
        response = requests.get(endpoint, params=params)
        
        if response.status_code == 200:
            return response.json().get('data', [])
        else:
            raise Exception(f"Meta API error: {response.text}")

    @staticmethod
    def get_campaigns_list(access_token: str, account_id: str) -> list:
        endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/campaigns"
        params = {
            "access_token": access_token,
            "fields": "id,name,status,effective_status,daily_budget,lifetime_budget,objective"
        }
        
        response = requests.get(endpoint, params=params)
        
        if response.status_code == 200:
            return response.json().get('data', [])
        else:
            raise Exception(f"Meta API error: {response.text}")

    @staticmethod
    def create_campaign(access_token: str, account_id: str, campaign_data: dict) -> Dict[str, Any]:
        """
        Create a Meta Ads campaign. Supports mock mode.
        """
        if getattr(settings, 'META_MOCK_MODE', True):
            return {
                "status": "success", 
                "campaign_id": "mock_camp_12345", 
                "adset_id": "mock_adset_67890", 
                "ad_id": "mock_ad_11111", 
                "message": "MOCK MODE: Campaign drafted successfully."
            }
            
        try:
            endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/campaigns"
            params = {
                "access_token": access_token,
                "name": campaign_data.get("name"),
                "objective": campaign_data.get("objective", "OUTCOME_TRAFFIC"),
                "status": "PAUSED",
                "special_ad_categories": "NONE"
            }
            response = requests.post(endpoint, data=params)
            response.raise_for_status()
            camp_data = response.json()
            
            return {
                "status": "success",
                "campaign_id": camp_data.get("id"),
                "message": "Campaign successfully created."
            }
        except Exception as e:
            raise Exception(f"Meta API error: {str(e)}")
