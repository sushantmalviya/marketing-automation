from .base import parse_datetime, resolve_value


class NotEqualsCondition:
    def execute(self, execution, node, config):
        return (
            resolve_value(config, "left", execution)
            != resolve_value(config, "right", execution)
        )


class ContainsCondition:
    def execute(self, execution, node, config):
        left = resolve_value(config, "left", execution)
        right = resolve_value(config, "right", execution)

        if left is None:
            return False

        return str(right) in str(left)


class NotContainsCondition:
    def execute(self, execution, node, config):
        return not ContainsCondition().execute(
            execution,
            node,
            config,
        )


class ExistsCondition:
    def execute(self, execution, node, config):
        return resolve_value(config, "left", execution) is not None


class EmptyCondition:
    def execute(self, execution, node, config):
        value = resolve_value(config, "left", execution)
        return value in (None, "", [], {})


class BooleanCompareCondition:
    def execute(self, execution, node, config):
        left = bool(resolve_value(config, "left", execution))
        right = bool(resolve_value(config, "right", execution))
        operator = (config.get("operator") or "EQUALS").upper()

        if operator == "NOT_EQUALS":
            return left != right

        return left == right


class DateCompareCondition:
    def execute(self, execution, node, config):
        left = parse_datetime(resolve_value(config, "left", execution))
        right = parse_datetime(resolve_value(config, "right", execution))
        operator = (config.get("operator") or "EQUALS").upper()

        if not left or not right:
            return False

        if operator == "BEFORE":
            return left < right

        if operator == "AFTER":
            return left > right

        if operator == "ON_OR_BEFORE":
            return left <= right

        if operator == "ON_OR_AFTER":
            return left >= right

        return left == right


class AndCondition:
    def execute(self, execution, node, config):
        conditions = config.get("conditions", [])
        return all(bool(item.get("value")) for item in conditions)


class OrCondition:
    def execute(self, execution, node, config):
        conditions = config.get("conditions", [])
        return any(bool(item.get("value")) for item in conditions)


class NotCondition:
    def execute(self, execution, node, config):
        return not bool(resolve_value(config, "left", execution))


from datetime import timedelta
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from apps.events.models import SystemEvent

class CommunicationEventCondition:
    def execute(self, execution, node, config):
        channel = config.get("channel", "email").upper()
        event_type = config.get("eventType", "opened").upper()
        wait_days = int(config.get("waitDays") if config.get("waitDays") is not None else 2)
        
        target_event = f"{channel}_{event_type}"
        
        context = getattr(execution, "context", {}) or {}
        contact = context.get("contact") or {}
        contact_id = str(contact.get("id") or "")
        contact_email = str(contact.get("email") or context.get("email") or "")
        
        if not contact_id and not contact_email:
            return False
            
        # Check if event happened after automation started
        from django.db.models import Q
        has_event = SystemEvent.objects.filter(
            Q(user_identifier=contact_id) | Q(user_identifier=contact_email),
            event_type="COMMUNICATION",
            event_name=target_event,
            created_at__gte=execution.started_at
        ).exists()
        
        if has_event:
            return True
            
        if wait_days <= 0:
            return False
            
        context_key = f"wait_started_{node.get('id')}"
        now = timezone.now()
        
        if context_key not in execution.context:
            # First time reaching this condition, start the wait timer
            execution.context[context_key] = now.isoformat()
            execution.save(update_fields=["context"])
            
            # Pause and resume in 1 hour to check again
            delay = timedelta(hours=1)
            
            execution.status = "WAITING"
            execution.paused_at = now
            execution.resume_at = now + delay
            execution.current_node_id = node.get("id")
            execution.save(update_fields=["status", "paused_at", "resume_at", "current_node_id"])
            
            return {
                "paused": True,
                "resume_at": execution.resume_at.isoformat(),
                "message": f"Waiting up to {wait_days} days for {target_event}..."
            }
        else:
            # We are already waiting, check if timer expired
            wait_started_at = parse_datetime(execution.context[context_key])
            if now > wait_started_at + timedelta(days=wait_days):
                return False
            else:
                # Still waiting
                delay = timedelta(hours=1)
                
                execution.status = "WAITING"
                execution.paused_at = now
                execution.resume_at = now + delay
                execution.current_node_id = node.get("id")
                execution.save(update_fields=["status", "paused_at", "resume_at", "current_node_id"])
                
                return {
                    "paused": True,
                    "resume_at": execution.resume_at.isoformat(),
                    "message": f"Still waiting for {target_event}..."
                }
