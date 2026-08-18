from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import OperationalError
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.analytics.views import AnalyticsSummaryView


class AnalyticsSummaryRetryTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="analytics@example.com",
            password="test-password",
        )
        self.request = APIRequestFactory().get("/api/analytics/summary/")
        force_authenticate(self.request, user=self.user)

    @patch("apps.analytics.views.connections")
    @patch("apps.analytics.views.all_metrics")
    def test_retries_once_after_database_disconnect(self, metrics, connections):
        expected = {"email": {"sent": 4}, "workflow": {"execution_count": 2}}
        metrics.side_effect = [OperationalError("connection closed"), expected]

        response = AnalyticsSummaryView.as_view()(self.request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, expected)
        self.assertEqual(metrics.call_count, 2)
        connections["default"].close.assert_called_once_with()

    @patch("apps.analytics.views.all_metrics")
    def test_does_not_retry_successful_request(self, metrics):
        metrics.return_value = {"workflow": {"execution_count": 0}}

        response = AnalyticsSummaryView.as_view()(self.request)

        self.assertEqual(response.status_code, 200)
        metrics.assert_called_once_with(self.user, date_from=None, date_to=None)
