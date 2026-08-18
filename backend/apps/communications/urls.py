from django.urls import path

from apps.communications.views import (
    CommunicationEventListView,
    WhatsAppWebhookView,
)


urlpatterns = [
    path(
        "events/",
        CommunicationEventListView.as_view(),
    ),
    path(
        "webhooks/whatsapp/",
        WhatsAppWebhookView.as_view(),
    ),
]

