import logging
from django.conf import settings
from apps.communications.models import CommunicationEvent, WhatsAppConnection, SenderIdentity
from apps.communications.providers.whatsapp import MetaWhatsAppProvider
from apps.integrations.utils.crypto import decrypt_token

logger = logging.getLogger(__name__)


def get_whatsapp_connection(organization=None, connection=None):
    """
    Resolves the WhatsAppConnection for an organization or returns the explicit connection.
    """
    if connection:
        return connection

    if organization:
        conn = WhatsAppConnection.objects.filter(
            organization=organization,
            is_active=True,
        ).order_by("-created_at").first()
        if conn:
            return conn

    # Fallback to any active connection if no organization provided
    conn = WhatsAppConnection.objects.filter(
        is_active=True,
    ).order_by("-created_at").first()

    return conn


def get_whatsapp_identity(user=None, identity_id=None):
    """
    Find active SenderIdentity for WHATSAPP_CLOUD with multi-tenant scoping.
    """
    if identity_id:
        return SenderIdentity.objects.filter(id=identity_id, provider="WHATSAPP_CLOUD").first()
    if user:
        from apps.common.ownership import get_organization_users
        org_users = get_organization_users(user)
        return SenderIdentity.objects.filter(
            user__in=org_users,
            provider="WHATSAPP_CLOUD",
            status="CONNECTED"
        ).order_by("-updated_at").first()
    return SenderIdentity.objects.filter(provider="WHATSAPP_CLOUD", status="CONNECTED").order_by("-updated_at").first()


def get_whatsapp_credentials(identity):
    """
    Safely extract decrypted access_token, phone_number_id, and waba_id from SenderIdentity.
    """
    if not identity:
        raise ValueError("No active WhatsApp provider configured")

    creds = identity.encrypted_credentials or {}
    raw_token = creds.get("access_token", "")

    # Try decrypting token; fallback to raw if not encrypted
    access_token = ""
    if raw_token:
        try:
            access_token = decrypt_token(raw_token)
        except Exception:
            access_token = raw_token

    phone_number_id = identity.phone_number_id or creds.get("phone_number_id", "")
    waba_id = identity.waba_id or creds.get("waba_id", "")

    if not access_token or not phone_number_id:
        raise ValueError("Incomplete WhatsApp Cloud API credentials")

    return {
        "access_token": access_token,
        "phone_number_id": phone_number_id,
        "waba_id": waba_id,
    }


def get_whatsapp_provider(organization=None, connection=None, user=None, identity_id=None):
    """
    Returns an initialized MetaWhatsAppProvider instance for the organization, user, or explicit connection.
    Supports both WhatsAppConnection and SenderIdentity.
    """
    org = organization or user
    whatsapp_conn = get_whatsapp_connection(organization=org, connection=connection)

    if whatsapp_conn:
        raw_token = whatsapp_conn.get_access_token()
        if not raw_token:
            raise ValueError("WhatsApp connection access token could not be decrypted or is empty.")

        return MetaWhatsAppProvider(
            access_token=raw_token,
            phone_number_id=whatsapp_conn.phone_number_id,
            api_version=getattr(settings, "META_GRAPH_API_VERSION", "v19.0"),
        )

    # Fallback to SenderIdentity if configured
    identity = get_whatsapp_identity(user=org, identity_id=identity_id)
    if identity:
        creds = get_whatsapp_credentials(identity)
        return MetaWhatsAppProvider(
            access_token=creds["access_token"],
            phone_number_id=creds["phone_number_id"],
            api_version=getattr(settings, "META_GRAPH_API_VERSION", "v19.0"),
        )

    raise ValueError("No active WhatsApp connection configured.")


def send_whatsapp(to, message, config=None, execution=None, campaign=None, organization=None, connection=None):
    """
    Sends an outbound WhatsApp message via Meta Cloud API using the organization's connection.
    """
    config = config or {}

    # Resolve organization context from campaign or execution if not explicitly provided
    if not organization:
        if campaign and hasattr(campaign, "created_by") and campaign.created_by:
            organization = campaign.created_by
        elif execution and hasattr(execution, "automation") and hasattr(execution.automation, "owner") and execution.automation.owner:
            organization = execution.automation.owner

    whatsapp_conn = get_whatsapp_connection(organization=organization, connection=connection)
    if not whatsapp_conn:
        raise ValueError(
            f"No active WhatsApp connection found for organization: {organization}"
            if organization else "No active WhatsApp connection configured."
        )

    provider = get_whatsapp_provider(connection=whatsapp_conn)
    response = provider.send(
        to=to,
        message=message,
        metadata=config.get("metadata", {}),
    )

    msg_id = str(getattr(response, "id", ""))
    event = CommunicationEvent.objects.create(
        execution=execution,
        campaign=campaign,
        whatsapp_connection=whatsapp_conn,
        channel="WHATSAPP",
        event_name="WHATSAPP_SENT",
        recipient=to,
        status="SENT",
        provider_message_id=msg_id,
        metadata=config.get("metadata", {}),
    )

    return msg_id or True


def submit_whatsapp_template(template, organization=None, connection=None, user=None, identity_id=None):
    """
    Submits a WhatsApp message template to Meta for approval.
    """
    import requests

    org = organization or user
    if not org and hasattr(template, "created_by") and template.created_by:
        org = template.created_by

    whatsapp_conn = get_whatsapp_connection(organization=org, connection=connection)
    access_token = None
    waba_id = None

    if whatsapp_conn:
        access_token = whatsapp_conn.get_access_token()
        waba_id = template.provider_data.get("waba_id") if isinstance(template.provider_data, dict) else None
        if not waba_id:
            waba_id = getattr(settings, "META_WABA_ID", None)
    else:
        identity = get_whatsapp_identity(user=org, identity_id=identity_id)
        if identity:
            creds = get_whatsapp_credentials(identity)
            access_token = creds.get("access_token")
            waba_id = creds.get("waba_id")

    if not access_token:
        raise ValueError("No access token available for WhatsApp connection.")

    if not waba_id:
        raise ValueError("WhatsApp Business Account ID (WABA ID) is required to submit templates.")

    version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")
    url = f"https://graph.facebook.com/{version}/{waba_id}/message_templates"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    components = [
        {
            "type": "BODY",
            "text": template.body,
        }
    ]

    payload = {
        "name": template.name.lower().replace(" ", "_").replace("-", "_")[:512],
        "language": "en_US",
        "category": "MARKETING",
        "components": components,
    }

    response = requests.post(url, json=payload, headers=headers, timeout=15)

    if not response.ok:
        raise RuntimeError(f"Failed to submit WhatsApp Template to Meta: {response.text}")

    data = response.json()
    if not isinstance(template.provider_data, dict):
        template.provider_data = {}

    template.provider_data["meta_template_id"] = data.get("id")
    template.provider_data["meta_status"] = data.get("status", "PENDING")
    template.save()

    return template
