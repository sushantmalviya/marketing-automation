from django.db.models import Avg, DurationField, ExpressionWrapper, F, Q

from apps.automation.models import AutomationExecution
from apps.communications.models import CommunicationEvent
from apps.accounts.models import MAUser


def visible_events(user, date_from=None, date_to=None):
    role = MAUser.objects.filter(user=user).values_list("role", flat=True).first()
    events = CommunicationEvent.objects.all()
    if user.is_superuser or role == "ADMIN":
        pass
    elif role == "USER" and user.department_id:
        events = events.filter(
            Q(campaign__created_by__department_id=user.department_id)
            | Q(execution__automation__owner__department_id=user.department_id)
        ).distinct()
    else:
        events = events.filter(
            Q(campaign__created_by=user)
            | Q(execution__automation__owner=user)
        ).distinct()

    if date_from:
        events = events.filter(created_at__date__gte=date_from)
    if date_to:
        events = events.filter(created_at__date__lte=date_to)
    return events


def visible_executions(user, date_from=None, date_to=None):
    role = MAUser.objects.filter(user=user).values_list("role", flat=True).first()
    executions = AutomationExecution.objects.all()
    if user.is_superuser or role == "ADMIN":
        pass
    elif role == "USER" and user.department_id:
        executions = executions.filter(automation__owner__department_id=user.department_id)
    else:
        executions = executions.filter(automation__owner=user)

    if date_from:
        executions = executions.filter(started_at__date__gte=date_from)
    if date_to:
        executions = executions.filter(started_at__date__lte=date_to)
    return executions


def rate(numerator, denominator):
    if denominator == 0:
        return 0

    return round((numerator / denominator) * 100, 2)


def communication_metrics(user, date_from=None, date_to=None):
    events = visible_events(user, date_from=date_from, date_to=date_to)

    email_sent = events.filter(
        channel="EMAIL",
        event_name="EMAIL_SENT",
    ).count()
    sms_sent = events.filter(
        channel="SMS",
        event_name="SMS_SENT",
    ).count()
    whatsapp_sent = events.filter(
        channel="WHATSAPP",
        event_name="WHATSAPP_SENT",
    ).count()

    return {
        "email": {
            "sent": email_sent,
            "open_rate": rate(
                events.filter(event_name="EMAIL_OPENED").count(),
                email_sent,
            ),
            "click_rate": rate(
                events.filter(event_name="EMAIL_CLICKED").count(),
                email_sent,
            ),
            "bounce_rate": rate(
                events.filter(event_name="EMAIL_BOUNCED").count(),
                email_sent,
            ),
            "unsubscribe_rate": rate(
                events.filter(event_name="EMAIL_UNSUBSCRIBED").count(),
                email_sent,
            ),
        },
        "sms": {
            "sent": sms_sent,
            "delivery_rate": rate(
                events.filter(event_name="SMS_DELIVERED").count(),
                sms_sent,
            ),
        },
        "whatsapp": {
            "sent": whatsapp_sent,
            "read_rate": rate(
                events.filter(event_name="WHATSAPP_READ").count(),
                whatsapp_sent,
            ),
            "reply_rate": rate(
                events.filter(event_name="WHATSAPP_REPLIED").count(),
                whatsapp_sent,
            ),
        },
    }


def workflow_metrics(user, date_from=None, date_to=None):
    executions = visible_executions(user, date_from=date_from, date_to=date_to)
    total = executions.count()
    success = executions.filter(
        status=AutomationExecution.Status.SUCCESS
    ).count()
    failed = executions.filter(
        status=AutomationExecution.Status.FAILED
    ).count()
    duration = ExpressionWrapper(
        F("finished_at") - F("started_at"),
        output_field=DurationField(),
    )
    average = (
        executions.filter(
            finished_at__isnull=False
        )
        .annotate(duration=duration)
        .aggregate(value=Avg("duration"))
        .get("value")
    )

    return {
        "execution_count": total,
        "success_rate": rate(success, total),
        "failure_rate": rate(failed, total),
        "average_duration": (
            average.total_seconds()
            if average
            else 0
        ),
    }


def all_metrics(user, date_from=None, date_to=None):
    data = communication_metrics(user, date_from=date_from, date_to=date_to)
    data["workflow"] = workflow_metrics(user, date_from=date_from, date_to=date_to)
    return data

