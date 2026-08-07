import os
import requests
from typing import Dict, Any
import urllib.parse
from .base import BaseSocialProvider

class LinkedInProvider(BaseSocialProvider):
    """Implements LinkedIn OAuth 2.0 (v2 API)."""
    
    AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
    ACCESS_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    ME_URL = "https://api.linkedin.com/v2/userinfo"

    def __init__(self):
        self.client_id = os.environ.get("LINKEDIN_CLIENT_ID")
        self.client_secret = os.environ.get("LINKEDIN_CLIENT_SECRET")

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        if not self.client_id:
            raise ValueError("LINKEDIN_CLIENT_ID environment variable is missing.")
            
        scopes = "openid profile email w_member_social"
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": scopes
        }
        return f"{self.AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        if not self.client_id or not self.client_secret:
            raise ValueError("LinkedIn client credentials are missing in environment variables.")

        response = requests.post(self.ACCESS_TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        })
        response.raise_for_status()
        data = response.json()
        
        access_token = data.get("access_token")
        
        # Fetch user profile
        headers = {"Authorization": f"Bearer {access_token}"}
        me_resp = requests.get(self.ME_URL, headers=headers)
        me_resp.raise_for_status()
        me_data = me_resp.json()
        
        return {
            "access_token": access_token,
            "refresh_token": data.get("refresh_token"),
            "expires_in": data.get("expires_in"),
            "account_id": me_data.get("sub"),
            "account_name": me_data.get("name"),
            "metadata": {
                "picture": me_data.get("picture")
            }
        }

    def validate_token(self, access_token: str) -> bool:
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            resp = requests.get(self.ME_URL, headers=headers)
            return resp.status_code == 200
        except Exception:
            return False

    def revoke_token(self, access_token: str) -> bool:
        # LinkedIn does not have a standard token revocation endpoint
        # The user must revoke from their LinkedIn settings
        return True

    def publish_post(self, connection, content: str, image_url: str = None) -> dict:
        """Publishes to LinkedIn via UGC Post API."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}
            
        # account_id is the URN (e.g., 'urn:li:person:12345')
        # Sometimes connection.platform_account_id is just the raw ID, we need to prefix it
        author = connection.platform_account_id
        if not author.startswith("urn:li:"):
            author = f"urn:li:person:{author}"
            
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
            "LinkedIn-Version": "202601"
        }
        
        post_url = "https://api.linkedin.com/rest/posts"
        
        payload = {
            "author": author,
            "commentary": content,
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": []
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False
        }
        
        if image_url:
            asset_urn = self._upload_image_to_linkedin(access_token, author, image_url)
            if asset_urn:
                payload["content"] = {
                    "media": {
                        "id": asset_urn,
                        "title": "Attached Image"
                    }
                }
            else:
                return {"success": False, "error": "Failed to upload image to LinkedIn."}
                
        try:
            resp = requests.post(post_url, headers=headers, json=payload)
            resp.raise_for_status()
            
            # For rest/posts, the URN is usually returned in the 'x-linkedin-id' header or in the body
            post_urn = resp.headers.get("x-linkedin-id", "")
            if not post_urn and resp.text:
                try:
                    post_urn = resp.json().get("id", "")
                except:
                    pass
                    
            return {
                "success": True,
                "platform_post_id": post_urn
            }
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}

    def _upload_image_to_linkedin(self, access_token: str, author_urn: str, image_url: str) -> str:
        """
        Executes LinkedIn's image upload process using /rest/images.
        Returns the asset URN on success, or None on failure.
        """
        try:
            img_resp = requests.get(image_url, timeout=10)
            img_resp.raise_for_status()
            img_bytes = img_resp.content
        except Exception as e:
            import logging
            logging.error(f"Failed to download image from {image_url}: {e}")
            return None

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": "202601"
        }
        
        register_url = "https://api.linkedin.com/rest/images?action=initializeUpload"
        register_payload = {
            "initializeUploadRequest": {
                "owner": author_urn
            }
        }
        
        try:
            reg_resp = requests.post(register_url, headers=headers, json=register_payload)
            reg_resp.raise_for_status()
            reg_data = reg_resp.json()
            
            upload_url = reg_data["value"]["uploadUrl"]
            asset_urn = reg_data["value"]["image"]
        except Exception as e:
            import logging
            logging.error(f"Failed to register LinkedIn image upload: {e}")
            return None

        try:
            put_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/octet-stream"
            }
            put_resp = requests.put(upload_url, headers=put_headers, data=img_bytes)
            put_resp.raise_for_status()
        except Exception as e:
            import logging
            logging.error(f"Failed to upload binary image to LinkedIn: {e}")
            return None

        return asset_urn
