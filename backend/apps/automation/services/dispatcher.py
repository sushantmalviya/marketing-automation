import threading
import logging
from django.conf import settings
from django.db import close_old_connections, transaction

from apps.automation.models import (
    AutomationExecution
)

from apps.automation.tasks import (
    execute_workflow
)

logger = logging.getLogger(__name__)


def dispatch_workflow(
    automation,
    user,
    context=None,
):

    execution = (
        AutomationExecution.objects.create(
            automation=automation,
            triggered_by=user,
            context=context or {},
        )
    )

    is_eager = getattr(settings, "CELERY_TASK_ALWAYS_EAGER", True)

    def _trigger():
        if is_eager:
            def _bg_execute(exec_id):
                close_old_connections()
                try:
                    execute_workflow(exec_id)
                except Exception as e:
                    logger.error(f"Error executing workflow in background: {e}", exc_info=True)
                finally:
                    close_old_connections()

            thread = threading.Thread(target=_bg_execute, args=(str(execution.id),), daemon=True)
            thread.start()
        else:
            execute_workflow.delay(
                str(execution.id)
            )

    transaction.on_commit(_trigger)

    return execution

