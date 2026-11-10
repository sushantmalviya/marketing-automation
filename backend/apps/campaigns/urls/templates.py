from django.urls import path

from apps.campaigns.views import (
    TemplateCreateAPIView,
    TemplateListAPIView,
    TemplateUpdateAPIView,
    TemplateSubmitAPIView,
    TemplateSyncStatusAPIView,
    TemplateDeleteAPIView
)

urlpatterns = [
    path(
        "",
        TemplateListAPIView.as_view(),
        name="template-list",
    ),

    path(
        "create/",
        TemplateCreateAPIView.as_view(),
        name="template-create",
    ),

    path(
        "<int:template_id>/",
        TemplateUpdateAPIView.as_view(),
        name="template-update",
    ),
    path(
        "<int:template_id>/submit-to-provider/",
        TemplateSubmitAPIView.as_view(),
        name="template-submit",
    ),
    path(
        "<int:template_id>/submit/",
        TemplateSubmitAPIView.as_view(),
        name="template-submit-alias",
    ),
    path(
        "<int:template_id>/sync-provider-status/",
        TemplateSyncStatusAPIView.as_view(),
        name="template-sync-status",
    ),
    path(
        "<int:template_id>/sync-status/",
        TemplateSyncStatusAPIView.as_view(),
        name="template-sync-status-alias",
    ),
    path(
        "<int:template_id>/delete/",
        TemplateDeleteAPIView.as_view(),
        name="template-delete",
    )
]