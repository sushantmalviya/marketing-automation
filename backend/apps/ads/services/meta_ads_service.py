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
    def get_auth_url(redirect_uri: Optional[str] = None) -> Dict[str, str]:
        """
        Generate Meta OAuth authorization URL and CSRF state.

        Returns:
            Dict containing 'auth_url' and 'csrf_state'.
        """
        app_id = getattr(settings, 'META_APP_ID', '123456789012345')
        configured_redirect = getattr(settings, 'META_REDIRECT_URI', 'https://marketing-automation-smoky.vercel.app/admin/ads')
        target_redirect = redirect_uri or configured_redirect
        
        if getattr(settings, 'META_MOCK_MODE', False):
            return {
                "auth_url": f"{target_redirect}?code=mock_code_123&state=abc123xyz",
                "csrf_state": "abc123xyz",
            }
            
        # Complete required permissions for Ads management, Insights, Pages, and Lead Retrieval
        scopes = "ads_management,ads_read,read_insights,leads_retrieval,pages_show_list,pages_read_engagement,pages_manage_ads"
        return {
            "auth_url": (
                f"https://www.facebook.com/{MetaAdsService.GRAPH_API_VERSION}/dialog/oauth?"
                f"client_id={app_id}&"
                f"redirect_uri={target_redirect}&"
                f"scope={scopes}&"
                "state=abc123xyz"
            ),
            "csrf_state": "abc123xyz",
        }

    @staticmethod
    def exchange_code_for_token(code: str, redirect_uri: Optional[str] = None) -> str:
        app_id = getattr(settings, 'META_APP_ID', '123456789012345')
        app_secret = getattr(settings, 'META_APP_SECRET', 'secret')
        configured_redirect = getattr(settings, 'META_REDIRECT_URI', 'https://marketing-automation-smoky.vercel.app/admin/ads')
        target_redirect = redirect_uri or configured_redirect
        
        if getattr(settings, 'META_MOCK_MODE', False) or code.startswith("mock_"):
            return "mock_access_token_" + code
        
        # Build candidate redirect URIs in priority order (primary provided -> localhost -> production)
        candidates = [target_redirect]
        for fallback in [
            "http://localhost:3000/admin/ads",
            "https://marketing-automation-smoky.vercel.app/admin/ads",
            "http://localhost:3000/user/ads",
            "https://marketing-automation-smoky.vercel.app/user/ads"
        ]:
            if fallback not in candidates:
                candidates.append(fallback)

        last_response = None
        for candidate_uri in candidates:
            response = requests.get(
                f"{MetaAdsService.BASE_URL}/oauth/access_token",
                params={
                    "client_id": app_id,
                    "redirect_uri": candidate_uri,
                    "client_secret": app_secret,
                    "code": code,
                }
            )
            if response.status_code == 200:
                data = response.json()
                short_lived_token = data.get("access_token")
                if short_lived_token:
                    # Exchange for long-lived 60-day token
                    try:
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
                    except Exception:
                        pass
                    return short_lived_token
            last_response = response

        # If all candidates failed, raise the error from the response
        if last_response is not None:
            MetaAdsService._handle_api_response(last_response)
        raise MetaAPIError("Failed to exchange OAuth code for access token.")

    @staticmethod
    def get_user_pages(access_token: str) -> List[Dict[str, Any]]:
        """
        Fetch Facebook Pages managed by the authenticated user.
        Includes Page Access Token for Lead Forms and Webhook subscriptions.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
            return [
                {
                    "id": "mock_page_123",
                    "name": "Mock Business Page",
                    "access_token": "mock_page_token_123",
                    "category": "Marketing Agency",
                    "tasks": ["ADVERTISE", "ANALYZE", "MANAGE"]
                }
            ]

        response = requests.get(
            f"{MetaAdsService.BASE_URL}/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,access_token,category,tasks,instagram_business_account{id,username}",
            }
        )
        MetaAdsService._handle_api_response(response)
        data = response.json()
        return data.get("data", [])

    # Alias for convenience and backward compatibility
    get_pages = get_user_pages

    @classmethod
    def get_page_access_token(cls, user_access_token: str, page_id: str) -> Optional[str]:
        """
        Retrieves the Page Access Token for a specific Page ID using the user's access token.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (user_access_token and user_access_token.startswith("mock_")):
            return "mock_page_token"
        try:
            pages = cls.get_pages(user_access_token)
            for page in pages:
                if str(page.get("id")) == str(page_id):
                    return page.get("access_token")
        except Exception as e:
            logger.warning(f"Failed to get page access token for page {page_id}: {e}")
        return None

    @classmethod
    def get_page_lead_forms(cls, page_token_or_user_token: str, page_id: str) -> List[Dict[str, Any]]:
        """
        Fetch Instant Forms (Lead Forms) created under a specific Facebook Page.
        Automatically resolves Page Access Token if a user token was provided.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (page_token_or_user_token and page_token_or_user_token.startswith("mock_")):
            return [
                {
                    "id": "mock_form_101",
                    "name": "Indore Interior Consultation Form",
                    "status": "ACTIVE",
                    "leads_count": 42
                }
            ]

        # First try with the provided token
        response = requests.get(
            f"{cls.BASE_URL}/{page_id}/leadgen_forms",
            params={
                "access_token": page_token_or_user_token,
                "fields": "id,name,status,created_time,leads_count,questions",
            }
        )
        if not response.ok:
            # If failed (e.g. #190 requires Page Access Token), try resolving page token
            page_token = cls.get_page_access_token(page_token_or_user_token, page_id)
            if page_token and page_token != page_token_or_user_token:
                response = requests.get(
                    f"{cls.BASE_URL}/{page_id}/leadgen_forms",
                    params={
                        "access_token": page_token,
                        "fields": "id,name,status,created_time,leads_count,questions",
                    }
                )

        cls._handle_api_response(response)
        data = response.json()
        return data.get("data", [])

    @classmethod
    def get_form_leads(cls, access_token: str, form_id: str, limit: int = 50) -> Dict[str, Any]:
        """
        Fetch leads submitted for a specific Leadgen Form.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
            return {
                "data": [
                    {
                        "id": "mock_lead_1",
                        "created_time": "2026-10-28T05:41:02+0000",
                        "field_data": [
                            {"name": "full_name", "values": ["Mock Lead User"]},
                            {"name": "email", "values": ["mock_lead@example.com"]},
                            {"name": "phone_number", "values": ["+1234567890"]}
                        ]
                    }
                ]
            }

        endpoint = f"{cls.BASE_URL}/{form_id}/leads"
        params = {
            "access_token": access_token,
            "fields": "id,created_time,ad_id,ad_name,form_id,field_data,campaign_id,campaign_name",
            "limit": limit
        }
        try:
            response = requests.get(endpoint, params=params)
            if not response.ok:
                err_msg = response.text
                try:
                    err_msg = response.json().get("error", {}).get("message", err_msg)
                except Exception:
                    pass
                logger.error(f"Error fetching leads for form {form_id}: {err_msg}")
                return {"data": [], "error": err_msg}
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error fetching form leads {form_id}: {e}")
            return {"data": [], "error": str(e)}

    @staticmethod
    def subscribe_page_to_webhooks(page_access_token: str, page_id: str) -> Dict[str, Any]:
        """
        Subscribes the Facebook Page to the app for the 'leadgen' webhook topic.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (page_access_token and page_access_token.startswith("mock_")):
            return {"success": True, "message": "Mock page subscribed successfully"}

        endpoint = f"{MetaAdsService.BASE_URL}/{page_id}/subscribed_apps"
        response = requests.post(
            endpoint,
            data={
                "access_token": page_access_token,
                "subscribed_fields": "leadgen"
            }
        )
        MetaAdsService._handle_api_response(response)
        return response.json()

    @staticmethod
    def search_targeting_interests(access_token: str, query: str) -> List[Dict[str, Any]]:
        """
        Search Meta targeting interests with IDs valid for flexible_spec.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
            return [
                {"id": "6003139266461", "name": f"{query} (Mock Interest)", "audience_size_lower_bound": 100000}
            ]

        endpoint = f"{MetaAdsService.BASE_URL}/search"
        response = requests.get(
            endpoint,
            params={
                "access_token": access_token,
                "type": "adinterest",
                "q": query
            }
        )
        if response.ok:
            return response.json().get("data", [])
        return []

    @staticmethod
    def get_ad_accounts(access_token: str) -> List[Dict[str, Any]]:
        """
        Fetch Meta Ad Accounts associated with the user.

        Args:
            access_token: Meta OAuth access token.

        Returns:
            List of dictionaries containing ad account details.
        """
        if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
            return [{"account_id": "act_12345", "name": "Mock Ad Account", "currency": "INR", "account_status": 1}]
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
            "fields": "spend,impressions,clicks,reach,cpc,ctr,actions,cost_per_action_type"
        }
        
        response = requests.get(endpoint, params=params)
        
        if response.status_code == 200:
            data = response.json().get('data', [])
            if data:
                item = data[0]
                actions = item.get("actions", [])
                leads = 0
                conversions = 0
                for action in actions:
                    atype = action.get("action_type", "")
                    val = int(float(action.get("value", 0)))
                    if atype in ("lead", "onsite_conversion.lead_grouped", "leadgen.other", "contact"):
                        leads += val
                    if "conversion" in atype or "purchase" in atype or atype == "lead":
                        conversions += val
                
                spend = float(item.get("spend", 0))
                roas = 0.0
                for cost_action in item.get("cost_per_action_type", []):
                    if cost_action.get("action_type") == "purchase_roas":
                        roas = float(cost_action.get("value", 0))
                
                item["leads"] = leads
                item["conversions"] = conversions
                item["roas"] = roas or (round(conversions * 1.5, 2) if conversions else 0.0)
                return item
            else:
                return {"spend": "0", "impressions": "0", "clicks": "0", "leads": 0, "conversions": 0, "roas": 0.0}
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
            "fields": "spend,impressions,clicks,actions",
            "time_increment": "1"
        }
        
        response = requests.get(endpoint, params=params)
        
        if response.status_code == 200:
            raw_data = response.json().get('data', [])
            enriched = []
            for entry in raw_data:
                actions = entry.get("actions", [])
                conversions = 0
                for a in actions:
                    if "lead" in a.get("action_type", "") or "conversion" in a.get("action_type", ""):
                        conversions += int(float(a.get("value", 0)))
                enriched.append({
                    "date": entry.get("date_start", ""),
                    "spend": float(entry.get("spend", 0)),
                    "clicks": int(entry.get("clicks", 0)),
                    "impressions": int(entry.get("impressions", 0)),
                    "conversions": conversions
                })
            return enriched
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
        Create a Meta Ads campaign hierarchy (Campaign -> AdSet -> AdCreative -> Ad).
        Strictly compliant with Meta Marketing API v19.0+ specs for OUTCOME_LEADS and custom geo targeting.
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

            objective = campaign_data.get("objective", "OUTCOME_LEADS")
            is_lead_campaign = (objective == "OUTCOME_LEADS")
            page_id = campaign_data.get("page_id")
            
            # If no page_id provided, attempt auto-resolving from user's pages
            if not page_id:
                pages = MetaAdsService.get_user_pages(access_token)
                if pages:
                    page_id = pages[0].get("id")
                else:
                    raise Exception("No Facebook Page found. A Facebook Page is required to run Meta Ads.")

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

            # Level 2: AdSet Targeting & Optimization
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

            # 5. Ad Scheduling & Delivery Pacing Type
            pacing = []
            delivery_type = campaign_data.get("delivery_type")
            if delivery_type == "ACCELERATED" and campaign_data.get("bid_strategy") == "BID_CAP":
                pacing.append("no_pacing")
            elif delivery_type == "STANDARD":
                pacing.append("standard")

            if (
                campaign_data.get("ad_schedule_type") == "ON_SCHEDULE"
                and campaign_data.get("budget_mode") == "LIFETIME"
            ):
                pacing.append("day_parting")

            if pacing:
                adset_params["pacing_type"] = json.dumps(pacing)

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
                
            logger.info(f"Creating AdSet with opt_goal={opt_goal}")
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
                headline = campaign_data.get("headline", "Special Announcement")
                description = campaign_data.get("description", "")
                link = campaign_data.get("link", "https://marketing-automation-smoky.vercel.app")
                message = campaign_data.get("ad_text", "Check out our latest offer!")
                
                frontend_cta = campaign_data.get("call_to_action", "SIGN_UP")
                cta_type = "SIGN_UP"
                if frontend_cta in ("Book Now", "BOOK_TRAVEL"):
                    cta_type = "BOOK_TRAVEL"
                elif frontend_cta in ("Learn More", "LEARN_MORE"):
                    cta_type = "LEARN_MORE"
                elif frontend_cta in ("Contact Us", "CONTACT_US"):
                    cta_type = "CONTACT_US"
                elif frontend_cta in ("Get Quote", "GET_QUOTE"):
                    cta_type = "GET_QUOTE"

                leadgen_form_id = campaign_data.get("leadgen_form_id")
                
                object_story_spec = {
                    "page_id": page_id,
                }
                
                video_id = campaign_data.get("video_id")
                image_hash = campaign_data.get("image_hash")
                
                if leadgen_form_id:
                    cta_block = {
                        "type": "SIGN_UP",
                        "value": {"lead_gen_form_id": leadgen_form_id}
                    }
                else:
                    cta_block = {
                        "type": cta_type,
                        "value": {"link": link}
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
                logger.info(f"Creating AdCreative for Page {page_id}")
                creative_response = requests.post(creative_endpoint, data=creative_params)
                MetaAdsService._handle_api_response(creative_response)
                creative_data = creative_response.json()
                creative_id = creative_data.get("id")

                ad_endpoint = f"{MetaAdsService.BASE_URL}/{account_id}/ads"
                ad_params = {
                    "access_token": access_token,
                    "name": f"{campaign_data.get('name')} - Ad",
                    "adset_id": adset_id,
                    "creative": json.dumps({"creative_id": creative_id}),
                    "status": "PAUSED"
                }
                logger.info("Creating Ad object")
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
                "page_id": page_id,
                "creative_error": creative_error,
                "message": "Campaign and AdSet created, but Creative had an issue: " + str(creative_error) if creative_error else "Campaign successfully launched in paused mode on Meta."
            }
        except Exception as e:
            raise Exception(f"Meta API error: {str(e)}")

    @classmethod
    def get_lead_details(cls, access_token: str, leadgen_id: str) -> dict:
        try:
            endpoint = f"{cls.BASE_URL}/{leadgen_id}"
            params = {
                "access_token": access_token,
                "fields": "id,created_time,ad_id,ad_name,form_id,field_data,campaign_id,campaign_name"
            }
            response = requests.get(endpoint, params=params)
            if not response.ok:
                err_msg = response.text
                err_code = None
                try:
                    err_json = response.json().get('error', {})
                    err_msg = err_json.get('message', err_msg)
                    err_code = err_json.get('code')
                except Exception:
                    pass
                logger.warning(f"Meta Graph error fetching lead {leadgen_id} (code {err_code}): {err_msg}")
                return {"error": err_msg, "code": err_code}
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error fetching lead {leadgen_id}: {e}")
            return {"error": str(e)}

    @classmethod
    def fetch_lead_with_credentials_fallback(cls, leadgen_id: str, page_id: Optional[str] = None):
        """
        Attempts to fetch lead details using all available active credentials and page access tokens.
        Returns tuple of (lead_data_dict, user_owner).
        """
        from apps.ads.models import MetaUserCredential

        active_creds = list(MetaUserCredential.objects.filter(status='ACTIVE').select_related('user'))
        if not active_creds:
            logger.error("No active MetaUserCredential found in system.")
            return None, None

        # Strategy 1: If page_id is given, try resolving the Page Access Token first
        if page_id:
            for cred in active_creds:
                try:
                    page_token = cls.get_page_access_token(cred.access_token, str(page_id))
                    if page_token:
                        lead_data = cls.get_lead_details(page_token, leadgen_id)
                        if "error" not in lead_data and lead_data.get("field_data") is not None:
                            logger.info(f"Successfully fetched lead {leadgen_id} using page token for page {page_id}")
                            return lead_data, cred.user
                except Exception as e:
                    logger.debug(f"Page token attempt failed for user {cred.user}: {e}")

        # Strategy 2: Try each active credential's user access token
        for cred in active_creds:
            try:
                lead_data = cls.get_lead_details(cred.access_token, leadgen_id)
                if "error" not in lead_data and lead_data.get("field_data") is not None:
                    logger.info(f"Successfully fetched lead {leadgen_id} using user token of {cred.user.email}")
                    return lead_data, cred.user
            except Exception as e:
                logger.debug(f"User token attempt failed for user {cred.user}: {e}")

        # Strategy 3: Check all managed pages across all credentials if page_id was not provided
        if not page_id:
            for cred in active_creds:
                try:
                    pages = cls.get_pages(cred.access_token)
                    for page in pages:
                        ptoken = page.get("access_token")
                        if ptoken:
                            lead_data = cls.get_lead_details(ptoken, leadgen_id)
                            if "error" not in lead_data and lead_data.get("field_data") is not None:
                                logger.info(f"Successfully fetched lead {leadgen_id} using page token of {page.get('name')}")
                                return lead_data, cred.user
                except Exception as e:
                    logger.debug(f"All-pages scan attempt failed for user {cred.user}: {e}")

        logger.error(f"Failed to fetch lead {leadgen_id} across all available credentials and pages.")
        return None, None

    @classmethod
    def process_meta_leadgen_payload(cls, payload: dict) -> List[dict]:
        """
        Parses incoming Meta leadgen webhook payload, fetches lead data, and saves into CRM & Database.
        """
        from apps.campaigns.models import CustomerUpload, CustomerRecord
        from apps.campaigns.services import ContactService
        from apps.events.models import SystemEvent
        from apps.ads.models import MetaUserCredential

        results = []
        entries = payload.get("entry", []) if isinstance(payload, dict) else []

        for entry in entries:
            page_id = str(entry.get("id") or "")
            changes = entry.get("changes", [])
            for change in changes:
                if change.get("field") != "leadgen":
                    continue
                value = change.get("value", {})
                leadgen_id = str(value.get("leadgen_id") or "")
                page_id = str(value.get("page_id") or page_id or "")
                form_id = str(value.get("form_id") or "")
                ad_id = str(value.get("ad_id") or "")
                campaign_id = str(value.get("campaign_id") or "")

                if not leadgen_id:
                    continue

                lead_data, owner_user = cls.fetch_lead_with_credentials_fallback(leadgen_id, page_id=page_id)
                if not lead_data:
                    logger.error(f"Could not retrieve lead {leadgen_id} details from Meta API.")
                    continue

                if not owner_user:
                    first_cred = MetaUserCredential.objects.filter(status='ACTIVE').first() or MetaUserCredential.objects.first()
                    owner_user = first_cred.user if first_cred else None

                field_data = lead_data.get("field_data", [])
                email = None
                full_name = "Unknown"
                phone_number = None
                custom_questions = {}

                for field in field_data:
                    fname = field.get("name", "")
                    values = field.get("values", [])
                    if values:
                        val = values[0]
                        if fname in ("email", "user_email"):
                            email = val
                        elif fname in ("full_name", "name", "first_name"):
                            full_name = val
                        elif fname in ("phone_number", "phone", "contact_number"):
                            phone_number = val
                        else:
                            custom_questions[fname] = val if len(values) == 1 else values

                campaign_name = lead_data.get("campaign_name") or f"Meta Campaign {campaign_id}" if campaign_id else "Meta Webhooks"
                
                # Ensure CustomerUpload has a non-null uploaded_by
                upload_defaults = {"file_type": "meta", "status": CustomerUpload.Status.COMPLETED}
                if owner_user:
                    upload, _ = CustomerUpload.objects.get_or_create(
                        file_name="Meta Webhooks",
                        uploaded_by=owner_user,
                        defaults=upload_defaults
                    )
                else:
                    from apps.accounts.models import User
                    fallback_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
                    upload, _ = CustomerUpload.objects.get_or_create(
                        file_name="Meta Webhooks",
                        uploaded_by=fallback_user,
                        defaults=upload_defaults
                    )
                    owner_user = fallback_user

                meta_payload = {
                    'email': email or "",
                    'name': full_name,
                    'phone': phone_number or "",
                    'source': 'meta',
                    '__source__': 'meta',
                    '_source': 'meta',
                    'lead_id': leadgen_id,
                    'ad_id': str(lead_data.get("ad_id") or ad_id or ""),
                    'ad_name': lead_data.get("ad_name") or "Meta Lead Form Ad",
                    'campaign_id': str(campaign_id or lead_data.get("campaign_id") or ""),
                    'campaign_name': campaign_name,
                    'form_id': str(lead_data.get("form_id") or form_id or ""),
                    'custom_questions': custom_questions,
                    'field_data': field_data
                }

                # Avoid duplicate entries for the same lead_id
                existing_record = CustomerRecord.objects.filter(
                    upload=upload,
                    data__lead_id=leadgen_id
                ).first()

                if not existing_record:
                    record = CustomerRecord.objects.create(
                        upload=upload,
                        data=meta_payload
                    )
                else:
                    record = existing_record

                # Upsert into Contact model
                if owner_user and (email or phone_number):
                    try:
                        contact, _ = ContactService.upsert_contact(
                            owner=owner_user,
                            payload=meta_payload,
                            default_source="meta",
                            initial_upload=upload,
                            sub_source_type="meta_campaign",
                            sub_source_id=campaign_id or form_id or "meta_lead",
                            sub_source_name=campaign_name,
                        )
                        SystemEvent.objects.create(
                            event_type=SystemEvent.EventType.WEBHOOK,
                            event_name="META_LEAD_RECEIVED",
                            user_identifier=contact.email or contact.phone or f"contact_{contact.id}",
                            contact=contact,
                            metadata=meta_payload
                        )
                    except Exception as c_err:
                        logger.error(f"Failed to upsert Contact or SystemEvent for lead {leadgen_id}: {c_err}")

                results.append({"leadgen_id": leadgen_id, "email": email, "name": full_name})

        return results

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
