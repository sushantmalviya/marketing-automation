import logging
from apps.communications.services.email import send_email
from apps.communications.services.sms import send_sms
from apps.communications.services.whatsapp import send_whatsapp

logger = logging.getLogger(__name__)

class Dispatcher:
    """
    Routes a delivery to the correct communication service.
    """

    @classmethod
    def send(cls, *, delivery):
        channel_code = delivery.channel.code.upper()

        recipient = None

        try:
            if channel_code == "EMAIL":
                recipient = delivery.customer.data.get("email")
                if not recipient:
                    raise ValueError("Customer email not found.")
                
                send_email(
                    subject=delivery.campaign.name,
                    message=delivery.rendered_message,
                    recipients=[recipient],
                    campaign=delivery.campaign,
                )
            
            elif channel_code == "SMS":
                recipient = delivery.customer.data.get("phone")
                if not recipient:
                    raise ValueError("Customer phone not found.")
                
                send_sms(
                    to=recipient,
                    message=delivery.rendered_message,
                    campaign=delivery.campaign,
                )
            
            elif channel_code == "WHATSAPP":
                recipient = delivery.customer.data.get("phone")
                if not recipient:
                    raise ValueError("Customer phone not found.")
                
                result = send_whatsapp(
                    to=recipient,
                    message=delivery.rendered_message,
                    campaign=delivery.campaign,
                    organization=getattr(delivery.campaign, "created_by", None),
                )
                if isinstance(result, str):
                    provider_msg_id = result
                else:
                    provider_msg_id = ""
                
                return {
                    "success": True,
                    "provider_message_id": provider_msg_id,
                }
            
            else:
                raise ValueError(f"No dispatcher configured for channel {channel_code}")

            return {
                "success": True,
                "provider_message_id": "",
            }


        except Exception as exc:
            logger.exception(
                "Failed to send %s | Campaign=%s Customer=%s",
                channel_code,
                delivery.campaign.id,
                delivery.customer.id,
            )
            return {
                "success": False,
                "error": str(exc),
            }