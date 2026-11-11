import logging
from apps.common.models import atomic_transaction
from .models import Wallet, Transaction

logger = logging.getLogger(__name__)

class InsufficientCreditsError(Exception):
    pass

class BillingService:
    INITIAL_WALLET_CREDITS = 1000

    @staticmethod
    def _get_or_create_wallet(organization=None, for_update=False):
        from django.db import IntegrityError

        qs = Wallet.objects.select_for_update() if for_update else Wallet.objects
        if organization is not None:
            wallet = qs.filter(organization=organization).first()
            if not wallet:
                try:
                    wallet = Wallet.objects.create(
                        organization=organization,
                        balance=BillingService.INITIAL_WALLET_CREDITS,
                    )
                    logger.info(
                        "Auto-created wallet for organization %s with %s credits.",
                        organization.id,
                        BillingService.INITIAL_WALLET_CREDITS,
                    )
                except IntegrityError:
                    wallet = qs.get(organization=organization)
            return wallet

        wallet = qs.filter(organization__isnull=True).order_by("created_at").first()
        if not wallet:
            wallet = Wallet.objects.create(balance=BillingService.INITIAL_WALLET_CREDITS)
            logger.info("Auto-created missing default wallet with %s credits.", BillingService.INITIAL_WALLET_CREDITS)
        return wallet

    @staticmethod
    def get_balance(organization=None) -> int:
        """Return the current AI credit balance for an organization (or default wallet)."""
        wallet = BillingService._get_or_create_wallet(organization=organization, for_update=False)
        return wallet.balance

    @staticmethod
    def consume_credits(amount, description="", reference_id=None, organization=None, idempotency_key=None):
        """
        Deducts the specified amount of credits from the wallet.
        Raises InsufficientCreditsError if the balance is too low.
        Supports idempotency_key to prevent duplicate deductions.
        """
        with atomic_transaction():
            if idempotency_key:
                existing = Transaction.objects.select_related("wallet").filter(idempotency_key=idempotency_key).first()
                if existing:
                    return existing

            if amount <= 0:
                return None

            wallet = BillingService._get_or_create_wallet(organization=organization, for_update=True)

            if wallet.balance < amount:
                raise InsufficientCreditsError(
                    f"Not enough credits. Available balance: {wallet.balance}, required: {amount}."
                )

            wallet.balance -= amount
            wallet.save(update_fields=["balance", "updated_at"])

            tx = Transaction.objects.create(
                wallet=wallet,
                transaction_type=Transaction.Type.DEBIT,
                amount=amount,
                description=description,
                reference_id=reference_id,
                idempotency_key=idempotency_key,
            )

            logger.info(f"Consumed {amount} credits. New balance: {wallet.balance}")
            return tx

    @staticmethod
    def add_credits(amount, description="", reference_id=None, organization=None, idempotency_key=None):
        """
        Adds the specified amount of credits to the wallet.
        Supports idempotency_key to guarantee at-most-once refunds or top-ups.
        """
        with atomic_transaction():
            if idempotency_key:
                existing = Transaction.objects.select_related("wallet").filter(idempotency_key=idempotency_key).first()
                if existing:
                    return existing

            if amount <= 0:
                return None

            wallet = BillingService._get_or_create_wallet(organization=organization, for_update=True)

            wallet.balance += amount
            wallet.save(update_fields=["balance", "updated_at"])

            tx = Transaction.objects.create(
                wallet=wallet,
                transaction_type=Transaction.Type.CREDIT,
                amount=amount,
                description=description,
                reference_id=reference_id,
                idempotency_key=idempotency_key,
            )

            logger.info(f"Added {amount} credits. New balance: {wallet.balance}")
            return tx

    @staticmethod
    def refund_credits(amount, description="", reference_id=None, organization=None, idempotency_key=None):
        """Idempotently refund credits after a failed AI operation."""
        return BillingService.add_credits(
            amount=amount,
            description=description,
            reference_id=reference_id,
            organization=organization,
            idempotency_key=idempotency_key,
        )
