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
            import json
            import logging
            logger = logging.getLogger(__name__)

            # Level 1: Campaign
            endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/campaigns"
            params = {
                "access_token": access_token,
                "name": campaign_data.get("name"),
                "objective": campaign_data.get("objective", "OUTCOME_TRAFFIC"),
                "buying_type": "AUCTION",
                "status": "PAUSED",
                "special_ad_categories": json.dumps(campaign_data.get("special_ad_categories", ["NONE"]))
            }
            logger.debug(f"Creating Campaign with payload: {json.dumps(params)}")
            response = requests.post(endpoint, data=params)
            response.raise_for_status()
            camp_data = response.json()
            campaign_id = camp_data.get("id")

            # Level 2: AdSet
            adset_endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/adsets"
            targeting = {
                "geo_locations": {"countries": [campaign_data.get("location", "US")]},
                "age_min": campaign_data.get("age_min", 18),
                "age_max": campaign_data.get("age_max", 65),
                "flexible_spec": [{"interests": campaign_data.get("interests", [])}]
            }
            adset_params = {
                "access_token": access_token,
                "campaign_id": campaign_id,
                "name": f"{campaign_data.get('name')} - AdSet",
                "daily_budget": campaign_data.get("daily_budget", 1000),
                "billing_event": "IMPRESSIONS",
                "optimization_goal": campaign_data.get("optimization_goal", "REACH"),
                "targeting": json.dumps(targeting),
                "status": "PAUSED"
            }
            start_time = campaign_data.get("start_time")
            if start_time:
                adset_params["start_time"] = start_time
                
            logger.debug(f"Creating AdSet with payload: {json.dumps(adset_params)}")
            adset_response = requests.post(adset_endpoint, data=adset_params)
            adset_response.raise_for_status()
            adset_data = adset_response.json()
            adset_id = adset_data.get("id")

            # Level 3: AdCreative & Ad
            creative_endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/adcreatives"
            page_id = campaign_data.get("page_id", "123456789") 
            object_story_spec = {
                "page_id": page_id,
                "link_data": {
                    "message": campaign_data.get("ad_text", "Check this out!"),
                    "link": campaign_data.get("link", "https://example.com"),
                }
            }
            
            image_hash = campaign_data.get("image_hash")
            if image_hash:
                object_story_spec["link_data"]["image_hash"] = image_hash
                
            leadgen_form_id = campaign_data.get("leadgen_form_id")
            if leadgen_form_id:
                object_story_spec["link_data"]["call_to_action"] = {
                    "type": "SIGN_UP",
                    "value": {"lead_gen_form_id": leadgen_form_id}
                }

            creative_params = {
                "access_token": access_token,
                "name": f"{campaign_data.get('name')} - Creative",
                "object_story_spec": json.dumps(object_story_spec)
            }
            logger.debug(f"Creating AdCreative with payload: {json.dumps(creative_params)}")
            creative_response = requests.post(creative_endpoint, data=creative_params)
            creative_response.raise_for_status()
            creative_data = creative_response.json()
            creative_id = creative_data.get("id")

            ad_endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/ads"
            ad_params = {
                "access_token": access_token,
                "name": f"{campaign_data.get('name')} - Ad",
                "adset_id": adset_id,
                "creative_id": creative_id,
                "status": "PAUSED"
            }
            logger.debug(f"Creating Ad with payload: {json.dumps(ad_params)}")
            ad_response = requests.post(ad_endpoint, data=ad_params)
            ad_response.raise_for_status()
            ad_data = ad_response.json()
            ad_id = ad_data.get("id")
            
            return {
                "status": "success",
                "campaign_id": campaign_id,
                "adset_id": adset_id,
                "ad_id": ad_id,
                "message": "Campaign successfully created."
            }
        except Exception as e:
            raise Exception(f"Meta API error: {str(e)}")

    @classmethod
    def get_lead_details(cls, access_token: str, leadgen_id: str) -> dict:
        try:
            endpoint = f"{cls.BASE_URL}/{leadgen_id}"
            response = requests.get(endpoint, params={"access_token": access_token})
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # Log the error appropriately in production
            return {"error": str(e)}

    @classmethod
    def get_campaign_insights(cls, access_token: str, campaign_id: str, date_preset: str = 'last_30d', time_range: dict = None, breakdowns: str = None) -> dict:
        import json
        try:
            endpoint = f"{cls.BASE_URL}/{campaign_id}/insights"
            params = {
                "access_token": access_token,
                "level": "campaign",
                "fields": "spend,impressions,clicks,reach,cpc,ctr,actions,cost_per_action_type"
            }
            if time_range:
                params["time_range"] = json.dumps(time_range)
            else:
                params["date_preset"] = date_preset
            if breakdowns:
                params["breakdowns"] = breakdowns
                
            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            data = response.json().get("data", [])
            return data[0] if data else {}
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @classmethod
    def get_adset_insights(cls, access_token: str, adset_id: str, date_preset: str = 'last_30d', time_range: dict = None, breakdowns: str = None) -> dict:
        import json
        try:
            endpoint = f"{cls.BASE_URL}/{adset_id}/insights"
            params = {
                "access_token": access_token,
                "level": "adset",
                "fields": "spend,impressions,clicks,reach,cpc,ctr,actions,cost_per_action_type"
            }
            if time_range:
                params["time_range"] = json.dumps(time_range)
            else:
                params["date_preset"] = date_preset
            if breakdowns:
                params["breakdowns"] = breakdowns

            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            data = response.json().get("data", [])
            return data[0] if data else {}
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @classmethod
    def get_ad_insights(cls, access_token: str, ad_id: str, date_preset: str = 'last_30d', time_range: dict = None, breakdowns: str = None) -> dict:
        import json
        try:
            endpoint = f"{cls.BASE_URL}/{ad_id}/insights"
            params = {
                "access_token": access_token,
                "level": "ad",
                "fields": "spend,impressions,clicks,reach,cpc,ctr,actions,cost_per_action_type"
            }
            if time_range:
                params["time_range"] = json.dumps(time_range)
            else:
                params["date_preset"] = date_preset
            if breakdowns:
                params["breakdowns"] = breakdowns

            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            data = response.json().get("data", [])
            return data[0] if data else {}
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @classmethod
    def get_form_leads(cls, access_token: str, form_id: str, after_cursor: str = None) -> dict:
        try:
            endpoint = f"{cls.BASE_URL}/{form_id}/leads"
            params = {
                "access_token": access_token,
                "fields": "created_time,field_data,campaign_id"
            }
            if after_cursor:
                params["after"] = after_cursor
            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @classmethod
    def update_object_status(cls, access_token: str, object_id: str, status: str) -> dict:
        import logging
        logger = logging.getLogger(__name__)
        try:
            endpoint = f"{cls.BASE_URL}/{object_id}"
            data = {"access_token": access_token, "status": status}
            logger.debug(f"Updating object {object_id} status to {status}")
            response = requests.post(endpoint, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error updating status: {str(e)}")
            return {"error": str(e)}

    @classmethod
    def update_adset_budget(cls, access_token: str, adset_id: str, budget: int, is_lifetime: bool = False) -> dict:
        import logging
        logger = logging.getLogger(__name__)
        try:
            endpoint = f"{cls.BASE_URL}/{adset_id}"
            data = {"access_token": access_token}
            if is_lifetime:
                data["lifetime_budget"] = budget
            else:
                data["daily_budget"] = budget
            logger.debug(f"Updating AdSet {adset_id} budget: {data}")
            response = requests.post(endpoint, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error updating budget: {str(e)}")
            return {"error": str(e)}

    @classmethod
    def get_ad_review_status(cls, access_token: str, ad_id: str) -> dict:
        import logging
        logger = logging.getLogger(__name__)
        try:
            endpoint = f"{cls.BASE_URL}/{ad_id}"
            params = {"access_token": access_token, "fields": "effective_status,issues_info"}
            logger.debug(f"Fetching review status for ad {ad_id}")
            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching review status: {str(e)}")
            return {"error": str(e)}
