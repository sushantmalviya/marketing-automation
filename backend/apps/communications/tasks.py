import imaplib
import email
import re
import logging
from email.utils import parseaddr
from celery import shared_task
from django.conf import settings
from apps.communications.models import CommunicationEvent
from apps.events.models import SystemEvent

logger = logging.getLogger(__name__)

def extract_uuid(text):
    """Extract UUID from string."""
    if not text:
        return None
    # Standard UUID regex
    match = re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', text, re.IGNORECASE)
    return match.group(1) if match else None

@shared_task
def poll_inbox_task():
    """
    Connects to the tracking IMAP inbox, processes unread bounces and replies,
    and logs the corresponding events.
    """
    if not getattr(settings, 'IMAP_HOST', None) or not getattr(settings, 'IMAP_USER', None) or not getattr(settings, 'IMAP_PASSWORD', None):
        logger.warning("IMAP credentials not fully configured. Skipping poll_inbox_task.")
        return

    try:
        # Connect to IMAP
        mail = imaplib.IMAP4_SSL(settings.IMAP_HOST, getattr(settings, 'IMAP_PORT', 993))
        mail.login(settings.IMAP_USER, settings.IMAP_PASSWORD)
        mail.select("INBOX")

        # Search for unread emails
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK" or not messages[0]:
            mail.logout()
            return

        message_ids = messages[0].split()
        for msg_id in message_ids:
            # Fetch email
            res, msg_data = mail.fetch(msg_id, "(RFC822)")
            if res != "OK":
                continue

            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = msg.get("Subject", "")
            in_reply_to = msg.get("In-Reply-To", "")
            from_header = msg.get("From", "")
            
            # Determine if Bounce or Reply
            is_bounce = False
            is_reply = False
            uuid = None

            # 1. Check for Reply
            if in_reply_to:
                # In-Reply-To contains the original Message-ID we injected
                uuid = extract_uuid(in_reply_to)
                if uuid:
                    is_reply = True

            # 2. Check for Bounce (NDR)
            content_type = msg.get_content_type()
            if "multipart/report" in content_type or "delivery-status" in content_type or \
               "undeliverable" in subject.lower() or "returned to sender" in subject.lower() or \
               "delivery failure" in subject.lower():
                is_bounce = True
                
                # Try to find UUID in Original-Message-ID or body text
                # We iterate through parts of the multipart message
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "message/delivery-status":
                            payload = part.get_payload(decode=True)
                            if payload:
                                uuid = extract_uuid(payload.decode('utf-8', errors='ignore'))
                        elif part.get_content_type() == "text/rfc822-headers":
                            payload = part.get_payload(decode=True)
                            if payload:
                                uuid = extract_uuid(payload.decode('utf-8', errors='ignore'))
                                
                if not uuid:
                    # Fallback to plain body regex search
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            payload = part.get_payload(decode=True)
                            if payload:
                                uuid = extract_uuid(payload.decode('utf-8', errors='ignore'))
                                if uuid:
                                    break

            if uuid:
                try:
                    event = CommunicationEvent.objects.get(id=uuid)
                    
                    if is_bounce:
                        event.status = "BOUNCED"
                        event.save(update_fields=["status"])
                        SystemEvent.objects.create(
                            event_type=SystemEvent.EventType.COMMUNICATION,
                            event_name="EMAIL_BOUNCED",
                            user_identifier=event.recipient,
                            metadata={
                                "communication_event_id": str(event.id),
                                "subject": subject,
                                "campaign_id": str(event.campaign.id) if event.campaign else None
                            }
                        )
                        
                    elif is_reply:
                        event.status = "REPLIED"
                        event.save(update_fields=["status"])
                        
                        # Try to extract plain text body for reply content
                        reply_text = ""
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                payload = part.get_payload(decode=True)
                                if payload:
                                    reply_text = payload.decode('utf-8', errors='ignore')
                                    break
                                    
                        SystemEvent.objects.create(
                            event_type=SystemEvent.EventType.COMMUNICATION,
                            event_name="EMAIL_REPLIED",
                            user_identifier=event.recipient,
                            metadata={
                                "communication_event_id": str(event.id),
                                "subject": subject,
                                "from": from_header,
                                "reply_text": reply_text[:500], # Store preview
                                "campaign_id": str(event.campaign.id) if event.campaign else None
                            }
                        )
                except CommunicationEvent.DoesNotExist:
                    pass

            # Mark as SEEN (IMAP fetch RFC822 automatically sets \Seen flag by default,
            # but we can explicitly flag it if needed).
            # mail.store(msg_id, '+FLAGS', '\\Seen')

        mail.logout()
    except Exception as e:
        logger.error(f"Error polling IMAP inbox: {e}")
