from decimal import Decimal
from django.test import TestCase, Client
from django.utils import timezone
from rest_framework import status
from apps.accounts.models import (
    User,
    MAUser,
    Organization,
    OrganizationSubscription,
    OrganizationUsageLedger,
    UserUsageLedger,
)
from apps.accounts.services import UsageMeterService, InsufficientWalletBalanceError


class MultiTenantSaaSTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.api_key = "external-secret-provisioning-key-2026"

    def test_external_provisioning_and_isolation(self):
        # 1. Test External Provisioning API
        payload = {
            "external_company_id": "TEST-COMP-101",
            "company_name": "Test Acme Inc",
            "admin_email": "acme_admin@test.com",
            "admin_password": "SecurePassword123!",
            "admin_first_name": "Acme",
            "admin_last_name": "Admin",
            "rental_fee": 299.00,
            "initial_wallet_balance": 150.00,
        }

        response = self.client.post(
            "/api/v1/external/organizations/provision/",
            data=payload,
            content_type="application/json",
            HTTP_X_EXTERNAL_API_KEY=self.api_key,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(res_data["organization"]["external_company_id"], "TEST-COMP-101")
        self.assertEqual(res_data["subscription"]["wallet_balance"], "150.00")

        # Verify DB records
        org = Organization.objects.get(external_company_id="TEST-COMP-101")
        admin_user = User.objects.get(email="acme_admin@test.com")
        self.assertEqual(admin_user.organization, org)
        self.assertEqual(admin_user.ma_users.first().role, "ADMIN")

    def test_usage_meter_service_and_payg_wallet(self):
        org = Organization.objects.create(
            name="Metering Corp",
            slug="metering-corp",
            external_company_id="TEST-METER-999",
        )
        sub = OrganizationSubscription.objects.create(
            organization=org,
            rent_status="ACTIVE",
            rental_fee=100.00,
            wallet_balance=Decimal("20.00"),
        )
        user = User.objects.create_user(
            email="meter_user@test.com",
            password="Password123!",
            organization=org,
        )

        # Record 100 emails at $0.05 per email = $5.00 total
        log = UsageMeterService.record_usage(
            user=user,
            action_type="EMAIL_SENT",
            quantity=100,
            unit_cost=0.05,
            metadata={"campaign": "Welcome Series"},
        )
        self.assertIsNotNone(log)
        sub.refresh_from_db()
        self.assertEqual(sub.wallet_balance, Decimal("15.00"))

        # Verify User Usage Ledger
        user_log = UserUsageLedger.objects.get(id=log.id)
        self.assertEqual(user_log.action_type, "EMAIL_SENT")
        self.assertEqual(user_log.total_cost, Decimal("5.00"))

        # Record 2 AI Images at $5.00 per image = $10.00 total
        UsageMeterService.record_usage(
            user=user,
            action_type="AI_IMAGE_GEN",
            quantity=2,
            unit_cost=5.00,
        )
        sub.refresh_from_db()
        self.assertEqual(sub.wallet_balance, Decimal("5.00"))

        # Attempt to perform action requiring $10.00 with only $5.00 balance
        with self.assertRaises(InsufficientWalletBalanceError):
            UsageMeterService.record_usage(
                user=user,
                action_type="WHATSAPP_SENT",
                quantity=100,
                unit_cost=0.10,
            )

    def test_usage_report_api(self):
        org = Organization.objects.create(
            name="Analytics Org",
            slug="analytics-org",
            external_company_id="ANALYTICS-101",
        )
        OrganizationSubscription.objects.create(
            organization=org,
            rent_status="ACTIVE",
            wallet_balance=100.00,
        )
        user = User.objects.create_user(
            email="analytics_user@test.com",
            password="Password123!",
            organization=org,
        )
        UsageMeterService.record_usage(user, "EMAIL_SENT", quantity=50, unit_cost=0.02)

        response = self.client.get(
            "/api/v1/external/organizations/ANALYTICS-101/usage/",
            HTTP_X_EXTERNAL_API_KEY=self.api_key,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["external_company_id"], "ANALYTICS-101")
        self.assertEqual(data["usage_summary"]["emails_sent"], 50)
        self.assertEqual(len(data["per_user_breakdown"]), 1)
        self.assertEqual(data["per_user_breakdown"][0]["email"], "analytics_user@test.com")
