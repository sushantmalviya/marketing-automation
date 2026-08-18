from django.contrib import admin

from apps.events.models import SystemEvent


@admin.register(SystemEvent)
class SystemEventAdmin(admin.ModelAdmin):
    list_display = (
        "event_type",
        "event_name",
        "user_identifier",
        "session_id",
        "url",
        "created_at",
    )
    list_filter = (
        "event_type",
        "event_name",
        "created_at",
    )
    search_fields = (
        "user_identifier",
        "session_id",
        "url",
    )
    readonly_fields = (
        "id",
        "created_at",
    )

