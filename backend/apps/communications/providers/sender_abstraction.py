import base64
import json
import logging
import os
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


class AWSSESSender(BaseEmailSender):
    def test_connection(self):
        from apps.communications.services.aws_ses import AWSSESService
        domain = ""
        if self.sender_identity.domain_auth:
            domain = self.sender_identity.domain_auth.domain
        elif self.sender_identity.email and "@" in self.sender_identity.email:
            domain = self.sender_identity.email.split("@")[-1]

        if not domain:
            return False, "Invalid domain for AWS SES sender."

        ses_service = AWSSESService()
        res = ses_service.get_domain_verification_status(domain)
        if res.get("success"):
            return True, f"AWS SES identity for '{domain}' is active and verified."
        return False, res.get("detail", "AWS SES verification pending.")

    def send(self, subject, html_content, recipient, headers=None):
        from apps.communications.services.aws_ses import AWSSESService
        from_email = self.sender_identity.email
        display_name = self.sender_identity.display_name
        from_header = f"{display_name} <{from_email}>" if display_name else from_email

        tenant_id = str(self.sender_identity.user_id) if self.sender_identity.user_id else ""

        ses_service = AWSSESService()
        result = ses_service.send_email(
            from_address=from_header,
            to_address=recipient,
            subject=subject,
            html_body=html_content,
            tenant_id=tenant_id,
        )
        return result.get("success", False)


def get_sender_provider(sender_identity):
    if not sender_identity:
        return None
    provider = sender_identity.provider.upper()
    if provider == "AWS_SES":
        return AWSSESSender(sender_identity)
    else:  # CUSTOM_SMTP or fallback
        return SMTPEmailSender(sender_identity)

