from apps.communications.services.sms import send_sms
from apps.automation.services.renderer import TemplateRenderer


class SendSMSAction:
    def execute(self, execution, node, config):
        context = execution.context
        
        to = config.get("toAddress") or config.get("to") or context.get("contact", {}).get("phone_no")
        message = config.get("customBody") or config.get("message", "")
        
        rendered_to = TemplateRenderer.render(to, context) if to else ""
        rendered_message = TemplateRenderer.render(message, context)

        send_sms(
            to=rendered_to,
            message=rendered_message,
            config=config,
            execution=execution,
        )

        return {
            "success": True,
            "message": "SMS sent.",
        }

