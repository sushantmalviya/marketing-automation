from datetime import timedelta

from django.utils import timezone


DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 60
DEFAULT_RETRY_STRATEGY = "FIXED"


def get_retry_config(execution):
    node = None
    if execution.current_node_id and execution.automation and execution.automation.workflow_graph:
        nodes = execution.automation.workflow_graph.get("nodes", [])
        for n in nodes:
            if n.get("id") == execution.current_node_id:
                node = n
                break

    if not node:
        return {
            "retry_count": DEFAULT_RETRY_COUNT,
            "retry_delay": DEFAULT_RETRY_DELAY,
            "retry_strategy": DEFAULT_RETRY_STRATEGY,
        }

    config = node.get("business_config") or {}

    return {
        "retry_count": int(
            config.get("retry_count", DEFAULT_RETRY_COUNT) or 0
        ),
        "retry_delay": int(
            config.get("retry_delay", DEFAULT_RETRY_DELAY) or 0
        ),
        "retry_strategy": (
            config.get("retry_strategy", DEFAULT_RETRY_STRATEGY)
            or DEFAULT_RETRY_STRATEGY
        ).upper(),
    }


def calculate_retry_delay(config, attempt):
    base_delay = max(config["retry_delay"], 1)

    if config["retry_strategy"] == "EXPONENTIAL":
        return base_delay * (2 ** max(attempt - 1, 0))

    return base_delay


def mark_retry_or_failed(execution, error):
    config = get_retry_config(execution)
    next_attempt = execution.retry_count + 1

    execution.error_message = str(error)

    if next_attempt > config["retry_count"]:
        execution.status = "FAILED"
        execution.retry_after = None
        execution.finished_at = timezone.now()
        execution.save(
            update_fields=[
                "status",
                "retry_after",
                "error_message",
                "finished_at",
            ]
        )
        return None

    delay = calculate_retry_delay(config, next_attempt)

    execution.status = "RETRYING"
    execution.retry_count = next_attempt
    execution.retry_after = timezone.now() + timedelta(seconds=delay)
    execution.save(
        update_fields=[
            "status",
            "retry_count",
            "retry_after",
            "error_message",
        ]
    )

    return delay
