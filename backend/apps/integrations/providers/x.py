import os
import base64
import requests
from typing import Dict, Any
from .base import BaseSocialProvider

class XProvider(BaseSocialProvider):
    """Implements X (Twitter) OAuth 2.0 with PKCE."""
    
    AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize"
    ACCESS_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
    ME_URL = "https://api.twitter.com/2/users/me"

    def __init__(self):
        self.client_id = os.environ.get("X_CLIENT_ID", "")
        self.client_secret = os.environ.get("X_CLIENT_SECRET", "")

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        scopes = "tweet.read tweet.write users.read offline.access"
        # In a real implementation, code_challenge should be dynamically generated.
        # For simplicity here, we assume a static challenge for demonstration.
        code_challenge = "challenge"
        return f"{self.AUTHORIZE_URL}?response_type=code&client_id={self.client_id}&redirect_uri={redirect_uri}&scope={scopes}&state={state}&code_challenge={code_challenge}&code_challenge_method=plain"

    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        auth_string = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
            "code_verifier": "challenge" # Must match challenge in auth url
        }
        
        response = requests.post(self.ACCESS_TOKEN_URL, headers=headers, data=data)
        response.raise_for_status()
        resp_data = response.json()
        
        access_token = resp_data.get("access_token")
        
        # Fetch user profile with public_metrics
        me_headers = {"Authorization": f"Bearer {access_token}"}
        me_url = f"{self.ME_URL}?user.fields=public_metrics,profile_image_url,description"
        me_resp = requests.get(me_url, headers=me_headers)
        me_resp.raise_for_status()
        me_data = me_resp.json().get("data", {})
        
        return {
            "access_token": access_token,
            "refresh_token": resp_data.get("refresh_token"),
            "expires_in": resp_data.get("expires_in"),
            "account_id": me_data.get("id"),
            "account_name": me_data.get("username"),
            "metadata": {
                "name": me_data.get("name"),
                "profile_image_url": me_data.get("profile_image_url"),
                "public_metrics": me_data.get("public_metrics", {}),
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
        auth_string = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "token": access_token,
            "token_type_hint": "access_token"
        }
        
        try:
            resp = requests.post("https://api.twitter.com/2/oauth2/revoke", headers=headers, data=data)
            return resp.status_code == 200
        except Exception:
            return False

    def refresh_access_token(self, connection) -> bool:
        refresh_token = connection.get_refresh_token()
        if not refresh_token:
            return False

        auth_string = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        
        try:
            response = requests.post(self.ACCESS_TOKEN_URL, headers=headers, data=data)
            response.raise_for_status()
            resp_data = response.json()
            
            connection.set_tokens(
                access_token=resp_data.get("access_token"),
                refresh_token=resp_data.get("refresh_token") or refresh_token
            )
            if resp_data.get("expires_in"):
                from django.utils import timezone
                from datetime import timedelta
                connection.token_expires_at = timezone.now() + timedelta(seconds=resp_data.get("expires_in"))
            connection.save()
            return True
        except Exception as e:
            return False

    def publish_post(self, connection, content: str, image_url: str = None) -> dict:
        """Publishes a Tweet via Twitter API v2."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}
            
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        post_url = "https://api.twitter.com/2/tweets"
        payload = {
            "text": content
        }
        
        if image_url:
            payload["text"] = f"{content}\n\n{image_url}"
            
        try:
            resp = requests.post(post_url, headers=headers, json=payload)
            resp.raise_for_status()
            
            return {
                "success": True,
                "platform_post_id": resp.json().get("data", {}).get("id")
            }
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if e.response is not None:
                error_msg = e.response.text
            return {"success": False, "error": error_msg}

    def get_user_analytics(self, connection) -> dict:
        """Fetches X User Account Metrics (followers_count, following_count, tweet_count, listed_count)."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}

        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            me_url = f"{self.ME_URL}?user.fields=public_metrics,profile_image_url,description"
            resp = requests.get(me_url, headers=headers)
            resp.raise_for_status()
            data = resp.json().get("data", {})
            return {
                "success": True,
                "user": data,
                "public_metrics": data.get("public_metrics", {}),
            }
        except requests.exceptions.RequestException as e:
            # Fallback to connection metadata if live request rate limited
            cached_metrics = connection.metadata.get("public_metrics", {}) if connection.metadata else {}
            return {
                "success": True,
                "user": {"username": connection.account_name},
                "public_metrics": cached_metrics,
                "note": "Using cached metrics."
            }

    def get_recent_tweets(self, connection, limit: int = 25) -> dict:
        """Fetches User Recent Tweets with public performance metrics."""
        access_token = connection.get_access_token()
        if not access_token:
            return {"success": False, "error": "No access token available."}

        user_id = connection.platform_account_id
        if not user_id:
            return {"success": False, "error": "Missing X user account ID."}

        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            url = f"https://api.twitter.com/2/users/{user_id}/tweets"
            params = {
                "max_results": limit,
                "tweet.fields": "created_at,public_metrics,entities"
            }
            resp = requests.get(url, headers=headers, params=params)
            resp.raise_for_status()
            return {
                "success": True,
                "tweets": resp.json().get("data", []),
                "username": connection.account_name,
            }
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

