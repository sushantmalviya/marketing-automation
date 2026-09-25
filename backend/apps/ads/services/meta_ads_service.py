from typing import Dict, List, Any, Optional
import requests
import time
import functools
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def retry_on_rate_limit(max_retries=3, base_delay=2):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    # Check if response has 429 or Meta specific rate limit codes
                    if hasattr(e, 'response') and e.response is not None:
                        if e.response.status_code == 429:
                            delay = base_delay * (2 ** retries)
                            logger.warning(f"Rate limited by Meta API. Retrying in {delay} seconds...")
                            time.sleep(delay)
                            retries += 1
                            continue
                    raise e
            return func(*args, **kwargs)
        return wrapper
    return decorator
class MetaTokenExpiredError(Exception):
    pass

class MetaAPIError(Exception):
    pass

class MetaAdsService:
    """
    Service class to handle Meta Ads business logic and Meta Graph API interactions.
    """
    GRAPH_API_VERSION = "v19.0"
    BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

    @staticmethod
    def _handle_api_response(response):
        if not response.ok:
            try:
                error_data = response.json().get('error', {})
                code = error_data.get('code')
                message = error_data.get('message', 'Unknown Meta error')
                if code == 190:
                    raise MetaTokenExpiredError(message)
                raise MetaAPIError(f"Meta API error ({code}): {message}")
            except ValueError:
                response.raise_for_status()

    @staticmethod
    def get_auth_url() -> Dict[str, str]:
        """
        Generate Meta OAuth authorization URL and CSRF state.

        Returns:
            Dict containing 'auth_url' and 'csrf_state'.
        """
        app_id = getattr(settings, 'META_APP_ID', '123456789012345')
        redirect_uri = getattr(settings, 'META_REDIRECT_URI', 'http://localhost:3000/admin/ads')
        
        if getattr(settings, 'META_MOCK_MODE', False):
            return {
                "auth_url": f"{redirect_uri}?code=mock_code_123&state=abc123xyz",
                "csrf_state": "abc123xyz",
            }
            
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
        redirect_uri = getattr(settings, 'META_REDIRECT_URI', 'http://localhost:3000/admin/ads')
        
        if getattr(settings, 'META_MOCK_MODE', False) or code.startswith("mock_"):
            return "mock_access_token_" + code
        
        response = requests.get(
            f"{MetaAdsService.BASE_URL}/oauth/access_token",
            params={
                "client_id": app_id,
                "redirect_uri": redirect_uri,
                "client_secret": app_secret,
                "code": code,
            }
        )
        MetaAdsService._handle_api_response(response)
        data = response.json()
        short_lived_token = data["access_token"]
        
        # Exchange for long-lived token
        ll_response = requests.get(
            f"{MetaAdsService.BASE_URL}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": short_lived_token,
            }
        )
        if ll_response.ok:
            return ll_response.json().get("access_token", short_lived_token)
        return short_lived_token

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
        MetaAdsService._handle_api_response(response)
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
        if not account_id.startswith('act_'):
            account_id = f"act_{account_id}"
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
        if not account_id.startswith('act_'):
            account_id = f"act_{account_id}"
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
    @retry_on_rate_limit(max_retries=3)
    def get_campaigns_list(access_token: str, account_id: str, limit: int = 100, after_cursor: str = None) -> list:
        if not account_id.startswith('act_'):
            account_id = f"act_{account_id}"
        endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/campaigns"
        params = {
            "access_token": access_token,
            "fields": "id,name,status,effective_status,daily_budget,lifetime_budget,objective",
            "limit": limit
        }
        if after_cursor:
            params["after"] = after_cursor
        
        response = requests.get(endpoint, params=params)
        response.raise_for_status()
        
        if response.status_code == 200:
            return response.json().get('data', [])
        else:
            raise Exception(f"Meta API error: {response.text}")

    @staticmethod
    def update_campaign_status(access_token: str, campaign_id: str, status: str) -> dict:
        endpoint = f"{MetaAdsService.BASE_URL}/{campaign_id}"
        params = {
            "access_token": access_token,
            "status": status
        }
        response = requests.post(endpoint, data=params)
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Meta API error: {response.text}")

    @staticmethod
    def delete_campaign(access_token: str, campaign_id: str) -> dict:
        endpoint = f"{MetaAdsService.BASE_URL}/{campaign_id}"
        params = {
            "access_token": access_token
        }
        response = requests.delete(endpoint, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Meta API error: {response.text}")

    @staticmethod
    def create_campaign(access_token: str, account_id: str, campaign_data: dict) -> Dict[str, Any]:
        """
        Create a Meta Ads campaign. Supports mock mode.
        """
        if not account_id.startswith('act_'):
            account_id = f"act_{account_id}"
        if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
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
                "special_ad_categories": json.dumps(campaign_data.get("special_ad_categories") or ["NONE"]),
                "is_adset_budget_sharing_enabled": False
            }
            logger.debug(f"Creating Campaign with payload: {json.dumps(params)}")
            response = requests.post(endpoint, data=params)
            MetaAdsService._handle_api_response(response)
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
                "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
                "targeting": json.dumps(targeting),
                "status": "PAUSED"
            }
            start_time = campaign_data.get("start_time")
            if start_time:
                adset_params["start_time"] = start_time
                
            logger.debug(f"Creating AdSet with payload: {json.dumps(adset_params)}")
            adset_response = requests.post(adset_endpoint, data=adset_params)
            MetaAdsService._handle_api_response(adset_response)
            adset_data = adset_response.json()
            adset_id = adset_data.get("id")

            # Level 3: AdCreative & Ad
            creative_id = None
            ad_id = None
            creative_error = None
            try:
                creative_endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/adcreatives"
                page_id = campaign_data.get("page_id", "123456789") 
                headline = campaign_data.get("headline", "Default Headline")
                description = campaign_data.get("description", "")
                link = campaign_data.get("link", "https://example.com")
                message = campaign_data.get("ad_text", "Check this out!")
                
                cta_type = "LEARN_MORE"
                frontend_cta = campaign_data.get("call_to_action")
                if frontend_cta == "Book Now":
                    cta_type = "BOOK_TRAVEL"
                elif frontend_cta == "Sign Up":
                    cta_type = "SIGN_UP"

                object_story_spec = {
                    "page_id": page_id,
                }
                
                video_id = campaign_data.get("video_id")
                image_hash = campaign_data.get("image_hash")
                leadgen_form_id = campaign_data.get("leadgen_form_id")
                
                cta_block = {
                    "type": "SIGN_UP" if leadgen_form_id else cta_type,
                    "value": {"lead_gen_form_id": leadgen_form_id} if leadgen_form_id else {"link": link}
                }

                if video_id:
                    object_story_spec["video_data"] = {
                        "video_id": video_id,
                        "title": headline,
                        "message": message,
                        "call_to_action": cta_block
                    }
                else:
                    object_story_spec["link_data"] = {
                        "message": message,
                        "link": link,
                        "name": headline,
                        "description": description,
                        "call_to_action": cta_block
                    }
                    if image_hash:
                        object_story_spec["link_data"]["image_hash"] = image_hash

                creative_params = {
                    "access_token": access_token,
                    "name": f"{campaign_data.get('name')} - Creative",
                    "object_story_spec": json.dumps(object_story_spec)
                }
                logger.debug(f"Creating AdCreative with payload: {json.dumps(creative_params)}")
                creative_response = requests.post(creative_endpoint, data=creative_params)
                MetaAdsService._handle_api_response(creative_response)
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
                MetaAdsService._handle_api_response(ad_response)
                ad_data = ad_response.json()
                ad_id = ad_data.get("id")
            except Exception as e:
                logger.warning(f"Failed to create Ad Creative / Ad: {str(e)}")
                creative_error = str(e)
            
            return {
                "status": "success",
                "campaign_id": campaign_id,
                "adset_id": adset_id,
                "ad_id": ad_id,
                "creative_error": creative_error,
                "message": "Campaign and AdSet successfully created (Creative/Ad creation failed/skipped)." if creative_error else "Campaign successfully created."
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

    @classmethod
    @retry_on_rate_limit(max_retries=3)
    def upload_media(cls, access_token: str, account_id: str, media_type: str, file_obj) -> dict:
        import time
        logger = logging.getLogger(__name__)
        
        if not account_id.startswith('act_'):
            account_id = f"act_{account_id}"
            
        if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
            return {
                "image_hash" if media_type == 'image' else "video_id": f"mock_media_hash_{int(time.time())}"
            }
            
        try:
            if media_type == 'image':
                endpoint = f"{cls.BASE_URL}/{account_id}/adimages"
                files = {'filename': file_obj}
                data = {'access_token': access_token}
                logger.debug(f"Uploading image to {endpoint}")
                response = requests.post(endpoint, data=data, files=files)
                response.raise_for_status()
                res_data = response.json()
                images = res_data.get('images', {})
                if images:
                    first_image = list(images.values())[0]
                    return {"image_hash": first_image.get("hash")}
                return {"error": "Failed to get image_hash from response."}
                
            elif media_type == 'video':
                endpoint = f"{cls.BASE_URL}/{account_id}/advideos"
                files = {'source': file_obj}
                data = {'access_token': access_token}
                logger.debug(f"Uploading video to {endpoint}")
                response = requests.post(endpoint, data=data, files=files)
                response.raise_for_status()
                res_data = response.json()
                return {"video_id": res_data.get("id")}
            else:
                return {"error": "Invalid media type. Must be 'image' or 'video'."}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error uploading media: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                return {"error": e.response.text}
            return {"error": str(e)}
