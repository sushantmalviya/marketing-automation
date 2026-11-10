from apps.accounts.models import Organization
from apps.common.ownership import get_user_organization
from apps.communications.models import CommunicationEvent, SenderIdentity
from apps.communications.providers.sms import MSG91Provider, TwilioSMSProvider
from apps.integrations.utils.crypto import decrypt_token


def get_sms_identity(organization=None, user=None):
    target = organization or user
    if target is None:
        return None

    sms_providers = ["TWILIO_SMS", "CUSTOM_SMS"]
    if isinstance(target, Organization):
        return SenderIdentity.objects.filter(
            organization=target,
            provider__in=sms_providers,
            status="CONNECTED",
        ).order_by("-updated_at").first()

    org = get_user_organization(target)
    if org is not None:
        return SenderIdentity.objects.filter(
            organization=org,
            provider__in=sms_providers,
            status="CONNECTED",
        ).order_by("-updated_at").first()

    return SenderIdentity.objects.filter(
        organization__isnull=True,
        user=target,
        provider__in=sms_providers,
        status="CONNECTED",
    ).order_by("-updated_at").first()


def get_sms_provider(organization=None, user=None):
    identity = get_sms_identity(organization=organization, user=user)
    if not identity:
        raise ValueError("No active SMS provider configured")

    creds = identity.encrypted_credentials or {}
    raw_token = creds.get("auth_token", "")
    auth_token = ""
    if raw_token:
        try:
            auth_token = decrypt_token(raw_token)
        except Exception:
            auth_token = raw_token

    if identity.provider == "TWILIO_SMS":
        return TwilioSMSProvider(
            account_sid=creds.get("account_sid", ""),
            auth_token=auth_token,
            from_number=identity.email,
        )

    return MSG91Provider(
        auth_key=auth_token,
        sender_id=identity.email,
    )


def send_sms(to, message, config=None, execution=None, campaign=None, organization=None):
    config = config or {}
    if organization is None:
        if campaign and hasattr(campaign, "created_by") and campaign.created_by:
            organization = campaign.created_by
        elif execution and hasattr(execution, "automation") and hasattr(execution.automation, "owner") and execution.automation.owner:
            organization = execution.automation.owner

    provider = get_sms_provider(organization=organization)
    response = provider.send(
        to,
        message,
        metadata=config.get("metadata", {}),
    )

    CommunicationEvent.objects.create(
        execution=execution,
        campaign=campaign,
        channel="SMS",
        event_name="SMS_SENT",
        recipient=to,
        status="SENT",
        provider_message_id=str(getattr(response, "sid", "")),
        metadata=config.get("metadata", {}),
    )

    return True

