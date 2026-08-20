from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.forms.models import FormSubmission
from apps.automation.models import Automation
from apps.automation.services.dispatcher import dispatch_workflow


@receiver(post_save, sender=FormSubmission)
def handle_form_submission(sender, instance, created, **kwargs):
    if not created:
        return

    automations = Automation.objects.filter(is_active=True, status="PUBLISHED")

    for automation in automations:
        workflow_graph = automation.workflow_graph or {}
        nodes = workflow_graph.get("nodes", [])

        for node in nodes:
            if node.get("type") == "TRIGGER" and node.get("action_name") == "FORM_SUBMITTED":
                config = node.get("business_config", {})
                if str(config.get("form_id")) == str(instance.form_id):
                    context = {
                        "form_submission": instance.answers,
                        "form_id": str(instance.form_id),
                        "submission_id": str(instance.id)
                    }
                    dispatch_workflow(automation, user=None, context=context)
                    break
