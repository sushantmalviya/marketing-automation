from apps.communications.models import CommunicationEvent, SenderIdentity
from apps.communications.providers.email import (
    default_sender,
    get_email_provider,
)
from apps.communications.providers.sender_abstraction import get_sender_provider


def send_email(subject, message, recipients, sender=None, execution=None, campaign=None, sender_identity=None):
    import re
    from django.conf import settings

    # Resolve active SenderIdentity if available
    identity = sender_identity
    if not identity and (campaign or execution):
        user = getattr(campaign, "created_by", None) or (execution.automation.owner if hasattr(execution, "automation") else None)
        if user:
            if sender:
                identity = SenderIdentity.objects.filter(user=user, email__iexact=sender, status="CONNECTED").first()
            if not identity:
                identity = SenderIdentity.objects.filter(user=user, status="CONNECTED").first()

    custom_sender_provider = get_sender_provider(identity) if identity else None

    default_prov = get_email_provider()
    organization_provider = getattr(default_prov, "organization_provider", None)
    
    sender_address = (identity.email if identity else None) or sender or default_sender(organization_provider)
    public_url = getattr(settings, "PUBLIC_URL", "http://localhost:8000")

    for recipient in recipients:
        # 1. Create the event first to get a UUID
        event = CommunicationEvent.objects.create(
            execution=execution,
            campaign=campaign,
            channel="EMAIL",
            event_name="EMAIL_SENT",
            recipient=recipient,
            status="SENT",
            metadata={"subject": subject, "sender": sender_address},
        )
        
        # 2. Inject Open Tracking Pixel
        tracking_pixel = f'<img src="{public_url}/api/events/track/open/{event.id}.png" width="1" height="1" style="display:none;" />'
        recipient_message = message
        
        if "</body>" in recipient_message.lower():
            recipient_message = re.sub(r'</body>', f"{tracking_pixel}</body>", recipient_message, flags=re.IGNORECASE)
        else:
            recipient_message += tracking_pixel
            
        # 3. Wrap Links for Click Tracking
        def link_replacer(match):
            original_url = match.group(1)
            from urllib.parse import quote
            safe_url = quote(original_url)
            return f'href="{public_url}/api/events/track/click/{event.id}?url={safe_url}"'
            
        recipient_message = re.sub(r'href=[\'"](http[^\'"]+)[\'"]', link_replacer, recipient_message)
        
        # 4. Inject Headers for Bounce & Reply Tracking
        domain = public_url.replace("https://", "").replace("http://", "").split(":")[0]
        message_id = f"<{event.id}@{domain}>"
        tracking_email = getattr(settings, "TRACKING_EMAIL", sender_address)
        headers = {
            "Message-ID": message_id,
            "Reply-To": tracking_email
        }
        
        # 5. Send using custom SenderIdentity provider if present, otherwise default system provider
        if custom_sender_provider:
            custom_sender_provider.send(
                subject,
                recipient_message,
                recipient,
                headers=headers
            )
        else:
            default_prov.send(
                subject,
                recipient_message,
                sender_address,
                [recipient],
                headers=headers
            )

    return True


