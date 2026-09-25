from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
import secrets
from .models import MAUser
from django.db import transaction

from django.conf import settings
from django.core.mail import send_mail

from rest_framework.exceptions import ValidationError


User = get_user_model()


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

import random
from django.core.cache import cache
from django.contrib.auth.hashers import make_password, check_password

class OTPService:
    CACHE_KEY_PREFIX = "password_reset_otp_"
    TIMEOUT_SECONDS = 300  # 5 minutes

    @classmethod
    def get_cache_key(cls, email):
        return f"{cls.CACHE_KEY_PREFIX}{email}"

    @classmethod
    def generate_and_cache_otp(cls, email):
        """
        Generates a 6-digit OTP, hashes it, stores the hash in cache,
        and returns the plaintext OTP (to be sent to the user).
        """
        otp = f"{random.SystemRandom().randint(100000, 999999)}"
        hashed_otp = make_password(otp)
        
        cache_key = cls.get_cache_key(email)
        cache.set(cache_key, hashed_otp, timeout=cls.TIMEOUT_SECONDS)
        
        return otp

    @classmethod
    def verify_and_delete_otp(cls, email, otp_input):
        """
        Retrieves the hashed OTP from cache, verifies the input, 
        and deletes the OTP from cache if valid.
        Returns a tuple: (is_valid, error_message)
        """
        cache_key = cls.get_cache_key(email)
        hashed_otp = cache.get(cache_key)
        
        if not hashed_otp:
            return False, "OTP expired or does not exist."
            
        if not check_password(otp_input, hashed_otp):
            return False, "Invalid OTP."
            
        # OTP is valid, remove it to prevent reuse
        cache.delete(cache_key)
        return True, None

import logging
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

logger = logging.getLogger(__name__)

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
        """Returns a queryset of all User & Admin accounts, optimized with prefetch_related."""
        return User.objects.filter(ma_users__role__in=["USER", "ADMIN"]).prefetch_related("ma_users").order_by("-date_joined")

    @classmethod
    def get_admins_queryset(cls):
        """Alias for get_users_queryset."""
        return cls.get_users_queryset()

