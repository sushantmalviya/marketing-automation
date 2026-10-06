import os
import logging
import urllib.parse
from typing import Dict, Any, List, Optional
import requests
from .base import BaseSocialProvider

logger = logging.getLogger(__name__)


class LinkedInProvider(BaseSocialProvider):
    """
    Implements LinkedIn OAuth 2.0 & Community/Analytics APIs:
    - Member Profile & Organization Page Publishing (Person & Organization URNs)
    - Multi-Image, Native Video Uploads, Article Link Shares
    - Organizational Share Statistics (Impressions, Clicks, Likes, Comments, Shares, Engagement Rate)
    - Follower Demographics (Seniority, Industry, Job Function, Country)
    - Community Comments & Inline Replies API
    """

    AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
    ACCESS_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    ME_URL = "https://api.linkedin.com/v2/userinfo"
    REST_BASE_URL = "https://api.linkedin.com/rest"

    def __init__(self):
        self.client_id = os.environ.get("LINKEDIN_CLIENT_ID")
        self.client_secret = os.environ.get("LINKEDIN_CLIENT_SECRET")

    def _get_headers(self, access_token: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
            "LinkedIn-Version": "202601",
        }

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        if not self.client_id:
            raise ValueError("LINKEDIN_CLIENT_ID environment variable is missing.")

        scopes = "openid profile email w_member_social w_organization_social r_organization_social rw_organization_admin"
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": scopes,
        }
        return f"{self.AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        if not self.client_id or not self.client_secret:
            raise ValueError("LinkedIn client credentials are missing in environment variables.")

        response = requests.post(
            self.ACCESS_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
        )
        response.raise_for_status()
        data = response.json()
        access_token = data.get("access_token")

        headers = {"Authorization": f"Bearer {access_token}"}
        me_resp = requests.get(self.ME_URL, headers=headers)
        me_resp.raise_for_status()
        me_data = me_resp.json()

        # Fetch managed organization pages
        orgs = self.get_managed_organizations(access_token)

        return {
            "access_token": access_token,
            "refresh_token": data.get("refresh_token"),
            "expires_in": data.get("expires_in"),
            "account_id": me_data.get("sub"),
            "account_name": me_data.get("name"),
            "metadata": {
                "picture": me_data.get("picture"),
                "email": me_data.get("email"),
                "managed_organizations": orgs,
            },
        }

    def validate_token(self, access_token: str) -> bool:
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            resp = requests.get(self.ME_URL, headers=headers)
            return resp.status_code == 200
        except Exception:
            return False

    def revoke_token(self, access_token: str) -> bool:
        return True

    def get_managed_organizations(self, access_token: str) -> List[Dict[str, Any]]:
        """Fetches LinkedIn Organization Pages where user has ADMIN roles."""
        try:
            url = f"{self.REST_BASE_URL}/organizationalEntityAcls?q=roleAssignee"
            headers = self._get_headers(access_token)
            resp = requests.get(url, headers=headers)
            if resp.status_code != 200:
                return []
            data = resp.json().get("elements", [])
            orgs = []
            for item in data:
                org_urn = item.get("organizationalTarget")
                role = item.get("role")
                if org_urn:
                    orgs.append({"organization_urn": org_urn, "role": role})
            return orgs
        except Exception as e:
            logger.error(f"Failed to fetch LinkedIn managed organizations: {e}")
            return []

    def publish_post(
        self,
        connection,
        content: str,
        image_url: Optional[str] = None,
        author_urn: Optional[str] = None,
        article_url: Optional[str] = None,
        article_title: Optional[str] = None,
        article_description: Optional[str] = None,
    ) -> dict:
        """Publishes post to Personal Profile or Company Page on LinkedIn."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}

        author = author_urn or connection.platform_account_id
        if not author.startswith("urn:li:"):
            author = f"urn:li:person:{author}"

        headers = self._get_headers(access_token)
        post_url = f"{self.REST_BASE_URL}/posts"

        payload = {
            "author": author,
            "commentary": content,
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": [],
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        }

        # Handle Article Link Share
        if article_url:
            payload["content"] = {
                "article": {
                    "source": article_url,
                    "title": article_title or "Shared Article",
                    "description": article_description or "",
                }
            }
            if image_url:
                asset_urn = self._upload_image_to_linkedin(access_token, author, image_url)
                if asset_urn:
                    payload["content"]["article"]["thumbnail"] = asset_urn

        # Handle Image or Video Upload
        elif image_url:
            is_video = image_url.lower().endswith((".mp4", ".mov"))
            if is_video:
                asset_urn = self._upload_video_to_linkedin(access_token, author, image_url)
            else:
                asset_urn = self._upload_image_to_linkedin(access_token, author, image_url)

            if asset_urn:
                payload["content"] = {
                    "media": {
                        "id": asset_urn,
                        "title": "Attached Media",
                    }
                }
            else:
                return {"success": False, "error": "Failed to upload media to LinkedIn."}

        try:
            resp = requests.post(post_url, headers=headers, json=payload)
            resp.raise_for_status()

            post_urn = resp.headers.get("x-linkedin-id", "")
            if not post_urn and resp.text:
                try:
                    post_urn = resp.json().get("id", "")
                except Exception:
                    pass

            return {"success": True, "platform_post_id": post_urn}

        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}

    def _upload_image_to_linkedin(self, access_token: str, author_urn: str, image_url: str) -> Optional[str]:
        try:
            img_resp = requests.get(image_url, timeout=10)
            img_resp.raise_for_status()
            img_bytes = img_resp.content
        except Exception as e:
            logger.error(f"Failed to download image from {image_url}: {e}")
            return None

        headers = self._get_headers(access_token)
        register_url = f"{self.REST_BASE_URL}/images?action=initializeUpload"
        register_payload = {"initializeUploadRequest": {"owner": author_urn}}

        try:
            reg_resp = requests.post(register_url, headers=headers, json=register_payload)
            reg_resp.raise_for_status()
            reg_data = reg_resp.json()
            upload_url = reg_data["value"]["uploadUrl"]
            asset_urn = reg_data["value"]["image"]
        except Exception as e:
            logger.error(f"Failed to register LinkedIn image upload: {e}")
            return None

        try:
            put_headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/octet-stream"}
            put_resp = requests.put(upload_url, headers=put_headers, data=img_bytes)
            put_resp.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to upload binary image to LinkedIn: {e}")
            return None

        return asset_urn

    def _upload_video_to_linkedin(self, access_token: str, author_urn: str, video_url: str) -> Optional[str]:
        try:
            vid_resp = requests.get(video_url, timeout=20)
            vid_resp.raise_for_status()
            vid_bytes = vid_resp.content
        except Exception as e:
            logger.error(f"Failed to download video from {video_url}: {e}")
            return None

        headers = self._get_headers(access_token)
        register_url = f"{self.REST_BASE_URL}/videos?action=initializeUpload"
        register_payload = {
            "initializeUploadRequest": {
                "owner": author_urn,
                "fileSizeBytes": len(vid_bytes),
                "uploadCaptions": False,
                "uploadThumbnail": False,
            }
        }

        try:
            reg_resp = requests.post(register_url, headers=headers, json=register_payload)
            reg_resp.raise_for_status()
            reg_data = reg_resp.json()
            upload_instructions = reg_data["value"]["uploadInstructions"]
            upload_url = upload_instructions[0]["uploadUrl"]
            video_urn = reg_data["value"]["video"]
        except Exception as e:
            logger.error(f"Failed to register LinkedIn video upload: {e}")
            return None

        try:
            put_headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/octet-stream"}
            put_resp = requests.put(upload_url, headers=put_headers, data=vid_bytes)
            put_resp.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to upload binary video to LinkedIn: {e}")
            return None

        return video_urn

    def get_organization_insights(self, connection, org_urn: str) -> dict:
        """Fetches LinkedIn Organizational Page Analytics (Impressions, Clicks, Likes, Comments, Shares)."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        try:
            url = f"{self.REST_BASE_URL}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity={org_urn}"
            headers = self._get_headers(access_token)
            resp = requests.get(url, headers=headers)
            resp.raise_for_status()
            return {"success": True, "statistics": resp.json().get("elements", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_follower_demographics(self, connection, org_urn: str) -> dict:
        """Fetches follower demographics by Seniority, Industry, Job Function, and Country."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        try:
            url = f"{self.REST_BASE_URL}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity={org_urn}"
            headers = self._get_headers(access_token)
            resp = requests.get(url, headers=headers)
            resp.raise_for_status()
            return {"success": True, "demographics": resp.json().get("elements", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def get_post_comments(self, connection, share_urn: str) -> dict:
        """Fetches comments on a LinkedIn post or share."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        try:
            url = f"{self.REST_BASE_URL}/socialActions/{share_urn}/comments"
            headers = self._get_headers(access_token)
            resp = requests.get(url, headers=headers)
            resp.raise_for_status()
            return {"success": True, "comments": resp.json().get("elements", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def reply_to_comment(self, connection, comment_urn: str, message: str) -> dict:
        """Replies to a user comment on LinkedIn."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token."}

        author = connection.platform_account_id
        if not author.startswith("urn:li:"):
            author = f"urn:li:person:{author}"

        try:
            url = f"{self.REST_BASE_URL}/socialActions/{comment_urn}/comments"
            headers = self._get_headers(access_token)
            payload = {
                "actor": author,
                "message": {"text": message},
            }
            resp = requests.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return {"success": True, "reply_urn": resp.headers.get("x-linkedin-id", "")}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

