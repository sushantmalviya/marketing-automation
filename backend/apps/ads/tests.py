from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Organization, MAUser
from apps.ads.models import (
    MetaAdAccount,
    MetaUserCredential,
    MetaPixelSettings,
    MetaCapiEventLog,
    MetaLeadTrigger,
)
from apps.campaigns.models import CustomerUpload, CustomerRecord

User = get_user_model()


class OrganizationMetaAdsTests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(
            name="Org A Ads",
            slug="org-a-ads",
            external_company_id="ORG-A-ADS",
        )
        self.org_b = Organization.objects.create(
            name="Org B Ads",
            slug="org-b-ads",
            external_company_id="ORG-B-ADS",
        )
        self.user_a1 = User.objects.create_user(
            email="ads1@orga.com",
            password="Password123!",
            organization=self.org_a,
        )
        MAUser.objects.create(user=self.user_a1, organization=self.org_a, role="ADMIN")
        self.user_a2 = User.objects.create_user(
            email="ads2@orga.com",
            password="Password123!",
            organization=self.org_a,
        )
        MAUser.objects.create(user=self.user_a2, organization=self.org_a, role="USER")
        self.user_b = User.objects.create_user(
            email="ads1@orgb.com",
            password="Password123!",
            organization=self.org_b,
        )
        MAUser.objects.create(user=self.user_b, organization=self.org_b, role="ADMIN")

    def test_meta_ads_credentials_accounts_pixel_triggers_and_leads_shared_in_org(self):
        # 1. User 1 connects Meta Ads via OAuth code
        self.client.force_authenticate(user=self.user_a1)
        with patch("apps.ads.views.MetaAdsService.exchange_code_for_token", return_value="meta_org_a_tok"), \
             patch("apps.ads.views.MetaAdsService.get_ad_accounts", return_value=[{"account_id": "act_999", "name": "Org A Ad Account", "currency": "USD"}]):
            res = self.client.get("/api/meta-ads/meta/ad-accounts/?code=auth_code_1")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(len(res.data["data"]), 1)

        # User 1 selects ad account, configures Pixel, and creates a Lead Trigger
        sel_res = self.client.post(
            "/api/meta-ads/meta/ad-accounts/select/",
            {"account_id": "act_999", "name": "Org A Ad Account", "currency": "USD"},
            format="json",
        )
        self.assertEqual(sel_res.status_code, status.HTTP_201_CREATED)

        px_res = self.client.post(
            "/api/meta-ads/meta/pixel/",
            {"pixel_id": "px_123", "access_token": "capi_tok", "test_event_code": "TEST1", "is_active": True},
            format="json",
        )
        self.assertEqual(px_res.status_code, status.HTTP_200_OK)

        with patch("apps.ads.views.MetaAdsService.get_page_access_token", return_value="pg_tok"), \
             patch("apps.ads.views.MetaAdsService.subscribe_page_to_webhooks", return_value={"success": True}):
            trig_res = self.client.post(
                "/api/meta-ads/meta/triggers/",
                {"page_id": "page_111", "page_name": "Org A Page", "form_id": "form_222", "form_name": "Demo Form"},
                format="json",
            )
            self.assertEqual(trig_res.status_code, status.HTTP_201_CREATED)
            trigger_id = trig_res.data["data"]["id"]

        upload = CustomerUpload.objects.create(
            file_name="Meta Form: Demo Form",
            file_type="meta",
            uploaded_by=self.user_a1,
            status=CustomerUpload.Status.COMPLETED,
        )
        CustomerRecord.objects.create(
            upload=upload,
            data={"email": "lead@example.com", "name": "Lead One", "source": "meta", "form_id": "form_222"},
        )

        # 2. User 2 in Org A sees Meta Ad Accounts, Pixel, CAPI logs, Triggers, and Leads
        self.client.force_authenticate(user=self.user_a2)
        with patch("apps.ads.views.MetaAdsService.get_ad_accounts", return_value=[{"account_id": "act_999", "name": "Org A Ad Account", "currency": "USD"}]):
            u2_acc = self.client.get("/api/meta-ads/meta/ad-accounts/")
            self.assertEqual(u2_acc.status_code, status.HTTP_200_OK)
            self.assertEqual(u2_acc.data["data"][0]["account_id"], "act_999")

        # User 2 can re-select same ad account without IntegrityError
        u2_sel = self.client.post(
            "/api/meta-ads/meta/ad-accounts/select/",
            {"account_id": "act_999", "name": "Org A Ad Account", "currency": "USD"},
            format="json",
        )
        self.assertEqual(u2_sel.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MetaAdAccount.objects.filter(organization=self.org_a).count(), 1)

        u2_px = self.client.get("/api/meta-ads/meta/pixel/")
        self.assertEqual(u2_px.data["data"]["pixel_id"], "px_123")

        u2_logs = self.client.get("/api/meta-ads/meta/pixel/events/")
        self.assertEqual(len(u2_logs.data["data"]), 1)

        u2_trigs = self.client.get("/api/meta-ads/meta/triggers/")
        self.assertEqual(len(u2_trigs.data["data"]), 1)

        u2_leads = self.client.get("/api/meta-ads/meta/leads/")
        self.assertEqual(len(u2_leads.data["data"]), 1)

        # User 2 can toggle User 1's trigger
        with patch("apps.ads.views.MetaAdsService.unsubscribe_page_from_webhooks", return_value={"success": True}):
            patch_res = self.client.patch(f"/api/meta-ads/meta/triggers/{trigger_id}/", {"is_active": False}, format="json")
            self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
            self.assertFalse(patch_res.data["data"]["is_active"])

        # 3. User 3 in Org B sees NONE of Org A's Meta Ads entities
        self.client.force_authenticate(user=self.user_b)
        self.assertEqual(self.client.get("/api/meta-ads/meta/ad-accounts/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/api/meta-ads/meta/pixel/").data["data"]["pixel_id"], "")
        self.assertEqual(self.client.get("/api/meta-ads/meta/pixel/events/").data["data"], [])
        self.assertEqual(self.client.get("/api/meta-ads/meta/triggers/").data["data"], [])
        self.assertEqual(self.client.get("/api/meta-ads/meta/leads/").data["data"], [])

        # 4. Deleting User 1 preserves Org A's credential, pixel, ad account, and triggers; User 2 can disconnect
        self.user_a1.delete()
        self.assertTrue(MetaUserCredential.objects.filter(organization=self.org_a).exists())
        self.assertTrue(MetaPixelSettings.objects.filter(organization=self.org_a).exists())
        self.assertTrue(MetaLeadTrigger.objects.filter(organization=self.org_a).exists())

        self.client.force_authenticate(user=self.user_a2)
        disc_res = self.client.delete("/api/meta-ads/meta/disconnect/")
        self.assertEqual(disc_res.status_code, status.HTTP_200_OK)
        self.assertFalse(MetaUserCredential.objects.filter(organization=self.org_a).exists())
        self.assertFalse(MetaAdAccount.objects.filter(organization=self.org_a).exists())

