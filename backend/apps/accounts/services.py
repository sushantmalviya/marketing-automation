import random
import logging
import datetime
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from django.core.mail import send_mail
from django.core.cache import cache
from django.contrib.auth.hashers import make_password, check_password
from django.http import Http404
from rest_framework.exceptions import ValidationError, PermissionDenied

from .models import MAUser, OrganizationUsageLedger, UserUsageLedger

User = get_user_model()
logger = logging.getLogger(__name__)


def send_welcome_email(email, temporary_password):
    subject = "Welcome to Auto Market"
    message = f"""
Hello,

Your Auto Market account has been approved.

Login Email:
{email}

Temporary Password:
{temporary_password}

Please login and change your password immediately.

Regards,
Auto Market Team
"""
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )


class OTPService:
    CACHE_KEY_PREFIX = "password_reset_otp_"
    TIMEOUT_SECONDS = 300  # 5 minutes

    @classmethod
    def get_cache_key(cls, email):
        return f"{cls.CACHE_KEY_PREFIX}{email}"

    @classmethod
    def generate_and_cache_otp(cls, email):
        otp = f"{random.SystemRandom().randint(100000, 999999)}"
        hashed_otp = make_password(otp)
        cache_key = cls.get_cache_key(email)
        cache.set(cache_key, hashed_otp, timeout=cls.TIMEOUT_SECONDS)
        return otp

    @classmethod
    def verify_and_delete_otp(cls, email, otp_input):
        cache_key = cls.get_cache_key(email)
        hashed_otp = cache.get(cache_key)
        if not hashed_otp:
            return False, "OTP expired or does not exist."
        if not check_password(otp_input, hashed_otp):
            return False, "Invalid OTP."
        cache.delete(cache_key)
        return True, None


class UserManagementService:
    @classmethod
    @transaction.atomic
    def delete_admin(cls, request_user, target_id):
        from apps.common.ownership import is_super_admin
        if not is_super_admin(request_user):
            raise PermissionDenied("You do not have permission to perform this action.")

        try:
            target_user = User.objects.get(id=target_id)
        except User.DoesNotExist:
            raise Http404("User not found.")

        target_ma_user = MAUser.objects.filter(user=target_user).first()
        if not target_ma_user or target_ma_user.role not in ["ADMIN", "USER"]:
            raise ValidationError({"detail": "Only User/Admin accounts can be deleted using this endpoint."})

        target_email = target_user.email
        target_user.delete()
        logger.info(f"User {target_email} deleted by Admin {request_user.email}.")

    @classmethod
    def get_users_queryset(cls, request_user=None):
        return User.objects.filter(ma_users__role__in=["USER", "ADMIN"]).prefetch_related("ma_users").order_by("-date_joined")

    @classmethod
    def get_admins_queryset(cls):
        return cls.get_users_queryset()


class InsufficientWalletBalanceError(Exception):
    pass


def get_current_month_bounds():
    now = timezone.now()
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        next_month = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    period_end = next_month - datetime.timedelta(seconds=1)
    return period_start, period_end


class UsageMeterService:
    @classmethod
    def record_usage(cls, user, action_type, quantity=1, unit_cost=0.0, metadata=None):
        if not user or not hasattr(user, 'organization') or not user.organization:
            return None

        org = user.organization
        sub = getattr(org, 'subscription', None)

        total_cost = Decimal(str(quantity)) * Decimal(str(unit_cost))

        if total_cost > 0 and sub:
            curr_balance = Decimal(str(sub.wallet_balance)) if sub.wallet_balance is not None else Decimal("0.00")
            if curr_balance < total_cost:
                raise InsufficientWalletBalanceError(
                    f"Insufficient wallet balance (${curr_balance:.2f}). Required: ${total_cost:.2f} for {action_type}."
                )
            sub.wallet_balance = curr_balance - total_cost
            sub.save(update_fields=['wallet_balance'])

        user_log = UserUsageLedger.objects.create(
            organization=org,
            user=user if getattr(user, 'is_authenticated', False) else None,
            action_type=action_type,
            quantity=quantity,
            unit_cost=Decimal(str(unit_cost)),
            total_cost=total_cost,
            metadata=metadata or {},
        )

        period_start, period_end = get_current_month_bounds()
        ledger, _ = OrganizationUsageLedger.objects.get_or_create(
            organization=org,
            period_start=period_start,
            period_end=period_end,
        )

        if action_type == 'EMAIL_SENT':
            ledger.emails_sent += quantity
        elif action_type == 'SMS_SENT':
            ledger.sms_sent += quantity
        elif action_type == 'WHATSAPP_SENT':
            ledger.whatsapp_sent += quantity
        elif action_type == 'SOCIAL_POST':
            ledger.social_posts_published += quantity
        elif action_type == 'AI_IMAGE_GEN':
            ledger.ai_images_generated += quantity
        elif action_type == 'AI_TEXT_GEN':
            ledger.ai_prompts_processed += quantity

        curr_ledger_cost = Decimal(str(ledger.total_payg_cost_deducted)) if ledger.total_payg_cost_deducted is not None else Decimal("0.00")
        ledger.total_payg_cost_deducted = curr_ledger_cost + total_cost
        ledger.save()

        return user_log
