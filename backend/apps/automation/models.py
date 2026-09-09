import uuid

# pyrefly: ignore [missing-import]
from django.conf import settings
from django.db import models


# ============================================================
# AUTOMATION
# ============================================================

class Automation(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        VALIDATED = "VALIDATED", "Validated"
        PUBLISHED = "PUBLISHED", "Published"
        PAUSED = "PAUSED", "Paused"
        ARCHIVED = "ARCHIVED", "Archived"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(
        max_length=255
    )

    description = models.TextField(
        blank=True,
        null=True
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_automations"
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    is_active = models.BooleanField(
        default=True
    )

    is_template = models.BooleanField(
        default=False
    )

    is_public = models.BooleanField(
        default=False
    )

    version = models.PositiveIntegerField(
        default=1
    )

    workflow_graph = models.JSONField(
        default=dict,
        blank=True
    )

    published_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "automation"

        ordering = [
            "-created_at"
        ]

        indexes = [
            models.Index(fields=["owner"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.name


# ============================================================
# AUTOMATION MEMBERS
# ============================================================

class AutomationMember(models.Model):

    class Permission(models.TextChoices):
        VIEW = "VIEW", "View"
        EDIT = "EDIT", "Edit"
        EXECUTE = "EXECUTE", "Execute"
        ADMIN = "ADMIN", "Admin"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    automation = models.ForeignKey(
        Automation,
        on_delete=models.CASCADE,
        related_name="members"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="automation_memberships"
    )

    permission = models.CharField(
        max_length=20,
        choices=Permission.choices
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="shared_automations"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "automation_member"

        unique_together = [
            ("automation", "user")
        ]

        indexes = [
            models.Index(fields=["automation"]),
            models.Index(fields=["user"]),
            models.Index(fields=["permission"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.permission}"



# ============================================================
# AUTOMATION EXECUTION
# ============================================================

class AutomationExecution(models.Model):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        RUNNING = "RUNNING", "Running"
        WAITING = "WAITING", "Waiting"
        RETRYING = "RETRYING", "Retrying"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    automation = models.ForeignKey(
        Automation,
        on_delete=models.CASCADE,
        related_name="executions"
    )

    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    current_node_id = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )

    retry_count = models.PositiveIntegerField(
        default=0
    )

    retry_after = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True
    )

    paused_at = models.DateTimeField(
        null=True,
        blank=True
    )

    resume_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True
    )

    context = models.JSONField(
        default=dict,
        blank=True
    )

    error_message = models.TextField(
        blank=True
    )

    started_at = models.DateTimeField(
        auto_now_add=True
    )

    finished_at = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        db_table = "automation_execution"

        indexes = [
            models.Index(fields=["automation"]),
            models.Index(fields=["status"]),
            models.Index(fields=["status", "resume_at"]),
            models.Index(fields=["status", "retry_after"]),
        ]

    def __str__(self):
        return f"{self.automation.name} - {self.status}"


# ============================================================
# AUTOMATION EXECUTION LOGS
# ============================================================

class AutomationExecutionLog(models.Model):

    class Status(models.TextChoices):
        STARTED = "STARTED", "Started"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        SKIPPED = "SKIPPED", "Skipped"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    execution = models.ForeignKey(
        AutomationExecution,
        on_delete=models.CASCADE,
        related_name="logs"
    )

    node_id = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices
    )

    message = models.TextField(
        blank=True
    )

    started_at = models.DateTimeField(
        auto_now_add=True
    )

    finished_at = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        db_table = "automation_execution_log"

        indexes = [
            models.Index(fields=["execution"]),
            models.Index(fields=["node_id"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.execution.id} - {self.status}"
