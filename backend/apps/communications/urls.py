from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.communications.views import (
    CommunicationEventListView,
    WhatsAppConnectionViewSet,
    WhatsAppWebhookView,
    SESWebhookView,
)

router = DefaultRouter()
router.register(r"whatsapp/connections", WhatsAppConnectionViewSet, basename="whatsapp-connections")
from apps.communications.views_sender import (
    ConnectSESView,
    ConnectSMTPView,
    WhatsAppEmbeddedSignupCallbackView,
    ConnectSMSView,
    DomainAuthenticationDetailView,
    DomainAuthenticationListCreateView,
    DomainAuthenticationVerifyView,
    SendTestEmailView,
    SenderIdentityDetailView,
    SenderIdentityListView,
    TestSMTPConnectionView,
)

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
    path(
        "webhooks/ses/",
        SESWebhookView.as_view(),
    ),
    path(
        "whatsapp/embedded-signup/callback/",
        WhatsAppEmbeddedSignupCallbackView.as_view(),
    ),
    path(
        "sender-domains/",
        DomainAuthenticationListCreateView.as_view(),
    ),
    path(
        "sender-domains/<uuid:pk>/",
        DomainAuthenticationDetailView.as_view(),
    ),
    path(
        "sender-domains/<uuid:pk>/verify/",
        DomainAuthenticationVerifyView.as_view(),
    ),
    path(
        "sender-identities/",
        SenderIdentityListView.as_view(),
    ),
    path(
        "sender-identities/<uuid:pk>/",
        SenderIdentityDetailView.as_view(),
    ),
    path(
        "sender-identities/connect-ses/",
        ConnectSESView.as_view(),
    ),
    path(
        "sender-identities/test-smtp/",
        TestSMTPConnectionView.as_view(),
    ),
    path(
        "sender-identities/connect-smtp/",
        ConnectSMTPView.as_view(),
    ),
    path(
        "sender-identities/connect-sms/",
        ConnectSMSView.as_view(),
    ),
    path(
        "sender-identities/<uuid:pk>/test-email/",
        SendTestEmailView.as_view(),
    ),
]



