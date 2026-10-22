import os
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from apps.accounts.models import (
    User,
    MAUser,
    Organization,
    OrganizationSubscription,
    OrganizationUsageLedger,
    UserUsageLedger,
)

EXTERNAL_API_KEY = os.getenv("EXTERNAL_PROVISIONING_API_KEY", "external-secret-provisioning-key-2026")


class ExternalAPIKeyPermission(AllowAny):
    """
    Validates X-External-API-Key header against configured EXTERNAL_PROVISIONING_API_KEY.
    """
    def has_permission(self, request, view):
        api_key = request.headers.get("X-External-API-Key")
        if not api_key:
            return False
        return api_key == EXTERNAL_API_KEY


class ExternalOrganizationProvisionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        api_key = request.headers.get("X-External-API-Key")
        if api_key != EXTERNAL_API_KEY:
            return Response({"error": "Unauthorized", "detail": "Invalid or missing X-External-API-Key header."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        external_company_id = data.get("external_company_id")
        company_name = data.get("company_name")
        admin_email = data.get("admin_email")
        admin_password = data.get("admin_password")
        admin_first_name = data.get("admin_first_name", "")
        admin_last_name = data.get("admin_last_name", "")

        if not external_company_id or not company_name or not admin_email or not admin_password:
            return Response(
                {"error": "Missing Required Fields", "detail": "external_company_id, company_name, admin_email, and admin_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Organization.objects.filter(external_company_id=external_company_id).exists():
            return Response(
                {"error": "Already Exists", "detail": f"Organization with external_company_id '{external_company_id}' already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rental_fee = Decimal(str(data.get("rental_fee", 0.0)))
        initial_wallet = Decimal(str(data.get("initial_wallet_balance", 0.0)))

        rent_start = timezone.now()
        rent_end_str = data.get("rent_end_date")
        if rent_end_str:
            try:
                rent_end = timezone.datetime.fromisoformat(rent_end_str.replace("Z", "+00:00"))
            except ValueError:
                rent_end = rent_start + timezone.timedelta(days=365)
        else:
            rent_end = rent_start + timezone.timedelta(days=365)

        base_slug = slugify(company_name) or "company"
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        with transaction.atomic():
            # 1. Create Organization
            org = Organization.objects.create(
                name=company_name,
                slug=slug,
                external_company_id=external_company_id,
                status="ACTIVE",
            )

            # 2. Create OrganizationSubscription
            sub = OrganizationSubscription.objects.create(
                organization=org,
                rent_status="ACTIVE",
                rent_start_date=rent_start,
                rent_end_date=rent_end,
                rental_fee=rental_fee,
                wallet_balance=initial_wallet,
            )

            # 3. Create Admin User
            user, created = User.objects.get_or_create(
                email=admin_email,
                defaults={
                    "username": admin_email,
                    "first_name": admin_first_name,
                    "last_name": admin_last_name,
                    "organization": org,
                },
            )
            if not created:
                user.organization = org
                if admin_first_name:
                    user.first_name = admin_first_name
                if admin_last_name:
                    user.last_name = admin_last_name
            user.set_password(admin_password)
            user.save()

            # 4. Assign MAUser Tenant Owner Role
            ma_user, _ = MAUser.objects.get_or_create(
                user=user,
                defaults={"organization": org, "role": "ADMIN"},
            )
            ma_user.organization = org
            ma_user.role = "ADMIN"
            ma_user.save()

        return Response(
            {
                "status": "success",
                "message": "Organization, Subscription, and Tenant Admin created successfully.",
                "organization": {
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug,
                    "external_company_id": org.external_company_id,
                },
                "admin_user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": "ADMIN",
                },
                "subscription": {
                    "rent_status": sub.rent_status,
                    "rent_start_date": sub.rent_start_date,
                    "rent_end_date": sub.rent_end_date,
                    "rental_fee": f"{sub.rental_fee:.2f}",
                    "wallet_balance": f"{sub.wallet_balance:.2f}",
                },
            },
            status=status.HTTP_201_CREATED,
        )


class ExternalOrganizationRentalUpdateView(APIView):
    permission_classes = [AllowAny]

    def put(self, request, external_company_id):
        api_key = request.headers.get("X-External-API-Key")
        if api_key != EXTERNAL_API_KEY:
            return Response({"error": "Unauthorized", "detail": "Invalid or missing X-External-API-Key header."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            org = Organization.objects.get(external_company_id=external_company_id)
        except Organization.DoesNotExist:
            return Response({"error": "Not Found", "detail": f"Organization '{external_company_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        sub, _ = OrganizationSubscription.objects.get_or_create(organization=org)
        data = request.data

        if "rent_status" in data:
            sub.rent_status = data["rent_status"]
            org.status = "ACTIVE" if data["rent_status"] == "ACTIVE" else "RENT_EXPIRED"
            org.save()

        if "rent_end_date" in data:
            try:
                sub.rent_end_date = timezone.datetime.fromisoformat(data["rent_end_date"].replace("Z", "+00:00"))
            except ValueError:
                pass

        if "wallet_topup_amount" in data:
            topup = Decimal(str(data["wallet_topup_amount"]))
            sub.wallet_balance += topup

        if "rental_fee" in data:
            sub.rental_fee = Decimal(str(data["rental_fee"]))

        sub.save()

        return Response(
            {
                "status": "success",
                "organization": org.name,
                "subscription": {
                    "rent_status": sub.rent_status,
                    "rent_start_date": sub.rent_start_date,
                    "rent_end_date": sub.rent_end_date,
                    "rental_fee": str(sub.rental_fee),
                    "wallet_balance": str(sub.wallet_balance),
                },
            },
            status=status.HTTP_200_OK,
        )


class ExternalOrganizationUsageReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, external_company_id):
        api_key = request.headers.get("X-External-API-Key")
        if api_key != EXTERNAL_API_KEY:
            return Response({"error": "Unauthorized", "detail": "Invalid or missing X-External-API-Key header."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            org = Organization.objects.get(external_company_id=external_company_id)
        except Organization.DoesNotExist:
            return Response({"error": "Not Found", "detail": f"Organization '{external_company_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        sub = getattr(org, "subscription", None)

        # Aggregated ledger stats
        ledgers = OrganizationUsageLedger.objects.filter(organization=org)
        aggregated = ledgers.aggregate(
            total_emails=Sum("emails_sent"),
            total_sms=Sum("sms_sent"),
            total_whatsapp=Sum("whatsapp_sent"),
            total_posts=Sum("social_posts_published"),
            total_images=Sum("ai_images_generated"),
            total_prompts=Sum("ai_prompts_processed"),
            total_cost=Sum("total_payg_cost_deducted"),
        )

        # Per user breakdown
        users = User.objects.filter(organization=org)
        per_user_data = []

        for user in users:
            logs = UserUsageLedger.objects.filter(organization=org, user=user)
            user_stats = {
                "user_id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "emails_sent": logs.filter(action_type="EMAIL_SENT").aggregate(s=Sum("quantity"))["s"] or 0,
                "sms_sent": logs.filter(action_type="SMS_SENT").aggregate(s=Sum("quantity"))["s"] or 0,
                "whatsapp_sent": logs.filter(action_type="WHATSAPP_SENT").aggregate(s=Sum("quantity"))["s"] or 0,
                "social_posts": logs.filter(action_type="SOCIAL_POST").aggregate(s=Sum("quantity"))["s"] or 0,
                "ai_images": logs.filter(action_type="AI_IMAGE_GEN").aggregate(s=Sum("quantity"))["s"] or 0,
                "ai_prompts": logs.filter(action_type="AI_TEXT_GEN").aggregate(s=Sum("quantity"))["s"] or 0,
                "total_payg_cost": str(logs.aggregate(c=Sum("total_cost"))["c"] or Decimal("0.00")),
            }
            per_user_data.append(user_stats)

        return Response(
            {
                "external_company_id": org.external_company_id,
                "company_name": org.name,
                "rental_info": {
                    "rent_status": sub.rent_status if sub else "N/A",
                    "rent_start_date": sub.rent_start_date if sub else None,
                    "rent_end_date": sub.rent_end_date if sub else None,
                    "rental_fee": str(sub.rental_fee) if sub else "0.00",
                    "wallet_balance": str(sub.wallet_balance) if sub else "0.00",
                },
                "usage_summary": {
                    "emails_sent": aggregated["total_emails"] or 0,
                    "sms_sent": aggregated["total_sms"] or 0,
                    "whatsapp_sent": aggregated["total_whatsapp"] or 0,
                    "social_posts_published": aggregated["total_posts"] or 0,
                    "ai_images_generated": aggregated["total_images"] or 0,
                    "ai_prompts_processed": aggregated["total_prompts"] or 0,
                    "total_payg_cost_deducted": str(aggregated["total_cost"] or Decimal("0.00")),
                },
                "per_user_breakdown": per_user_data,
            },
            status=status.HTTP_200_OK,
        )
