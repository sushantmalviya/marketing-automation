import base64
import json
import logging
import smtplib
import ssl
import urllib.parse
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from apps.integrations.utils.crypto import decrypt_token

logger = logging.getLogger(__name__)


class BaseEmailSender:
    def __init__(self, sender_identity):
        self.sender_identity = sender_identity
        self.credentials = sender_identity.encrypted_credentials or {}

    def test_connection(self):
        raise NotImplementedError

    def send(self, subject, html_content, recipient, headers=None):
        raise NotImplementedError


class SMTPEmailSender(BaseEmailSender):
    def _get_smtp_config(self):
        host = self.credentials.get("host", "")
        port = int(self.credentials.get("port", 587))
        security = str(self.credentials.get("security", "STARTTLS")).upper() # SSL/TLS, STARTTLS, NONE
        username = self.credentials.get("username", "")
        encrypted_password = self.credentials.get("password", "")
        password = decrypt_token(encrypted_password) if encrypted_password else ""
        return host, port, security, username, password

    def test_connection(self):
        host, port, security, username, password = self._get_smtp_config()
        if not host or not username:
            return False, "Missing SMTP host or username."

        try:
            context = ssl.create_default_context()
            if security in ("SSL", "SSL/TLS"):
                with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
                    server.login(username, password)
            else: # STARTTLS or standard
                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.ehlo()
                    if security != "NONE":
                        server.starttls(context=context)
                        server.ehlo()
                    if username and password:
                        server.login(username, password)
            return True, "SMTP connection verified successfully."
        except Exception as e:
            logger.warning(f"SMTP connection test failed for {username}: {e}")
            return False, str(e)

    def send(self, subject, html_content, recipient, headers=None):
        host, port, security, username, password = self._get_smtp_config()
        from_email = self.sender_identity.email
        display_name = self.sender_identity.display_name

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{display_name} <{from_email}>" if display_name else from_email
        msg["To"] = recipient

        if headers:
            for k, v in headers.items():
                if k not in ("Subject", "From", "To"):
                    msg[k] = v

        msg.attach(MIMEText(html_content, "html", "utf-8"))

        context = ssl.create_default_context()
        if security in ("SSL", "SSL/TLS"):
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                server.login(username, password)
                server.sendmail(from_email, [recipient], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                if security != "NONE":
                    server.starttls(context=context)
                    server.ehlo()
                if username and password:
                    server.login(username, password)
                server.sendmail(from_email, [recipient], msg.as_string())
        return True


class GmailSender(BaseEmailSender):
    def _get_access_token(self):
        enc_refresh_token = self.credentials.get("refresh_token")
        if not enc_refresh_token:
            return None
        refresh_token = decrypt_token(enc_refresh_token)

        from django.conf import settings
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
        client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")

        if not client_id or not client_secret:
            logger.error("Google OAuth credentials missing in settings.")
            return None

        data = urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                return res_data.get("access_token")
        except Exception as e:
            logger.error(f"Failed to refresh Google access token: {e}")
            return None

    def test_connection(self):
        token = self._get_access_token()
        if not token:
            return False, "Failed to authenticate with Google OAuth."

        req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token}"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("email"):
                    return True, f"Google account connected: {data['email']}"
            return False, "Could not fetch user profile from Google."
        except Exception as e:
            return False, f"Google connection error: {e}"

    def send(self, subject, html_content, recipient, headers=None):
        token = self._get_access_token()
        if not token:
            raise RuntimeError("Could not obtain Google access token.")

        from_email = self.sender_identity.email
        display_name = self.sender_identity.display_name

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{display_name} <{from_email}>" if display_name else from_email
        msg["To"] = recipient

        if headers:
            for k, v in headers.items():
                if k not in ("Subject", "From", "To"):
                    msg[k] = v

        msg.attach(MIMEText(html_content, "html", "utf-8"))
        raw_msg = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

        payload = json.dumps({"raw": raw_msg}).encode("utf-8")
        req = urllib.request.Request(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201, 202):
                return True
        return True


class MicrosoftSender(BaseEmailSender):
    def _get_access_token(self):
        enc_refresh_token = self.credentials.get("refresh_token")
        if not enc_refresh_token:
            return None
        refresh_token = decrypt_token(enc_refresh_token)

        from django.conf import settings
        client_id = getattr(settings, "MICROSOFT_CLIENT_ID", "")
        client_secret = getattr(settings, "MICROSOFT_CLIENT_SECRET", "")

        if not client_id or not client_secret:
            logger.error("Microsoft OAuth credentials missing in settings.")
            return None

        data = urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": "https://graph.microsoft.com/Mail.Send offline_access User.Read",
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                return res_data.get("access_token")
        except Exception as e:
            logger.error(f"Failed to refresh Microsoft access token: {e}")
            return None

    def test_connection(self):
        token = self._get_access_token()
        if not token:
            return False, "Failed to authenticate with Microsoft Graph."

        req = urllib.request.Request(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("userPrincipalName") or data.get("mail"):
                    return True, "Microsoft account connected successfully."
            return False, "Could not fetch user profile from Microsoft."
        except Exception as e:
            return False, f"Microsoft connection error: {e}"

    def send(self, subject, html_content, recipient, headers=None):
        token = self._get_access_token()
        if not token:
            raise RuntimeError("Could not obtain Microsoft access token.")

        payload = json.dumps({
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_content
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": recipient
                        }
                    }
                ]
            },
            "saveToSentItems": "true"
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://graph.microsoft.com/v1.0/me/sendMail",
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 202):
                return True
        return True


def get_sender_provider(sender_identity):
    if not sender_identity:
        return None
    provider = sender_identity.provider.upper()
    if provider == "GMAIL":
        return GmailSender(sender_identity)
    elif provider == "MICROSOFT":
        return MicrosoftSender(sender_identity)
    else: # YAHOO or CUSTOM_SMTP
        return SMTPEmailSender(sender_identity)
