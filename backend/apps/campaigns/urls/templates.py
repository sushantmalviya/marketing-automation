from django.urls import path

from apps.campaigns.views import (
    TemplateCreateAPIView,
    TemplateListAPIView,
    TemplateUpdateAPIView,
    TemplateSubmitAPIView,
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
        "<int:template_id>/delete/",
        TemplateDeleteAPIView.as_view(),
        name="template-delete",
    )
]