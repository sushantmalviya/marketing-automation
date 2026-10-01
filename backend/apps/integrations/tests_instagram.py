from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.accounts.models import User, MAUser, Organization
from apps.integrations.models import SocialConnection
from apps.integrations.providers.instagram import InstagramProvider


class InstagramProviderTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Test Instagram Org",
            slug="test-ig-org",
            external_company_id="IG-TEST-101",
        )
        self.user = User.objects.create_user(
            email="ig_user@test.com",
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
            platform=SocialConnection.PlatformChoices.INSTAGRAM,
            platform_account_id="17841400000000000",
            account_name="test_ig_handle",
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
        )
        self.connection.set_tokens("mock_access_token")
        self.connection.save()
        self.provider = InstagramProvider()

    @patch("requests.post")
    @patch("requests.get")
    def test_publish_carousel(self, mock_get, mock_post):
        # Mock item container creation
        mock_post_resp = MagicMock()
        mock_post_resp.json.return_value = {"id": "container_123"}
        mock_post_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_post_resp

        # Mock container status poll
        mock_get_resp = MagicMock()
        mock_get_resp.json.return_value = {"status_code": "FINISHED"}
        mock_get_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_get_resp

        items = [
            {"type": "IMAGE", "url": "https://example.com/img1.jpg"},
            {"type": "IMAGE", "url": "https://example.com/img2.jpg"},
        ]
        result = self.provider.publish_carousel(self.connection, items=items, caption="Awesome Carousel Post")
        self.assertTrue(result["success"])
        self.assertEqual(result["platform_post_id"], "container_123")

    @patch("requests.get")
    def test_get_user_insights(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {"name": "reach", "values": [{"value": 1500}]},
                {"name": "impressions", "values": [{"value": 3200}]},
            ]
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = self.provider.get_user_insights(self.connection)
        self.assertTrue(res["success"])
        self.assertEqual(len(res["insights"]), 2)
