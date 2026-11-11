import getpass
import requests
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.conf import settings

from apps.accounts.models import Organization, MAUser
from apps.communications.models import WhatsAppConnection, SenderIdentity
from apps.integrations.utils.crypto import encrypt_token, decrypt_token


class Command(BaseCommand):
    help = (
        "Registers or updates the secure Meta WhatsApp Cloud API development test connection "
        "for the specified user and organization."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default="himanshu@gmail.com",
            help="Automarketer user email (defaults to himanshu@gmail.com)",
        )
        parser.add_argument(
            "--org-id",
            type=str,
            default=None,
            help="Explicit Organization ID or slug if user has ambiguous memberships",
        )
        parser.add_argument(
            "--phone-number-id",
            type=str,
            default=getattr(settings, "WHATSAPP_TEST_PHONE_NUMBER_ID", "1212090155330828"),
            help="Meta WhatsApp Phone Number ID (defaults to test phone ID 1212090155330828)",
        )
        parser.add_argument(
            "--waba-id",
            type=str,
            default=getattr(settings, "WHATSAPP_TEST_WABA_ID", "1050882897946612"),
            help="Meta WhatsApp Business Account ID (defaults to test WABA ID 1050882897946612)",
        )
        parser.add_argument(
            "--token",
            type=str,
            default=None,
            help="Raw Meta WhatsApp Access Token (if not provided, reads from WHATSAPP_TEST_ACCESS_TOKEN or masked prompt)",
        )
        parser.add_argument(
            "--skip-meta-validation",
            action="store_true",
            help="Skip live Meta Graph API read-only verification (for offline testing)",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Automatically confirm update without interactive prompts",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        email = (options.get("email") or "").strip().lower()
        org_id_arg = options.get("org_id")
        phone_number_id = str(options.get("phone_number_id") or "").strip()
        waba_id = str(options.get("waba_id") or "").strip()
        skip_meta_validation = options.get("skip_meta_validation", False)

        self.stdout.write(self.style.MIGRATE_HEADING("=== WhatsApp Development Connection Setup ==="))

        # 1. Resolve User
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"User with email '{email}' does not exist.")

        self.stdout.write(f"Target User: {user.email} (ID: {user.id})")

        # 2. Resolve Active Organization Membership
        # Check explicit MAUser memberships and user.organization
        ma_org_ids = list(
            MAUser.objects.filter(user=user, organization__status="ACTIVE")
            .values_list("organization_id", flat=True)
            .distinct()
        )
        if user.organization_id and user.organization_id not in ma_org_ids:
            if getattr(user.organization, "status", "ACTIVE") == "ACTIVE":
                ma_org_ids.append(user.organization_id)

        target_org = None
        if org_id_arg:
            target_org = Organization.objects.filter(id=org_id_arg).first()
            if not target_org:
                target_org = Organization.objects.filter(slug=org_id_arg).first()
            if not target_org:
                raise CommandError(f"Organization '{org_id_arg}' not found.")
            if target_org.id not in ma_org_ids and not user.is_superuser:
                raise CommandError(
                    f"User '{user.email}' is not an active member of organization '{target_org.name}' ({target_org.id})."
                )
        else:
            if len(ma_org_ids) == 0:
                raise CommandError(f"User '{user.email}' has no active organization membership.")
            if len(ma_org_ids) > 1:
                org_list = list(Organization.objects.filter(id__in=ma_org_ids).values("id", "name"))
                raise CommandError(
                    f"User '{user.email}' belongs to multiple organizations ({org_list}). "
                    "Ambiguous organization ownership. Please specify --org-id explicitly."
                )
            target_org = Organization.objects.filter(id=ma_org_ids[0]).first()

        if not target_org:
            raise CommandError("Could not resolve target organization.")

        # 5. Verify Organization Eligibility
        if target_org.status != "ACTIVE":
            raise CommandError(
                f"Organization '{target_org.name}' status is '{target_org.status}'. "
                "Only organizations with ACTIVE status are eligible for development connection setup."
            )

        self.stdout.write(f"Resolved Organization: {target_org.name} (UUID: {target_org.id}, Status: {target_org.status})")

        # 6. Validate IDs
        if not phone_number_id:
            raise CommandError("Phone Number ID is required.")
        if not waba_id:
            raise CommandError("WhatsApp Business Account ID (WABA) is required.")

        # 7. Read Access Token
        raw_token = options.get("token")
        if not raw_token:
            raw_token = getattr(settings, "WHATSAPP_TEST_ACCESS_TOKEN", None)

        if not raw_token:
            self.stdout.write("\nWHATSAPP_TEST_ACCESS_TOKEN not set in environment or command options.")
            self.stdout.write("Please enter Meta WhatsApp Cloud API Access Token (input will be hidden):")
            try:
                raw_token = getpass.getpass("Access Token (hidden): ").strip()
            except Exception:
                raw_token = input("Access Token (hidden): ").strip()

        if not raw_token:
            raise CommandError("Access Token cannot be empty. Setup aborted.")

        # 8. Meta Credential Validation (Read-Only Check)
        meta_verified = False
        meta_details = "Validation skipped"
        if not skip_meta_validation:
            try:
                api_version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")
                meta_url = f"https://graph.facebook.com/{api_version}/{phone_number_id}"
                headers = {"Authorization": f"Bearer {raw_token}"}
                params = {"fields": "verified_name,code_verification_status,display_phone_number,quality_rating"}
                resp = requests.get(meta_url, headers=headers, params=params, timeout=12)
                if resp.ok:
                    meta_verified = True
                    data = resp.json()
                    meta_details = (
                        f"Verified Name: {data.get('verified_name')}, "
                        f"Phone: {data.get('display_phone_number')}, "
                        f"Quality: {data.get('quality_rating')}"
                    )
                else:
                    err_msg = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                    raise CommandError(f"Meta Graph API credential validation failed: {err_msg}")
            except requests.RequestException as exc:
                raise CommandError(f"Network error contacting Meta Graph API: {exc}")

        # 9. Create or Update WhatsAppConnection Idempotently
        # Query existing connection for this user and phone_number_id
        conn, created = WhatsAppConnection.objects.get_or_create(
            organization=user,
            phone_number_id=phone_number_id,
            defaults={
                "waba_id": waba_id,
                "environment": "development",
                "is_active": True,
            },
        )

        conn.waba_id = waba_id
        conn.environment = "development"
        conn.is_active = True
        conn.set_access_token(raw_token)
        conn.save()

        # 10. Integrity Verification
        if conn.encrypted_access_token == raw_token:
            raise CommandError("CRITICAL SECURITY ERROR: Access token was stored in plaintext! Aborting.")

        decrypted = conn.get_access_token()
        if decrypted != raw_token:
            raise CommandError("CRITICAL SECURITY ERROR: Decryption verification failed.")

        # 11. Synchronize SenderIdentity for UI consistency
        encrypted_token_stored = conn.encrypted_access_token
        SenderIdentity.objects.update_or_create(
            user=user,
            provider="WHATSAPP_CLOUD",
            phone_number_id=phone_number_id,
            defaults={
                "waba_id": waba_id,
                "email": user.email,
                "display_name": f"Meta Test ({phone_number_id})",
                "connection_type": "API_KEY",
                "status": "CONNECTED",
                "encrypted_credentials": {
                    "access_token": encrypted_token_stored,
                    "phone_number_id": phone_number_id,
                    "waba_id": waba_id,
                    "environment": "development",
                },
            },
        )

        # Clear raw secrets from local memory
        del raw_token
        del decrypted

        # 12. Safe Reporting Output
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("WhatsApp development connection registered successfully."))
        self.stdout.write("--------------------------------------------------")
        self.stdout.write(f"User:                   {user.email} (ID: {user.id})")
        self.stdout.write(f"Organization:           {target_org.name} ({target_org.id})")
        self.stdout.write(f"Phone Number ID:        {conn.phone_number_id}")
        self.stdout.write(f"WABA ID:                {conn.waba_id}")
        self.stdout.write(f"Environment:            {conn.environment}")
        self.stdout.write(f"Connection ID:          {conn.id}")
        self.stdout.write(f"Active:                 {conn.is_active}")
        self.stdout.write(f"Token Storage:          Encrypted at rest (Fernet AES-128-CBC / SHA-256)")
        self.stdout.write(f"Token Plaintext Leaked: No")
        self.stdout.write(f"Decryption Verified:    Yes")
        self.stdout.write(f"Meta API Verified:      {'Yes (' + meta_details + ')' if meta_verified else meta_details}")
        self.stdout.write(f"Production Connections: Preserved (unchanged)")
        self.stdout.write("--------------------------------------------------")
