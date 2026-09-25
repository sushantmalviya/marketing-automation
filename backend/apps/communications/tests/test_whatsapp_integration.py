import hmac
import hashlib
import json
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.communications.models import SenderIdentity, CommunicationEvent
from apps.communications.services.whatsapp import get_whatsapp_provider, get_whatsapp_identity
from apps.integrations.utils.crypto import encrypt_token, decrypt_token

User = get_user_model()


class WhatsAppIntegrationTests(APITestCase):
    def setUp(self):
        self.tenant_a = User.objects.create_user(
            email="tenant_a@example.com",
            password="Password123!",
            first_name="Tenant",
            last_name="A"
        )
        self.tenant_b = User.objects.create_user(
            email="tenant_b@example.com",
            password="Password123!",
            first_name="Tenant",
            last_name="B"
        )

        self.identity_a = SenderIdentity.objects.create(
            user=self.tenant_a,
            email="+15550001111",
            display_name="Tenant A Business",
            provider="WHATSAPP_CLOUD",
            connection_type="OAUTH",
            status="CONNECTED",
            phone_number_id="phone_id_a",
            waba_id="waba_id_a",
            quality_rating="GREEN",
            encrypted_credentials={
                "phone_number_id": "phone_id_a",
                "waba_id": "waba_id_a",
                "access_token": encrypt_token("mock_token_tenant_a"),
            }
        )

        self.identity_b = SenderIdentity.objects.create(
            user=self.tenant_b,
            email="+15550002222",
            display_name="Tenant B Business",
            provider="WHATSAPP_CLOUD",
            connection_type="OAUTH",
            status="CONNECTED",
            phone_number_id="phone_id_b",
            waba_id="waba_id_b",
            quality_rating="GREEN",
            encrypted_credentials={
                "phone_number_id": "phone_id_b",
                "waba_id": "waba_id_b",
                "access_token": encrypt_token("mock_token_tenant_b"),
            }
        )

    def test_tenant_isolation_get_provider(self):
        """Test that get_whatsapp_provider retrieves correct tenant-scoped provider."""
        provider_a = get_whatsapp_provider(user=self.tenant_a)
        self.assertEqual(provider_a.phone_number_id, "phone_id_a")
        self.assertEqual(provider_a.access_token, "mock_token_tenant_a")

        provider_b = get_whatsapp_provider(user=self.tenant_b)
        self.assertEqual(provider_b.phone_number_id, "phone_id_b")
        self.assertEqual(provider_b.access_token, "mock_token_tenant_b")

    def test_embedded_signup_callback_endpoint(self):
        """Test Embedded Signup callback API exchanges code and creates SenderIdentity."""
        self.client.force_authenticate(user=self.tenant_a)
        url = "/api/communications/whatsapp/embedded-signup/callback/"
        payload = {
            "code": "mock_auth_code_123",
            "waba_id": "new_waba_100",
            "phone_number_id": "new_phone_100"
        }

        mock_meta_api = MagicMock()
        mock_meta_api.exchange_code_for_token.return_value = {"access_token": "mock_long_lived_token"}
        mock_meta_api.subscribe_waba_to_app.return_value = True
        mock_meta_api.register_phone_number.return_value = True
        mock_meta_api.get_phone_number_details.return_value = {
            "display_phone_number": "+15559998888",
            "verified_name": "Verified Business Name",
            "quality_rating": "GREEN",
            "code_verification_status": "VERIFIED",
            "account_review_status": "APPROVED",
        }

        with patch("apps.communications.views_sender.MetaAPIService", return_value=mock_meta_api):
            response = self.client.post(url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(response.data["email"], "+15559998888")
            self.assertEqual(response.data["waba_id"], "new_waba_100")
            self.assertEqual(response.data["phone_number_id"], "new_phone_100")
            self.assertEqual(response.data["status"], "CONNECTED")

    def test_webhook_challenge_verification(self):
        """Test GET request challenge verification."""
        url = "/api/communications/webhooks/whatsapp/?hub.mode=subscribe&hub.verify_token=auto-market-whatsapp-secure-token&hub.challenge=test_challenge_123"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), "test_challenge_123")

    def test_webhook_hmac_signature_validation(self):
        """Test POST signature verification rejects invalid HMAC signature."""
        url = "/api/communications/webhooks/whatsapp/"
        payload = {"object": "whatsapp_business_account", "entry": []}
        body_bytes = json.dumps(payload).encode("utf-8")

        with self.settings(META_APP_SECRET="super_secret_key"):
            # Invalid signature
            response = self.client.post(
                url,
                data=payload,
                format="json",
                HTTP_X_HUB_SIGNATURE_256="sha256=invalid_signature_hash"
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

            # Valid signature
            valid_sig = hmac.new(b"super_secret_key", body_bytes, hashlib.sha256).hexdigest()
            response = self.client.post(
                url,
                data=payload,
                format="json",
                HTTP_X_HUB_SIGNATURE_256=f"sha256={valid_sig}"
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_webhook_inbound_message_processing(self):
        """Test that incoming customer messages are processed and logged as WHATSAPP_RECEIVED."""
        url = "/api/communications/webhooks/whatsapp/"
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "waba_id_a",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "+15550001111",
                                    "phone_number_id": "phone_id_a"
                                },
                                "messages": [
                                    {
                                        "from": "+19998887777",
                                        "id": "wmid.inbound.12345",
                                        "timestamp": "1700000000",
                                        "type": "text",
                                        "text": {"body": "Hello Tenant A, I need support!"}
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        event = CommunicationEvent.objects.filter(provider_message_id="wmid.inbound.12345").first()
        self.assertIsNotNone(event)
        self.assertEqual(event.channel, "WHATSAPP")
        self.assertEqual(event.event_name, "WHATSAPP_RECEIVED")
        self.assertEqual(event.status, "RECEIVED")
        self.assertEqual(event.recipient, "+19998887777")
        self.assertEqual(event.metadata["text"], "Hello Tenant A, I need support!")
        self.assertEqual(event.metadata["tenant_user_id"], str(self.tenant_a.id))

    def test_webhook_outbound_status_update(self):
        """Test outbound delivery and read status updates."""
        outbound_event = CommunicationEvent.objects.create(
            channel="WHATSAPP",
            event_name="WHATSAPP_SENT",
            recipient="+19998887777",
            status="SENT",
            provider_message_id="wmid.outbound.99999"
        )

        url = "/api/communications/webhooks/whatsapp/"
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "waba_id_a",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "phone_number_id": "phone_id_a"
                                },
                                "statuses": [
                                    {
                                        "id": "wmid.outbound.99999",
                                        "status": "read",
                                        "timestamp": "1700000010"
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        outbound_event.refresh_from_db()
        self.assertEqual(outbound_event.status, "READ")
