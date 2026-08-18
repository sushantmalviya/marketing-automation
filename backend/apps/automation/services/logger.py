# apps/automation/services/logger.py

from apps.automation.models import (
    AutomationExecutionLog,
)


def log_execution(
    execution,
    node,
    status,
    message="",
):
    """
    Create an execution log entry for a node.
    """

    return AutomationExecutionLog.objects.create(
        execution=execution,
        node_id=node.get("id"),
        status=status,
        message=message,
    )