from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.communications.models import SenderIdentity

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

    def test_connect_custom_smtp_identity(self):
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

    def test_delete_sender_identity(self):
        identity = SenderIdentity.objects.create(
            user=self.user,
            email="delete@example.com",
            provider="YAHOO",
            connection_type="SMTP",
            status="CONNECTED"
        )
        url = f"/api/communications/sender-identities/{identity.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SenderIdentity.objects.filter(id=identity.id).exists())

    def test_google_oauth_url(self):
        url = "/api/communications/sender-identities/oauth/google/url/"
        with self.settings(GOOGLE_CLIENT_ID="mock-google-client-id"):
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("https://accounts.google.com/o/oauth2/v2/auth", response.data["url"])
            self.assertIn("mock-google-client-id", response.data["url"])

    def test_microsoft_oauth_url(self):
        url = "/api/communications/sender-identities/oauth/microsoft/url/"
        with self.settings(MICROSOFT_CLIENT_ID="mock-microsoft-client-id"):
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("https://login.microsoftonline.com/common/oauth2/v2.0/authorize", response.data["url"])
            self.assertIn("mock-microsoft-client-id", response.data["url"])
