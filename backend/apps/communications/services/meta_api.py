import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class MetaAPIService:
    def __init__(self, app_id=None, app_secret=None, api_version=None):
        self.app_id = app_id or getattr(settings, "META_APP_ID", "")
        self.app_secret = app_secret or getattr(settings, "META_APP_SECRET", "")
        self.api_version = api_version or getattr(settings, "META_GRAPH_API_VERSION", "v19.0")
        self.base_url = f"https://graph.facebook.com/{self.api_version}"

    def exchange_code_for_token(self, code: str) -> dict:
        """
        Exchange Meta Embedded Signup authorization code for a access token.
        """
        if not self.app_id or not self.app_secret:
            raise ValueError("Meta App ID and App Secret are not configured in system settings.")

        url = f"{self.base_url}/oauth/access_token"
        params = {
            "client_id": self.app_id,
            "client_secret": self.app_secret,
            "code": code,
        }

        try:
            response = requests.get(url, params=params, timeout=15)
            data = response.json()
            if not response.ok or "error" in data:
                error_msg = data.get("error", {}).get("message", response.text)
                logger.error(f"Meta OAuth token exchange failed: {error_msg}")
                raise ValueError(f"Meta OAuth token exchange failed: {error_msg}")
            
            return {
                "access_token": data.get("access_token"),
                "token_type": data.get("token_type"),
                "expires_in": data.get("expires_in"),
            }
        except requests.RequestException as exc:
            logger.error(f"Network error during Meta token exchange: {exc}")
            raise RuntimeError(f"Network error during Meta token exchange: {str(exc)}") from exc

    def get_waba_details(self, waba_id: str, access_token: str) -> dict:
        """
        Fetch Meta WABA details.
        """
        url = f"{self.base_url}/{waba_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"fields": "id,name,currency,timezone_id,message_template_namespace"}

        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
            data = response.json()
            if not response.ok or "error" in data:
                error_msg = data.get("error", {}).get("message", response.text)
                logger.warning(f"Failed to fetch WABA details for {waba_id}: {error_msg}")
                return {"id": waba_id, "name": f"WABA {waba_id}"}
            return data
        except Exception as exc:
            logger.warning(f"Error fetching WABA details: {exc}")
            return {"id": waba_id, "name": f"WABA {waba_id}"}

    def get_phone_number_details(self, phone_number_id: str, access_token: str) -> dict:
        """
        Fetch WhatsApp Phone Number details including display_phone_number, quality_rating, verified_name.
        """
        url = f"{self.base_url}/{phone_number_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"fields": "id,display_phone_number,verified_name,quality_rating,code_verification_status,account_review_status"}

        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
            data = response.json()
            if not response.ok or "error" in data:
                error_msg = data.get("error", {}).get("message", response.text)
                logger.warning(f"Failed to fetch Phone Number details for {phone_number_id}: {error_msg}")
                return {
                    "id": phone_number_id,
                    "display_phone_number": phone_number_id,
                    "verified_name": "",
                    "quality_rating": "UNKNOWN",
                    "code_verification_status": "UNKNOWN",
                    "account_review_status": "UNKNOWN",
                }
            return data
        except Exception as exc:
            logger.warning(f"Error fetching phone details: {exc}")
            return {
                "id": phone_number_id,
                "display_phone_number": phone_number_id,
                "verified_name": "",
                "quality_rating": "UNKNOWN",
                "code_verification_status": "UNKNOWN",
                "account_review_status": "UNKNOWN",
            }

    def subscribe_waba_to_app(self, waba_id: str, access_token: str) -> bool:
        """
        Subscribe WABA to the app webhooks.
        POST /{waba_id}/subscribed_apps
        """
        url = f"{self.base_url}/{waba_id}/subscribed_apps"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(url, headers=headers, timeout=15)
            data = response.json()
            if not response.ok or "error" in data:
                error_msg = data.get("error", {}).get("message", response.text)
                logger.warning(f"WABA webhook subscription failed for {waba_id}: {error_msg}")
                return False
            logger.info(f"Successfully subscribed WABA {waba_id} to webhooks.")
            return True
        except Exception as exc:
            logger.error(f"Error subscribing WABA {waba_id} to webhooks: {exc}")
            return False

    def register_phone_number(self, phone_number_id: str, access_token: str, pin: str = "123456") -> bool:
        """
        Register a phone number with Meta Cloud API.
        POST /{phone_number_id}/register
        """
        url = f"{self.base_url}/{phone_number_id}/register"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "pin": pin,
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            data = response.json()
            if not response.ok or "error" in data:
                error_msg = data.get("error", {}).get("message", response.text)
                logger.warning(f"Phone registration info for {phone_number_id}: {error_msg}")
                return False
            logger.info(f"Successfully registered phone number {phone_number_id}.")
            return True
        except Exception as exc:
            logger.error(f"Error registering phone number {phone_number_id}: {exc}")
            return False
