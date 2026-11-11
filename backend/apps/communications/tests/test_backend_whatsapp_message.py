import os
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.conf import settings

from apps.accounts.models import Organization, MAUser
from apps.communications.models import WhatsAppConnection, CommunicationEvent
from apps.communications.services.whatsapp import get_whatsapp_connection, send_whatsapp
from apps.communications.providers.whatsapp import MetaWhatsAppProvider

User = get_user_model()


class AutomatedMockedTests(TestCase):
    """
    Automated unit and mocked integration tests covering all 10 requirements:
    1. Correct organization resolution
    2. Phone number ID selection
    3. Secure token retrieval and decryption
    4. Recipient normalization (917806030359)
    5. Valid hello_world template payload construction
    6. Correct Meta Graph API endpoint URL
    7. Response handling
    8. Message ID and CommunicationEvent persistence
    9. Error handling
    10. Tenant isolation
    """

    def setUp(self):
        # 1. Organization A (Tenant Alpha)
        self.org_a = Organization.objects.create(
            name="Alpha Corp",
            slug="alpha-corp",
            external_company_id="ALPHA-001",
            status="ACTIVE",
        )
        self.user_a = User.objects.create_user(
            username="himanshu_mock",
            email="himanshu@gmail.com",
            password="testpassword123",
            organization=self.org_a,
        )
        MAUser.objects.create(
            user=self.user_a,
            organization=self.org_a,
            role="USER",
        )

        # 2. Organization B (Tenant Beta)
        self.org_b = Organization.objects.create(
            name="Beta Ltd",
            slug="beta-ltd",
            external_company_id="BETA-002",
            status="ACTIVE",
        )
        self.user_b = User.objects.create_user(
            username="beta_mock_user",
            email="beta_user@example.com",
            password="testpassword123",
            organization=self.org_b,
        )
        MAUser.objects.create(
            user=self.user_b,
            organization=self.org_b,
            role="ADMIN",
        )

        # 3. Connection for Org A (Development)
        self.conn_a = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="1212090155330828",
            waba_id="1050882897946612",
            environment="development",
            is_active=True,
        )
        self.conn_a.set_access_token("EAA_MOCKED_TOKEN_ORG_A")
        self.conn_a.save()

        # 4. Connection for Org B
        self.conn_b = WhatsAppConnection.objects.create(
            organization=self.user_b,
            phone_number_id="999888777666",
            waba_id="999888777666_WABA",
            environment="development",
            is_active=True,
        )
        self.conn_b.set_access_token("EAA_MOCKED_TOKEN_ORG_B")
        self.conn_b.save()

    def test_organization_resolution_and_phone_number_id(self):
        """1 & 2: Backend resolves correct connection and phone number ID for user_a's organization."""
        conn = get_whatsapp_connection(organization=self.user_a, environment="development")
        self.assertIsNotNone(conn)
        self.assertEqual(conn.id, self.conn_a.id)
        self.assertEqual(conn.phone_number_id, "1212090155330828")
        self.assertEqual(conn.environment, "development")

    def test_secure_token_retrieval_and_decryption(self):
        """3: Access token is encrypted in DB and decrypted securely in memory."""
        self.conn_a.refresh_from_db()
        self.assertNotEqual(self.conn_a.encrypted_access_token, "EAA_MOCKED_TOKEN_ORG_A")
        self.assertEqual(self.conn_a.get_access_token(), "EAA_MOCKED_TOKEN_ORG_A")

    @patch("requests.Session.post")
    def test_recipient_normalization_and_template_payload(self, mock_post):
        """4, 5, 6, 7, 8: Validates recipient normalization, endpoint URL, template payload, and event persistence."""
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "contacts": [{"input": "917806030359", "wa_id": "917806030359"}],
            "messages": [{"id": "wamid.MOCKED_TEST_MSG_12345"}],
        }
        mock_post.return_value = mock_resp

        # Call send_whatsapp with messy phone format '+91 78060 30359'
        config = {
            "metadata": {
                "type": "template",
                "template": {
                    "name": "hello_world",
                    "language": {"code": "en_US"},
                },
            }
        }
        msg_id = send_whatsapp(
            to="+91 78060 30359",
            message="",
            config=config,
            organization=self.user_a,
            environment="development",
        )

        self.assertEqual(msg_id, "wamid.MOCKED_TEST_MSG_12345")
        self.assertTrue(mock_post.called)

        call_args, call_kwargs = mock_post.call_args
        # 6: Meta Graph API URL verification
        api_ver = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")
        expected_url = f"https://graph.facebook.com/{api_ver}/1212090155330828/messages"
        self.assertEqual(call_args[0], expected_url)

        # 4 & 5: Payload verification
        json_data = call_kwargs["json"]
        self.assertEqual(json_data["to"], "917806030359")
        self.assertEqual(json_data["type"], "template")
        self.assertEqual(json_data["template"]["name"], "hello_world")
        self.assertEqual(json_data["template"]["language"]["code"], "en_US")
        self.assertEqual(call_kwargs["headers"]["Authorization"], "Bearer EAA_MOCKED_TOKEN_ORG_A")

        # 8: Persistence verification in CommunicationEvent
        event = CommunicationEvent.objects.filter(provider_message_id="wamid.MOCKED_TEST_MSG_12345").first()
        self.assertIsNotNone(event)
        self.assertEqual(event.status, "SENT")
        self.assertEqual(event.whatsapp_connection.id, self.conn_a.id)

    @patch("requests.Session.post")
    def test_api_error_handling(self, mock_post):
        """9: Meta API errors (e.g. 400 Bad Request) are raised and handled properly."""
        import requests
        mock_resp = MagicMock()
        mock_resp.ok = False
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "error": {
                "message": "Template hello_world does not exist in en_US",
                "type": "OAuthException",
                "code": 100,
            }
        }
        mock_post.side_effect = requests.HTTPError(
            "400 Client Error",
            response=mock_resp,
        )

        with self.assertRaises(Exception):
            send_whatsapp(
                to="917806030359",
                message="",
                config={"metadata": {"type": "template", "template": {"name": "hello_world", "language": {"code": "en_US"}}}},
                organization=self.user_a,
                environment="development",
            )

    def test_tenant_isolation(self):
        """10: User from Organization B cannot access Organization A's connection."""
        conn_for_b = get_whatsapp_connection(organization=self.user_b, environment="development")
        self.assertEqual(conn_for_b.id, self.conn_b.id)
        self.assertNotEqual(conn_for_b.id, self.conn_a.id)
        self.assertNotEqual(conn_for_b.get_access_token(), self.conn_a.get_access_token())


