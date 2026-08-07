from django.urls import path

from apps.communications.views import (
    CommunicationEventListView,
    EmailProviderListCreateView,
    SMSProviderListCreateView,
    WhatsAppProviderListCreateView,
    WhatsAppWebhookView,
)


urlpatterns = [
    path(
        "email-providers/",
        EmailProviderListCreateView.as_view(),
    ),
    path(
        "sms-providers/",
        SMSProviderListCreateView.as_view(),
    ),
    path(
        "whatsapp-providers/",
        WhatsAppProviderListCreateView.as_view(),
    ),
    path(
        "events/",
        CommunicationEventListView.as_view(),
    ),
    path(
        "webhooks/whatsapp/",
        WhatsAppWebhookView.as_view(),
    ),
]

