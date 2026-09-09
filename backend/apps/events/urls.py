from django.urls import path

from apps.events.views import (
    TrackEventView,
    EmailOpenTrackingView,
    EmailClickTrackingView,
)

urlpatterns = [
    path(
        "track/",
        TrackEventView.as_view(),
    ),
    path(
        "track/open/<str:payload>.png",
        EmailOpenTrackingView.as_view(),
    ),
    path(
        "track/click/<str:payload>",
        EmailClickTrackingView.as_view(),
    ),
]

