from celery import shared_task
from django.utils import timezone

from apps.automation.models import (
    AutomationExecution,
)

from apps.automation.services.executor import (
    WorkflowExecutor,
)


@shared_task
def resume_workflows():

    waiting = (
        AutomationExecution
        .objects
        .select_related(
            "automation",
        )
        .filter(
            status="WAITING",
            resume_at__lte=
                timezone.now(),
        )
    )

    for execution in waiting:

        executor = WorkflowExecutor(
            execution
        )

        if executor.current and executor.current.get("type") == "CONDITION":
            next_node = executor.current
        else:
            next_node = executor.get_next(
                executor.current
            )

        if not next_node:
            execution.status = "SUCCESS"
            execution.finished_at = timezone.now()
            execution.save(
                update_fields=[
                    "status",
                    "finished_at",
                ]
            )
            continue

        execution.status = "RUNNING"
        execution.current_node_id = next_node.get("id") if next_node else None
        execution.paused_at = None
        execution.resume_at = None
        execution.save(
            update_fields=[
                "status",
                "current_node_id",
                "paused_at",
                "resume_at",
            ]
        )

        executor = WorkflowExecutor(
            execution,
            start_node=next_node,
        )

        completed = executor.run()

        if completed:
            execution.status = "SUCCESS"
            execution.finished_at = timezone.now()
            execution.save(
                update_fields=[
                    "status",
                    "finished_at",
                ]
            )
