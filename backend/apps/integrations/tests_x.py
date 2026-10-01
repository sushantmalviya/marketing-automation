from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.accounts.models import User, MAUser, Organization
from apps.integrations.models import SocialConnection
from apps.integrations.providers.x import XProvider
from apps.analytics.services.x_analytics import XAnalyticsService


class XProviderTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Test X Org",
            slug="test-x-org",
            external_company_id="X-TEST-101",
        )
        self.user = User.objects.create_user(
            email="x_user@test.com",
            password="Password123!",
            organization=self.org,
        )
        self.ma_user = MAUser.objects.create(
            user=self.user,
            organization=self.org,
            role="ADMIN",
        )
        self.connection = SocialConnection.objects.create(
            user=self.ma_user,
            platform=SocialConnection.PlatformChoices.X,
            platform_account_id="1234567890123456",
            account_name="test_x_handle",
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
            metadata={"public_metrics": {"followers_count": 3400, "following_count": 450, "tweet_count": 120}},
        )
        self.connection.set_tokens("mock_x_access_token")
        self.connection.save()
        self.provider = XProvider()

    @patch("requests.get")
    def test_get_user_analytics(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": {
                "id": "1234567890123456",
                "username": "test_x_handle",
                "public_metrics": {
                    "followers_count": 3550,
                    "following_count": 460,
                    "tweet_count": 125,
                    "listed_count": 12,
                },
            }
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = XAnalyticsService.get_user_insights(self.user)
        self.assertTrue(res["success"])
        self.assertEqual(res["public_metrics"]["followers_count"], 3550)

    @patch("requests.get")
    def test_get_recent_tweets(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {
                    "id": "tweet_987654321",
                    "text": "Excited to launch our new feature on X!",
                    "created_at": "2026-10-01T10:00:00.000Z",
                    "public_metrics": {
                        "retweet_count": 14,
                        "reply_count": 8,
                        "like_count": 92,
                        "quote_count": 3,
                        "impression_count": 1420,
                    },
                }
            ]
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = XAnalyticsService.get_recent_tweets(self.user)
        self.assertTrue(res["success"])
        self.assertEqual(len(res["tweets"]), 1)
        self.assertEqual(res["tweets"][0]["public_metrics"]["like_count"], 92)
