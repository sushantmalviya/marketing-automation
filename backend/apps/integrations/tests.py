from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Organization, MAUser
from apps.integrations.models import SocialConnection
from apps.integrations.services.oauth_service import OAuthService
from apps.integrations.tasks import publish_social_post_task
from apps.content_studio.models import ContentDraft, ContentPlatform

User = get_user_model()


class OrganizationSocialConnectionTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(
            name="Org A Social",
            slug="org-a-social",
            external_company_id="ORG-A-SOC",
        )
        self.org_b = Organization.objects.create(
            name="Org B Social",
            slug="org-b-social",
            external_company_id="ORG-B-SOC",
        )
        self.user_a1 = User.objects.create_user(
            email="admin@orga.com",
            password="Password123!",
            organization=self.org_a,
        )
        self.ma_a1 = MAUser.objects.create(user=self.user_a1, organization=self.org_a, role="ADMIN")

        self.user_a2 = User.objects.create_user(
            email="member@orga.com",
            password="Password123!",
            organization=self.org_a,
        )
        self.ma_a2 = MAUser.objects.create(user=self.user_a2, organization=self.org_a, role="USER")

        self.user_b = User.objects.create_user(
            email="admin@orgb.com",
            password="Password123!",
            organization=self.org_b,
        )
        self.ma_b = MAUser.objects.create(user=self.user_b, organization=self.org_b, role="ADMIN")

        self.client = APIClient()

    def test_social_connections_shared_across_organization_and_isolated(self):
        conn = SocialConnection.objects.create(
            user=self.ma_a1,
            platform=SocialConnection.PlatformChoices.FACEBOOK,
            platform_account_id="fb_org_a",
            account_name="Org A Page",
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
        )
        conn.set_tokens("tok_fb_orga")
        conn.save()

        # Auto-populated organization
        self.assertEqual(conn.organization_id, self.org_a.id)

        # User 2 in Org A sees User 1's Facebook connection
        self.client.force_authenticate(user=self.user_a2)
        res = self.client.get("/api/integrations/social/connections/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data.get("results", res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], str(conn.id))

        # User 3 in Org B sees nothing
        self.client.force_authenticate(user=self.user_b)
        res_b = self.client.get("/api/integrations/social/connections/")
        items_b = res_b.data.get("results", res_b.data) if isinstance(res_b.data, dict) else res_b.data
        self.assertEqual(items_b, [])

        # User 2 in Org A can publish using User 1's org connection
        draft = ContentDraft.objects.create(
            owner=self.user_a2,
            workflow_state=ContentDraft.WorkflowState.APPROVED,
            enhanced_prompt="Hello Org A!",
        )
        plat = ContentPlatform.objects.create(
            draft=draft,
            platform=ContentPlatform.PlatformChoices.FACEBOOK,
        )
        mock_provider = MagicMock()
        mock_provider.publish_post.return_value = {"success": True, "platform_post_id": "fb_post_99"}
        with patch("apps.integrations.tasks.ProviderFactory.get_provider", return_value=mock_provider):
            publish_social_post_task.apply(args=[str(plat.id), str(self.user_a2.id)])

        plat.refresh_from_db()
        self.assertEqual(plat.status, ContentPlatform.PlatformStatus.POSTED)
        self.assertEqual(plat.external_post_id, "fb_post_99")

        # Deleting User 1 preserves Org A's connection, and User 2 can still disconnect it
        self.user_a1.delete()
        self.assertTrue(SocialConnection.objects.filter(id=conn.id, organization=self.org_a).exists())

        self.client.force_authenticate(user=self.user_a2)
        with patch("apps.integrations.services.oauth_service.ProviderFactory.get_provider", return_value=mock_provider):
            del_res = self.client.delete(f"/api/integrations/social/connections/{conn.id}/")
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SocialConnection.objects.filter(id=conn.id).exists())

    def test_oauth_callback_redirects_user_role_to_user_account(self):
        mock_provider = MagicMock()
        mock_provider.get_authorization_url.return_value = "https://example.com/auth"
        mock_provider.exchange_code.return_value = {
            "access_token": "tok_x",
            "account_id": "x_123",
            "account_name": "Org A X",
            "metadata": {},
        }

        self.client.force_authenticate(user=self.user_a2)
        with patch.dict(
            "os.environ",
            {
                "OAUTH_REDIRECT_BASE_URL": "http://localhost:8000/api/integrations/social/connections/callback/",
                "OAUTH_SUCCESS_REDIRECT_URL": "http://localhost:3000/admin/account?tab=connect-socials",
            },
        ), patch("apps.integrations.services.oauth_service.ProviderFactory.get_provider", return_value=mock_provider):
            init_res = self.client.get(
                "/api/integrations/social/connections/connect/x/",
                HTTP_ACCEPT="application/json",
            )
            self.assertEqual(init_res.status_code, status.HTTP_200_OK)
            state = mock_provider.get_authorization_url.call_args[0][0]

            self.client.force_authenticate(user=None)
            cb_res = self.client.get(
                f"/api/integrations/social/connections/callback/x/?state={state}&code=abc123"
            )
            self.assertEqual(cb_res.status_code, status.HTTP_302_FOUND)
            self.assertIn("/user/account", cb_res["Location"])
            self.assertIn("x=connected", cb_res["Location"])
