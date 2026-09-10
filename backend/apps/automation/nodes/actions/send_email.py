from apps.communications.services.email import send_email
from apps.automation.services.renderer import TemplateRenderer


class SendEmailAction:

    def execute(
        self,
        execution,
        node,
        config,
    ):
        context = execution.context or {}
        
        recipient = (
            config.get("toAddress")
            or config.get("recipient")
            or (context.get("contact", {}).get("email") if isinstance(context.get("contact"), dict) else None)
            or context.get("email")
        )
        recipients = config.get("recipients") or ([recipient] if recipient else [])

        subject = config.get("customSubject") or config.get("subject") or ""
        message = config.get("customBody") or config.get("message") or ""

        # Fetch template if templateId is specified
        template_id = config.get("templateId") or config.get("template_id")
        if template_id:
            try:
                from apps.campaigns.models import Template
                tpl = Template.objects.filter(id=template_id).first()
                if tpl:
                    if not subject:
                        subject = tpl.subject or tpl.name or ""
                    if not message:
                        message = tpl.body or ""
            except Exception:
                pass

        if not subject:
            subject = "Notification from Marketing Automation"
        if not message:
            message = "Hello! You have received a notification from our automated workflow."

        # Render placeholders
        rendered_recipients = [
            TemplateRenderer.render(str(r), context) for r in recipients if r
        ]
        rendered_subject = TemplateRenderer.render(subject, context)
        rendered_message = TemplateRenderer.render(message, context)

        final_recipients = [r for r in rendered_recipients if r and "@" in r]

        if not final_recipients:
            return {
                "success": False,
                "message": "No valid recipient email address found in execution context or node config."
            }

        send_email(
            subject=rendered_subject,
            message=rendered_message,
            recipients=final_recipients,
            sender=config.get("sender"),
            execution=execution,
        )

        return {
            "success": True,
            "message": f"Email sent to {', '.join(final_recipients)}."
        }


class SendBulkEmailAction(SendEmailAction):
    pass
