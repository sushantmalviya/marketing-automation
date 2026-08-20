from apps.communications.services.email import send_email
from apps.automation.services.renderer import TemplateRenderer

class SendEmailAction:

    def execute(
        self,
        execution,
        node,
        config,
    ):
        context = execution.context
        
        recipient = config.get("toAddress") or config.get("recipient") or context.get("contact", {}).get("email")
        recipients = config.get("recipients") or ([recipient] if recipient else [])

        subject = config.get("customSubject") or config.get("subject") or ""
        message = config.get("customBody") or config.get("message") or ""

        # Render placeholders
        context = execution.context
        
        rendered_recipients = [
            TemplateRenderer.render(r, context) for r in recipients
        ]
        rendered_subject = TemplateRenderer.render(subject, context)
        rendered_message = TemplateRenderer.render(message, context)

        send_email(
            subject=rendered_subject,
            message=rendered_message,
            recipients=[r for r in rendered_recipients if r],
            sender=config.get("sender"),
            execution=execution,
        )

        return {
            "success": True,
            "message": "Email sent."
        }


class SendBulkEmailAction(SendEmailAction):
    pass
