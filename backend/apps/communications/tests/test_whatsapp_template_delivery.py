import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Organization, User, MAUser
from apps.campaigns.models import (
    Campaign,
    Audience,
    CustomerUpload,
    CustomerRecord,
    CampaignAudience,
    Channel,
    CampaignChannel,
    Template,
    CampaignTemplate,
    CampaignDelivery,
)
from apps.campaigns.services.delivery import DeliveryService
from apps.campaigns.services.dispatcher import Dispatcher
from apps.communications.models import WhatsAppConnection, CommunicationEvent
from apps.communications.services.whatsapp import send_whatsapp
from apps.communications.providers.whatsapp import MetaWhatsAppProvider


class WhatsAppTemplateDeliveryIntegrationTests(TestCase):
    def setUp(self):
        # 1. Organization & User
        self.org = Organization.objects.create(
            name="Alpha Corp",
            slug="alpha-corp",
            external_company_id="ALPHA-001",
            status="ACTIVE",
        )
        self.user = User.objects.create_user(
            username="alpha_admin",
            email="admin@alpha.com",
            password="StrongPassword123!",
            organization=self.org,
        )
        self.ma_user = MAUser.objects.create(
            user=self.user,
            organization=self.org,
            role="ADMIN",
        )

        # 2. WhatsApp Connection
        self.conn = WhatsAppConnection.objects.create(
            organization=self.org,
            connected_by=self.user,
            phone_number_id="1000000000001",
            waba_id="2000000000002",
            environment="production",
            is_active=True,
        )
        self.conn.set_access_token("EAA_MOCK_ACCESS_TOKEN_ALPHA")
        self.conn.save()

        # 3. Channels
        self.channel_wa, _ = Channel.objects.get_or_create(code="WHATSAPP", defaults={"name": "WhatsApp"})
        self.channel_email, _ = Channel.objects.get_or_create(code="EMAIL", defaults={"name": "Email"})

        # 4. Customer & Audience
        self.upload = CustomerUpload.objects.create(
            file_name="recipients.csv",
            uploaded_by=self.user,
            status=CustomerUpload.Status.COMPLETED,
        )
        self.customer = CustomerRecord.objects.create(
            upload=self.upload,
            data={
                "name": "Mayur Rudrawal",
                "first_name": "Mayur",
                "phone": "+91 78060 30359",
                "discount": "25%",
                "coupon_code": "PROMO2026",
                "order_id": "ORD-9988",
            },
        )
        self.audience = Audience.objects.create(
            name="Single Recipient Audience",
            customer_upload=self.upload,
            definition={"type": "STATIC", "conditions": []},
            created_by=self.user,
            is_active=True,
        )

        # 5. Base Campaign
        self.campaign = Campaign.objects.create(
            name="WhatsApp Rich Template Campaign",
            target_audience=self.audience,
            status=Campaign.Status.APPROVED,
            created_by=self.user,
            approved_by=self.user,
            approved_at=timezone.now(),
        )
        CampaignAudience.objects.create(campaign=self.campaign, customer=self.customer)
        CampaignChannel.objects.create(campaign=self.campaign, channel=self.channel_wa)

    def _create_whatsapp_template(self, name, subject_dict, body, meta_status="APPROVED", meta_template_name=None):
        meta_name = meta_template_name or name.lower().replace(" ", "_")
        provider_data = {
            "meta_template_id": "meta_tpl_123456",
            "meta_template_name": meta_name,
            "meta_status": meta_status,
            "waba_id": self.conn.waba_id,
        } if meta_status else {}

        template = Template.objects.create(
            name=name,
            channel=self.channel_wa,
            subject=json.dumps(subject_dict) if isinstance(subject_dict, dict) else (subject_dict or ""),
            body=body,
            status=Template.Status.ACTIVE,
            provider_data=provider_data,
            created_by=self.user,
        )
        CampaignTemplate.objects.create(
            campaign=self.campaign,
            channel=self.channel_wa,
            template=template,
        )
        return template

    # 1. Existing ordinary text-message sending
    @patch("requests.Session.post")
    def test_ordinary_text_message_sending(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.TEXT_ONLY_123"}]
        }
        mock_post.return_value = mock_resp

        # Send ordinary text message via provider
        provider = MetaWhatsAppProvider(
            access_token=self.conn.get_access_token(),
            phone_number_id=self.conn.phone_number_id,
        )
        res = provider.send(
            to="917806030359",
            message="Hello this is a plain text message",
            metadata={"type": "text"},
        )
        self.assertEqual(res.id, "wamid.TEXT_ONLY_123")
        sent_json = mock_post.call_args[1]["json"]
        self.assertEqual(sent_json["type"], "text")
        self.assertEqual(sent_json["text"]["body"], "Hello this is a plain text message")
        self.assertNotIn("template", sent_json)

    # 2. Approved text-only template
    @patch("requests.Session.post")
    def test_approved_text_only_template_dispatch(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.TEXT_TEMPLATE_001"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Welcome to our platform!",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Welcome Text Template",
            subject_dict=metadata,
            body="Welcome to our platform!",
            meta_status="APPROVED",
            meta_template_name="welcome_text_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        self.assertTrue(mock_post.called)
        sent_json = mock_post.call_args[1]["json"]
        self.assertEqual(sent_json["type"], "template")
        self.assertEqual(sent_json["template"]["name"], "welcome_text_template")
        self.assertEqual(sent_json["template"]["language"]["code"], "en_US")
        self.assertEqual(sent_json["to"], "917806030359")

    # 3. Approved image-header template
    @patch("requests.Session.post")
    def test_approved_image_header_template_dispatch(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.IMAGE_TEMPLATE_002"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {
                "type": "IMAGE",
                "mediaUrl": "https://res.cloudinary.com/demo/image/upload/sample_header.jpg"
            },
            "body": "Check our special deal!",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Image Header Promo",
            subject_dict=metadata,
            body="Check our special deal!",
            meta_status="APPROVED",
            meta_template_name="image_header_promo",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        self.assertEqual(sent_json["type"], "template")
        self.assertEqual(sent_json["template"]["name"], "image_header_promo")
        components = sent_json["template"]["components"]
        header_comp = next(c for c in components if c["type"] == "header")
        self.assertEqual(header_comp["parameters"][0]["type"], "image")
        self.assertEqual(header_comp["parameters"][0]["image"]["link"], "https://res.cloudinary.com/demo/image/upload/sample_header.jpg")

    # 4. Approved video-header template
    @patch("requests.Session.post")
    def test_approved_video_header_template_dispatch(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.VIDEO_TEMPLATE_003"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {
                "type": "VIDEO",
                "mediaUrl": "https://res.cloudinary.com/demo/video/upload/promo.mp4"
            },
            "body": "Watch our walkthrough video.",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Video Promo",
            subject_dict=metadata,
            body="Watch our walkthrough video.",
            meta_status="APPROVED",
            meta_template_name="video_promo",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        header_comp = next(c for c in sent_json["template"]["components"] if c["type"] == "header")
        self.assertEqual(header_comp["parameters"][0]["type"], "video")
        self.assertEqual(header_comp["parameters"][0]["video"]["link"], "https://res.cloudinary.com/demo/video/upload/promo.mp4")

    # 5. Approved document-header template
    @patch("requests.Session.post")
    def test_approved_document_header_template_dispatch(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.DOC_TEMPLATE_004"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "UTILITY",
            "language": "en_US",
            "header": {
                "type": "DOCUMENT",
                "mediaUrl": "https://example.com/invoice.pdf"
            },
            "body": "Your invoice is ready.",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Invoice Delivery",
            subject_dict=metadata,
            body="Your invoice is ready.",
            meta_status="APPROVED",
            meta_template_name="invoice_delivery",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        header_comp = next(c for c in sent_json["template"]["components"] if c["type"] == "header")
        self.assertEqual(header_comp["parameters"][0]["type"], "document")
        self.assertEqual(header_comp["parameters"][0]["document"]["link"], "https://example.com/invoice.pdf")

    # 6. Dynamic body variables resolution
    @patch("requests.Session.post")
    def test_dynamic_body_variables_resolution(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.VARS_TEMPLATE_005"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Hello {{first_name}}, get {{discount}} off your next order with code {{coupon_code}}!",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Personalized Discount",
            subject_dict=metadata,
            body="Hello {{first_name}}, get {{discount}} off your next order with code {{coupon_code}}!",
            meta_status="APPROVED",
            meta_template_name="personalized_discount",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        body_comp = next(c for c in sent_json["template"]["components"] if c["type"] == "body")
        params = [p["text"] for p in body_comp["parameters"]]
        # Recipient Mayur has first_name: "Mayur", discount: "25%", coupon_code: "PROMO2026"
        self.assertEqual(params, ["Mayur", "25%", "PROMO2026"])

    # 7. Static URL button
    @patch("requests.Session.post")
    def test_static_url_button_does_not_inject_spurious_parameters(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.STATIC_BTN_006"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Check our main catalog.",
            "buttons": [
                {"type": "URL", "text": "Visit Website", "url": "https://example.com/catalog"}
            ],
        }
        self._create_whatsapp_template(
            name="Static URL Button Template",
            subject_dict=metadata,
            body="Check our main catalog.",
            meta_status="APPROVED",
            meta_template_name="static_url_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        # Static URL button has no dynamic parameters; Meta rejects button components if static
        components = sent_json["template"].get("components", [])
        button_comps = [c for c in components if c["type"] == "button"]
        self.assertEqual(len(button_comps), 0)

    # 8. Dynamic URL button parameter resolution
    @patch("requests.Session.post")
    def test_dynamic_url_button_parameter_resolution(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.DYN_BTN_007"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Track your shipment below.",
            "buttons": [
                {"type": "URL", "text": "Track Order", "url": "https://example.com/orders/{{order_id}}"}
            ],
        }
        self._create_whatsapp_template(
            name="Dynamic URL Template",
            subject_dict=metadata,
            body="Track your shipment below.",
            meta_status="APPROVED",
            meta_template_name="dynamic_url_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        button_comp = next(c for c in sent_json["template"]["components"] if c["type"] == "button")
        self.assertEqual(button_comp["sub_type"], "url")
        self.assertEqual(button_comp["index"], "0")
        # customer order_id is "ORD-9988"
        self.assertEqual(button_comp["parameters"][0]["text"], "ORD-9988")

    # 9. Quick-reply button
    @patch("requests.Session.post")
    def test_quick_reply_button_preservation(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.QR_BTN_008"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Are you satisfied with our service?",
            "buttons": [
                {"type": "QUICK_REPLY", "text": "Yes 👍"},
                {"type": "QUICK_REPLY", "text": "No 👎"},
            ],
        }
        self._create_whatsapp_template(
            name="Quick Reply Feedback",
            subject_dict=metadata,
            body="Are you satisfied with our service?",
            meta_status="APPROVED",
            meta_template_name="quick_reply_feedback",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        self.assertEqual(sent_json["template"]["name"], "quick_reply_feedback")

    # 10. Missing template metadata rejection
    def test_missing_template_metadata_rejection(self):
        # Template has no meta_template_name or provider_data
        template = Template.objects.create(
            name="Unsubmitted Template",
            channel=self.channel_wa,
            subject="",
            body="Hello customer",
            status=Template.Status.ACTIVE,
            provider_data={},
            created_by=self.user,
        )
        CampaignTemplate.objects.create(
            campaign=self.campaign,
            channel=self.channel_wa,
            template=template,
        )

        with self.assertRaises(ValidationError) as cm:
            DeliveryService.send_campaign(campaign=self.campaign)
        self.assertIn("not approved by Meta", str(cm.exception))

    # 11. Pending template rejection
    def test_pending_template_rejection(self):
        self._create_whatsapp_template(
            name="Pending Review Template",
            subject_dict={"body": "Pending body"},
            body="Pending body",
            meta_status="PENDING",
            meta_template_name="pending_review_template",
        )

        with self.assertRaises(ValidationError) as cm:
            DeliveryService.send_campaign(campaign=self.campaign)
        self.assertIn("current status: PENDING", str(cm.exception))

    # 12. Rejected template rejection
    def test_rejected_template_rejection(self):
        self._create_whatsapp_template(
            name="Rejected Review Template",
            subject_dict={"body": "Rejected body"},
            body="Rejected body",
            meta_status="REJECTED",
            meta_template_name="rejected_review_template",
        )

        with self.assertRaises(ValidationError) as cm:
            DeliveryService.send_campaign(campaign=self.campaign)
        self.assertIn("current status: REJECTED", str(cm.exception))

    # 13. Invalid header media handling (omits invalid / empty media url cleanly)
    @patch("requests.Session.post")
    def test_invalid_header_media_handling(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.NO_HEADER_URL_013"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "IMAGE", "mediaUrl": ""},  # Empty URL
            "body": "Deal without image header.",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Empty Header URL Template",
            subject_dict=metadata,
            body="Deal without image header.",
            meta_status="APPROVED",
            meta_template_name="empty_header_url_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        # No header component injected if mediaUrl was empty
        components = sent_json["template"].get("components", [])
        header_comps = [c for c in components if c["type"] == "header"]
        self.assertEqual(len(header_comps), 0)

    # 14. Missing dynamic variable fallback to empty string (no raw {{placeholders}} sent)
    @patch("requests.Session.post")
    def test_missing_dynamic_variable_fallback(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.MISSING_VAR_014"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Hello {{nonexistent_field}}, welcome!",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Missing Var Template",
            subject_dict=metadata,
            body="Hello {{nonexistent_field}}, welcome!",
            meta_status="APPROVED",
            meta_template_name="missing_var_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        sent_json = mock_post.call_args[1]["json"]
        body_comp = next(c for c in sent_json["template"]["components"] if c["type"] == "body")
        # Missing variable is resolved to empty string, NOT raw '{{nonexistent_field}}'
        self.assertEqual(body_comp["parameters"][0]["text"], "")

    # 15. Meta API rejection error handling
    @patch("requests.Session.post")
    def test_meta_api_rejection_error_handling(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = False
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "error": {
                "message": "(#132000) Template name does not exist",
                "type": "OAuthException",
                "code": 132000,
            }
        }
        import requests
        mock_resp.raise_for_status.side_effect = requests.HTTPError(response=mock_resp)
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Test message.",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Failed Meta Call",
            subject_dict=metadata,
            body="Test message.",
            meta_status="APPROVED",
            meta_template_name="failed_meta_call",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        delivery = CampaignDelivery.objects.get(campaign=self.campaign)
        self.assertEqual(delivery.status, CampaignDelivery.Status.FAILED)
        self.assertIn("132000", delivery.error_message)

    # 16. Provider timeout error handling
    @patch("requests.Session.post")
    def test_provider_timeout_error_handling(self, mock_post):
        import requests
        mock_post.side_effect = requests.Timeout("Connection timed out waiting for Meta")

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Test timeout.",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Timeout Template",
            subject_dict=metadata,
            body="Test timeout.",
            meta_status="APPROVED",
            meta_template_name="timeout_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        delivery = CampaignDelivery.objects.get(campaign=self.campaign)
        self.assertEqual(delivery.status, CampaignDelivery.Status.FAILED)
        self.assertIn("timed out", delivery.error_message)

    # 17. Message ID persistence
    @patch("requests.Session.post")
    def test_message_id_persistence(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.HBgMOTE3ODA2MDMwMzU5FQIAERgSMTBDNDVGMTRDNzE5QjYxM0EA"}]
        }
        mock_post.return_value = mock_resp

        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "Persistence test.",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="Persistence Template",
            subject_dict=metadata,
            body="Persistence test.",
            meta_status="APPROVED",
            meta_template_name="persistence_template",
        )

        DeliveryService.send_campaign(campaign=self.campaign)

        delivery = CampaignDelivery.objects.get(campaign=self.campaign)
        self.assertEqual(delivery.provider_message_id, "wamid.HBgMOTE3ODA2MDMwMzU5FQIAERgSMTBDNDVGMTRDNzE5QjYxM0EA")
        self.assertEqual(delivery.status, CampaignDelivery.Status.SENT)

        event = CommunicationEvent.objects.get(provider_message_id="wamid.HBgMOTE3ODA2MDMwMzU5FQIAERgSMTBDNDVGMTRDNzE5QjYxM0EA")
        self.assertEqual(event.status, "SENT")

    # 18. Webhook delivery-status updates (by provider_message_id)
    def test_webhook_delivery_status_updates(self):
        from rest_framework.test import APIRequestFactory
        from apps.communications.views import WhatsAppWebhookView

        delivery = CampaignDelivery.objects.create(
            campaign=self.campaign,
            customer=self.customer,
            channel=self.channel_wa,
            rendered_message="Test message",
            status=CampaignDelivery.Status.SENT,
            provider_message_id="wamid.STATUS_TEST_999",
        )
        event = CommunicationEvent.objects.create(
            campaign=self.campaign,
            whatsapp_connection=self.conn,
            channel="WHATSAPP",
            event_name="WHATSAPP_SENT",
            recipient="917806030359",
            status="SENT",
            provider_message_id="wamid.STATUS_TEST_999",
        )

        webhook_payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": self.conn.waba_id,
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "1234567890",
                                    "phone_number_id": self.conn.phone_number_id,
                                },
                                "statuses": [
                                    {
                                        "id": "wamid.STATUS_TEST_999",
                                        "status": "delivered",
                                        "timestamp": "1700000000",
                                        "recipient_id": "917806030359",
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }

        factory = APIRequestFactory()
        request = factory.post("/api/communications/webhooks/whatsapp/", webhook_payload, format="json")
        view = WhatsAppWebhookView.as_view()
        # Mock signature verification
        with patch.object(WhatsAppWebhookView, "_verify_signature", return_value=True):
            response = view(request)

        self.assertEqual(response.status_code, 200)
        delivery.refresh_from_db()
        event.refresh_from_db()
        self.assertEqual(delivery.status, CampaignDelivery.Status.DELIVERED)
        self.assertEqual(event.status, "DELIVERED")

    # 19. Duplicate / Out-of-order webhook events idempotency
    def test_duplicate_webhook_events_idempotency(self):
        from rest_framework.test import APIRequestFactory
        from apps.communications.views import WhatsAppWebhookView

        delivery = CampaignDelivery.objects.create(
            campaign=self.campaign,
            customer=self.customer,
            channel=self.channel_wa,
            rendered_message="Test message",
            status=CampaignDelivery.Status.DELIVERED,
            provider_message_id="wamid.IDEMPOTENT_777",
        )
        event = CommunicationEvent.objects.create(
            campaign=self.campaign,
            whatsapp_connection=self.conn,
            channel="WHATSAPP",
            event_name="WHATSAPP_SENT",
            recipient="917806030359",
            status="DELIVERED",
            provider_message_id="wamid.IDEMPOTENT_777",
        )

        # Incoming webhook reports "sent" (earlier status arriving late)
        webhook_payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": self.conn.waba_id,
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "phone_number_id": self.conn.phone_number_id,
                                },
                                "statuses": [
                                    {
                                        "id": "wamid.IDEMPOTENT_777",
                                        "status": "sent",
                                        "timestamp": "1699999999",
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }

        factory = APIRequestFactory()
        request = factory.post("/api/communications/webhooks/whatsapp/", webhook_payload, format="json")
        view = WhatsAppWebhookView.as_view()
        with patch.object(WhatsAppWebhookView, "_verify_signature", return_value=True):
            response = view(request)

        self.assertEqual(response.status_code, 200)
        delivery.refresh_from_db()
        event.refresh_from_db()
        # Status should NOT regress backwards from DELIVERED to SENT
        self.assertEqual(delivery.status, CampaignDelivery.Status.DELIVERED)
        self.assertEqual(event.status, "DELIVERED")

    # 20. Multi-channel campaign regression (Email alongside WhatsApp)
    @patch("requests.Session.post")
    @patch("apps.campaigns.services.dispatcher.send_email")
    def test_multichannel_campaign_regression(self, mock_email, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.MULTI_CH_WA"}]
        }
        mock_post.return_value = mock_resp

        # Add Email channel and template to the campaign
        CampaignChannel.objects.create(campaign=self.campaign, channel=self.channel_email)
        email_template = Template.objects.create(
            name="Email Newsletter",
            channel=self.channel_email,
            subject="Monthly Digest",
            body="<p>Email body for {{name}}</p>",
            status=Template.Status.ACTIVE,
            created_by=self.user,
        )
        CampaignTemplate.objects.create(
            campaign=self.campaign,
            channel=self.channel_email,
            template=email_template,
        )

        # Add WhatsApp template
        metadata = {
            "version": 1,
            "category": "MARKETING",
            "language": "en_US",
            "header": {"type": "NONE"},
            "body": "WhatsApp notification for {{name}}",
            "buttons": [],
        }
        self._create_whatsapp_template(
            name="WA Multi Channel",
            subject_dict=metadata,
            body="WhatsApp notification for {{name}}",
            meta_status="APPROVED",
            meta_template_name="wa_multi_channel",
        )

        # Add email to customer data
        self.customer.data["email"] = "mayur@example.com"
        self.customer.save()

        DeliveryService.send_campaign(campaign=self.campaign)

        # Both channels should have dispatched
        self.assertTrue(mock_email.called)
        self.assertTrue(mock_post.called)

        deliveries = CampaignDelivery.objects.filter(campaign=self.campaign)
        self.assertEqual(deliveries.count(), 2)
        wa_delivery = deliveries.get(channel=self.channel_wa)
        email_delivery = deliveries.get(channel=self.channel_email)

        self.assertEqual(wa_delivery.status, CampaignDelivery.Status.SENT)
        self.assertEqual(wa_delivery.provider_message_id, "wamid.MULTI_CH_WA")
        self.assertEqual(email_delivery.status, CampaignDelivery.Status.SENT)
