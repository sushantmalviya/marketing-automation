from apps.communications.models import CommunicationEvent
from apps.communications.providers.whatsapp import MetaWhatsAppProvider


def get_whatsapp_provider():
    from apps.communications.models import OrganizationWhatsAppProvider

    organization_provider = (
        OrganizationWhatsAppProvider.objects.filter(
            is_active=True,
        )
        .order_by("-created_at")
        .first()
    )

    if not organization_provider:
        raise ValueError(f"No active WhatsApp provider configured")

    return MetaWhatsAppProvider(
        access_token=organization_provider.access_token,
        phone_number_id=organization_provider.phone_number_id,
    )


def send_whatsapp(to, message, config=None, execution=None, campaign=None):
    config = config or {}
    provider = get_whatsapp_provider()
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


def submit_whatsapp_template(template):
    import requests
    from apps.communications.models import OrganizationWhatsAppProvider

    organization_provider = (
        OrganizationWhatsAppProvider.objects.filter(is_active=True)
        .order_by("-created_at")
        .first()
    )

    if not organization_provider or not organization_provider.business_account_id:
        raise ValueError("No active WhatsApp provider with a Business Account ID configured")

    waba_id = organization_provider.business_account_id
    access_token = organization_provider.access_token

    url = f"https://graph.facebook.com/v19.0/{waba_id}/message_templates"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # Meta requires a specific component format. For text-only, we create one BODY component.
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

    response = requests.post(url, json=payload, headers=headers)
    
    if not response.ok:
        raise RuntimeError(f"Failed to submit WhatsApp Template to Meta: {response.text}")

    data = response.json()
    template.provider_data["meta_template_id"] = data.get("id")
    template.provider_data["meta_status"] = data.get("status", "PENDING")
    template.save()

    return template
