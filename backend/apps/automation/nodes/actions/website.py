class TrackEventAction:
    def execute(self, execution, node, config):
        from apps.events.models import SystemEvent

        event = SystemEvent.objects.create(
            event_type=SystemEvent.EventType.WEBSITE,
            event_name=config.get("event_name", "PAGE_VISITED"),
            user_identifier=config.get("user_identifier", ""),
            session_id=config.get("session_id", ""),
            url=config.get("url", ""),
            metadata=config.get("metadata", {}),
        )

        return {
            "success": True,
            "event_id": str(event.id),
        }


class UpdateUserPropertyAction:
    def execute(self, execution, node, config):
        context = execution.context or {}
        properties = context.setdefault("user_properties", {})
        properties.update(config.get("properties", {}))
        execution.context = context
        execution.save(
            update_fields=[
                "context",
            ]
        )

        return {
            "success": True,
            "properties": properties,
        }
