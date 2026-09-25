from datetime import timedelta
from django.utils import timezone
from django.conf import settings


class WaitNode:

    def execute(
        self,
        execution,
        node,
        config,
    ):

        amount = int(config.get("delayAmount", 1) or 1)
        unit = config.get("timeUnit", "Minutes").lower()

        kwargs = {}
        if unit == "minutes":
            kwargs["minutes"] = amount
        elif unit == "hours":
            kwargs["hours"] = amount
        elif unit == "days":
            kwargs["days"] = amount
        elif unit == "weeks":
            kwargs["weeks"] = amount

        delay = timedelta(**kwargs)

        if delay.total_seconds() <= 0:
            delay = timedelta(minutes=1)

        now = timezone.now()

        execution.status = "WAITING"
        execution.paused_at = now
        execution.resume_at = now + delay
        execution.current_node_id = node.get("id")
        execution.save(
            update_fields=[
                "status",
                "paused_at",
                "resume_at",
                "current_node_id",
            ]
        )

        is_eager = getattr(settings, "CELERY_TASK_ALWAYS_EAGER", True)
        if is_eager:
            from apps.automation.tasks_resume import schedule_execution_resume
            schedule_execution_resume(str(execution.id), delay.total_seconds())

        return {
            "success": True,
            "paused": True,
            "resume_at": execution.resume_at.isoformat(),
            "message": "Execution paused.",
        }
