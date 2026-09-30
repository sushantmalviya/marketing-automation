import hashlib
import hmac
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.communications.models import WhatsAppConnection, CommunicationEvent
from apps.communications.services.whatsapp import (
    send_whatsapp,
    get_whatsapp_provider,
    get_whatsapp_connection,
)
from apps.communications.serializers import WhatsAppConnectionSerializer
from apps.campaigns.models import Campaign, Channel, CustomerUpload, CustomerRecord, CampaignDelivery
from apps.campaigns.services.dispatcher import Dispatcher
from apps.tasks.models import Task

User = get_user_model()


class WhatsAppIntegrationTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username="org_a_user",
            email="admin_a@example.com",
            password="password123",
        )
        self.user_b = User.objects.create_user(
            username="org_b_user",
            email="admin_b@example.com",
            password="password123",
        )

        # Create connection for Organization A
        self.conn_a = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="100012345678901",
        )
        self.conn_a.set_access_token("EAA_RAW_META_TOKEN_ORG_A")
        self.conn_a.save()

        # Create connection for Organization B
        self.conn_b = WhatsAppConnection.objects.create(
            organization=self.user_b,
            phone_number_id="200098765432109",
        )
        self.conn_b.set_access_token("EAA_RAW_META_TOKEN_ORG_B")
        self.conn_b.save()

        self.client = APIClient()

    # ==========================================================
    # PHASE 1 & 4: Encryption at Rest & Decryption
    # ==========================================================

    def test_credential_encryption_at_rest(self):
        """Verify access token is encrypted in DB and not stored as plaintext."""
        self.conn_a.refresh_from_db()
        self.assertNotEqual(self.conn_a.encrypted_access_token, "EAA_RAW_META_TOKEN_ORG_A")
        self.assertTrue(len(self.conn_a.encrypted_access_token) > 20)
        # Decryption yields the original token
        self.assertEqual(self.conn_a.get_access_token(), "EAA_RAW_META_TOKEN_ORG_A")

    def test_serializer_does_not_leak_token(self):
        """Verify serializer never outputs encrypted or raw token."""
        serializer = WhatsAppConnectionSerializer(instance=self.conn_a)
        data = serializer.data
        self.assertNotIn("encrypted_access_token", data)
        self.assertNotIn("access_token", data)
        self.assertEqual(data["phone_number_id"], "100012345678901")

    # ==========================================================
    # PHASE 1 & 3: Outbound Messaging & Multi-Tenant Provider Resolution
    # ==========================================================

    @patch("requests.Session.post")
    def test_send_whatsapp_success(self, mock_post):
        """Verify successful outbound WhatsApp sending and CommunicationEvent creation."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "messaging_product": "whatsapp",
            "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
            "messages": [{"id": "wamid.HBgLMTIzNDU2Nzg5MA=="}],
        }
        mock_post.return_value = mock_response

        res = send_whatsapp(
            to="+91 9876543210",
            message="Welcome to Automarketer!",
            organization=self.user_a,
        )

        self.assertEqual(res, "wamid.HBgLMTIzNDU2Nzg5MA==")
        self.assertTrue(mock_post.called)

        # Check call arguments
        call_args, call_kwargs = mock_post.call_args
        self.assertIn("100012345678901/messages", call_args[0])
        self.assertEqual(call_kwargs["headers"]["Authorization"], "Bearer EAA_RAW_META_TOKEN_ORG_A")
        self.assertEqual(call_kwargs["json"]["to"], "919876543210")
        self.assertEqual(call_kwargs["json"]["text"]["body"], "Welcome to Automarketer!")

        # Verify CommunicationEvent
        event = CommunicationEvent.objects.filter(
            recipient="+91 9876543210",
            whatsapp_connection=self.conn_a,
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.status, "SENT")
        self.assertEqual(event.provider_message_id, "wamid.HBgLMTIzNDU2Nzg5MA==")

    # ==========================================================
    # PHASE 9: Multi-Tenant Credential Isolation
    # ==========================================================

    @patch("requests.Session.post")
    def test_tenant_isolation_outbound(self, mock_post):
        """Verify Organization A uses Org A's credentials and Org B uses Org B's credentials."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"messages": [{"id": "wamid.ORGA"}]}
        mock_post.return_value = mock_response

        # Send as Org A
        send_whatsapp(to="1111111111", message="Msg A", organization=self.user_a)
        _, kwargs_a = mock_post.call_args
        self.assertEqual(kwargs_a["headers"]["Authorization"], "Bearer EAA_RAW_META_TOKEN_ORG_A")

        # Send as Org B
        mock_response.json.return_value = {"messages": [{"id": "wamid.ORGB"}]}
        send_whatsapp(to="2222222222", message="Msg B", organization=self.user_b)
        _, kwargs_b = mock_post.call_args
        self.assertEqual(kwargs_b["headers"]["Authorization"], "Bearer EAA_RAW_META_TOKEN_ORG_B")

    def test_tenant_isolation_api(self):
        """Verify User A cannot list or access User B's WhatsApp connection via API."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/communications/whatsapp/connections/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        raw_list = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        ids = [str(item["id"]) for item in raw_list]
        self.assertIn(str(self.conn_a.id), ids)
        self.assertNotIn(str(self.conn_b.id), ids)



        # Attempt direct detail retrieval of Org B's connection
        detail_response = self.client.get(f"/api/communications/whatsapp/connections/{self.conn_b.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    # ==========================================================
    # PHASE 5: Webhook Security & HMAC Verification
    # ==========================================================

    @override_settings(WHATSAPP_WEBHOOK_VERIFY_TOKEN="secret-verify-token")
    def test_webhook_challenge_verification(self):
        """Verify GET hub.challenge verification for Meta Webhook setup."""
        response = self.client.get(
            "/api/communications/webhooks/whatsapp/",
            {
                "hub.mode": "subscribe",
                "hub.verify_token": "secret-verify-token",
                "hub.challenge": "1158201444",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), "1158201444")

    @override_settings(META_APP_SECRET="test-meta-app-secret")
    def test_webhook_hmac_signature_validation(self):
        """Verify POST webhook validates X-Hub-Signature-256 and rejects invalid signatures."""
        payload = json.dumps({
            "object": "whatsapp_business_account",
            "entry": [],
        }).encode("utf-8")

        # 1. Invalid signature
        response = self.client.post(
            "/api/communications/webhooks/whatsapp/",
            data=payload,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256="sha256=invalid_signature",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Valid signature
        valid_sig = hmac.new(b"test-meta-app-secret", msg=payload, digestmod=hashlib.sha256).hexdigest()
        response = self.client.post(
            "/api/communications/webhooks/whatsapp/",
            data=payload,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=f"sha256={valid_sig}",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # ==========================================================
    # PHASE 5 & 8: Delivery Tracking & Idempotency
    # ==========================================================

    @override_settings(META_APP_SECRET="test-meta-app-secret")
    def test_webhook_delivery_status_progression_and_idempotency(self):
        """Verify status advances SENT -> DELIVERED -> READ and resists regression."""
        event = CommunicationEvent.objects.create(
            channel="WHATSAPP",
            event_name="WHATSAPP_SENT",
            recipient="919876543210",
            status="SENT",
            provider_message_id="wamid.TEST_ID_100",
            whatsapp_connection=self.conn_a,
        )

        def send_status_webhook(msg_status):
            payload_dict = {
                "object": "whatsapp_business_account",
                "entry": [{
                    "changes": [{
                        "value": {
                            "messaging_product": "whatsapp",
                            "statuses": [{
                                "id": "wamid.TEST_ID_100",
                                "status": msg_status,
                                "timestamp": "1710000000",
                            }],
                        },
                        "field": "messages",
                    }],
                }],
            }
            raw = json.dumps(payload_dict).encode("utf-8")
            sig = hmac.new(b"test-meta-app-secret", msg=raw, digestmod=hashlib.sha256).hexdigest()
            return self.client.post(
                "/api/communications/webhooks/whatsapp/",
                data=raw,
                content_type="application/json",
                HTTP_X_HUB_SIGNATURE_256=f"sha256={sig}",
            )

        # Step 1: Delivered
        res = send_status_webhook("delivered")
        self.assertEqual(res.status_code, 200)
        event.refresh_from_db()
        self.assertEqual(event.status, "DELIVERED")

        # Step 2: Read
        res = send_status_webhook("read")
        self.assertEqual(res.status_code, 200)
        event.refresh_from_db()
        self.assertEqual(event.status, "READ")

        # Step 3: Out of order "delivered" or "sent" status should NOT revert "READ"
        res = send_status_webhook("delivered")
        self.assertEqual(res.status_code, 200)
        event.refresh_from_db()
        self.assertEqual(event.status, "READ")

    # ==========================================================
    # PHASE 6 & 7: Campaign Integration & Dispatcher
    # ==========================================================

    @patch("requests.Session.post")
    def test_campaign_dispatcher_whatsapp_flow(self, mock_post):
        """Verify Campaign delivery routing via Dispatcher to WhatsApp provider."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "messages": [{"id": "wamid.CAMPAIGN_DISPATCH_1"}],
        }
        mock_post.return_value = mock_response

        # Setup Campaign and Channel
        from django.utils import timezone
        from apps.campaigns.models import Audience

        channel, _ = Channel.objects.get_or_create(code="WHATSAPP", defaults={"name": "WhatsApp"})
        upload = CustomerUpload.objects.create(file_name="leads.csv", uploaded_by=self.user_a)
        audience = Audience.objects.create(name="All Customers", customer_upload=upload, created_by=self.user_a)
        task = Task.objects.create(
            title="Test Task",
            due_date=timezone.now(),
            audience=audience,
            created_by=self.user_a,
        )
        campaign = Campaign.objects.create(name="Festive Promo", task=task, created_by=self.user_a)
        record = CustomerRecord.objects.create(
            upload=upload,
            data={"phone": "919999999999", "name": "John"},
            routing_logs=[],
        )



        delivery = CampaignDelivery.objects.create(
            campaign=campaign,
            customer=record,
            channel=channel,
            rendered_message="Hello John, Festive Promo for you!",
            status=CampaignDelivery.Status.PENDING,
        )

        result = Dispatcher.send(delivery=delivery)
        self.assertTrue(result["success"])
        self.assertEqual(result["provider_message_id"], "wamid.CAMPAIGN_DISPATCH_1")

        # Verify CommunicationEvent exists and is linked to campaign
        event = CommunicationEvent.objects.filter(campaign=campaign).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.recipient, "919999999999")
        self.assertEqual(event.provider_message_id, "wamid.CAMPAIGN_DISPATCH_1")
