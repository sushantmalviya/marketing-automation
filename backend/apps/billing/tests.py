from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser, User
from apps.billing.models import Transaction, Wallet


class BillingSummaryTests(APITestCase):
    def setUp(self):
        self.root = User.objects.create_user(email="billing-root@example.com", password="StrongPass123!")
        MAUser.objects.create(user=self.root, role="ADMIN")
        self.user = User.objects.create_user(email="billing-user@example.com", password="StrongPass123!")
        MAUser.objects.create(user=self.user, role="USER")
        self.wallet = Wallet.objects.create(balance=700)
        Transaction.objects.create(wallet=self.wallet, transaction_type="CREDIT", amount=1000)
        Transaction.objects.create(wallet=self.wallet, transaction_type="DEBIT", amount=300)

    def test_super_admin_receives_real_wallet_totals(self):
        self.client.force_authenticate(self.root)
        response = self.client.get(reverse("billing-summary"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["balance"], 700)
        self.assertEqual(response.data["credited"], 1000)
        self.assertEqual(response.data["consumed"], 300)

    def test_normal_user_is_forbidden(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(reverse("billing-summary")).status_code, status.HTTP_403_FORBIDDEN)
