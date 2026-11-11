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


class OrganizationSocialAnalyticsTests(TestCase):
    def setUp(self):
        from apps.accounts.models import Organization, MAUser
        from apps.integrations.models import SocialConnection
        from apps.analytics.services.facebook_analytics import FacebookAnalyticsService
        from apps.analytics.services.instagram_analytics import InstagramAnalyticsService
        from apps.analytics.services.linkedin_analytics import LinkedInAnalyticsService
        from apps.analytics.services.x_analytics import XAnalyticsService

        self.FacebookAnalyticsService = FacebookAnalyticsService
        self.InstagramAnalyticsService = InstagramAnalyticsService
        self.LinkedInAnalyticsService = LinkedInAnalyticsService
        self.XAnalyticsService = XAnalyticsService

        User = get_user_model()
        self.org_a = Organization.objects.create(
            name="Org A Analytics",
            slug="org-a-analytics",
            external_company_id="ORG-A-ANA",
        )
        self.org_b = Organization.objects.create(
            name="Org B Analytics",
            slug="org-b-analytics",
            external_company_id="ORG-B-ANA",
        )
        self.user_a1 = User.objects.create_user(email="a1@ana.com", password="pwd", organization=self.org_a)
        self.ma_a1 = MAUser.objects.create(user=self.user_a1, organization=self.org_a, role="ADMIN")
        self.user_a2 = User.objects.create_user(email="a2@ana.com", password="pwd", organization=self.org_a)
        MAUser.objects.create(user=self.user_a2, organization=self.org_a, role="USER")
        self.user_b = User.objects.create_user(email="b1@ana.com", password="pwd", organization=self.org_b)
        MAUser.objects.create(user=self.user_b, organization=self.org_b, role="ADMIN")
        self.user_no_ma = User.objects.create_user(email="noma@ana.com", password="pwd", organization=self.org_b)

        for plat in [
            SocialConnection.PlatformChoices.FACEBOOK,
            SocialConnection.PlatformChoices.INSTAGRAM,
            SocialConnection.PlatformChoices.LINKEDIN,
            SocialConnection.PlatformChoices.X,
        ]:
            conn = SocialConnection.objects.create(
                user=self.ma_a1,
                platform=plat,
                platform_account_id=f"{plat.lower()}_acc",
                account_name=f"Org A {plat}",
                connection_status=SocialConnection.ConnectionStatus.CONNECTED,
            )
            conn.set_tokens("tok")
            conn.save()

    def test_colleague_shares_analytics_connections_and_other_org_isolated(self):
        for svc in [
            self.FacebookAnalyticsService,
            self.InstagramAnalyticsService,
            self.LinkedInAnalyticsService,
            self.XAnalyticsService,
        ]:
            self.assertIsNotNone(svc.get_connection(self.user_a2))
            self.assertIsNone(svc.get_connection(self.user_b))
            self.assertIsNone(svc.get_connection(self.user_no_ma))
