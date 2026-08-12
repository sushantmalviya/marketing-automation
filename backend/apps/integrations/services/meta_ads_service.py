from typing import Dict, List, Any, Optional


class MetaAdsService:
    """
    Dummy service class to handle Meta Ads business logic and mock Meta Graph API responses
    until production API keys and Meta SDK integration are configured.
    """

    @staticmethod
    def get_auth_url() -> Dict[str, str]:
        """
        Generate mock Meta OAuth authorization URL and CSRF state.

        Returns:
            Dict containing 'auth_url' and 'csrf_state'.
        """
        return {
            "auth_url": (
                "https://www.facebook.com/v18.0/dialog/oauth?"
                "client_id=123456789012345&"
                "redirect_uri=http://localhost:8000/api/v1/integrations/meta/callback/&"
                "scope=ads_read,ads_management,business_management&"
                "state=abc123xyz"
            ),
            "csrf_state": "abc123xyz",
        }

    @staticmethod
    def get_ad_accounts(user: Optional[Any] = None) -> List[Dict[str, Any]]:
        """
        Fetch dummy Meta Ad Accounts associated with the user.

        Args:
            user: Optional user instance.

        Returns:
            List of dictionaries containing ad account details.
        """
        return [
            {
                "account_id": "act_1020304050",
                "name": "Main Marketing Account",
                "currency": "USD",
                "account_status": "ACTIVE",
            },
            {
                "account_id": "act_9080706050",
                "name": "Secondary Regional Account",
                "currency": "INR",
                "account_status": "DISABLED",
            },
        ]

    @staticmethod
    def get_ad_insights(
        account_id: str, date_preset: str = "last_30d"
    ) -> Dict[str, Any]:
        """
        Fetch dummy advertising metrics and insights for a given Meta Ad Account.

        Args:
            account_id: Meta Ad Account ID string.
            date_preset: Date range preset (e.g. 'last_30d', 'last_7d').

        Returns:
            Dict containing metric summaries and daily breakdowns.
        """
        return {
            "summary": {
                "total_spend": 1250.50,
                "impressions": 45000,
                "clicks": 1820,
                "cpc": 0.69,
                "leads": 42,
            },
            "daily_breakdown": [
                {
                    "date": "2026-08-08",
                    "spend": 620.25,
                    "impressions": 22000,
                    "clicks": 900,
                    "cpc": 0.69,
                    "leads": 20,
                },
                {
                    "date": "2026-08-09",
                    "spend": 630.25,
                    "impressions": 23000,
                    "clicks": 920,
                    "cpc": 0.68,
                    "leads": 22,
                },
            ],
        }
