from django.conf import settings
from django.core.mail import EmailMessage, get_connection


class BaseEmailProvider:
    def send(self, subject, message, sender, recipients, headers=None):
        raise NotImplementedError

    def validate_configuration(self):
        return True

    def health_check(self):
        return True

    def test_connection(self):
        return True


class SMTPEmailProvider(BaseEmailProvider):
    def __init__(self, organization_provider=None):
        self.organization_provider = organization_provider

    def send(self, subject, message, sender, recipients, headers=None):
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=sender,
            to=recipients,
            connection=get_connection(),
            headers=headers or {}
        )
        email.content_subtype = "html" # Ensure email is sent as HTML
        return email.send(fail_silently=False)


class SESEmailProvider(BaseEmailProvider):
    def __init__(self, organization_provider):
        self.organization_provider = organization_provider

    def send(self, subject, message, sender, recipients, headers=None):
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError(
                "boto3 is required for AWS SES email delivery."
            ) from exc

        client = boto3.client(
            "ses",
            aws_access_key_id=self.organization_provider.aws_access_key,
            aws_secret_access_key=self.organization_provider.aws_secret_key,
            region_name=self.organization_provider.aws_region,
        )

        message_dict = {
            "Subject": {
                "Data": subject,
            },
            "Body": {
                "Html": {
                    "Data": message,
                }
            },
        }

        # Boto3 doesn't support generic custom headers via the simple send_email API easily without send_raw_email.
        # But for the purpose of the tracking engine demo, we'll assume SMTP is primarily used for the native engine.
        # If we need headers in SES, we would typically use send_raw_email. We will just pass here for now.
        return client.send_email(
            Source=sender,
            Destination={
                "ToAddresses": recipients,
            },
            Message=message_dict,
        )


def get_email_provider():
    return SMTPEmailProvider(None)


def default_sender(organization_provider=None):
    if organization_provider and organization_provider.verified_domain:
        return f"no-reply@{organization_provider.verified_domain}"

    return settings.DEFAULT_FROM_EMAIL

