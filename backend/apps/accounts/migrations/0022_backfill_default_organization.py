import uuid
from django.db import migrations
from django.utils import timezone

def create_default_organization_and_backfill(apps, schema_editor):
    Organization = apps.get_model("accounts", "Organization")
    OrganizationSubscription = apps.get_model("accounts", "OrganizationSubscription")
    User = apps.get_model("accounts", "User")
    MAUser = apps.get_model("accounts", "MAUser")

    now = timezone.now()
    default_org, created = Organization.objects.get_or_create(
        external_company_id="DEFAULT-ORG",
        defaults={
            "name": "Default Organization",
            "slug": "default-organization",
            "status": "ACTIVE",
        },
    )

    OrganizationSubscription.objects.get_or_create(
        organization=default_org,
        defaults={
            "rent_status": "ACTIVE",
            "rent_start_date": now,
            "rent_end_date": now + timezone.timedelta(days=3650),
            "rental_fee": 0.00,
            "wallet_balance": 1000.00,
            "currency": "USD",
        },
    )

    # Backfill all existing users and ma_users with the default organization
    User.objects.filter(organization__isnull=True).update(organization=default_org)
    MAUser.objects.filter(organization__isnull=True).update(organization=default_org)

def reverse_backfill(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_organization_mauser_organization_user_organization_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_organization_and_backfill, reverse_backfill),
    ]
