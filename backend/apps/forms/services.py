from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    Form,
    FormField,
    FormStatus,
    FormSubmission,
    SubmissionAnswer,
)


class FormService:

    @staticmethod
    def evaluate_form_conditions(conditions, answers_dict):
        if not conditions:
            return True
            
        root_operator = conditions.get("root_operator", "AND")
        groups = conditions.get("groups", [])
        
        if not groups:
            return True
            
        group_results = []
        
        for group in groups:
            group_operator = group.get("operator", "AND")
            rules = group.get("rules", [])
            
            if not rules:
                continue
                
            rule_results = []
            for rule in rules:
                field_id = str(rule.get("field_id"))
                operator = rule.get("operator")
                target_value = str(rule.get("value", "")).lower()
                
                actual_value = str(answers_dict.get(field_id, "")).lower()
                
                if operator == "equals":
                    res = actual_value == target_value
                elif operator == "not_equals":
                    res = actual_value != target_value
                elif operator == "contains":
                    res = target_value in actual_value
                elif operator == "not_contains":
                    res = target_value not in actual_value
                elif operator == "is_empty":
                    res = actual_value == ""
                elif operator == "is_not_empty":
                    res = actual_value != ""
                elif operator == "gt":
                    try:
                        res = float(actual_value) > float(target_value)
                    except ValueError:
                        res = False
                elif operator == "lt":
                    try:
                        res = float(actual_value) < float(target_value)
                    except ValueError:
                        res = False
                else:
                    res = False
                    
                rule_results.append(res)
                
            if not rule_results:
                group_results.append(True)
            elif group_operator == "AND":
                group_results.append(all(rule_results))
            else: # OR
                group_results.append(any(rule_results))
                
        if not group_results:
            return True
            
        if root_operator == "AND":
            return all(group_results)
        else: # OR
            return any(group_results)

    @staticmethod
    @transaction.atomic
    def create_form(*, user, data):

        fields = data.pop("fields", [])

        form = Form.objects.create(
            created_by=user,
            **data,
        )

        FormField.objects.bulk_create(
            [
                FormField(
                    form=form,
                    **field,
                )
                for field in fields
            ]
        )

        return form

    @staticmethod
    @transaction.atomic
    def update_form(*, form, data):

        fields = data.pop(
            "fields",
            None,
        )

        for key, value in data.items():
            setattr(form, key, value)

        form.save()

        if fields is not None:

            form.fields.all().delete()

            FormField.objects.bulk_create(
                [
                    FormField(
                        form=form,
                        **field,
                    )
                    for field in fields
                ]
            )

        return form

    @staticmethod
    def publish_form(form):

        if not form.fields.exists():
            raise ValidationError(
                "Cannot publish an empty form."
            )

        if form.status == FormStatus.PUBLISHED:
            raise ValidationError(
                "Form is already published."
            )

        form.status = FormStatus.PUBLISHED
        form.published_at = timezone.now()

        form.save(
            update_fields=[
                "status",
                "published_at",
            ]
        )

        return form

    @staticmethod
    def archive_form(form):

        if form.status == FormStatus.ARCHIVED:
            return form

        form.status = FormStatus.ARCHIVED

        form.save(
            update_fields=[
                "status",
            ]
        )

        return form

    @staticmethod
    @transaction.atomic
    def submit_form(
        *,
        form,
        answers,
        ip_address=None,
        user_agent="",
    ):

        # submission limit
        if (
            form.submission_limit
            and form.submissions.count()
            >= form.submission_limit
        ):
            raise ValidationError(
                "Submission limit reached."
            )

        # schedule validation
        now = timezone.now()

        if (
            form.start_date
            and now < form.start_date
        ):
            raise ValidationError(
                "Form is not active yet."
            )

        if (
            form.end_date
            and now > form.end_date
        ):
            raise ValidationError(
                "Form has expired."
            )

        # validate field ownership
        valid_field_ids = set(
            form.fields.values_list(
                "id",
                flat=True,
            )
        )

        submission = FormSubmission.objects.create(
            form=form,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        submission_answers = []
        answers_dict = {}

        for item in answers:

            field_id = item["field_id"]
            answers_dict[str(field_id)] = item.get("answer", "")

            if field_id not in valid_field_ids:
                raise ValidationError(
                    f"Invalid field id: {field_id}"
                )

            submission_answers.append(
                SubmissionAnswer(
                    submission=submission,
                    field_id=field_id,
                    answer=item["answer"],
                )
            )

        SubmissionAnswer.objects.bulk_create(
            submission_answers
        )
        
        # Create a CustomerRecord for this submission
        fields_map = {str(f.id): f for f in form.fields.all()}
        customer_data = {"_source": "form"}
        contact_name = ""
        contact_email = ""
        contact_phone = ""
        
        for field_id, answer in answers_dict.items():
            field = fields_map.get(field_id)
            if not field: continue
            
            label_lower = field.label.lower()
            if field.field_type == "email" or "email" in label_lower:
                contact_email = answer
                customer_data["Email"] = answer
            elif field.field_type == "phone" or "phone" in label_lower:
                contact_phone = answer
                customer_data["Phone"] = answer
            elif field.field_type == "text" and "name" in label_lower:
                contact_name = answer
                customer_data["Name"] = answer
            else:
                customer_data[field.label] = answer
                
        if not customer_data.get("Name"):
            customer_data["Name"] = contact_name or "Form User"
        if not customer_data.get("Email"):
            customer_data["Email"] = contact_email
            
        if contact_email or contact_phone:
            try:
                from apps.campaigns.models import CustomerUpload, CustomerRecord, Audience
                
                upload, _ = CustomerUpload.objects.get_or_create(
                    uploaded_by=form.created_by,
                    file_name="Form Submissions",
                    defaults={"file_type": "forms", "status": "COMPLETED"},
                )
                
                customer = CustomerRecord.objects.create(
                    upload=upload,
                    data=customer_data
                )
                
                upload.total_records = upload.records.count()
                upload.imported_records = upload.total_records
                upload.save(update_fields=["total_records", "imported_records"])
                
            except Exception:
                pass # Fail silently if customer record creation fails

        try:
            from apps.automation.models import AutomationNode
            from apps.automation.services.dispatcher import dispatch_workflow

            matching_trigger_nodes = AutomationNode.objects.filter(
                node_type="TRIGGER",
                action_name="FORM_SUBMITTED",
                business_config__form_id=str(form.id),
                automation__status="PUBLISHED",
                automation__is_active=True,
            ).select_related("automation").distinct()

            context = {
                "form": {
                    "id": str(form.id),
                    "submission_id": str(submission.id),
                }
            }

            for trigger_node in matching_trigger_nodes:
                conditions = trigger_node.business_config.get("conditions")
                reentry_rule = trigger_node.business_config.get("reentry_rule", "every_time")
                reentry_days = int(trigger_node.business_config.get("reentry_days", 30))
                reentry_identifier_type = trigger_node.business_config.get("reentry_identifier_type", "email")
                
                # Evaluate the conditions against the user's submitted answers
                if FormService.evaluate_form_conditions(conditions, answers_dict):
                    allow_dispatch = True
                    
                    if reentry_rule != "every_time":
                        identifier_field = form.fields.filter(field_type=reentry_identifier_type).first()
                        
                        if identifier_field:
                            identifier_value = answers_dict.get(str(identifier_field.id), "")
                            
                            if identifier_value:
                                from apps.automation.models import AutomationExecution
                                from datetime import timedelta
                                
                                previous_submissions = FormSubmission.objects.filter(
                                    form=form,
                                    answers__field=identifier_field,
                                    answers__answer__iexact=identifier_value
                                ).exclude(id=submission.id)
                                
                                past_executions_query = AutomationExecution.objects.filter(
                                    automation=trigger_node.automation,
                                    context__form__submission_id__in=[str(s.id) for s in previous_submissions]
                                )
                                
                                if reentry_rule == "only_once":
                                    if past_executions_query.exists():
                                        allow_dispatch = False
                                        
                                elif reentry_rule == "custom_days":
                                    cutoff_date = timezone.now() - timedelta(days=reentry_days)
                                    if past_executions_query.filter(started_at__gte=cutoff_date).exists():
                                        allow_dispatch = False
                                        
                    if allow_dispatch:
                        dispatch_workflow(
                            trigger_node.automation,
                            None,
                            context=context,
                        )
        except Exception:
            pass # Failing to dispatch automation should not fail the form submission

        return submission