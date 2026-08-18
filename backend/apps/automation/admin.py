from django.contrib import admin

from .models import (
    Automation,
    AutomationMember,
    AutomationExecution,
    AutomationExecutionLog,
)


# ==================================================
# Automation
# ==================================================

@admin.register(Automation)
class AutomationAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "owner",
        "status",
        "is_active",
        "is_template",
        "is_public",
        "version",
        "created_at",
    )

    list_filter = (
        "status",
        "is_active",
        "is_template",
        "is_public",
    )

    search_fields = (
        "name",
        "description",
        "owner__email",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    ordering = (
        "-created_at",
    )


# ==================================================
# Automation Member
# ==================================================

@admin.register(AutomationMember)
class AutomationMemberAdmin(admin.ModelAdmin):

    list_display = (
        "automation",
        "user",
        "permission",
        "created_by",
        "created_at",
    )

    list_filter = (
        "permission",
    )

    search_fields = (
        "automation__name",
        "user__email",
    )

    readonly_fields = (
        "id",
        "created_at",
    )



# ==================================================
# Automation Execution
# ==================================================

@admin.register(AutomationExecution)
class AutomationExecutionAdmin(admin.ModelAdmin):

    list_display = (
        "automation",
        "triggered_by",
        "status",
        "retry_count",
        "started_at",
        "finished_at",
    )

    list_filter = (
        "status",
    )

    search_fields = (
        "automation__name",
        "triggered_by__email",
    )

    readonly_fields = (
        "id",
        "started_at",
        "finished_at",
    )

    ordering = (
        "-started_at",
    )


# ==================================================
# Automation Execution Log
# ==================================================

@admin.register(AutomationExecutionLog)
class AutomationExecutionLogAdmin(admin.ModelAdmin):

    list_display = (
        "execution",
        "node_id",
        "status",
        "started_at",
        "finished_at",
    )

    list_filter = (
        "status",
    )

    readonly_fields = (
        "id",
        "started_at",
        "finished_at",
    )

    ordering = (
        "-started_at",
    )