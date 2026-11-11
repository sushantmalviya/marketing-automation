import json
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser, User
from apps.campaigns.models import Audience, Campaign, CustomerRecord, CustomerUpload, Template, Channel


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


class SmartColumnResolverTests(APITestCase):
    def test_header_resolution_variations(self):
        from apps.campaigns.utils import SmartColumnResolver

        # Name variations
        self.assertEqual(SmartColumnResolver.resolve_header("Customer Name"), "name")
        self.assertEqual(SmartColumnResolver.resolve_header("Full Name"), "name")
        self.assertEqual(SmartColumnResolver.resolve_header("NAME!"), "name")
        self.assertEqual(SmartColumnResolver.resolve_header("User Name"), "name")

        # Phone variations
        self.assertEqual(SmartColumnResolver.resolve_header("Mobile No."), "phone")
        self.assertEqual(SmartColumnResolver.resolve_header("Contact Number"), "phone")
        self.assertEqual(SmartColumnResolver.resolve_header("Phone_Num"), "phone")
        self.assertEqual(SmartColumnResolver.resolve_header("Number"), "phone")

        # Email variations
        self.assertEqual(SmartColumnResolver.resolve_header("E-Mail Address"), "email")
        self.assertEqual(SmartColumnResolver.resolve_header("Mail ID"), "email")
        self.assertEqual(SmartColumnResolver.resolve_header("EmailID"), "email")

        # Extra dynamic custom fields
        self.assertEqual(SmartColumnResolver.resolve_header("Age"), "age")
        self.assertEqual(SmartColumnResolver.resolve_header("Gender"), "gender")
        self.assertEqual(SmartColumnResolver.resolve_header("Date of Birth"), "date_of_birth")

    def test_data_sample_auto_detection(self):
        from apps.campaigns.utils import SmartColumnResolver

        # Ambiguous header with email values
        self.assertEqual(
            SmartColumnResolver.resolve_header("Col_1", ["test@example.com", "user@domain.org"]),
            "email",
        )
        # Ambiguous header with phone values
        self.assertEqual(
            SmartColumnResolver.resolve_header("Field_X", ["+19876543210", "9876543210"]),
            "phone",
        )

    def test_dataframe_resolution_and_name_merging(self):
        import pandas as pd
        from apps.campaigns.utils import normalize_dataframe_columns

        df = pd.DataFrame({
            "First Name": ["John", "Jane"],
            "Last Name": ["Doe", "Smith"],
            "E-Mail Address": ["john@example.com", "jane@example.com"],
            "Mob. No.": ["1234567890", "0987654321"],
            "Age": [25, 30],
            "Gender": ["Male", "Female"],
        })

        normalized_df = normalize_dataframe_columns(df)
        self.assertIn("name", normalized_df.columns)
        self.assertIn("email", normalized_df.columns)
        self.assertIn("phone", normalized_df.columns)
        self.assertIn("age", normalized_df.columns)
        self.assertIn("gender", normalized_df.columns)

        self.assertEqual(normalized_df["name"].tolist(), ["John Doe", "Jane Smith"])


class TemplateSanitizerTests(APITestCase):
    def test_html_tag_stripping_and_formatting(self):
        from apps.campaigns.services.renderer import TemplateRenderer
        html_input = "<p>Hello <b>Carlos</b>!</p><br><p>Thank you for choosing &amp; trusting our service.</p>"
        clean = TemplateRenderer.to_plain_text(html_input, channel="WHATSAPP")
        self.assertEqual(clean, "Hello *Carlos*!\n\nThank you for choosing & trusting our service.")

    def test_json_template_payload_parsing(self):
        from apps.campaigns.services.renderer import TemplateRenderer
        import json
        json_input = json.dumps({"version": 1, "cleanBody": "<div>Special Offer: <b>50% OFF</b></div>"})
        clean = TemplateRenderer.to_plain_text(json_input, channel="WHATSAPP")
        self.assertEqual(clean, "Special Offer: *50% OFF*")

    def test_render_for_channel_plain_text(self):
        from apps.campaigns.services.renderer import TemplateRenderer
        template = "<p>Hi {{ name }}, your order <b>#{{ order_id }}</b> is ready.</p>"
        context = {"name": "Carlos", "order_id": "1001"}
        rendered = TemplateRenderer.render_for_channel(template, context, channel="WHATSAPP")
        self.assertEqual(rendered, "Hi Carlos, your order *#1001* is ready.")


