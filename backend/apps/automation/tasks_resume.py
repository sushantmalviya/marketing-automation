import threading
import logging
from celery import shared_task
from django.utils import timezone
from django.db import close_old_connections

from apps.automation.models import (
    AutomationExecution,
)

from apps.automation.services.executor import (
    WorkflowExecutor,
)

logger = logging.getLogger(__name__)


def resume_single_execution(execution_id, force=False):
    try:
        execution = (
            AutomationExecution.objects.select_related("automation").get(
                pk=execution_id,
                status="WAITING",
            )
        )
    except AutomationExecution.DoesNotExist:
        return False

    now = timezone.now()
    if not force and execution.resume_at and now < execution.resume_at:
        return False

    executor = WorkflowExecutor(execution)

    if executor.current and executor.current.get("type") == "CONDITION":
        next_node = executor.current
    else:
        next_node = executor.get_next(executor.current)

    if not next_node:
        execution.status = "SUCCESS"
        execution.finished_at = now
        execution.save(update_fields=["status", "finished_at"])
        return True

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
    return completed


def schedule_execution_resume(execution_id, delay_seconds):
    def _bg_resume():
        import time
        time.sleep(max(0.5, delay_seconds))
        close_old_connections()
        try:
            resume_single_execution(execution_id)
        except Exception as e:
            logger.error(f"Error resuming execution {execution_id}: {e}", exc_info=True)
        finally:
            close_old_connections()

    thread = threading.Thread(target=_bg_resume, daemon=True)
    thread.start()


@shared_task
def resume_workflows():
    waiting = (
        AutomationExecution.objects.select_related("automation").filter(
            status="WAITING",
            resume_at__lte=timezone.now(),
        )
    )

    for execution in waiting:
        try:
            resume_single_execution(execution.id)
        except Exception as e:
            logger.error(f"Error resuming workflow {execution.id}: {e}")

