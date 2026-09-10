from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    Form,
    FormStatus,
    FormSubmission,
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

        fields = data.pop("fields_schema", [])

        form = Form.objects.create(
            created_by=user,
            fields_schema=fields,
            **data,
        )

        return form

    @staticmethod
    @transaction.atomic
    def update_form(*, form, data):

        fields = data.pop(
            "fields_schema",
            None,
        )

        for key, value in data.items():
            setattr(form, key, value)
            
        if fields is not None:
            form.fields_schema = fields

        form.save()
        return form

    @staticmethod
    def publish_form(form):

        if not form.fields_schema:
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

        submission = FormSubmission.objects.create(
            form=form,
            ip_address=ip_address,
            user_agent=user_agent,
            answers={}
        )

        answers_dict = {}

        if isinstance(answers, list):
            for item in answers:
                if isinstance(item, dict) and "field_id" in item:
                    field_id = str(item["field_id"])
                    answers_dict[field_id] = item.get("answer", "")
        elif isinstance(answers, dict):
            for k, v in answers.items():
                answers_dict[str(k)] = v

        submission.answers = answers_dict
        submission.save(update_fields=['answers'])
        
        # Create a CustomerRecord for this submission
        fields_map = {str(f.get('id', '')): f for f in form.fields_schema}
        customer_data = {"_source": "form", "__source__": "form"}
        contact_name = ""
        contact_email = ""
        contact_phone = ""
        
        for field_id, answer in answers_dict.items():
            field = fields_map.get(field_id)
            if not field: continue
            
            label_lower = field.get('label', '').lower()
            field_type = field.get('field_type', '')
            
            if field_type == "email" or "email" in label_lower:
                contact_email = answer
                customer_data["Email"] = answer
            elif field_type == "phone" or "phone" in label_lower:
                contact_phone = answer
                customer_data["Phone"] = answer
            elif field_type == "text" and "name" in label_lower:
                contact_name = answer
                customer_data["Name"] = answer
            else:
                customer_data[field.get('label', field_id)] = answer
                
        if not customer_data.get("Name"):
            customer_data["Name"] = contact_name or "Form User"
        if not customer_data.get("Email"):
            customer_data["Email"] = contact_email
            
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

        return submission