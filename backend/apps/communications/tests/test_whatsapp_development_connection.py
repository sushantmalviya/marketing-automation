import hashlib
import hmac
import json
from unittest.mock import patch, MagicMock
from io import StringIO

from django.test import TestCase, override_settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import Organization, MAUser
from apps.communications.models import WhatsAppConnection, CommunicationEvent, SenderIdentity
from apps.communications.services.whatsapp import get_whatsapp_connection, send_whatsapp

User = get_user_model()


class WhatsAppDevelopmentConnectionTests(TestCase):
    def setUp(self):
        # 1. Setup Organizations
        self.org_a = Organization.objects.create(
            name="Alpha Corp",
            slug="alpha-corp",
            external_company_id="ALPHA-001",
            status="ACTIVE",
        )
        self.org_b = Organization.objects.create(
            name="Beta Ltd",
            slug="beta-ltd",
            external_company_id="BETA-002",
            status="ACTIVE",
        )
        self.org_suspended = Organization.objects.create(
            name="Suspended Corp",
            slug="suspended-corp",
            external_company_id="SUSP-003",
            status="SUSPENDED",
        )

        # 2. Setup Users
        self.user_a = User.objects.create_user(
            username="himanshu_dev",
            email="himanshu@gmail.com",
            password="testpassword123",
            organization=self.org_a,
        )
        MAUser.objects.create(
            user=self.user_a,
            organization=self.org_a,
            role="USER",
        )

        self.user_b = User.objects.create_user(
            username="beta_user",
            email="beta_user@example.com",
            password="testpassword123",
            organization=self.org_b,
        )
        MAUser.objects.create(
            user=self.user_b,
            organization=self.org_b,
            role="ADMIN",
        )

        self.client = APIClient()

    # =========================================================================
    # Test 1 & 7: Development connection registration & token encryption
    # =========================================================================
    @patch("requests.get")
    def test_setup_command_success_and_encryption(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "verified_name": "Automarketer Test",
            "display_phone_number": "+1 555 655 7195",
            "quality_rating": "GREEN",
        }
        mock_get.return_value = mock_resp

        out = StringIO()
        call_command(
            "setup_whatsapp_development_connection",
            email="himanshu@gmail.com",
            phone_number_id="1212090155330828",
            waba_id="1050882897946612",
            token="EAA_TEST_SECRET_TOKEN_XYZ",
            stdout=out,
        )

        conn = WhatsAppConnection.objects.filter(
            organization=self.user_a,
            phone_number_id="1212090155330828",
        ).first()
        self.assertIsNotNone(conn)
        self.assertEqual(conn.environment, "development")
        self.assertEqual(conn.waba_id, "1050882897946612")
        self.assertTrue(conn.is_active)

        # Encryption verification: token must not be plaintext in DB
        self.assertNotEqual(conn.encrypted_access_token, "EAA_TEST_SECRET_TOKEN_XYZ")
        self.assertEqual(conn.get_access_token(), "EAA_TEST_SECRET_TOKEN_XYZ")

        # SenderIdentity sync verification
        identity = SenderIdentity.objects.filter(
            user=self.user_a,
            phone_number_id="1212090155330828",
            provider="WHATSAPP_CLOUD",
        ).first()
        self.assertIsNotNone(identity)
        self.assertEqual(identity.status, "CONNECTED")
        self.assertEqual(identity.waba_id, "1050882897946612")

    # =========================================================================
    # Test 2: Idempotent re-execution (no duplicate rows)
    # =========================================================================
    @patch("requests.get")
    def test_setup_command_idempotency(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {"verified_name": "Test"}
        mock_get.return_value = mock_resp

        for i in range(2):
            call_command(
                "setup_whatsapp_development_connection",
                email="himanshu@gmail.com",
                phone_number_id="1212090155330828",
                waba_id="1050882897946612",
                token=f"EAA_TOKEN_RUN_{i}",
                skip_meta_validation=True,
            )

        conns = WhatsAppConnection.objects.filter(
            organization=self.user_a,
            phone_number_id="1212090155330828",
        )
        self.assertEqual(conns.count(), 1)
        self.assertEqual(conns.first().get_access_token(), "EAA_TOKEN_RUN_1")

    # =========================================================================
    # Test 3 & 4: Ambiguous organization memberships require explicit --org-id
    # =========================================================================
    def test_ambiguous_organization_membership(self):
        # Add a second active organization membership to user_a
        MAUser.objects.create(
            user=self.user_a,
            organization=self.org_b,
            role="USER",
        )
        with self.assertRaises(CommandError) as cm:
            call_command(
                "setup_whatsapp_development_connection",
                email="himanshu@gmail.com",
                token="DUMMY_TOKEN",
                skip_meta_validation=True,
            )
        self.assertIn("multiple organizations", str(cm.exception))

    # =========================================================================
    # Test 5 & 6: Missing token & Invalid Meta credentials
    # =========================================================================
    @patch("requests.get")
    def test_invalid_meta_credentials(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.ok = False
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "error": {"message": "Invalid OAuth access token."}
        }
        mock_get.return_value = mock_resp

        with self.assertRaises(CommandError) as cm:
            call_command(
                "setup_whatsapp_development_connection",
                email="himanshu@gmail.com",
                token="INVALID_TOKEN",
            )
        self.assertIn("Meta Graph API credential validation failed", str(cm.exception))

    # =========================================================================
    # Test 8 & 15: Cross-organization isolation & production connection preservation
    # =========================================================================
    def test_production_and_tenant_isolation(self):
        # 1. Existing production connection for Org A
        prod_conn = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="1999888777666",
            waba_id="PROD_WABA_999",
            environment="production",
            is_active=True,
        )
        prod_conn.set_access_token("PROD_SECRET_TOKEN")
        prod_conn.save()

        # 2. Existing dev connection for Org A
        dev_conn = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="1212090155330828",
            waba_id="1050882897946612",
            environment="development",
            is_active=True,
        )
        dev_conn.set_access_token("DEV_SECRET_TOKEN")
        dev_conn.save()

        # Prod resolution returns prod connection
        res_prod = get_whatsapp_connection(organization=self.user_a, environment="production")
        self.assertEqual(res_prod.id, prod_conn.id)

        # Dev resolution returns dev connection
        res_dev = get_whatsapp_connection(organization=self.user_a, environment="development")
        self.assertEqual(res_dev.id, dev_conn.id)

        # Cross-tenant check: user_b should not resolve user_a's connections
        res_user_b = get_whatsapp_connection(organization=self.user_b, environment="development")
        self.assertIsNone(res_user_b)

    # =========================================================================
    # Test 9: Unauthorized API request rejected (401)
    # =========================================================================
    def test_test_message_endpoint_unauthenticated(self):
        res = self.client.post(
            "/api/communications/whatsapp/test-message/",
            data={"recipient": "917806030359"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================================
    # Test 10: Invalid recipient restricted in development environment
    # =========================================================================
    def test_test_message_restricted_recipient(self):
        dev_conn = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="1212090155330828",
            waba_id="1050882897946612",
            environment="development",
            is_active=True,
        )
        dev_conn.set_access_token("TOKEN_123")
        dev_conn.save()

        self.client.force_authenticate(user=self.user_a)
        # Attempt to send to an unauthorized recipient
        res = self.client.post(
            "/api/communications/whatsapp/test-message/",
            data={"recipient": "919999999999"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not authorized", res.data["detail"])

    # =========================================================================
    # Test 11 & 13: Successful test message dispatch & CommunicationEvent creation
    # =========================================================================
    @patch("requests.Session.post")
    def test_test_message_success_hello_world(self, mock_post):
        dev_conn = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="1212090155330828",
            waba_id="1050882897946612",
            environment="development",
            is_active=True,
        )
        dev_conn.set_access_token("EAA_VALID_DEV_TOKEN")
        dev_conn.save()

        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "messaging_product": "whatsapp",
            "contacts": [{"input": "917806030359", "wa_id": "917806030359"}],
            "messages": [{"id": "wamid.DEV_TEST_MSG_999"}],
        }
        mock_post.return_value = mock_resp

        self.client.force_authenticate(user=self.user_a)
        res = self.client.post(
            "/api/communications/whatsapp/test-message/",
            data={"recipient": "+91 78060 30359"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["message_id"], "wamid.DEV_TEST_MSG_999")
        self.assertEqual(res.data["template"], "hello_world")
        self.assertNotIn("access_token", res.data)

        # Check payload delivered to Meta
        call_args, call_kwargs = mock_post.call_args
        self.assertIn("1212090155330828/messages", call_args[0])
        self.assertEqual(call_kwargs["headers"]["Authorization"], "Bearer EAA_VALID_DEV_TOKEN")
        self.assertEqual(call_kwargs["json"]["to"], "917806030359")
        self.assertEqual(call_kwargs["json"]["type"], "template")
        self.assertEqual(call_kwargs["json"]["template"]["name"], "hello_world")

        # Verify CommunicationEvent recorded
        event = CommunicationEvent.objects.filter(provider_message_id="wamid.DEV_TEST_MSG_999").first()
        self.assertIsNotNone(event)
        self.assertEqual(event.status, "SENT")
        self.assertEqual(event.whatsapp_connection.id, dev_conn.id)

    # =========================================================================
    # Test 14: Webhook status progression for the development test message
    # =========================================================================
    @override_settings(META_APP_SECRET="test-app-secret")
    def test_webhook_status_sync(self):
        dev_conn = WhatsAppConnection.objects.create(
            organization=self.user_a,
            phone_number_id="1212090155330828",
            waba_id="1050882897946612",
            environment="development",
            is_active=True,
        )
        event = CommunicationEvent.objects.create(
            whatsapp_connection=dev_conn,
            channel="WHATSAPP",
            event_name="WHATSAPP_TEST_SENT",
            recipient="917806030359",
            status="SENT",
            provider_message_id="wamid.DEV_WEBHOOK_123",
        )

        # Simulate DELIVERED status event from Meta
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "1050882897946612",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "phone_number_id": "1212090155330828",
                            "display_phone_number": "+1 555 655 7195",
                        },
                        "statuses": [{
                            "id": "wamid.DEV_WEBHOOK_123",
                            "status": "delivered",
                            "timestamp": "1731234567",
                        }],
                    },
                    "field": "messages",
                }],
            }],
        }
        raw_body = json.dumps(payload).encode("utf-8")
        sig = hmac.new(b"test-app-secret", msg=raw_body, digestmod=hashlib.sha256).hexdigest()

        res = self.client.post(
            "/api/communications/webhooks/whatsapp/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=f"sha256={sig}",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        event.refresh_from_db()
        self.assertEqual(event.status, "DELIVERED")
