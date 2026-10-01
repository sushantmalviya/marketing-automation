import logging

from django.db import OperationalError, connections
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.analytics.services.metrics import all_metrics
from apps.analytics.services.instagram_analytics import InstagramAnalyticsService
from apps.analytics.services.linkedin_analytics import LinkedInAnalyticsService
from apps.analytics.services.facebook_analytics import FacebookAnalyticsService
from apps.analytics.services.x_analytics import XAnalyticsService

logger = logging.getLogger(__name__)


class AnalyticsSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = parse_date(request.query_params.get("date_from", "")) or None
        date_to = parse_date(request.query_params.get("date_to", "")) or None

        try:
            metrics = all_metrics(request.user, date_from=date_from, date_to=date_to)
        except OperationalError:
            logger.warning(
                "Database connection dropped while calculating analytics; retrying once."
            )
            connections["default"].close()
            metrics = all_metrics(request.user, date_from=date_from, date_to=date_to)

        return Response(metrics)


class InstagramAccountInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connection_id = request.query_params.get("connection_id")
        data = InstagramAnalyticsService.get_account_insights(request.user, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class InstagramMediaFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get("limit", 25))
        connection_id = request.query_params.get("connection_id")
        data = InstagramAnalyticsService.get_recent_media_feed(request.user, limit=limit, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class InstagramMediaMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, media_id):
        connection_id = request.query_params.get("connection_id")
        data = InstagramAnalyticsService.get_media_performance(request.user, media_id=media_id, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class InstagramCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, media_id):
        connection_id = request.query_params.get("connection_id")
        data = InstagramAnalyticsService.get_media_comments(request.user, media_id=media_id, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)

    def post(self, request, media_id):
        comment_id = request.data.get("comment_id")
        message = request.data.get("message")
        connection_id = request.query_params.get("connection_id")
        if not comment_id or not message:
            return Response({"error": "comment_id and message are required."}, status=status.HTTP_400_BAD_REQUEST)
        data = InstagramAnalyticsService.post_comment_reply(request.user, comment_id=comment_id, message=message, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)


class LinkedInOrganizationInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_urn = request.query_params.get("org_urn")
        connection_id = request.query_params.get("connection_id")
        data = LinkedInAnalyticsService.get_organization_insights(request.user, org_urn=org_urn, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class LinkedInFollowerDemographicsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_urn = request.query_params.get("org_urn")
        connection_id = request.query_params.get("connection_id")
        data = LinkedInAnalyticsService.get_follower_demographics(request.user, org_urn=org_urn, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class LinkedInCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, share_urn):
        connection_id = request.query_params.get("connection_id")
        data = LinkedInAnalyticsService.get_post_comments(request.user, share_urn=share_urn, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)

    def post(self, request, share_urn):
        comment_urn = request.data.get("comment_urn")
        message = request.data.get("message")
        connection_id = request.query_params.get("connection_id")
        if not comment_urn or not message:
            return Response({"error": "comment_urn and message are required."}, status=status.HTTP_400_BAD_REQUEST)
        data = LinkedInAnalyticsService.reply_to_comment(request.user, comment_urn=comment_urn, message=message, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)


class FacebookPageInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        page_id = request.query_params.get("page_id")
        connection_id = request.query_params.get("connection_id")
        data = FacebookAnalyticsService.get_page_insights(request.user, page_id=page_id, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class FacebookPageFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        page_id = request.query_params.get("page_id")
        limit = int(request.query_params.get("limit", 25))
        connection_id = request.query_params.get("connection_id")
        data = FacebookAnalyticsService.get_recent_posts(request.user, page_id=page_id, limit=limit, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class FacebookCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, post_id):
        connection_id = request.query_params.get("connection_id")
        data = FacebookAnalyticsService.get_post_comments(request.user, post_id=post_id, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)

    def post(self, request, post_id):
        comment_id = request.data.get("comment_id")
        message = request.data.get("message")
        connection_id = request.query_params.get("connection_id")
        if not comment_id or not message:
            return Response({"error": "comment_id and message are required."}, status=status.HTTP_400_BAD_REQUEST)
        data = FacebookAnalyticsService.reply_to_comment(request.user, comment_id=comment_id, message=message, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)


class XAccountInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connection_id = request.query_params.get("connection_id")
        data = XAnalyticsService.get_user_insights(request.user, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class XTweetsFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get("limit", 25))
        connection_id = request.query_params.get("connection_id")
        data = XAnalyticsService.get_recent_tweets(request.user, limit=limit, connection_id=connection_id)
        if not data.get("success", True):
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)





