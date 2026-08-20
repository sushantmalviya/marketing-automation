from apps.communications.services.whatsapp import send_whatsapp
from apps.automation.services.renderer import TemplateRenderer


class SendWhatsAppAction:
    def execute(self, execution, node, config):
        context = execution.context
        
        to = config.get("toAddress") or config.get("to") or context.get("contact", {}).get("phone_no")
        message = config.get("customBody") or config.get("message", "")
        
        rendered_to = TemplateRenderer.render(to, context) if to else ""
        rendered_message = TemplateRenderer.render(message, context)

        send_whatsapp(
            to=rendered_to,
            message=rendered_message,
            config=config,
            execution=execution,
        )

        return {
            "success": True,
            "message": "WhatsApp message sent.",
        }

