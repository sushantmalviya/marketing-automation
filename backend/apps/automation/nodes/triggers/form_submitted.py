from apps.forms.models import (
    FormSubmission
)


class FormSubmittedTrigger:

    def execute(
        self,
        execution,
        node,
        config,
    ):

        form_id = config.get(
            "form_id"
        )

        submission_id = execution.context.get("submission_id")
        
        if submission_id:
            submission = FormSubmission.objects.filter(id=submission_id).first()
        else:
            submission = FormSubmission.objects.filter(form_id=form_id).order_by("-submitted_at").first()

        return {
            "success": True,
            "submission": submission,
        }