from django.urls import path

from apps.communications.views import (
    CommunicationEventListView,
    WhatsAppWebhookView,
)
from apps.communications.views_sender import (
    ConnectSMTPView,
    GoogleOAuthCallbackView,
    GoogleOAuthUrlView,
    MicrosoftOAuthCallbackView,
    MicrosoftOAuthUrlView,
    SendTestEmailView,
    SenderIdentityDetailView,
    SenderIdentityListView,
    TestSMTPConnectionView,
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
    path(
        "sender-identities/",
        SenderIdentityListView.as_view(),
    ),
    path(
        "sender-identities/<uuid:pk>/",
        SenderIdentityDetailView.as_view(),
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
        "sender-identities/oauth/google/url/",
        GoogleOAuthUrlView.as_view(),
    ),
    path(
        "sender-identities/oauth/google/callback/",
        GoogleOAuthCallbackView.as_view(),
    ),
    path(
        "sender-identities/oauth/microsoft/url/",
        MicrosoftOAuthUrlView.as_view(),
    ),
    path(
        "sender-identities/oauth/microsoft/callback/",
        MicrosoftOAuthCallbackView.as_view(),
    ),
    path(
        "sender-identities/<uuid:pk>/test-email/",
        SendTestEmailView.as_view(),
    ),
]


