import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class AWSSESService:
    """
    AWS SES v2 Service for Multi-Tenant Domain Verification, DKIM Setup, and Bulk Email Dispatching.
    """

    def __init__(self):
        self.aws_access_key = (
            getattr(settings, "AWS_ACCESS_KEY_ID", "")
            or getattr(settings, "AWS_ACCESS_KEY", "")
        ).strip()
        self.aws_secret_key = (
            getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
            or getattr(settings, "AWS_SECRET_KEY", "")
        ).strip()
        self.region_name = (
            getattr(settings, "AWS_SES_REGION", "")
            or getattr(settings, "AWS_REGION", "us-east-1")
        ).strip()
        self.config_set_name = getattr(
            settings, "AWS_SES_CONFIG_SET", "saas-tracking-configset"
        )

    def _get_client(self):
        if not self.aws_access_key or not self.aws_secret_key:
            return None
        try:
            import boto3

            return boto3.client(
                "sesv2",
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.region_name,
            )
        except Exception as exc:
            logger.error(f"Failed to initialize boto3 SES client: {exc}")
            return None

    def create_domain_identity(self, domain: str):
        """
        Creates an Email Identity (Domain) in AWS SES v2 and returns Easy DKIM tokens (3 CNAME records).
        Also configures Custom MAIL FROM domain (bounces.<domain>).
        """
        domain = domain.strip().lower()
        client = self._get_client()

        # Development Fallback if AWS credentials are not configured yet
        if not client:
            logger.info(
                f"[AWS SES MOCK] Registering domain identity for '{domain}' in dev mode."
            )
            return {
                "success": True,
                "status": "PENDING",
                "dkim_status": "PENDING",
                "dkim_records": [
                    {
                        "name": f"token1._domainkey.{domain}",
                        "value": f"token1.dkim.amazonses.com",
                        "type": "CNAME",
                    },
                    {
                        "name": f"token2._domainkey.{domain}",
                        "value": f"token2.dkim.amazonses.com",
                        "type": "CNAME",
                    },
                    {
                        "name": f"token3._domainkey.{domain}",
                        "value": f"token3.dkim.amazonses.com",
                        "type": "CNAME",
                    },
                ],
                "mail_from_domain": f"bounces.{domain}",
                "mail_from_cname": {
                    "name": f"bounces.{domain}",
                    "value": f"feedback-smtp.{self.region_name}.amazonses.com",
                    "type": "MX / CNAME",
                },
                "is_mock": True,
            }

        try:
            # 1. Create Email Identity (Domain)
            res = client.create_email_identity(
                EmailIdentity=domain,
                DkimSigningAttributes={"NextSigningKeyLength": "RSA_2048_BIT"},
            )
            dkim_attrs = res.get("DkimAttributes", {})
            tokens = dkim_attrs.get("Tokens", [])

            dkim_records = [
                {
                    "name": f"{t}._domainkey.{domain}",
                    "value": f"{t}.dkim.amazonses.com",
                    "type": "CNAME",
                }
                for t in tokens
            ]

            # 2. Configure Custom MAIL FROM Domain (e.g. bounces.domain.com)
            mail_from_subdomain = f"bounces.{domain}"
            try:
                client.put_email_identity_mail_from_attributes(
                    EmailIdentity=domain,
                    MailFromDomain=mail_from_subdomain,
                    BehaviorOnMxFailure="USE_DEFAULT_VALUE",
                )
            except Exception as m_err:
                logger.warning(
                    f"Could not set custom MAIL FROM for {domain}: {m_err}"
                )

            return {
                "success": True,
                "status": dkim_attrs.get("Status", "PENDING"),
                "dkim_status": dkim_attrs.get("Status", "PENDING"),
                "dkim_records": dkim_records,
                "mail_from_domain": mail_from_subdomain,
                "mail_from_cname": {
                    "name": mail_from_subdomain,
                    "value": f"feedback-smtp.{self.region_name}.amazonses.com",
                    "type": "MX / CNAME",
                },
                "is_mock": False,
            }

        except Exception as e:
            logger.error(
                f"AWS SES create_email_identity failed for '{domain}': {e}"
            )
            error_msg = str(e)
            if hasattr(e, "response") and "Error" in e.response:
                error_msg = e.response["Error"].get("Message", str(e))
            return {"success": False, "detail": error_msg}

    def get_domain_verification_status(self, domain: str):
        """
        Polls AWS SES v2 API to check if DKIM CNAME records have propagated and identity is SUCCESS.
        """
        domain = domain.strip().lower()
        client = self._get_client()

        if not client:
            logger.info(
                f"[AWS SES MOCK] Checking status for '{domain}' in dev mode."
            )
            # In mock dev mode, pretend SUCCESS after verification check
            return {
                "success": True,
                "status": "VERIFIED",
                "dkim_status": "SUCCESS",
                "detail": "Domain DKIM verified successfully (Mock Mode).",
                "is_mock": True,
            }

        try:
            res = client.get_email_identity(EmailIdentity=domain)
            dkim_attrs = res.get("DkimAttributes", {})
            dkim_status = dkim_attrs.get("Status", "PENDING")
            verified_for_sending = res.get("VerifiedForSendingStatus", False)

            is_verified = (
                dkim_status == "SUCCESS" or verified_for_sending is True
            )

            tokens = dkim_attrs.get("Tokens", [])
            dkim_records = [
                {
                    "name": f"{t}._domainkey.{domain}",
                    "value": f"{t}.dkim.amazonses.com",
                    "type": "CNAME",
                }
                for t in tokens
            ]

            return {
                "success": True,
                "status": "VERIFIED" if is_verified else "PENDING",
                "dkim_status": dkim_status,
                "verified_for_sending": verified_for_sending,
                "dkim_records": dkim_records,
                "detail": (
                    "Domain verified successfully."
                    if is_verified
                    else f"DKIM Status is currently '{dkim_status}'. DNS propagation may take up to 24-48 hours."
                ),
                "is_mock": False,
            }

        except Exception as e:
            logger.error(
                f"AWS SES get_email_identity failed for '{domain}': {e}"
            )
            error_msg = str(e)
            if hasattr(e, "response") and "Error" in e.response:
                error_msg = e.response["Error"].get("Message", str(e))
            return {"success": False, "detail": error_msg}

    def delete_domain_identity(self, domain: str):
        """
        Removes an Email Identity from AWS SES v2.
        """
        domain = domain.strip().lower()
        client = self._get_client()
        if not client:
            return True

        try:
            client.delete_email_identity(EmailIdentity=domain)
            return True
        except Exception as e:
            logger.warning(
                f"AWS SES delete_email_identity failed for '{domain}': {e}"
            )
            return False

    def send_email(
        self,
        from_address: str,
        to_address: str,
        subject: str,
        html_body: str,
        tenant_id: str = "",
        campaign_id: str = "",
        execution_id: str = "",
        reply_to: str = "",
    ):
        """
        Sends an email using AWS SES v2 send_email API with campaign/tenant tagging.
        """
        client = self._get_client()

        if not client:
            logger.info(
                f"[AWS SES MOCK] Sending email from {from_address} to {to_address}"
            )
            return {
                "success": True,
                "message_id": f"mock-ses-msg-{to_address}",
                "is_mock": True,
            }

        tags = []
        if tenant_id:
            tags.append({"Name": "tenant_id", "Value": str(tenant_id)})
        if campaign_id:
            tags.append({"Name": "campaign_id", "Value": str(campaign_id)})
        if execution_id:
            tags.append({"Name": "execution_id", "Value": str(execution_id)})

        params = {
            "FromEmailAddress": from_address,
            "Destination": {"ToAddresses": [to_address]},
            "Content": {
                "Simple": {
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {"Html": {"Data": html_body, "Charset": "UTF-8"}},
                }
            },
        }

        if tags:
            params["EmailTags"] = tags

        if reply_to:
            params["ReplyToEmailAddresses"] = [reply_to]

        # Use configuration set for SNS bounce/complaint tracking if specified
        if self.config_set_name:
            params["ConfigurationSetName"] = self.config_set_name

        try:
            resp = client.send_email(**params)
            msg_id = resp.get("MessageId", "")
            return {"success": True, "message_id": msg_id, "is_mock": False}
        except Exception as e:
            logger.error(
                f"AWS SES send_email failed from {from_address} to {to_address}: {e}"
            )
            error_msg = str(e)
            if hasattr(e, "response") and "Error" in e.response:
                error_msg = e.response["Error"].get("Message", str(e))
            raise RuntimeError(f"AWS SES delivery error: {error_msg}")
