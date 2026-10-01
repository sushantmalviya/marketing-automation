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
        scopes = "public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,pages_manage_engagement,read_insights,instagram_basic,instagram_content_publish"
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
            "fields": "id,name,accounts{id,name,access_token,instagram_business_account}"
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
        try:
            resp = requests.delete("https://graph.facebook.com/me/permissions", params={
                "access_token": access_token
            })
            return resp.status_code == 200
        except Exception:
            return False

    def publish_post(self, connection, content: str, image_url: str = None, link_url: str = None) -> dict:
        """Publishes Text, Image, Video, or Link share to Facebook Page or Instagram Account."""
        pages = connection.metadata.get("pages", []) if connection.metadata else []
        if not pages:
            return {"success": False, "error": "No Facebook Pages found. You must create a Facebook Page to publish."}
            
        page = pages[0]
        page_id = page.get("id")
        access_token = page.get("access_token")
        
        if not access_token:
            return {"success": False, "error": "Missing Page Access Token. Please re-connect your Facebook account."}
            
        is_instagram = connection.platform == "INSTAGRAM"
        
        try:
            if is_instagram:
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
                # Video Upload to Facebook Page
                if image_url and image_url.lower().endswith((".mp4", ".mov")):
                    video_url = f"https://graph.facebook.com/v19.0/{page_id}/videos"
                    resp = requests.post(video_url, data={
                        "description": content,
                        "file_url": image_url,
                        "access_token": access_token
                    })
                    resp.raise_for_status()
                    return {"success": True, "platform_post_id": resp.json().get("id")}

                # Photo Post to Facebook Page
                elif image_url:
                    photo_url = f"https://graph.facebook.com/v19.0/{page_id}/photos"
                    resp = requests.post(photo_url, data={
                        "caption": content,
                        "url": image_url,
                        "access_token": access_token
                    })
                    resp.raise_for_status()
                    return {"success": True, "platform_post_id": resp.json().get("id", resp.json().get("post_id"))}

                # Link or Text Post to Facebook Page Feed
                else:
                    post_url = f"https://graph.facebook.com/v19.0/{page_id}/feed"
                    payload = {
                        "message": content,
                        "access_token": access_token
                    }
                    if link_url:
                        payload["link"] = link_url

                    resp = requests.post(post_url, data=payload)
                    resp.raise_for_status()
                    return {"success": True, "platform_post_id": resp.json().get("id")}
                
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}

    def get_page_insights(self, connection, page_id: str = None) -> dict:
        """Fetches Facebook Page Insights (impressions, engaged users, post engagements)."""
        pages = connection.metadata.get("pages", []) if connection.metadata else []
        if not pages:
            return {"success": False, "error": "No Facebook Page found."}

        target_page = next((p for p in pages if p.get("id") == page_id), pages[0]) if page_id else pages[0]
        p_id = target_page.get("id")
        access_token = target_page.get("access_token")

        if not access_token:
            return {"success": False, "error": "Missing Page access token."}

        try:
            url = f"https://graph.facebook.com/v19.0/{p_id}/insights"
            metrics = "page_impressions,page_engaged_users,page_post_engagements,page_daily_follows"
            resp = requests.get(url, params={"metric": metrics, "period": "day", "access_token": access_token})
            resp.raise_for_status()
            return {"success": True, "insights": resp.json().get("data", []), "page_id": p_id}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_recent_posts(self, connection, page_id: str = None, limit: int = 25) -> dict:
        """Fetches recent posts from Facebook Page feed with reactions and comment summary."""
        pages = connection.metadata.get("pages", []) if connection.metadata else []
        if not pages:
            return {"success": False, "error": "No Facebook Page found."}

        target_page = next((p for p in pages if p.get("id") == page_id), pages[0]) if page_id else pages[0]
        p_id = target_page.get("id")
        access_token = target_page.get("access_token")

        if not access_token:
            return {"success": False, "error": "Missing Page access token."}

        try:
            url = f"https://graph.facebook.com/v19.0/{p_id}/feed"
            fields = "id,message,created_time,full_picture,permalink_url,shares,reactions.summary(true),comments.summary(true)"
            resp = requests.get(url, params={"fields": fields, "limit": limit, "access_token": access_token})
            resp.raise_for_status()
            return {"success": True, "posts": resp.json().get("data", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_post_comments(self, connection, post_id: str) -> dict:
        """Fetches comments on a Facebook Page post."""
        pages = connection.metadata.get("pages", []) if connection.metadata else []
        access_token = pages[0].get("access_token") if pages else connection.get_access_token()

        try:
            url = f"https://graph.facebook.com/v19.0/{post_id}/comments"
            fields = "id,from,message,created_time,like_count,comment_count"
            resp = requests.get(url, params={"fields": fields, "access_token": access_token})
            resp.raise_for_status()
            return {"success": True, "comments": resp.json().get("data", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def reply_to_comment(self, connection, comment_id: str, message: str) -> dict:
        """Replies to a user comment on a Facebook Page post as the Page identity."""
        pages = connection.metadata.get("pages", []) if connection.metadata else []
        access_token = pages[0].get("access_token") if pages else connection.get_access_token()

        try:
            url = f"https://graph.facebook.com/v19.0/{comment_id}/comments"
            resp = requests.post(url, data={"message": message, "access_token": access_token})
            resp.raise_for_status()
            return {"success": True, "reply_id": resp.json().get("id")}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

