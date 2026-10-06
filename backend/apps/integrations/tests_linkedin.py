from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.accounts.models import User, MAUser, Organization
from apps.integrations.models import SocialConnection
from apps.integrations.providers.linkedin import LinkedInProvider
from apps.analytics.services.linkedin_analytics import LinkedInAnalyticsService


class LinkedInProviderTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Test LinkedIn Org",
            slug="test-li-org",
            external_company_id="LI-TEST-101",
        )
        self.user = User.objects.create_user(
            email="li_user@test.com",
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
            platform=SocialConnection.PlatformChoices.LINKEDIN,
            platform_account_id="urn:li:person:99999",
            account_name="Test Company Page",
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
            metadata={"managed_organizations": [{"organization_urn": "urn:li:organization:123456", "role": "ADMIN"}]},
        )
        self.connection.set_tokens("mock_li_access_token")
        self.connection.save()
        self.provider = LinkedInProvider()

    @patch("requests.get")
    def test_get_managed_organizations(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "elements": [
                {"organizationalTarget": "urn:li:organization:123456", "role": "ADMIN"}
            ]
        }
        mock_get.return_value = mock_resp

        orgs = self.provider.get_managed_organizations("mock_access_token")
        self.assertEqual(len(orgs), 1)
        self.assertEqual(orgs[0]["organization_urn"], "urn:li:organization:123456")

    @patch("requests.post")
    def test_publish_post_organization(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.headers = {"x-linkedin-id": "urn:li:share:7777777"}
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        res = self.provider.publish_post(
            self.connection,
            content="Hello LinkedIn from Automated Marketing Platform!",
            author_urn="urn:li:organization:123456",
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["platform_post_id"], "urn:li:share:7777777")

    @patch("requests.get")
    def test_get_organization_insights(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "elements": [
                {
                    "totalShareStatistics": {
                        "impressionCount": 4500,
                        "clickCount": 320,
                        "likeCount": 150,
                        "commentCount": 25,
                        "shareCount": 12,
                        "engagement": 0.112,
                    }
                }
            ]
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = LinkedInAnalyticsService.get_organization_insights(self.user, org_urn="urn:li:organization:123456")
        self.assertTrue(res["success"])
        self.assertEqual(len(res["statistics"]), 1)

    @patch("requests.get")
    def test_get_follower_demographics(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "elements": [
                {"followerCountsBySeniority": [{"seniority": "urn:li:seniority:7", "followerCount": 240}]}
            ]
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        res = LinkedInAnalyticsService.get_follower_demographics(self.user, org_urn="urn:li:organization:123456")
        self.assertTrue(res["success"])
        self.assertEqual(len(res["demographics"]), 1)
