from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.communications.models import DomainAuthentication, SenderIdentity

User = get_user_model()


class SenderIdentityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="testuser@example.com",
            password="Password123!",
            first_name="Test",
            last_name="User"
        )
        self.client.force_authenticate(user=self.user)

    def test_list_sender_identities_empty(self):
        url = "/api/communications/sender-identities/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_add_domain_and_verify(self):
        url = "/api/communications/sender-domains/"
        response = self.client.post(url, {"domain": "customdomain.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["domain"], "customdomain.com")
        self.assertEqual(response.data["status"], "PENDING")

        domain_id = response.data["id"]
        token = response.data["verification_token"]

        # Test verification failure
        with patch("apps.communications.views_sender.AWSSESService.get_domain_verification_status", return_value={"status": "PENDING"}), \
             patch("apps.communications.views_sender.verify_domain_dns", return_value=(False, "TXT record not found", [])):
            verify_res = self.client.post(f"/api/communications/sender-domains/{domain_id}/verify/")
            self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Test verification success
        with patch("apps.communications.views_sender.AWSSESService.get_domain_verification_status", return_value={"status": "PENDING"}), \
             patch("apps.communications.views_sender.verify_domain_dns", return_value=(True, "Verified", [f"automarket-verify={token}"])):
            verify_res = self.client.post(f"/api/communications/sender-domains/{domain_id}/verify/")
            self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
            self.assertEqual(verify_res.data["domain"]["status"], "VERIFIED")

    def test_connect_custom_smtp_requires_verified_domain(self):
        url = "/api/communications/sender-identities/connect-smtp/"
        payload = {
            "email": "smtpuser@unverifieddomain.com",
            "display_name": "Custom SMTP Sender",
            "provider": "CUSTOM_SMTP",
            "host": "smtp.unverifieddomain.com",
            "port": 587,
            "security": "STARTTLS",
            "username": "smtpuser@unverifieddomain.com",
            "password": "SecretPassword123"
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not verified", response.data["detail"])

    def test_connect_custom_smtp_identity(self):
        # Pre-create verified domain
        domain_auth = DomainAuthentication.objects.create(
            user=self.user,
            domain="customdomain.com",
            verification_token="token123",
            dns_record_value="automarket-verify=token123",
            status="VERIFIED"
        )

        url = "/api/communications/sender-identities/connect-smtp/"
        payload = {
            "email": "smtpuser@customdomain.com",
            "display_name": "Custom SMTP Sender",
            "provider": "CUSTOM_SMTP",
            "host": "smtp.customdomain.com",
            "port": 587,
            "security": "STARTTLS",
            "username": "smtpuser@customdomain.com",
            "password": "SecretPassword123"
        }
        
        with patch("apps.communications.providers.sender_abstraction.SMTPEmailSender.test_connection", return_value=(True, "Connected successfully")):
            response = self.client.post(url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(response.data["email"], "smtpuser@customdomain.com")
            self.assertEqual(response.data["provider"], "CUSTOM_SMTP")
            self.assertEqual(response.data["status"], "CONNECTED")

        # Verify password is encrypted and not leaked in response
        self.assertNotIn("password", response.data)
        identity = SenderIdentity.objects.get(email="smtpuser@customdomain.com")
        self.assertIn("password", identity.encrypted_credentials)
        self.assertNotEqual(identity.encrypted_credentials["password"], "SecretPassword123")
        self.assertEqual(identity.domain_auth, domain_auth)

    def test_delete_sender_identity(self):
        identity = SenderIdentity.objects.create(
            user=self.user,
            email="delete@example.com",
            provider="CUSTOM_SMTP",
            connection_type="SMTP",
            status="CONNECTED"
        )
        url = f"/api/communications/sender-identities/{identity.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SenderIdentity.objects.filter(id=identity.id).exists())

    def test_connect_aws_ses_identity(self):
        # Pre-create verified domain
        domain_auth = DomainAuthentication.objects.create(
            user=self.user,
            domain="customdomain.com",
            verification_token="token123",
            dns_record_value="automarket-verify=token123",
            status="VERIFIED"
        )

        url = "/api/communications/sender-identities/connect-ses/"
        payload = {
            "email": "newsletter@customdomain.com",
            "display_name": "SaaS Newsletter"
        }
        
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "newsletter@customdomain.com")
        self.assertEqual(response.data["provider"], "AWS_SES")
        self.assertEqual(response.data["status"], "CONNECTED")
        self.assertEqual(response.data["domain"], "customdomain.com")


class OrganizationSharedCommunicationsTests(APITestCase):
    def setUp(self):
        from apps.accounts.models import Organization, MAUser

        self.org_a = Organization.objects.create(
            name="Org A Comms",
            slug="org-a-comms",
            external_company_id="ORG-A-COMMS",
        )
        self.org_b = Organization.objects.create(
            name="Org B Comms",
            slug="org-b-comms",
            external_company_id="ORG-B-COMMS",
        )
        self.user_a1 = User.objects.create_user(
            email="u1@orga.com",
            password="Password123!",
            organization=self.org_a,
        )
        MAUser.objects.create(user=self.user_a1, organization=self.org_a, role="ADMIN")
        self.user_a2 = User.objects.create_user(
            email="u2@orga.com",
            password="Password123!",
            organization=self.org_a,
        )
        MAUser.objects.create(user=self.user_a2, organization=self.org_a, role="USER")
        self.user_b = User.objects.create_user(
            email="ub@orgb.com",
            password="Password123!",
            organization=self.org_b,
        )
        MAUser.objects.create(user=self.user_b, organization=self.org_b, role="ADMIN")

    def test_domain_and_email_shared_across_org_users_and_survives_user_delete(self):
        # User 1 adds and verifies domain
        self.client.force_authenticate(user=self.user_a1)
        dom_res = self.client.post("/api/communications/sender-domains/", {"domain": "orga.com"}, format="json")
        self.assertEqual(dom_res.status_code, status.HTTP_201_CREATED)
        dom_id = dom_res.data["id"]

        with patch("apps.communications.views_sender.AWSSESService.get_domain_verification_status", return_value={"status": "VERIFIED"}):
            ver_res = self.client.post(f"/api/communications/sender-domains/{dom_id}/verify/")
            self.assertEqual(ver_res.status_code, status.HTTP_200_OK)

        # User 1 connects SES sender email
        ses_res = self.client.post(
            "/api/communications/sender-identities/connect-ses/",
            {"email": "hello@orga.com", "display_name": "Org A Hello"},
            format="json",
        )
        self.assertEqual(ses_res.status_code, status.HTTP_201_CREATED)

        # User 2 in Org A sees the verified domain & email, can add another email on same verified domain
        self.client.force_authenticate(user=self.user_a2)
        doms_u2 = self.client.get("/api/communications/sender-domains/")
        self.assertEqual(len(doms_u2.data), 1)
        self.assertEqual(doms_u2.data[0]["domain"], "orga.com")

        # User 2 posting same domain gets existing org record (not "already verified by another account")
        dom_dup = self.client.post("/api/communications/sender-domains/", {"domain": "orga.com"}, format="json")
        self.assertEqual(dom_dup.status_code, status.HTTP_200_OK)
        self.assertEqual(dom_dup.data["id"], dom_id)

        idents_u2 = self.client.get("/api/communications/sender-identities/")
        self.assertEqual(len(idents_u2.data), 1)
        self.assertEqual(idents_u2.data[0]["email"], "hello@orga.com")

        ses_u2 = self.client.post(
            "/api/communications/sender-identities/connect-ses/",
            {"email": "support@orga.com", "display_name": "Org A Support"},
            format="json",
        )
        self.assertEqual(ses_u2.status_code, status.HTTP_201_CREATED)

        # User 3 in Org B sees nothing and cannot hijack orga.com
        self.client.force_authenticate(user=self.user_b)
        self.assertEqual(self.client.get("/api/communications/sender-domains/").data, [])
        self.assertEqual(self.client.get("/api/communications/sender-identities/").data, [])
        hijack = self.client.post("/api/communications/sender-domains/", {"domain": "orga.com"}, format="json")
        self.assertEqual(hijack.status_code, status.HTTP_400_BAD_REQUEST)

        # Deleting User 1 does NOT delete Org A's domains or sender identities
        self.user_a1.delete()
        self.assertTrue(DomainAuthentication.objects.filter(id=dom_id, organization=self.org_a).exists())
        self.assertEqual(SenderIdentity.objects.filter(organization=self.org_a).count(), 2)

        # User 2 can disconnect an org sender identity
        self.client.force_authenticate(user=self.user_a2)
        del_res = self.client.delete(f"/api/communications/sender-identities/{ses_res.data['id']}/")
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_single_sms_and_whatsapp_per_org_shared_and_isolated(self):
        from apps.communications.models import WhatsAppConnection
        from apps.communications.services.sms import get_sms_provider
        from apps.communications.services.whatsapp import get_whatsapp_connection

        # User 1 connects SMS #1
        self.client.force_authenticate(user=self.user_a1)
        res1 = self.client.post(
            "/api/communications/sender-identities/connect-sms/",
            {
                "phone_number": "+15551110001",
                "display_name": "Org A SMS 1",
                "provider": "TWILIO_SMS",
                "account_sid": "AC111",
                "auth_token": "tok111",
            },
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # User 2 sees SMS #1 and can use get_sms_provider
        self.client.force_authenticate(user=self.user_a2)
        list_u2 = self.client.get("/api/communications/sender-identities/")
        self.assertEqual(len(list_u2.data), 1)
        self.assertEqual(list_u2.data[0]["email"], "+15551110001")
        sms_prov = get_sms_provider(user=self.user_a2)
        self.assertEqual(sms_prov.from_number, "+15551110001")

        # User 2 reconnects with SMS #2 -> replaces SMS #1 (only 1 SMS number at a time per org)
        res2 = self.client.post(
            "/api/communications/sender-identities/connect-sms/",
            {
                "phone_number": "+15552220002",
                "display_name": "Org A SMS 2",
                "provider": "CUSTOM_SMS",
                "auth_token": "tok222",
            },
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        sms_rows = SenderIdentity.objects.filter(organization=self.org_a, provider__in=["TWILIO_SMS", "CUSTOM_SMS"])
        self.assertEqual(sms_rows.count(), 1)
        self.assertEqual(sms_rows.first().email, "+15552220002")

        # User 1 connects WhatsApp #1 manually, User 2 connects WhatsApp #2 -> only #2 stays active
        self.client.force_authenticate(user=self.user_a1)
        wa1 = self.client.post(
            "/api/communications/whatsapp/connections/",
            {"phone_number_id": "wa_phone_1", "access_token": "wa_tok_1", "is_active": True},
            format="json",
        )
        self.assertEqual(wa1.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.user_a2)
        wa_u2_list = self.client.get("/api/communications/sender-identities/")
        self.assertTrue(any(i["phone_number_id"] == "wa_phone_1" for i in wa_u2_list.data))

        wa2 = self.client.post(
            "/api/communications/whatsapp/connections/",
            {"phone_number_id": "wa_phone_2", "access_token": "wa_tok_2", "is_active": True},
            format="json",
        )
        self.assertEqual(wa2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WhatsAppConnection.objects.filter(organization=self.org_a, is_active=True).count(), 1)
        self.assertEqual(
            SenderIdentity.objects.filter(organization=self.org_a, provider="WHATSAPP_CLOUD").count(),
            1,
        )
        self.assertEqual(get_whatsapp_connection(organization=self.user_a1).phone_number_id, "wa_phone_2")

        # Disconnecting WhatsApp SenderIdentity also deactivates WhatsAppConnection
        wa_ident_id = SenderIdentity.objects.get(organization=self.org_a, provider="WHATSAPP_CLOUD").id
        del_wa = self.client.delete(f"/api/communications/sender-identities/{wa_ident_id}/")
        self.assertEqual(del_wa.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNone(get_whatsapp_connection(organization=self.user_a1))

        # Org B has no cross-tenant fallback for SMS or WhatsApp
        with self.assertRaises(ValueError):
            get_sms_provider(user=self.user_b)
        self.assertIsNone(get_whatsapp_connection(organization=self.user_b))


