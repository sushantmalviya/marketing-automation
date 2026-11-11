from django.contrib import admin
from .models import Transaction, Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("id", "organization", "balance", "updated_at")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "wallet", "transaction_type", "amount", "reference_id", "idempotency_key", "created_at")
    list_filter = ("transaction_type",)
    search_fields = ("description", "reference_id", "idempotency_key")
