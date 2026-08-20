from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from apps.accounts.models import User

from .models import (
    Task,
    TaskAssignment,
)


@transaction.atomic
def create_task(
    *,
    title,
    description,
    instructions,
    audience,
    channels,
    priority,
    due_date,
    created_by,
    users,
):
    """
    Create task and assign users.
    """

    # Create task
    task = Task.objects.create(
        title=title,
        description=description,
        instructions=instructions,
        audience=audience,
        priority=priority,
        due_date=due_date,
        created_by=created_by,
    )

    # Assign allowed channels
    task.channels.set(channels)

    # Fetch all users in one query
    user_objects = User.objects.filter(
        id__in=users,
    )

    # Create assignments
    TaskAssignment.objects.bulk_create(
        [
            TaskAssignment(
                task=task,
                user=user,
            )
            for user in user_objects
        ]
    )

    return task


def get_user_tasks(user):
    """
    Return tasks assigned to current user.
    """

    from apps.campaigns.models import Campaign
    return (
        TaskAssignment.objects
        .filter(user=user, task__is_active=True, task__is_deleted=False)
        .select_related(
            "task",
            "task__audience",
            "approved_by",
        )
        .prefetch_related(
            "comments",
            "attachments",
            "task__channels",
            Prefetch("task__campaigns", to_attr="prefetched_campaigns")
        )
        .order_by("-created_at")
    )


def get_admin_tasks(admin):
    """
    Return tasks created by admin.
    """

    from apps.campaigns.models import Campaign
    from apps.common.ownership import filter_tasks_for_admin
    
    queryset = filter_tasks_for_admin(Task.objects.filter(is_active=True, is_deleted=False), admin)
    
    return (
        queryset
        .select_related("created_by", "audience")
        .prefetch_related(
            "channels",
            "assignments",
            "assignments__user",
            "assignments__approved_by",
            "assignments__comments",
            "assignments__attachments",
            Prefetch("campaigns", to_attr="prefetched_campaigns")
        )
        .order_by("-created_at")
    )


def start_task(
    assignment,
):
    """
    ASSIGNED -> IN_PROGRESS
    """

    assignment.status = (
        TaskAssignment.Status.IN_PROGRESS
    )

    assignment.save()

    return assignment


def submit_task(
    assignment,
    remarks=None,
):
    """
    IN_PROGRESS -> SUBMITTED
    """

    assignment.status = (
        TaskAssignment.Status.SUBMITTED
    )

    assignment.remarks = remarks

    assignment.submitted_at = (
        timezone.now()
    )

    assignment.save()

    return assignment

def approve_task(
    assignment,
    approved_by,
    remarks=None,
):
    """
    SUBMITTED -> APPROVED
    """

    assignment.status = (
        TaskAssignment.Status.APPROVED
    )

    assignment.approved_by = approved_by

    assignment.approved_at = (
        timezone.now()
    )

    assignment.remarks = remarks

    assignment.save()

    return assignment


def reject_task(
    assignment,
    approved_by,
    remarks=None,
):
    """
    SUBMITTED -> REJECTED
    """

    assignment.status = (
        TaskAssignment.Status.REJECTED
    )

    assignment.approved_by = approved_by

    assignment.approved_at = (
        timezone.now()
    )

    assignment.remarks = remarks

    assignment.save()

    return assignment

def get_task_summary(user):

    qs = TaskAssignment.objects.filter(
        user=user
    )

    return {
        "assigned":
            qs.filter(
                status="ASSIGNED"
            ).count(),

        "in_progress":
            qs.filter(
                status="IN_PROGRESS"
            ).count(),

        "submitted":
            qs.filter(
                status="SUBMITTED"
            ).count(),

        "approved":
            qs.filter(
                status="APPROVED"
            ).count(),

        "rejected":
            qs.filter(
                status="REJECTED"
            ).count(),

        "overdue":
            qs.filter(
                status="OVERDUE"
            ).count(),
    }


class TaskStatusService:

    @staticmethod
    def calculate_task_status(campaigns):
        from apps.tasks.models import Task
        from apps.campaigns.models import Campaign

        if not campaigns:
            return Task.Status.ASSIGNED

        statuses = [c.status for c in campaigns]
        
        if Campaign.Status.PENDING_APPROVAL in statuses:
            return Task.Status.PENDING_APPROVAL
            
        active_statuses = {Campaign.Status.SCHEDULED, Campaign.Status.SENDING, Campaign.Status.PAUSED}
        if any(s in active_statuses for s in statuses):
            return Task.Status.IN_PROGRESS
            
        if Campaign.Status.APPROVED in statuses:
            return Task.Status.APPROVED
            
        terminal_statuses = {Campaign.Status.COMPLETED, Campaign.Status.CANCELLED, Campaign.Status.FAILED}
        if all(s in terminal_statuses for s in statuses):
            if any(s == Campaign.Status.COMPLETED for s in statuses):
                return Task.Status.COMPLETED
            return Task.Status.CANCELLED
            
        if any(s in terminal_statuses for s in statuses):
            return Task.Status.IN_PROGRESS
            
        return Task.Status.ASSIGNED

    @staticmethod
    def update_task_status(task):
        from django.utils import timezone
        
        campaigns = getattr(task, "prefetched_campaigns", task.campaigns.all())
        new_status = TaskStatusService.calculate_task_status(campaigns)
        
        task.status = new_status
        task.last_activity_at = timezone.now()
        task.save(update_fields=["status", "last_activity_at"])
        return task

    @staticmethod
    def get_task_statistics(task):
        from apps.campaigns.models import Campaign
        campaigns = getattr(task, "prefetched_campaigns", task.campaigns.all())
        
        total = len(campaigns)
        if total == 0:
            return {
                "campaign_count": 0,
                "completed_campaigns": 0,
                "approved_campaigns": 0,
                "pending_campaigns": 0,
                "draft_campaigns": 0,
                "rejected_campaigns": 0,
                "cancelled_campaigns": 0,
                "progress_percentage": 0.0,
            }

        counts = {
            "campaign_count": total,
            "completed_campaigns": sum(1 for c in campaigns if c.status == Campaign.Status.COMPLETED),
            "approved_campaigns": sum(1 for c in campaigns if c.status == Campaign.Status.APPROVED),
            "pending_campaigns": sum(1 for c in campaigns if c.status == Campaign.Status.PENDING_APPROVAL),
            "draft_campaigns": sum(1 for c in campaigns if c.status == Campaign.Status.DRAFT),
            "rejected_campaigns": sum(1 for c in campaigns if c.status == Campaign.Status.REJECTED),
            "cancelled_campaigns": sum(1 for c in campaigns if c.status == Campaign.Status.CANCELLED),
        }
        
        counts["progress_percentage"] = (counts["completed_campaigns"] / total) * 100.0
        
        return counts


