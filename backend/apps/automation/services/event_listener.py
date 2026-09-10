from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.forms.models import FormSubmission
from apps.campaigns.models import CustomerRecord
from apps.automation.models import Automation
from apps.automation.services.dispatcher import dispatch_workflow


@receiver(post_save, sender=FormSubmission)
def handle_form_submission(sender, instance, created, **kwargs):
    if not created:
        return

    automations = Automation.objects.filter(is_active=True, status="PUBLISHED")
    if not automations.exists():
        return

    form = instance.form
    answers_dict = instance.answers or {}
    fields_map = {str(f.get('id', '')): f for f in (form.fields_schema or [])}

    contact_name = ""
    contact_email = ""
    contact_phone = ""

    for field_id, answer in answers_dict.items():
        field = fields_map.get(str(field_id))
        if not field:
            continue
        label_lower = field.get('label', '').lower()
        field_type = field.get('field_type', '')

        if field_type == "email" or "email" in label_lower:
            contact_email = answer
        elif field_type == "phone" or "phone" in label_lower:
            contact_phone = answer
        elif field_type == "text" and "name" in label_lower:
            contact_name = answer

    if not contact_name:
        contact_name = "Form User"

    first_name = contact_name.split()[0] if contact_name else "Valued Customer"

    context = {
        "contact": {
            "id": str(instance.id),
            "name": contact_name,
            "first_name": first_name,
            "full_name": contact_name,
            "email": contact_email,
            "phone": contact_phone,
            "phone_no": contact_phone,
        },
        "form_submission": instance.answers,
        "form_id": str(instance.form_id),
        "form_title": form.title,
        "submission_id": str(instance.id),
        "email": contact_email,
        "name": contact_name,
        "first_name": first_name,
    }

    for automation in automations:
        graph = automation.workflow_graph or {}
        nodes = graph.get("nodes", [])

        for node in nodes:
            node_type = str(node.get("type") or "").upper()
            data = node.get("data", {})
            action_name = str(data.get("actionName") or node.get("action_name") or "").upper()

            if node_type in ("TRIGGER", "TRIGGERNODE") and ("FORM" in action_name or "SUBMIT" in action_name):
                config = data or node.get("business_config", {})
                form_id_cfg = str(config.get("form_id") or config.get("formId") or "")

                if not form_id_cfg or form_id_cfg == str(instance.form_id):
                    try:
                        dispatch_workflow(automation, user=None, context=context)
                    except Exception:
                        pass
                    break


@receiver(post_save, sender=CustomerRecord)
def handle_customer_record_created(sender, instance, created, **kwargs):
    if not created:
        return

    automations = Automation.objects.filter(is_active=True, status="PUBLISHED")
    if not automations.exists():
        return

    record_data = instance.data or {}

    email = record_data.get("Email") or record_data.get("email") or record_data.get("email_address") or ""
    name = record_data.get("Name") or record_data.get("name") or record_data.get("full_name") or "Form User"
    phone = record_data.get("Phone") or record_data.get("phone") or record_data.get("phone_no") or ""
    source = record_data.get("_source") or record_data.get("__source__") or ""

    first_name = name.split()[0] if name else "Valued Customer"

    context = {
        "contact": {
            "id": str(instance.id),
            "name": name,
            "first_name": first_name,
            "full_name": name,
            "email": email,
            "phone": phone,
            "phone_no": phone,
            "source": source,
        },
        "data": record_data,
        "email": email,
        "name": name,
        "first_name": first_name,
    }

    for automation in automations:
        graph = automation.workflow_graph or {}
        nodes = graph.get("nodes", [])

        for node in nodes:
            node_type = str(node.get("type") or "").upper()
            data = node.get("data", {})
            action_name = str(data.get("actionName") or node.get("action_name") or "").upper()

            if node_type in ("TRIGGER", "TRIGGERNODE") and ("CONTACT" in action_name or "ADDED" in action_name or "USER" in action_name):
                try:
                    dispatch_workflow(automation, user=None, context=context)
                except Exception:
                    pass
                break

