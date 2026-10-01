from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.accounts.models import User, MAUser, Organization
from apps.integrations.models import SocialConnection
from apps.integrations.providers.facebook import FacebookProvider
from apps.analytics.services.facebook_analytics import FacebookAnalyticsService


class FacebookProviderTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Test Facebook Org",
            slug="test-fb-org",
            external_company_id="FB-TEST-101",
        )
        self.user = User.objects.create_user(
            email="fb_user@test.com",
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
            platform=SocialConnection.PlatformChoices.FACEBOOK,
            platform_account_id="fb_123456789",
            account_name="Test Facebook Page",
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
            metadata={"pages": [{"id": "page_999", "name": "Test Page", "access_token": "mock_page_token"}]},
        )
        self.connection.set_tokens("mock_fb_user_token")
        self.connection.save()
        self.provider = FacebookProvider()

    @patch("requests.post")
    def test_publish_video_post(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": "video_111222"}
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        res = self.provider.publish_post(
            self.connection,
            content="Check out our new video!",
            image_url="https://example.com/promo.mp4",
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["platform_post_id"], "video_111222")

    @patch("requests.get")
    def test_get_page_insights(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {"name": "page_impressions", "values": [{"value": 8500}]},
                {"name": "page_engaged_users", "values": [{"value": 1200}]},
            ]
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = FacebookAnalyticsService.get_page_insights(self.user, page_id="page_999")
        self.assertTrue(res["success"])
        self.assertEqual(len(res["insights"]), 2)

    @patch("requests.get")
    def test_get_recent_posts(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {
                    "id": "page_999_post_1",
                    "message": "Welcome to our Facebook Page!",
                    "created_time": "2026-09-30T10:00:00+0000",
                    "reactions": {"summary": {"total_count": 45}},
                    "comments": {"summary": {"total_count": 12}},
                }
            ]
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = FacebookAnalyticsService.get_recent_posts(self.user, page_id="page_999")
        self.assertTrue(res["success"])
        self.assertEqual(len(res["posts"]), 1)
