from django.contrib import admin

from apps.communications.models import (
    CommunicationEvent,
)


@admin.register(CommunicationEvent)
class CommunicationEventAdmin(admin.ModelAdmin):
    list_display = (
        "channel",
        "event_name",
        "recipient",
        "status",
        "created_at",
    )
    list_filter = (
        "channel",
        "event_name",
        "status",
    )
    search_fields = (
        "recipient",
        "provider_message_id",
    )
    readonly_fields = (
        "id",
        "created_at",
    )

