import logging
from django.conf import settings
from apps.communications.models import CommunicationEvent, WhatsAppConnection
from apps.communications.providers.whatsapp import MetaWhatsAppProvider

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


def get_whatsapp_provider(organization=None, connection=None):
    """
    Returns an initialized MetaWhatsAppProvider instance for the organization or connection.
    """
    whatsapp_conn = get_whatsapp_connection(organization=organization, connection=connection)

    if not whatsapp_conn:
        raise ValueError("No active WhatsApp connection configured.")

    raw_token = whatsapp_conn.get_access_token()
    if not raw_token:
        raise ValueError("WhatsApp connection access token could not be decrypted or is empty.")

    return MetaWhatsAppProvider(
        access_token=raw_token,
        phone_number_id=whatsapp_conn.phone_number_id,
        api_version=getattr(settings, "META_GRAPH_API_VERSION", "v19.0"),
    )


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



def submit_whatsapp_template(template, organization=None, connection=None):
    """
    Submits a WhatsApp message template to Meta for approval.
    """
    import requests

    if not organization and hasattr(template, "created_by") and template.created_by:
        organization = template.created_by

    whatsapp_conn = get_whatsapp_connection(organization=organization, connection=connection)
    if not whatsapp_conn:
        raise ValueError("No active WhatsApp connection configured to submit template.")

    access_token = whatsapp_conn.get_access_token()
    if not access_token:
        raise ValueError("No access token available for WhatsApp connection.")

    # WABA ID can be stored in provider_data or connection metadata if provided
    waba_id = template.provider_data.get("waba_id") or getattr(settings, "META_WABA_ID", None)
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
    template.provider_data["meta_template_id"] = data.get("id")
    template.provider_data["meta_status"] = data.get("status", "PENDING")
    template.save()

    return template