class RealBackendIntegrationTest(TestCase):
    """
    Explicitly controlled real backend integration test.
    Requires RUN_REAL_WHATSAPP_TEST=true to make any external HTTP request.
    Enforces strict safety gates:
    - Recipient must be exactly 917806030359
    - Phone number ID must be 1212090155330828
    - Environment must be development
    - Template must be hello_world
    - Sends exactly one message
    """

    @unittest.skipUnless(
        os.getenv("RUN_REAL_WHATSAPP_TEST") == "true",
        "Real WhatsApp test skipped unless RUN_REAL_WHATSAPP_TEST=true is explicitly set in environment.",
    )
    def test_send_single_real_whatsapp_message(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # 1. Resolve User & Connection
        user = User.objects.filter(email__iexact="himanshu@gmail.com").first()
        self.assertIsNotNone(user, "User himanshu@gmail.com must exist in database")

        conn = get_whatsapp_connection(organization=user, environment="development")
        self.assertIsNotNone(conn, "Development WhatsAppConnection for himanshu@gmail.com must exist")

        # 2. Safety Gate: Verify sender is the development test number
        self.assertEqual(conn.phone_number_id, "1212090155330828", "Sender must be Meta Test Number ID")
        self.assertEqual(conn.environment, "development", "Environment must be development")

        # 3. Safety Gate: Recipient must be exactly 917806030359
        target_recipient = "917806030359"
        self.assertEqual(target_recipient, "917806030359")

        # 4. Dispatch exactly ONE message via existing send_whatsapp service
        config = {
            "metadata": {
                "type": "template",
                "template": {
                    "name": "hello_world",
                    "language": {"code": "en_US"},
                },
            }
        }
        msg_id = send_whatsapp(
            to=target_recipient,
            message="",
            config=config,
            organization=user,
            connection=conn,
            environment="development",
        )

        # 5. Assertions on real Meta response
        self.assertTrue(bool(msg_id), "Meta must return a message ID")
        self.assertTrue(str(msg_id).startswith("wamid."), f"Meta message ID should start with wamid: {msg_id}")

        # 6. Verify CommunicationEvent persistence in DB
        event = CommunicationEvent.objects.filter(provider_message_id=str(msg_id)).first()
        self.assertIsNotNone(event, "CommunicationEvent record must be persisted in database")
        self.assertEqual(event.status, "SENT")
        self.assertEqual(event.recipient, target_recipient)
        self.assertEqual(event.whatsapp_connection.id, conn.id)
        print(f"\n[REAL SEND SUCCESS] Meta Message ID: {msg_id} (CommunicationEvent ID: {event.id})")
