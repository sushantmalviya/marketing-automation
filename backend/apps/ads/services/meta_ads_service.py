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
            
            is_cbo = bool(
                campaign_data.get("is_adset_budget_sharing_enabled", False)
                or campaign_data.get("budget_strategy") == "CAMPAIGN_BUDGET"
            )
            
            campaign_status = campaign_data.get("status", "PAUSED")
            if campaign_status not in ["ACTIVE", "PAUSED"]:
                campaign_status = "PAUSED"
                
            special_cats = campaign_data.get("special_ad_categories") or ["NONE"]
            if isinstance(special_cats, str):
                special_cats = [special_cats]

            params = {
                "access_token": access_token,
                "name": campaign_data.get("name"),
                "objective": campaign_data.get("objective", "OUTCOME_LEADS"),
                "buying_type": campaign_data.get("buying_type", "AUCTION"),
                "status": campaign_status,
                "special_ad_categories": json.dumps(special_cats),
                "is_adset_budget_sharing_enabled": is_cbo
            }

            # If Advantage+ Campaign Budget is enabled, set budget and bid strategy on Campaign level
            if is_cbo:
                budget_mode = campaign_data.get("budget_mode", "DAILY")
                daily_budget = campaign_data.get("daily_budget")
                lifetime_budget = campaign_data.get("lifetime_budget")
                
                if budget_mode == "LIFETIME" and lifetime_budget:
                    params["lifetime_budget"] = int(lifetime_budget)
                elif daily_budget:
                    params["daily_budget"] = int(daily_budget)
                elif lifetime_budget:
                    params["lifetime_budget"] = int(lifetime_budget)

                bid_strat = campaign_data.get("bid_strategy", "LOWEST_COST_WITHOUT_CAP")
                params["bid_strategy"] = bid_strat

            # Optional campaign spending limit (minor currency units)
            spend_cap = campaign_data.get("spend_cap")
            if spend_cap and int(spend_cap) > 0:
                params["spend_cap"] = int(spend_cap)

            logger.debug(f"Creating Campaign with payload: {json.dumps(params)}")
            response = requests.post(endpoint, data=params)
            MetaAdsService._handle_api_response(response)
            camp_data = response.json()
            campaign_id = camp_data.get("id")

            # Level 2: AdSet
            adset_endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/adsets"
            
            # 1. Targeting Spec Assembly
            targeting: Dict[str, Any] = {
                "age_min": int(campaign_data.get("age_min") or 18),
                "age_max": int(campaign_data.get("age_max") or 65),
            }

            # Interests
            raw_interests = campaign_data.get("interests", [])
            if raw_interests:
                targeting["flexible_spec"] = [{"interests": raw_interests}]

            # Gender: Meta uses [1] for Male, [2] for Female, omitted for All
            gender_val = campaign_data.get("gender")
            if gender_val == "Men":
                targeting["genders"] = [1]
            elif gender_val == "Women":
                targeting["genders"] = [2]

            # Geo Locations: Custom radius or Country
            geo_locations_data = campaign_data.get("geo_locations")
            if geo_locations_data and "lat" in geo_locations_data and "lng" in geo_locations_data:
                try:
                    lat_num = float(geo_locations_data["lat"])
                    lng_num = float(geo_locations_data["lng"])
                    rad_num = float(geo_locations_data.get("radius") or campaign_data.get("radius") or 10)
                    targeting["geo_locations"] = {
                        "custom_locations": [
                            {
                                "latitude": lat_num,
                                "longitude": lng_num,
                                "radius": rad_num,
                                "distance_unit": "kilometer"
                            }
                        ]
                    }
                except (ValueError, TypeError):
                    targeting["geo_locations"] = {"countries": [campaign_data.get("location", "IN")]}
            else:
                targeting["geo_locations"] = {"countries": [campaign_data.get("location", "IN")]}

            # 2. Optimization Goal & Billing Event
            # Map campaign objective to standard Meta optimization goals
            objective_val = campaign_data.get("objective", "OUTCOME_LEADS")
            goal_mapping = {
                "OUTCOME_LEADS": "LEAD_GENERATION",
                "OUTCOME_AWARENESS": "REACH",
                "OUTCOME_TRAFFIC": "LINK_CLICKS",
                "OUTCOME_SALES": "OFFSITE_CONVERSIONS",
                "OUTCOME_ENGAGEMENT": "POST_ENGAGEMENT",
                "OUTCOME_APP_PROMOTION": "APP_INSTALLS"
            }
            derived_goal = campaign_data.get("optimization_goal") or goal_mapping.get(objective_val, "REACH")

            # 3. AdSet Base Parameters
            adset_params: Dict[str, Any] = {
                "access_token": access_token,
                "campaign_id": campaign_id,
                "name": f"{campaign_data.get('name')} - AdSet",
                "billing_event": "IMPRESSIONS",
                "optimization_goal": derived_goal,
                "targeting": json.dumps(targeting),
                "status": "PAUSED"
            }

            # 4. Frequency Control Specs (Target / Cap)
            # Meta requires frequency_control_specs at AdSet level when optimization_goal is REACH
            if campaign_data.get("frequency_control_enabled"):
                freq_times = int(campaign_data.get("frequency_control_times") or 2)
                freq_days = int(campaign_data.get("frequency_control_days") or 7)
                adset_params["frequency_control_specs"] = json.dumps([
                    {
                        "event": "IMPRESSIONS",
                        "interval_days": freq_days,
                        "max_frequency": freq_times
                    }
                ])
                if objective_val == "OUTCOME_AWARENESS":
                    adset_params["optimization_goal"] = "REACH"

            # 5. Ad Scheduling (Day Parting)
            # Allowed when lifetime_budget is selected
            if (
                campaign_data.get("ad_schedule_type") == "ON_SCHEDULE"
                and campaign_data.get("budget_mode") == "LIFETIME"
            ):
                adset_params["pacing_type"] = json.dumps(["day_parting"])

            # 6. Budget & Bid Strategy if NOT using Advantage+ Campaign Budget (CBO)
            if not is_cbo:
                adset_params["bid_strategy"] = campaign_data.get("bid_strategy", "LOWEST_COST_WITHOUT_CAP")
                budget_mode = campaign_data.get("budget_mode", "DAILY")
                if budget_mode == "LIFETIME" and campaign_data.get("lifetime_budget"):
                    adset_params["lifetime_budget"] = int(campaign_data.get("lifetime_budget"))
                else:
                    adset_params["daily_budget"] = int(campaign_data.get("daily_budget", 100000))

            start_time = campaign_data.get("start_time")
            if start_time:
                adset_params["start_time"] = start_time

            end_time = campaign_data.get("end_time")
            if end_time:
                adset_params["end_time"] = end_time
                
            logger.debug(f"Creating AdSet with payload: {json.dumps(adset_params)}")
            adset_response = requests.post(adset_endpoint, data=adset_params)
            MetaAdsService._handle_api_response(adset_response)
            adset_data = adset_response.json()
            adset_id = adset_data.get("id")

            # 7. Budget Scheduling Edge (High Demand Periods)
            # If user configured scheduled budget increases, dispatch to /{adset_id}/budget_schedules
            budget_schedules = campaign_data.get("budget_schedules", [])
            if budget_schedules and campaign_data.get("schedule_budget_increases"):
                schedule_endpoint = f"{MetaAdsService.BASE_URL}/{adset_id}/budget_schedules"
                from datetime import datetime
                for period in budget_schedules:
                    try:
                        # Extract timestamps
                        start_d = period.get("startDate")
                        start_t = period.get("startTime", "00:00")
                        end_d = period.get("endDate")
                        end_t = period.get("endTime", "00:00")
                        
                        if start_d and end_d:
                            s_dt = datetime.strptime(f"{start_d} {start_t}", "%Y-%m-%d %H:%M")
                            e_dt = datetime.strptime(f"{end_d} {end_t}", "%Y-%m-%d %H:%M")
                            t_start = int(s_dt.timestamp())
                            t_end = int(e_dt.timestamp())
                            
                            b_val = period.get("increaseValue", 5)
                            b_type = "ABSOLUTE" if period.get("increaseType") == "VALUE" else "MULTIPLIER"
                            
                            sched_payload = {
                                "access_token": access_token,
                                "time_start": t_start,
                                "time_end": t_end,
                                "budget_value": int(b_val * 100) if b_type == "ABSOLUTE" else int(b_val),
                                "budget_value_type": b_type
                            }
                            requests.post(schedule_endpoint, data=sched_payload)
                    except Exception as sched_err:
                        logger.warning(f"Failed to attach budget schedule: {sched_err}")

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
