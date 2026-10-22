import os
import json
import time
import requests
from typing import Dict, Any, List, Optional
from .base import BaseSocialProvider
from urllib.parse import urlencode

class InstagramProvider(BaseSocialProvider):
    """
    Implements Instagram Graph API & Instagram Login with:
    - OAuth Authorization & Token Exchange
    - Advanced Publishing (Single Image, Single Reel, Carousels up to 10 items)
    - Post Settings (User Tags, Location Tagging, Custom Reels Cover, Audio Name, Share to Feed)
    - User Insights & Media Analytics (Reach, Impressions, Likes, Comments, Shares, Saved, Video Plays)
    - Community Management (Comments Listing & Reply API)
    """
    AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize"
    ACCESS_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
    GRAPH_URL = "https://graph.instagram.com/v20.0"

    def __init__(self):
        self.client_id = os.environ.get("INSTAGRAM_CLIENT_ID", "")
        self.client_secret = os.environ.get("INSTAGRAM_CLIENT_SECRET", "")

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        scopes = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_comments,instagram_business_manage_messages"

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scopes,
            "state": state,
        }

        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
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

        ll_resp = requests.get(f"{self.GRAPH_URL}/access_token", params={
            "grant_type": "ig_exchange_token",
            "client_secret": self.client_secret,
            "access_token": short_lived_token
        })
        ll_resp.raise_for_status()
        ll_data = ll_resp.json()
        access_token = ll_data.get("access_token")
        expires_in = ll_data.get("expires_in")

        me_resp = requests.get(f"{self.GRAPH_URL}/me", params={
            "fields": "id,username,name,account_type,profile_picture_url,followers_count,media_count",
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
                "account_type": me_data.get("account_type"),
                "profile_picture_url": me_data.get("profile_picture_url"),
                "followers_count": me_data.get("followers_count", 0),
                "media_count": me_data.get("media_count", 0),
            }
        }

    def validate_token(self, access_token: str) -> bool:
        try:
            resp = requests.get(f"{self.GRAPH_URL}/me", params={"access_token": access_token})
            return resp.status_code == 200
        except Exception:
            return False

    def refresh_access_token(self, current_token: str) -> Optional[str]:
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

    def _wait_for_media_processing(self, creation_id: str, access_token: str, max_retries: int = 20) -> bool:
        for _ in range(max_retries):
            status = self.check_media_status(creation_id, access_token)
            if status == "FINISHED":
                return True
            elif status == "ERROR":
                return False
            time.sleep(3)
        return False

    def _publish_container(self, ig_user_id: str, creation_id: str, access_token: str) -> dict:
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

    def publish_post(
        self,
        connection,
        content: str,
        image_url: Optional[str] = None,
        location_id: Optional[str] = None,
        user_tags: Optional[List[Dict[str, Any]]] = None,
        cover_url: Optional[str] = None,
        thumb_offset: Optional[int] = None,
        share_to_feed: bool = True,
        audio_name: Optional[str] = None,
        collaborators: Optional[List[str]] = None,
        first_comment: Optional[str] = None,
    ) -> dict:
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}

        ig_user_id = connection.platform_account_id

        try:
            if not image_url:
                return {"success": False, "error": "Instagram requires a media URL to post."}

            if 'res.cloudinary.com' in image_url and '/upload/' in image_url:
                image_url = image_url.replace('/upload/', '/upload/c_pad,w_1080,h_1080,b_auto/')

            if image_url and image_url.startswith('http://') and '127.0.0.1' not in image_url and 'localhost' not in image_url:
                image_url = image_url.replace('http://', 'https://')

            is_video = image_url.lower().endswith(('.mp4', '.mov'))
            media_type = 'REELS' if is_video else 'IMAGE'

            container_url = f"{self.GRAPH_URL}/{ig_user_id}/media"
            payload = {
                "caption": content,
                "access_token": access_token
            }

            if media_type == 'REELS':
                payload["media_type"] = "REELS"
                payload["video_url"] = image_url
                payload["share_to_feed"] = "true" if share_to_feed else "false"
                if cover_url:
                    payload["cover_url"] = cover_url
                if thumb_offset is not None:
                    payload["thumb_offset"] = str(thumb_offset)
                if audio_name:
                    payload["audio_name"] = audio_name
            else:
                payload["image_url"] = image_url

            if location_id:
                clean_loc = str(location_id).strip()
                if clean_loc.isdigit():
                    payload["location_id"] = clean_loc
                else:
                    import logging
                    logging.getLogger(__name__).warning(f"Ignoring non-numeric location_id '{location_id}'. Instagram requires a numeric Facebook Location Page ID.")

            if user_tags and isinstance(user_tags, list):
                payload["user_tags"] = json.dumps(user_tags)

            if collaborators and isinstance(collaborators, list):
                payload["collaborators"] = json.dumps(collaborators)

            container_resp = requests.post(container_url, data=payload)
            container_resp.raise_for_status()
            creation_id = container_resp.json().get("id")

            if not self._wait_for_media_processing(creation_id, access_token):
                return {"success": False, "error": "Instagram media processing failed or timed out."}

            res = self._publish_container(ig_user_id, creation_id, access_token)
            if res.get("success") and first_comment:
                media_id = res.get("platform_post_id")
                try:
                    comment_resp = requests.post(f"{self.GRAPH_URL}/{media_id}/comments", data={
                        "message": first_comment,
                        "access_token": access_token
                    })
                    comment_resp.raise_for_status()
                    res["first_comment_id"] = comment_resp.json().get("id")
                except Exception as comment_err:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to post Instagram first comment on media {media_id}: {str(comment_err)}")
                    res["first_comment_error"] = str(comment_err)

            return res

        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}

    def publish_carousel(
        self,
        connection,
        items: List[Dict[str, Any]],
        caption: str,
        location_id: Optional[str] = None,
    ) -> dict:
        """
        Publishes a Carousel Post (Up to 10 items).
        items = [{"type": "IMAGE"|"VIDEO", "url": "https://..."}, ...]
        """
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}

        ig_user_id = connection.platform_account_id

        if not items or len(items) < 2 or len(items) > 10:
            return {"success": False, "error": "Instagram Carousel requires between 2 and 10 media items."}

        try:
            item_container_ids = []
            for item in items:
                media_type = item.get("type", "IMAGE").upper()
                media_url = item.get("url", "")
                if 'res.cloudinary.com' in media_url and '/upload/' in media_url and media_type == "IMAGE":
                    media_url = media_url.replace('/upload/', '/upload/c_pad,w_1080,h_1080,b_auto/')

                payload = {
                    "is_carousel_item": "true",
                    "access_token": access_token
                }
                if media_type == "VIDEO":
                    payload["media_type"] = "VIDEO"
                    payload["video_url"] = media_url
                else:
                    payload["image_url"] = media_url

                if "user_tags" in item and isinstance(item["user_tags"], list):
                    payload["user_tags"] = json.dumps(item["user_tags"])

                resp = requests.post(f"{self.GRAPH_URL}/{ig_user_id}/media", data=payload)
                resp.raise_for_status()
                cid = resp.json().get("id")

                if media_type == "VIDEO" and not self._wait_for_media_processing(cid, access_token):
                    return {"success": False, "error": f"Carousel video item failed processing."}

                item_container_ids.append(cid)

            master_payload = {
                "media_type": "CAROUSEL",
                "caption": caption,
                "children": ",".join(item_container_ids),
                "access_token": access_token
            }
            if location_id:
                master_payload["location_id"] = location_id

            master_resp = requests.post(f"{self.GRAPH_URL}/{ig_user_id}/media", data=master_payload)
            master_resp.raise_for_status()
            master_creation_id = master_resp.json().get("id")

            if not self._wait_for_media_processing(master_creation_id, access_token):
                return {"success": False, "error": "Master Carousel processing failed."}

            return self._publish_container(ig_user_id, master_creation_id, access_token)

        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}

    def get_user_insights(self, connection) -> dict:
        """Fetches account-level metrics (Reach, Impressions, Follower Count, Profile Views)."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        ig_user_id = connection.platform_account_id
        try:
            url = f"{self.GRAPH_URL}/{ig_user_id}/insights"
            params = {
                "metric": "reach,impressions,profile_views,follower_count,accounts_engaged",
                "period": "day",
                "access_token": access_token
            }
            resp = requests.get(url, params=params)
            resp.raise_for_status()
            return {"success": True, "insights": resp.json().get("data", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_media_insights(self, connection, media_id: str) -> dict:
        """Fetches media metrics (Likes, Comments, Shares, Saved, Reach, Impressions, Video Plays)."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        try:
            url = f"{self.GRAPH_URL}/{media_id}/insights"
            params = {
                "metric": "engagement,impressions,reach,saved,shares,video_views,plays",
                "access_token": access_token
            }
            resp = requests.get(url, params=params)
            resp.raise_for_status()
            return {"success": True, "media_id": media_id, "metrics": resp.json().get("data", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_recent_media(self, connection, limit: int = 25) -> dict:
        """Fetches recent published posts feed with permalinks and engagement counts."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        ig_user_id = connection.platform_account_id
        try:
            url = f"{self.GRAPH_URL}/{ig_user_id}/media"
            params = {
                "fields": "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count",
                "limit": limit,
                "access_token": access_token
            }
            resp = requests.get(url, params=params)
            resp.raise_for_status()
            return {"success": True, "posts": resp.json().get("data", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_media_comments(self, connection, media_id: str) -> dict:
        """Fetches top-level comments for a post."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        try:
            url = f"{self.GRAPH_URL}/{media_id}/comments"
            params = {
                "fields": "id,text,username,timestamp,like_count",
                "access_token": access_token
            }
            resp = requests.get(url, params=params)
            resp.raise_for_status()
            return {"success": True, "comments": resp.json().get("data", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def reply_to_comment(self, connection, comment_id: str, message: str) -> dict:
        """Replies to a user comment."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        try:
            url = f"{self.GRAPH_URL}/{comment_id}/replies"
            resp = requests.post(url, data={
                "message": message,
                "access_token": access_token
            })
            resp.raise_for_status()
            return {"success": True, "reply_id": resp.json().get("id")}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

