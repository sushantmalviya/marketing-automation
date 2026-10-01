from django.urls import path

from apps.analytics.views import (
    AnalyticsSummaryView,
    InstagramAccountInsightsView,
    InstagramMediaFeedView,
    InstagramMediaMetricsView,
    InstagramCommentsView,
    LinkedInOrganizationInsightsView,
    LinkedInFollowerDemographicsView,
    LinkedInCommentsView,
    FacebookPageInsightsView,
    FacebookPageFeedView,
    FacebookCommentsView,
    XAccountInsightsView,
    XTweetsFeedView,
)

urlpatterns = [
    path("summary/", AnalyticsSummaryView.as_view(), name="analytics-summary"),
    path("instagram/insights/", InstagramAccountInsightsView.as_view(), name="instagram-insights"),
    path("instagram/media/", InstagramMediaFeedView.as_view(), name="instagram-media-feed"),
    path("instagram/media/<str:media_id>/insights/", InstagramMediaMetricsView.as_view(), name="instagram-media-insights"),
    path("instagram/media/<str:media_id>/comments/", InstagramCommentsView.as_view(), name="instagram-media-comments"),
    path("linkedin/insights/", LinkedInOrganizationInsightsView.as_view(), name="linkedin-insights"),
    path("linkedin/demographics/", LinkedInFollowerDemographicsView.as_view(), name="linkedin-demographics"),
    path("linkedin/comments/<str:share_urn>/", LinkedInCommentsView.as_view(), name="linkedin-comments"),
    path("facebook/insights/", FacebookPageInsightsView.as_view(), name="facebook-insights"),
    path("facebook/posts/", FacebookPageFeedView.as_view(), name="facebook-posts"),
    path("facebook/posts/<str:post_id>/comments/", FacebookCommentsView.as_view(), name="facebook-comments"),
    path("x/insights/", XAccountInsightsView.as_view(), name="x-insights"),
    path("x/tweets/", XTweetsFeedView.as_view(), name="x-tweets"),
]





