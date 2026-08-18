from datetime import timedelta

from django.utils import timezone


class WaitNode:

    def execute(
        self,
        execution,
        node,
        config,
    ):

        minutes = int(config.get("minutes", 0) or 0)
        hours = int(config.get("hours", 0) or 0)
        days = int(config.get("days", 0) or 0)

        delay = timedelta(
            days=days,
            hours=hours,
            minutes=minutes,
        )

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

        return {
            "success": True,
            "paused": True,
            "resume_at": execution.resume_at.isoformat(),
            "message": "Execution paused.",
        }
