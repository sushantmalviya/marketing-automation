import os
import requests
from typing import Dict, Any
from .base import BaseSocialProvider
from urllib.parse import urlencode

class InstagramProvider(BaseSocialProvider):
    """
    Implements Instagram OAuth using the dedicated Instagram Login.
    """
    AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize"
    ACCESS_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
    # To get long-lived token and user info, we use graph.instagram.com
    GRAPH_URL = "https://graph.instagram.com/v20.0" 
    
    def __init__(self):
        self.client_id = os.environ.get("INSTAGRAM_CLIENT_ID", "")
        self.client_secret = os.environ.get("INSTAGRAM_CLIENT_SECRET", "")

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        scopes = "instagram_business_basic,instagram_business_content_publish"

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scopes,
            "state": state,
        }

        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        # 1. Exchange code for short-lived access token
        resp = requests.post(self.ACCESS_TOKEN_URL, data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
            "code": code
        })
        resp.raise_for_status()
        data = resp.json()
        short_lived_token = data.get("access_token")

        # 2. Exchange for long-lived token
        ll_resp = requests.get(f"{self.GRAPH_URL}/access_token", params={
            "grant_type": "ig_exchange_token",
            "client_secret": self.client_secret,
            "access_token": short_lived_token
        })
        ll_resp.raise_for_status()
        ll_data = ll_resp.json()
        access_token = ll_data.get("access_token")
        expires_in = ll_data.get("expires_in")

        # 3. Fetch user profile
        me_resp = requests.get(f"{self.GRAPH_URL}/me", params={
            "fields": "id,username,name,account_type",
            "access_token": access_token
        })
        me_resp.raise_for_status()
        me_data = me_resp.json()

        return {
            "access_token": access_token,
            "refresh_token": None,
            "expires_in": expires_in,
            "account_id": me_data.get("id"),
            "account_name": me_data.get("username", me_data.get("name", "Instagram Account")),
            "metadata": {
                "account_type": me_data.get("account_type")
            }
        }

    def validate_token(self, access_token: str) -> bool:
        try:
            resp = requests.get(f"{self.GRAPH_URL}/me", params={"access_token": access_token})
            return resp.status_code == 200
        except Exception:
            return False

    def refresh_access_token(self, current_token: str) -> str:
        try:
            url = f"{self.GRAPH_URL}/refresh_access_token"
            resp = requests.get(url, params={
                'grant_type': 'ig_refresh_token',
                'access_token': current_token
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("access_token")
        except requests.exceptions.RequestException:
            return None

    def revoke_token(self, access_token: str) -> bool:
        # Instagram API currently doesn't provide a direct revoke endpoint
        # Users must revoke via their Instagram App settings
        return True

    def check_media_status(self, ig_container_id: str, access_token: str) -> str:
        try:
            url = f"{self.GRAPH_URL}/{ig_container_id}"
            resp = requests.get(url, params={
                "fields": "status_code",
                "access_token": access_token
            })
            resp.raise_for_status()
            return resp.json().get("status_code", "ERROR")
        except requests.exceptions.RequestException:
            return "ERROR"

    def publish_post(self, connection, content: str, image_url: str = None) -> dict:
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}
            
        ig_user_id = connection.platform_account_id
        
        try:
            if not image_url:
                return {"success": False, "error": "Instagram requires a media URL to post."}

            if image_url and not any(image_url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.mp4', '.mov']):
                image_url = f"{image_url}.jpg"

            is_video = image_url.lower().endswith(('.mp4', '.mov'))
            media_type = 'REELS' if is_video else 'IMAGE'

            # 1. Create Media Container
            container_url = f"{self.GRAPH_URL}/{ig_user_id}/media"
            payload = {
                "caption": content,
                "access_token": access_token
            }
            if media_type == 'REELS':
                payload["media_type"] = "REELS"
                payload["video_url"] = image_url
            else:
                payload["image_url"] = image_url

            container_resp = requests.post(container_url, data=payload)
            container_resp.raise_for_status()
            creation_id = container_resp.json().get("id")
            
            import time
            max_retries = 20
            for _ in range(max_retries):
                status = self.check_media_status(creation_id, access_token)
                if status == "FINISHED":
                    break
                elif status == "ERROR":
                    return {"success": False, "error": "Instagram media processing failed."}
                time.sleep(3)
            
            # 2. Publish Container
            publish_url = f"{self.GRAPH_URL}/{ig_user_id}/media_publish"
            publish_resp = requests.post(publish_url, data={
                "creation_id": creation_id,
                "access_token": access_token
            })
            publish_resp.raise_for_status()
            
            return {
                "success": True,
                "platform_post_id": publish_resp.json().get("id")
            }
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}
