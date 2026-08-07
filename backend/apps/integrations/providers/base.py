from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple

class BaseSocialProvider(ABC):
    """Abstract base class for all Social Media OAuth Providers."""
    
    @abstractmethod
    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """
        Returns the authorization URL to redirect the user to.
        """
        pass

    @abstractmethod
    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """
        Exchanges an authorization code for access and refresh tokens.
        Returns a dict containing:
        {
            "access_token": "...",
            "refresh_token": "...", # Optional
            "expires_in": 3600, # Optional
            "account_id": "...",
            "account_name": "...",
            "metadata": {...}
        }
        """
        pass

    @abstractmethod
    def validate_token(self, access_token: str) -> bool:
        """
        Validates if an access token is still valid.
        """
        pass

    @abstractmethod
    def revoke_token(self, access_token: str) -> bool:
        """
        Revokes an access token on the provider's side (if supported).
        """
        pass

    def refresh_access_token(self, connection) -> bool:
        """
        Refreshes the access token if supported. Returns True if refreshed, False otherwise.
        """
        return False

    @abstractmethod
    def publish_post(self, connection, content: str, image_url: str = None) -> dict:
        """
        Publishes content to the platform.
        Returns a dict containing:
        {
            "success": True/False,
            "platform_post_id": "...",
            "error": "..." # If success is False
        }
        """
        pass

