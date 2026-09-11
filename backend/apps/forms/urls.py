from django.urls import path

from .views import (
    FormListCreateView,
    FormDetailView,
    PublishFormView,
    PublicFormView,
    SubmitFormView,
    FormResponsesView,
    FormResponseDetailView,
)

urlpatterns = [

    path(
        "",
        FormListCreateView.as_view(),
    ),

    path(
        "<int:pk>/",
        FormDetailView.as_view(),
    ),

    path(
        "<int:pk>/publish/",
        PublishFormView.as_view(),
    ),

    path(
        "<int:pk>/responses/",
        FormResponsesView.as_view(),
    ),

    path(
        "responses/<int:pk>/",
        FormResponseDetailView.as_view(),
        name="form-response-detail",
    ),

    path(
        "public/<uuid:uuid>/",
        PublicFormView.as_view(),
        name="public-form",
    ),

    path(
        "public/<uuid:uuid>/submit/",
        SubmitFormView.as_view(),
        name="submit-form",
    ),
]

