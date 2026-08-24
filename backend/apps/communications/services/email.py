from apps.communications.models import CommunicationEvent
from apps.communications.providers.email import (
    default_sender,
    get_email_provider,
)


def send_email(subject, message, recipients, sender=None, execution=None, campaign=None):
    import re
    from django.conf import settings

    provider = get_email_provider()
    organization_provider = getattr(
        provider,
        "organization_provider",
        None,
    )
    sender = sender or default_sender(organization_provider)
    
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
            metadata={"subject": subject},
        )
        
        # 2. Inject Open Tracking Pixel
        # Note: config/urls.py mounts events at /api/events/
        tracking_pixel = f'<img src="{public_url}/api/events/track/open/{event.id}.png" width="1" height="1" style="display:none;" />'
        recipient_message = message
        
        if "</body>" in recipient_message.lower():
            recipient_message = re.sub(r'</body>', f"{tracking_pixel}</body>", recipient_message, flags=re.IGNORECASE)
        else:
            recipient_message += tracking_pixel
            
        # 3. Wrap Links for Click Tracking
        def link_replacer(match):
            original_url = match.group(1)
            # Encode URL properly (could use urllib, but simple replace for now is okay, or just pass via query param)
            from urllib.parse import quote
            safe_url = quote(original_url)
            return f'href="{public_url}/api/events/track/click/{event.id}?url={safe_url}"'
            
        recipient_message = re.sub(r'href=[\'"](http[^\'"]+)[\'"]', link_replacer, recipient_message)
        
        # 4. Inject Headers for Bounce & Reply Tracking
        domain = public_url.replace("https://", "").replace("http://", "").split(":")[0]
        # Clean domain (e.g., marketing-automation-backend.onrender.com)
        message_id = f"<{event.id}@{domain}>"
        tracking_email = getattr(settings, "TRACKING_EMAIL", sender)
        headers = {
            "Message-ID": message_id,
            "Reply-To": tracking_email
        }
        
        # 5. Send individually
        provider.send(
            subject,
            recipient_message,
            sender,
            [recipient],
            headers=headers
        )

    return True

