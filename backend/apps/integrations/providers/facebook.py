import os
import requests
from typing import Dict, Any
from .base import BaseSocialProvider

class FacebookProvider(BaseSocialProvider):
    """
    Implements Facebook OAuth 2.0.
    Since Instagram accounts are linked to Facebook Pages, this also covers Instagram.
    """
    AUTHORIZE_URL = "https://www.facebook.com/v19.0/dialog/oauth"
    ACCESS_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
    ME_URL = "https://graph.facebook.com/v19.0/me"

    def __init__(self):
        self.client_id = os.environ.get("FACEBOOK_CLIENT_ID", "")
        self.client_secret = os.environ.get("FACEBOOK_CLIENT_SECRET", "")

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        scopes = "public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"
        return f"{self.AUTHORIZE_URL}?client_id={self.client_id}&redirect_uri={redirect_uri}&state={state}&scope={scopes}"

    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        response = requests.get(self.ACCESS_TOKEN_URL, params={
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "client_secret": self.client_secret,
            "code": code
        })
        response.raise_for_status()
        data = response.json()
        
        short_lived_token = data.get("access_token")
        
        from django.conf import settings
        ll_resp = requests.get(self.ACCESS_TOKEN_URL, params={
            'grant_type': 'fb_exchange_token', 
            'client_id': settings.META_APP_ID if hasattr(settings, 'META_APP_ID') else self.client_id, 
            'client_secret': settings.META_APP_SECRET if hasattr(settings, 'META_APP_SECRET') else self.client_secret, 
            'fb_exchange_token': short_lived_token
        })
        ll_resp.raise_for_status()
        ll_data = ll_resp.json()
        access_token = ll_data.get("access_token")
        expires_in = ll_data.get("expires_in")
        
        # Fetch user profile
        me_resp = requests.get(self.ME_URL, params={
            "access_token": access_token,
            "fields": "id,name,accounts{id,name,instagram_business_account}"
        })
        me_resp.raise_for_status()
        me_data = me_resp.json()
        
        return {
            "access_token": access_token,
            "refresh_token": None,
            "expires_in": expires_in,
            "account_id": me_data.get("id"),
            "account_name": me_data.get("name"),
            "metadata": {
                "pages": me_data.get("accounts", {}).get("data", [])
            }
        }

    def refresh_access_token(self, current_token: str):
        from django.conf import settings
        resp = requests.get(self.ACCESS_TOKEN_URL, params={
            'grant_type': 'fb_exchange_token',
            'client_id': settings.META_APP_ID if hasattr(settings, 'META_APP_ID') else self.client_id,
            'client_secret': settings.META_APP_SECRET if hasattr(settings, 'META_APP_SECRET') else self.client_secret,
            'fb_exchange_token': current_token
        })
        resp.raise_for_status()
        data = resp.json()
        return data.get("access_token"), data.get("expires_in")

    def validate_token(self, access_token: str) -> bool:
        try:
            resp = requests.get(self.ME_URL, params={"access_token": access_token})
            return resp.status_code == 200
        except Exception:
            return False

    def revoke_token(self, access_token: str) -> bool:
        # Facebook allows revoking permissions by making a DELETE request to /me/permissions
        try:
            resp = requests.delete(f"https://graph.facebook.com/me/permissions", params={
                "access_token": access_token
            })
            return resp.status_code == 200
        except Exception:
            return False

    def publish_post(self, connection, content: str, image_url: str = None) -> dict:
        """Publishes to Facebook Page or Instagram Business Account."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}
            
        page_id = connection.platform_account_id
        is_instagram = connection.platform == "INSTAGRAM"
        
        try:
            if is_instagram:
                # Instagram requires 2 steps: 1. Create container, 2. Publish container
                # Note: IG requires an image for posting. If no image, it will fail.
                if not image_url:
                    return {"success": False, "error": "Instagram requires an image."}
                    
                container_url = f"https://graph.facebook.com/v19.0/{page_id}/media"
                container_resp = requests.post(container_url, data={
                    "image_url": image_url,
                    "caption": content,
                    "access_token": access_token
                })
                container_resp.raise_for_status()
                creation_id = container_resp.json().get("id")
                
                publish_url = f"https://graph.facebook.com/v19.0/{page_id}/media_publish"
                publish_resp = requests.post(publish_url, data={
                    "creation_id": creation_id,
                    "access_token": access_token
                })
                publish_resp.raise_for_status()
                
                return {
                    "success": True,
                    "platform_post_id": publish_resp.json().get("id")
                }
            else:
                # Facebook Page Post
                post_url = f"https://graph.facebook.com/v19.0/{page_id}/feed"
                payload = {
                    "message": content,
                    "access_token": access_token
                }
                
                if image_url:
                    post_url = f"https://graph.facebook.com/v19.0/{page_id}/photos"
                    payload["url"] = image_url
                    
                resp = requests.post(post_url, data=payload)
                resp.raise_for_status()
                
                return {
                    "success": True,
                    "platform_post_id": resp.json().get("id", resp.json().get("post_id"))
                }
                
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}
