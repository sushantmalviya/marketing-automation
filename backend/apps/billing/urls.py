from django.urls import path
from apps.billing.views import BillingSummaryView, WalletBalanceView

urlpatterns = [
    path("summary/", BillingSummaryView.as_view(), name="billing-summary"),
    path("balance/", WalletBalanceView.as_view(), name="billing-balance"),
]
