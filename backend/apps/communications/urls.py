from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.communications.views import (
    CommunicationEventListView,
    WhatsAppConnectionViewSet,
    WhatsAppWebhookView,
)

router = DefaultRouter()
router.register(r"whatsapp/connections", WhatsAppConnectionViewSet, basename="whatsapp-connections")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "events/",
        CommunicationEventListView.as_view(),
        name="communication-events",
    ),
    path(
        "webhooks/whatsapp/",
        WhatsAppWebhookView.as_view(),
        name="whatsapp-webhook",
    ),
]