class WhatsAppTemplateSubmissionTests(APITestCase):
    def setUp(self):
        from apps.communications.models import WhatsAppConnection, SenderIdentity
        from apps.accounts.models import MAUser, Organization

        self.org_a = Organization.objects.create(
            name="Tenant A",
            slug="tenant-a",
            external_company_id="TENANT-A-001",
            status="ACTIVE",
        )
        self.user_a = User.objects.create_user(
            username="tenant_a",
            email="tenant_a@example.com",
            password="Password123!",
            organization=self.org_a,
        )
        self.ma_user_a = MAUser.objects.create(user=self.user_a, organization=self.org_a, role="USER")

        self.org_b = Organization.objects.create(
            name="Tenant B",
            slug="tenant-b",
            external_company_id="TENANT-B-002",
            status="ACTIVE",
        )
        self.user_b = User.objects.create_user(
            username="tenant_b",
            email="tenant_b@example.com",
            password="Password123!",
            organization=self.org_b,
        )
        self.ma_user_b = MAUser.objects.create(user=self.user_b, organization=self.org_b, role="USER")

        self.channel_wa, _ = Channel.objects.get_or_create(code="WHATSAPP", defaults={"name": "WhatsApp"})
        self.channel_email, _ = Channel.objects.get_or_create(code="EMAIL", defaults={"name": "Email"})

        # Connections & WABA identities
        self.conn_a = WhatsAppConnection.objects.create(
            organization=self.org_a,
            connected_by=self.user_a,
            phone_number_id="1401374839717756",
            waba_id="1538835448015786",
            is_active=True,
        )
        self.conn_a.set_access_token("EAA_TENANT_A_TOKEN")
        self.conn_a.save()

        self.identity_a = SenderIdentity.objects.create(
            user=self.user_a,
            provider="WHATSAPP_CLOUD",
            phone_number_id="1401374839717756",
            waba_id="1538835448015786",
            status="CONNECTED",
        )

        self.conn_b = WhatsAppConnection.objects.create(
            organization=self.org_b,
            connected_by=self.user_b,
            phone_number_id="2401374839717756",
            waba_id="2538835448015786",
            is_active=True,
        )
        self.conn_b.set_access_token("EAA_TENANT_B_TOKEN")
        self.conn_b.save()

        self.identity_b = SenderIdentity.objects.create(
            user=self.user_b,
            provider="WHATSAPP_CLOUD",
            phone_number_id="2401374839717756",
            waba_id="2538835448015786",
            status="CONNECTED",
        )

        self.client.force_authenticate(user=self.user_a)

    @patch("requests.post")
    def test_successful_whatsapp_template_submission(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "id": "meta_tpl_987654321",
            "status": "PENDING",
            "category": "MARKETING",
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "channel": "WHATSAPP",
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "TEXT", "text": "Special Announcement"},
            "body": "Hi {{first_name}}, get {{discount}} off today!",
            "footer": "Reply STOP to unsubscribe",
            "buttons": [
                {"type": "URL", "text": "Claim Offer", "url": "https://example.com/deal"},
                {"type": "PHONE_NUMBER", "text": "Call Support", "phoneNumber": "+15551234567"},
            ],
        }

        template = Template.objects.create(
            name="Holiday Mega Sale",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Compiled body text",
            created_by=self.user_a,
        )

        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta_status"], "PENDING")

        template.refresh_from_db()
        self.assertEqual(template.provider_data["meta_template_id"], "meta_tpl_987654321")
        self.assertEqual(template.provider_data["meta_status"], "PENDING")
        self.assertEqual(template.provider_data["meta_template_name"], "holiday_mega_sale")

        # Verify call arguments to Meta
        call_args, call_kwargs = mock_post.call_args
        self.assertIn("1538835448015786/message_templates", call_args[0])
        self.assertEqual(call_kwargs["headers"]["Authorization"], "Bearer EAA_TENANT_A_TOKEN")
        sent_json = call_kwargs["json"]
        self.assertEqual(sent_json["name"], "holiday_mega_sale")
        self.assertEqual(sent_json["category"], "MARKETING")
        self.assertEqual(sent_json["language"], "en_US")

        # Check components
        types = [c["type"] for c in sent_json["components"]]
        self.assertIn("HEADER", types)
        self.assertIn("BODY", types)
        self.assertIn("FOOTER", types)
        self.assertIn("BUTTONS", types)

        body_comp = next(c for c in sent_json["components"] if c["type"] == "BODY")
        self.assertEqual(body_comp["text"], "Hi {{1}}, get {{2}} off today!")
        self.assertEqual(body_comp["example"]["body_text"], [["Sample_first_name", "Sample_discount"]])

    def test_non_whatsapp_template_submission_rejected(self):
        template = Template.objects.create(
            name="Email Newsletter",
            channel=self.channel_email,
            subject="Monthly Digest",
            body="<p>Email content</p>",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Only WhatsApp templates can be submitted", response.data["detail"])

    def test_empty_body_template_submission_rejected(self):
        template = Template.objects.create(
            name="Empty Template",
            channel=self.channel_wa,
            subject="",
            body="",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("body cannot be empty", response.data["detail"])

    @patch("requests.post")
    def test_meta_api_rejection_error_handling(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = False
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "error": {
                "message": "(#100) Invalid template name format",
                "type": "OAuthException",
                "code": 100,
            }
        }
        mock_post.return_value = mock_resp

        template = Template.objects.create(
            name="Valid Name",
            channel=self.channel_wa,
            body="Hello world message",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "META_TEMPLATE_REJECTED")
        self.assertIn("Meta template submission rejected", response.data["detail"])

    @patch("requests.post")
    def test_meta_error_subcode_2388043_diagnostic_preservation(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = False
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "error": {
                "message": "Invalid parameter",
                "type": "OAuthException",
                "code": 100,
                "error_subcode": 2388043,
                "error_user_title": "Missing Sample Media",
                "error_user_msg": "Header handle is required for image header format.",
                "error_data": {"details": "example.header_handle is mandatory."},
                "fbtrace_id": "FBT_TEST_12345",
            }
        }
        mock_post.return_value = mock_resp

        template = Template.objects.create(
            name="Diag Test",
            channel=self.channel_wa,
            body="Hello world message",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "META_TEMPLATE_REJECTED")
        self.assertEqual(response.data["meta_subcode"], 2388043)
        self.assertEqual(response.data["meta_user_title"], "Missing Sample Media")
        self.assertEqual(response.data["meta_user_msg"], "Header handle is required for image header format.")
        self.assertEqual(response.data["meta_details"], "example.header_handle is mandatory.")
        self.assertEqual(response.data["fbtrace_id"], "FBT_TEST_12345")

    @patch("requests.post")
    def test_subcode_2388040_parameter_placement_rejection_details(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = False
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "error": {
                "message": "Invalid parameter",
                "type": "OAuthException",
                "code": 100,
                "error_subcode": 2388040,
                "error_user_title": "Invalid Parameter Placement",
                "error_user_msg": "Parameters cannot be placed at the end of the text. Please add text after {{2}}.",
                "error_data": {"details": "Parameter {{2}} is trailing."},
                "fbtrace_id": "FBT_PARAM_999",
            }
        }
        mock_post.return_value = mock_resp

        template = Template.objects.create(
            name="Param Placement Test",
            channel=self.channel_wa,
            body="Hello {{first_name}}, please find your order {{order_id}}",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "META_TEMPLATE_REJECTED")
        self.assertEqual(response.data["meta_subcode"], 2388040)
        self.assertIn("Parameters cannot be placed at the end", response.data["meta_user_msg"])

    @patch("requests.get")
    @patch("requests.post")
    def test_it360_payload_structure_and_image_header_handle(self, mock_post, mock_get):
        from django.conf import settings
        setattr(settings, "META_APP_ID", "968408089357113")

        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.status_code = 200
        precheck_resp.json.return_value = {"data": []}

        mock_dl = MagicMock()
        mock_dl.ok = True
        mock_dl.status_code = 200
        mock_dl.content = b"FAKE_PNG_BINARY_CONTENT"
        mock_dl.headers = {"Content-Type": "image/png"}

        mock_get.side_effect = [precheck_resp, mock_dl]

        session_resp = MagicMock()
        session_resp.ok = True
        session_resp.status_code = 200
        session_resp.json.return_value = {"id": "upload:SESSION_XYZ_123"}

        transfer_resp = MagicMock()
        transfer_resp.ok = True
        transfer_resp.status_code = 200
        transfer_resp.json.return_value = {"h": "4::aW1hZ2UvanBlZw==:HANDLE_987"}

        tpl_resp = MagicMock()
        tpl_resp.ok = True
        tpl_resp.status_code = 200
        tpl_resp.json.return_value = {
            "id": "meta_tpl_it360_id",
            "status": "PENDING",
            "category": "MARKETING",
        }

        mock_post.side_effect = [session_resp, transfer_resp, tpl_resp]

        it360_metadata = {
            "category": "MARKETING",
            "language": "en_US",
            "header": {
                "type": "IMAGE",
                "mediaUrl": "https://res.cloudinary.com/vxmvqh8s/image/upload/v1/media/assets/80b5be9b841c4f3591d66130e992381e_vyzuev",
                "mediaName": "ChatGPT Image.png",
            },
            "body": "Hi {{first_name}} 👋\n\nLooking to grow your business?\n\nBook a demo {{first_name}}.",
            "buttons": [
                {"type": "URL", "text": "Visit Website", "url": "https://www.itsoftlab360.com/home"},
                {"type": "PHONE_NUMBER", "text": "Call Us", "phoneNumber": "+91 9109911058"},
            ],
        }

        template = Template.objects.create(
            name="IT-360",
            channel=self.channel_wa,
            subject=json.dumps(it360_metadata),
            body=it360_metadata["body"],
            created_by=self.user_a,
        )

        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)

        template.refresh_from_db()
        self.assertEqual(template.provider_data["meta_template_id"], "meta_tpl_it360_id")
        self.assertEqual(template.provider_data["header_handle"], "4::aW1hZ2UvanBlZw==:HANDLE_987")

        # Verify template submission payload
        tpl_call_args, tpl_call_kwargs = mock_post.call_args_list[2]
        payload = tpl_call_kwargs["json"]

        # Check name normalization
        self.assertEqual(payload["name"], "it_360")

        # Check Header component has example.header_handle
        header_comp = next(c for c in payload["components"] if c["type"] == "HEADER")
        self.assertEqual(header_comp["format"], "IMAGE")
        self.assertEqual(header_comp["example"]["header_handle"], ["4::aW1hZ2UvanBlZw==:HANDLE_987"])

        # Check Body sequential variables: duplicate {{first_name}} replaced by {{1}} and {{2}}
        body_comp = next(c for c in payload["components"] if c["type"] == "BODY")
        self.assertIn("Hi {{1}} 👋", body_comp["text"])
        self.assertIn("demo {{2}}.", body_comp["text"])
        self.assertEqual(body_comp["example"]["body_text"], [["Sample_first_name", "Sample_first_name_2"]])

        # Check Button phone number whitespace stripping
        btn_comp = next(c for c in payload["components"] if c["type"] == "BUTTONS")
        phone_btn = next(b for b in btn_comp["buttons"] if b["type"] == "PHONE_NUMBER")
        self.assertEqual(phone_btn["phone_number"], "+919109911058")

    @patch("requests.get")
    def test_image_download_timeout_handling(self, mock_get):
        import requests
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}
        mock_get.side_effect = [precheck_resp, requests.Timeout("Media download timed out")]

        metadata = {
            "header": {
                "type": "IMAGE",
                "mediaUrl": "https://example.com/slow-image.png",
            },
            "body": "Image template body",
        }
        template = Template.objects.create(
            name="Slow Media",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Image template body",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["error_code"], "MEDIA_DOWNLOAD_ERROR")
        self.assertIn("Timeout downloading media", response.data["detail"])

    @patch("requests.get")
    def test_image_download_non_2xx_response(self, mock_get):
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}

        err_dl = MagicMock()
        err_dl.ok = False
        err_dl.status_code = 404
        err_dl.content = b""
        mock_get.side_effect = [precheck_resp, err_dl]

        metadata = {
            "header": {
                "type": "IMAGE",
                "mediaUrl": "https://example.com/missing.png",
            },
            "body": "Template with missing image",
        }
        template = Template.objects.create(
            name="Missing Image",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Template with missing image",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "MEDIA_DOWNLOAD_ERROR")
        self.assertIn("HTTP 404", response.data["detail"])

    @patch("requests.get")
    def test_invalid_image_content_type(self, mock_get):
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}

        html_dl = MagicMock()
        html_dl.ok = True
        html_dl.status_code = 200
        html_dl.content = b"<html>Not an image</html>"
        html_dl.headers = {"Content-Type": "text/html; charset=utf-8"}
        mock_get.side_effect = [precheck_resp, html_dl]

        metadata = {
            "header": {
                "type": "IMAGE",
                "mediaUrl": "https://example.com/not-image",
                "mediaName": "file.html",
            },
            "body": "Template with html header",
        }
        template = Template.objects.create(
            name="HTML Header",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Template with html header",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "MEDIA_DOWNLOAD_ERROR")
        self.assertIn("Unsupported media Content-Type", response.data["detail"])

    @patch("requests.get")
    def test_oversized_image_handling(self, mock_get):
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}

        big_dl = MagicMock()
        big_dl.ok = True
        big_dl.status_code = 200
        big_dl.content = b"x" * 100
        big_dl.headers = {"Content-Type": "image/png", "Content-Length": "20000000"}  # 20MB
        mock_get.side_effect = [precheck_resp, big_dl]

        metadata = {
            "header": {
                "type": "IMAGE",
                "mediaUrl": "https://example.com/oversized.png",
            },
            "body": "Template with big image",
        }
        template = Template.objects.create(
            name="Big Image",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Template with big image",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "MEDIA_DOWNLOAD_ERROR")
        self.assertIn("exceeds limit (16MB)", response.data["detail"])

    @patch("requests.get")
    @patch("requests.post")
    def test_meta_upload_session_failure(self, mock_post, mock_get):
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}

        mock_dl = MagicMock()
        mock_dl.ok = True
        mock_dl.status_code = 200
        mock_dl.content = b"PNG_CONTENT"
        mock_dl.headers = {"Content-Type": "image/png"}
        mock_get.side_effect = [precheck_resp, mock_dl]

        session_err = MagicMock()
        session_err.ok = False
        session_err.status_code = 500
        session_err.text = "Internal Meta Upload Service Error"
        mock_post.return_value = session_err

        metadata = {
            "header": {"type": "IMAGE", "mediaUrl": "https://example.com/img.png"},
            "body": "Template body",
        }
        template = Template.objects.create(
            name="Session Fail",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Template body",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["error_code"], "META_UPLOAD_ERROR")
        self.assertIn("session initiation failed", response.data["detail"])

    @patch("requests.get")
    @patch("requests.post")
    def test_binary_upload_timeout(self, mock_post, mock_get):
        import requests
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}

        mock_dl = MagicMock()
        mock_dl.ok = True
        mock_dl.status_code = 200
        mock_dl.content = b"PNG_CONTENT"
        mock_dl.headers = {"Content-Type": "image/png"}
        mock_get.side_effect = [precheck_resp, mock_dl]

        session_ok = MagicMock()
        session_ok.ok = True
        session_ok.status_code = 200
        session_ok.json.return_value = {"id": "upload:SESSION_1"}

        mock_post.side_effect = [session_ok, requests.Timeout("Binary stream timed out")]

        metadata = {
            "header": {"type": "IMAGE", "mediaUrl": "https://example.com/img.png"},
            "body": "Template body",
        }
        template = Template.objects.create(
            name="Binary Timeout",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Template body",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.data["error_code"], "META_TIMEOUT")
        self.assertIn("Timeout transferring file", response.data["detail"])

    @patch("requests.get")
    @patch("requests.post")
    def test_meta_template_creation_timeout_is_ambiguous(self, mock_post, mock_get):
        import requests
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {"data": []}
        mock_get.return_value = precheck_resp

        # Mock template POST timing out
        mock_post.side_effect = requests.Timeout("Meta Graph API response timed out after 15s")

        template = Template.objects.create(
            name="Ambiguous Template",
            channel=self.channel_wa,
            body="Template that times out during creation",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.data["error_code"], "META_TIMEOUT")
        self.assertTrue(response.data["is_ambiguous"])
        self.assertIn("Timeout waiting for Meta", response.data["detail"])

        template.refresh_from_db()
        self.assertEqual(template.provider_data["meta_status"], "SUBMISSION_AMBIGUOUS")

    @patch("requests.get")
    @patch("requests.post")
    def test_idempotent_submission_adopts_existing_meta_template(self, mock_post, mock_get):
        # Pre-check discovers that Meta already has a template named "it_360"
        precheck_resp = MagicMock()
        precheck_resp.ok = True
        precheck_resp.json.return_value = {
            "data": [
                {
                    "name": "it_360",
                    "status": "APPROVED",
                    "category": "MARKETING",
                    "id": "1844777456951988",
                    "language": "en_US",
                }
            ]
        }
        mock_get.return_value = precheck_resp

        template = Template.objects.create(
            name="IT-360",
            channel=self.channel_wa,
            body="Existing template content",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)

        # POST should NOT have been called to duplicate template creation
        mock_post.assert_not_called()

        template.refresh_from_db()
        self.assertEqual(template.provider_data["meta_template_id"], "1844777456951988")
        self.assertEqual(template.provider_data["meta_status"], "APPROVED")

    def test_missing_header_handle_validation_error(self):
        # Template with IMAGE header but no mediaUrl and no header_handle
        metadata = {
            "category": "MARKETING",
            "language": "en_US",
            "header": {
                "type": "IMAGE",
            },
            "body": "Body without image URL",
        }
        template = Template.objects.create(
            name="No Image URL",
            channel=self.channel_wa,
            subject=json.dumps(metadata),
            body="Body without image URL",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("sample media handle", response.data["detail"])

    def test_serializer_provider_data_credential_redaction(self):
        from apps.campaigns.serializers.template import TemplateSerializer

        template = Template.objects.create(
            name="Safe Serializer Test",
            channel=self.channel_wa,
            body="Safe test body",
            provider_data={
                "waba_id": "1538835448015786",
                "meta_template_id": "tpl_123",
                "meta_template_name": "safe_tpl",
                "meta_status": "APPROVED",
                "meta_category": "MARKETING",
                "header_handle": "handle_abc",
                # Sensitive fields that MUST NOT leak
                "access_token": "SUPER_SECRET_ACCESS_TOKEN",
                "client_secret": "TOP_SECRET_APP_SECRET",
                "internal_raw_creds": {"key": "val"},
            },
            created_by=self.user_a,
        )
        serializer = TemplateSerializer(template)
        data = serializer.data
        provider_data = data["provider_data"]

        # Whitelisted keys must be present
        self.assertEqual(provider_data["waba_id"], "1538835448015786")
        self.assertEqual(provider_data["meta_template_id"], "tpl_123")
        self.assertEqual(provider_data["header_handle"], "handle_abc")

        # Sensitive keys must be redacted
        self.assertNotIn("access_token", provider_data)
        self.assertNotIn("client_secret", provider_data)
        self.assertNotIn("internal_raw_creds", provider_data)

    def test_tenant_isolation_template_submission(self):
        # Template belongs to tenant B
        template_b = Template.objects.create(
            name="Tenant B Promo",
            channel=self.channel_wa,
            body="Hello from Tenant B",
            created_by=self.user_b,
        )
        # Tenant A attempts to submit Tenant B's template
        url = f"/api/templates/{template_b.id}/submit-to-provider/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 404)

    @patch("requests.get")
    def test_sync_template_status_from_meta(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "id": "meta_tpl_987654321",
            "status": "APPROVED",
        }
        mock_get.return_value = mock_resp

        template = Template.objects.create(
            name="Approved Promo",
            channel=self.channel_wa,
            body="Special discount",
            provider_data={
                "meta_template_id": "meta_tpl_987654321",
                "meta_status": "PENDING",
            },
            created_by=self.user_a,
        )

        url = f"/api/templates/{template.id}/sync-provider-status/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta_status"], "APPROVED")

        template.refresh_from_db()
        self.assertEqual(template.provider_data["meta_status"], "APPROVED")

    @patch("requests.get")
    def test_sync_template_rejection_reason(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "id": "meta_tpl_987654321",
            "status": "REJECTED",
            "rejected_reason": "PROMOTIONAL_CONTENT",
        }
        mock_get.return_value = mock_resp

        template = Template.objects.create(
            name="Rejected Promo",
            channel=self.channel_wa,
            body="Buy now",
            provider_data={
                "meta_template_id": "meta_tpl_987654321",
                "meta_status": "PENDING",
            },
            created_by=self.user_a,
        )

        url = f"/api/templates/{template.id}/sync-provider-status/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta_status"], "REJECTED")

        template.refresh_from_db()
        self.assertEqual(template.provider_data["meta_status"], "REJECTED")
        self.assertEqual(template.provider_data["meta_rejection_reason"], "PROMOTIONAL_CONTENT")

    def test_sync_unsubmitted_template_fails(self):
        template = Template.objects.create(
            name="Unsubmitted Promo",
            channel=self.channel_wa,
            body="Just a draft",
            created_by=self.user_a,
        )
        url = f"/api/templates/{template.id}/sync-provider-status/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("has not been submitted to Meta yet", response.data["detail"])

