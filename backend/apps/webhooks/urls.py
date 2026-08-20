from django.urls import path

from apps.webhooks.views import IncomingWebhookView, meta_lead_webhook


urlpatterns = [
    path('meta/', meta_lead_webhook, name='meta_webhook'),
    path(
        "<str:secret>/",
        IncomingWebhookView.as_view(),
    ),
]

