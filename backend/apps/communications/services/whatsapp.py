from apps.communications.models import CommunicationEvent, SenderIdentity
from apps.communications.providers.whatsapp import MetaWhatsAppProvider
from apps.integrations.utils.crypto import decrypt_token
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def get_whatsapp_identity(user=None, identity_id=None):
    """
    Find active SenderIdentity for WHATSAPP_CLOUD with multi-tenant scoping.
    """
    if identity_id:
        qs = SenderIdentity.objects.filter(id=identity_id, provider="WHATSAPP_CLOUD", status="CONNECTED")
        if user:
            qs = qs.filter(user=user)
        identity = qs.first()
        if identity:
            return identity

    if user:
        identity = SenderIdentity.objects.filter(
            user=user,
            provider="WHATSAPP_CLOUD",
            status="CONNECTED"
        ).order_by("-updated_at").first()
        if identity:
            return identity

    # Global fallback if no user specified (for legacy callers)
    identity = SenderIdentity.objects.filter(
        provider="WHATSAPP_CLOUD",
        status="CONNECTED"
    ).order_by("-updated_at").first()

    return identity


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


def get_whatsapp_provider(user=None, identity_id=None):
    identity = get_whatsapp_identity(user=user, identity_id=identity_id)
    if not identity:
        raise ValueError("No active WhatsApp provider configured for this user/tenant")
    
    creds = get_whatsapp_credentials(identity)
    return MetaWhatsAppProvider(
        access_token=creds["access_token"],
        phone_number_id=creds["phone_number_id"],
    )


def send_whatsapp(to, message, config=None, execution=None, campaign=None, user=None, identity_id=None):
    config = config or {}
    provider = get_whatsapp_provider(user=user, identity_id=identity_id)
    response = provider.send(
        to,
        message,
        metadata=config.get("metadata", {}),
    )

    CommunicationEvent.objects.create(
        execution=execution,
        campaign=campaign,
        channel="WHATSAPP",
        event_name="WHATSAPP_SENT",
        recipient=to,
        status="SENT",
        provider_message_id=str(getattr(response, "id", "")),
        metadata=config.get("metadata", {}),
    )

    return True


def submit_whatsapp_template(template, user=None, identity_id=None):
    import requests

    identity = get_whatsapp_identity(user=user, identity_id=identity_id)
    if not identity:
        raise ValueError("No active WhatsApp provider configured")

    creds = get_whatsapp_credentials(identity)
    waba_id = creds.get("waba_id")
    access_token = creds.get("access_token")

    if not waba_id:
        raise ValueError("No active WhatsApp provider with a Business Account ID (WABA ID) configured")

    api_version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0")
    url = f"https://graph.facebook.com/{api_version}/{waba_id}/message_templates"
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
