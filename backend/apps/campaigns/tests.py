from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser, User
from apps.campaigns.models import Audience, Campaign, CustomerRecord, CustomerUpload


class AdminCampaignWorkspaceTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="campaign-admin@example.com",
            password="StrongPass123!",
        )
        MAUser.objects.create(user=self.admin, role="ADMIN")
        self.upload = CustomerUpload.objects.create(
            file_name="campaign-test.csv",
            uploaded_by=self.admin,
            status=CustomerUpload.Status.COMPLETED,
        )
        self.audience = Audience.objects.create(
            name="Test audience",
            customer_upload=self.upload,
            definition={"type": "DYNAMIC", "operator": "AND", "conditions": []},
            created_by=self.admin,
        )
        CustomerRecord.objects.create(upload=self.upload, data={"email": "one@example.com"})
        CustomerRecord.objects.create(upload=self.upload, data={"email": "two@example.com"})
        self.client.force_authenticate(self.admin)

    def test_admin_can_create_and_list_owned_campaign(self):
        response = self.client.post(
            reverse("campaign-create"),
            {"audience": self.audience.id, "name": "Admin launch", "description": "Test"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Campaign.objects.filter(name="Admin launch", created_by=self.admin).exists())

        listing = self.client.get(reverse("campaign-my"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(listing.data["results"][0]["campaign_name"], "Admin launch")
        self.assertIn("contacts", listing.data["results"][0])

        summary = self.client.get(reverse("campaign-workspace-summary"))
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["total_campaigns"], 1)

    def test_admin_can_view_edit_and_soft_delete_owned_segment(self):
        listing = self.client.get(reverse("audience-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        audience_data = next((a for a in listing.data if a["id"] == self.audience.id), None)
        self.assertIsNotNone(audience_data)
        self.assertEqual(audience_data["contacts_count"], 2)
        self.assertEqual(audience_data["type"], "DYNAMIC")

        updated = self.client.patch(
            reverse("audience-detail", kwargs={"audience_id": self.audience.id}),
            {"name": "Premium customers", "definition": {"type": "STATIC", "conditions": []}},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["name"], "Premium customers")
        self.assertEqual(updated.data["type"], "STATIC")

        deleted = self.client.delete(
            reverse("audience-detail", kwargs={"audience_id": self.audience.id})
        )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.audience.refresh_from_db()
        self.assertFalse(self.audience.is_active)
        remaining = self.client.get(reverse("audience-list")).data
        self.assertFalse(any(a["id"] == self.audience.id for a in remaining))

    def test_grouped_segment_preview_supports_or_and_numeric_rules(self):
        CustomerRecord.objects.create(
            upload=self.upload,
            data={"occupation": "Athlete", "age": 25, "engagement_score": 10},
        )
        CustomerRecord.objects.create(
            upload=self.upload,
            data={"occupation": "Engineer", "age": 40, "engagement_score": 60},
        )
        CustomerRecord.objects.create(
            upload=self.upload,
            data={"occupation": "Engineer", "age": 40, "engagement_score": 20},
        )
        response = self.client.post(
            reverse("audience-preview"),
            {
                "customer_upload": self.upload.id,
                "audience_definition": {
                    "groups_operator": "OR",
                    "groups": [
                        {
                            "operator": "AND",
                            "conditions": [
                                {"field": "Occupation", "operator": "contains", "value": "Athlete"},
                                {"field": "Age", "operator": "between", "value": "18", "value_to": "35"},
                            ],
                        },
                        {
                            "operator": "AND",
                            "conditions": [
                                {"field": "Engagement Score", "operator": "greater_than", "value": "50"},
                            ],
                        },
                    ],
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_customers"], 2)
    def test_contact_sub_source_hierarchy_and_filtering(self):
        from apps.campaigns.models import Contact
        from apps.campaigns.services import ContactService

        # Create contacts with distinct sub-sources
        ContactService.upsert_contact(
            owner=self.admin,
            payload={"email": "form1@example.com", "name": "Form Lead 1"},
            default_source="form",
            sub_source_type="form",
            sub_source_id="form_101",
            sub_source_name="Newsletter Signup Form",
        )
        ContactService.upsert_contact(
            owner=self.admin,
            payload={"email": "meta1@example.com", "name": "Meta Lead 1"},
            default_source="meta",
            sub_source_type="meta_campaign",
            sub_source_id="camp_999",
            sub_source_name="Fall Clearance Promo",
        )

        # Test hierarchy endpoint
        response = self.client.get(reverse("customer-hierarchy"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        categories = response.data["categories"]
        self.assertIn("imported", categories)
        self.assertIn("forms", categories)
        self.assertIn("meta", categories)

        forms_items = categories["forms"]["items"]
        self.assertTrue(any(f["id"] == "form_101" for f in forms_items))

        meta_items = categories["meta"]["items"]
        self.assertTrue(any(m["id"] == "camp_999" for m in meta_items))

        # Test filtering by sub_source
        filtered_form = self.client.get(
            reverse("customer-list"),
            {"sub_source_type": "form", "sub_source_id": "form_101"},
        )
        self.assertEqual(filtered_form.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered_form.data), 1)
        self.assertEqual(filtered_form.data[0]["data"]["email"], "form1@example.com")



class DirectCampaignSendWorkflowTests(APITestCase):
    def setUp(self):
        from apps.campaigns.models import Channel, Template, CampaignChannel, CampaignTemplate, CampaignAudience
        from unittest.mock import patch

        self.user = User.objects.create_user(
            email="regular-user@example.com",
            password="StrongPass123!",
        )
        MAUser.objects.create(user=self.user, role="USER")

        self.other_user = User.objects.create_user(
            email="other-user@example.com",
            password="StrongPass123!",
        )
        MAUser.objects.create(user=self.other_user, role="USER")

        self.upload = CustomerUpload.objects.create(
            file_name="test-list.csv",
            uploaded_by=self.user,
            status=CustomerUpload.Status.COMPLETED,
        )
        self.customer = CustomerRecord.objects.create(
            upload=self.upload,
            data={"email": "client@example.com", "phone": "1234567890", "name": "Client"}
        )
        self.audience = Audience.objects.create(
            name="Client list",
            customer_upload=self.upload,
            created_by=self.user,
        )
        self.channel = Channel.objects.create(
            name="Email Channel",
            code="EMAIL",
        )
        self.template = Template.objects.create(
            name="Welcome Email",
            channel=self.channel,
            subject="Welcome {{name}}",
            body="Hello {{name}}",
            created_by=self.user,
        )

    def test_user_can_send_own_draft_campaign_directly(self):
        from unittest.mock import patch
        self.client.force_authenticate(self.user)

        # 1. Create campaign
        res = self.client.post(
            reverse("campaign-create"),
            {"audience": self.audience.id, "name": "Direct Launch", "description": "No approval needed"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        campaign_id = res.data["campaign"]["id"]
        campaign = Campaign.objects.get(id=campaign_id)
        self.assertEqual(campaign.status, Campaign.Status.DRAFT)
        self.assertEqual(campaign.audience.count(), 1)
        self.assertEqual(campaign.audience.first().customer.id, self.customer.id)

        # 2. Assign channel & template
        from apps.campaigns.models import CampaignChannel, CampaignTemplate
        CampaignChannel.objects.create(campaign=campaign, channel=self.channel)
        CampaignTemplate.objects.create(campaign=campaign, channel=self.channel, template=self.template)

        # 3. Direct send immediately from DRAFT
        with patch("apps.campaigns.tasks.send_campaign_background.delay") as mock_task:
            send_res = self.client.post(
                reverse("campaign-send"),
                {"campaign": campaign.id},
                format="json",
            )
            self.assertEqual(send_res.status_code, status.HTTP_200_OK)
            mock_task.assert_called_once_with(campaign.id)

    def test_campaign_creation_materializes_selected_audience_recipients(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            reverse("campaign-create"),
            {"audience": self.audience.id, "name": "Audience Materialization Test", "description": "Verifies recipient resolution"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        campaign = Campaign.objects.get(id=res.data["campaign"]["id"])
        self.assertEqual(campaign.audience.count(), 1)
        self.assertEqual(campaign.audience.first().customer.id, self.customer.id)

    def test_user_cannot_send_other_user_campaign(self):
        self.client.force_authenticate(self.other_user)

        # Other user tries to send user's campaign
        campaign = Campaign.objects.create(
            name="Target Campaign",
            target_audience=self.audience,
            created_by=self.user,
            status=Campaign.Status.DRAFT,
        )

        send_res = self.client.post(
            reverse("campaign-send"),
            {"campaign": campaign.id},
            format="json",
        )
        self.assertEqual(send_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_can_schedule_own_draft_campaign_directly(self):
        self.client.force_authenticate(self.user)

        campaign = Campaign.objects.create(
            name="Scheduled Campaign",
            target_audience=self.audience,
            created_by=self.user,
            status=Campaign.Status.DRAFT,
        )
        from apps.campaigns.models import CampaignChannel, CampaignTemplate, CampaignAudience
        CampaignAudience.objects.create(campaign=campaign, customer=self.customer)
        CampaignChannel.objects.create(campaign=campaign, channel=self.channel)
        CampaignTemplate.objects.create(campaign=campaign, channel=self.channel, template=self.template)

        future_time = timezone.now() + timedelta(days=2)
        sched_res = self.client.post(
            reverse("campaign-schedule"),
            {"campaign": campaign.id, "scheduled_at": future_time.isoformat()},
            format="json",
        )
        self.assertEqual(sched_res.status_code, status.HTTP_200_OK)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, Campaign.Status.SCHEDULED)

    def test_delivery_service_validates_templates_and_recipients(self):
        from apps.campaigns.services.delivery import DeliveryService
        from rest_framework.exceptions import ValidationError

        campaign = Campaign.objects.create(
            name="Empty Campaign",
            created_by=self.user,
            status=Campaign.Status.DRAFT,
        )
        # Missing audience -> raises ValidationError
        with self.assertRaises(ValidationError):
            DeliveryService.send_campaign(campaign=campaign)
   