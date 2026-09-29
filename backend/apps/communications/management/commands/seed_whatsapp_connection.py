import getpass
import sys
import requests
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.conf import settings
from apps.communications.models import WhatsAppConnection


class Command(BaseCommand):
    help = "Temporary seeding utility for Meta WhatsApp Cloud API credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--connection-id",
            type=str,
            help="Direct WhatsAppConnection UUID to update",
        )
        parser.add_argument(
            "--org",
            type=str,
            help="Organization User Email or ID",
        )
        parser.add_argument(
            "--phone-number-id",
            type=str,
            help="Meta WhatsApp Phone Number ID",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Automatically confirm update without interactive prompt",
        )

    def handle(self, *args, **options):
        User = get_user_model()

        self.stdout.write(self.style.MIGRATE_HEADING("=== Meta WhatsApp Connection Seeder ==="))

        conn_id_arg = options.get("connection_id")
        existing_by_id = None
        if conn_id_arg:
            existing_by_id = WhatsAppConnection.objects.filter(id=conn_id_arg).first()
            if not existing_by_id:
                raise CommandError(f"WhatsAppConnection with ID '{conn_id_arg}' not found.")

        # 1. Organization & Phone Resolution
        if existing_by_id:
            user = existing_by_id.organization
            phone_number_id = existing_by_id.phone_number_id
            self.stdout.write(self.style.SUCCESS(f"\nTarget Organization: {user.email} (ID: {user.id})"))
            self.stdout.write(self.style.SUCCESS(f"Target Phone Number ID: {phone_number_id}"))
        else:
            org_input = options.get("org")
            if not org_input:
                self.stdout.write("\nExisting users in database:")
                for u in User.objects.all().order_by("id"):
                    role_label = " (Staff/Admin)" if (u.is_staff or u.is_superuser) else ""
                    self.stdout.write(f"  [{u.id}] {u.email}{role_label}")
                org_input = input("\nEnter Organization User ID or Email: ").strip()

            if not org_input:
                raise CommandError("Organization identifier is required.")

            user = None
            if org_input.isdigit():
                user = User.objects.filter(id=int(org_input)).first()
            if not user:
                user = User.objects.filter(email__iexact=org_input).first()

            if not user:
                self.stdout.write(self.style.WARNING(f"User/Organization '{org_input}' was not found in the database."))
                create_choice = input(f"Would you like to create user '{org_input}' now? [y/N]: ").strip().lower()
                if create_choice in ("y", "yes"):
                    user = User.objects.create_user(email=org_input, is_staff=True)
                    self.stdout.write(self.style.SUCCESS(f"Created new user: {user.email} (ID: {user.id})"))
                else:
                    raise CommandError(f"User/Organization '{org_input}' not found.")

            self.stdout.write(self.style.SUCCESS(f"\nTarget Organization: {user.email} (ID: {user.id})"))

            # 2. Phone Number ID
            phone_number_id = options.get("phone_number_id")
            if not phone_number_id:
                phone_number_id = input("\nEnter Meta WhatsApp Phone Number ID: ").strip()

            if not phone_number_id:
                raise CommandError("Phone Number ID is required.")

        # 3. Access Token (Hidden prompt)
        self.stdout.write("\nPlease enter your Meta WhatsApp Cloud API Access Token below.")
        self.stdout.write("Input is masked for security and will never be logged or printed.")
        try:
            raw_token = getpass.getpass("Access Token (hidden): ").strip()
        except Exception:
            # Fallback if running in an environment where getpass is unavailable
            raw_token = input("Access Token (hidden): ").strip()

        if not raw_token:
            raise CommandError("Access Token cannot be empty.")

        # 4. Check Existing Connection
        auto_yes = options.get("yes", False)
        if existing_by_id:
            conn = existing_by_id
            user = conn.organization
            phone_number_id = conn.phone_number_id
            self.stdout.write(
                self.style.WARNING(
                    f"\nTargeting existing connection (UUID: {conn.id}, Org: {user.email} [ID: {user.id}], Phone: {conn.phone_number_id})."
                )
            )
            if not auto_yes:
                confirm = input("Confirm updating this existing connection's access token? [Y/n]: ").strip().lower()
                if confirm in ("n", "no"):
                    self.stdout.write(self.style.NOTICE("Operation aborted by user. Preserved existing connection data."))
                    return
            conn.is_active = True
        else:
            existing_conn = WhatsAppConnection.objects.filter(
                organization=user,
                phone_number_id=phone_number_id,
            ).first()

            if existing_conn:
                self.stdout.write(
                    self.style.WARNING(
                        f"\nAn existing connection for Phone Number ID '{phone_number_id}' "
                        f"under '{user.email}' already exists (UUID: {existing_conn.id}, Active: {existing_conn.is_active})."
                    )
                )
                if not auto_yes:
                    confirm = input("Do you want to update this existing connection? [Y/n]: ").strip().lower()
                    if confirm in ("n", "no"):
                        self.stdout.write(self.style.NOTICE("Operation aborted by user. Preserved existing connection data."))
                        return
                conn = existing_conn
                conn.is_active = True
            else:
                conn = WhatsAppConnection(
                    organization=user,
                    phone_number_id=phone_number_id,
                    is_active=True,
                )

        # 5. Encryption & Persistence
        conn.set_access_token(raw_token)
        conn.save()

        # 6. Integrity Verification
        if conn.encrypted_access_token == raw_token:
            raise CommandError("CRITICAL ERROR: Token was stored in plaintext! Aborting.")

        decrypted = conn.get_access_token()
        if decrypted != raw_token:
            raise CommandError("CRITICAL ERROR: Decryption verification failed. Encrypted data cannot be restored.")

        # Clear raw variable from local memory
        del raw_token
        del decrypted

        # 7. Safe Meta API Verification (Read-Only Check)
        meta_verified = False
        meta_details = "N/A"
        try:
            api_version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")
            meta_url = f"https://graph.facebook.com/{api_version}/{phone_number_id}"
            decrypted_for_api = conn.get_access_token()
            headers = {"Authorization": f"Bearer {decrypted_for_api}"}
            params = {"fields": "verified_name,code_verification_status,display_phone_number,quality_rating"}
            resp = requests.get(meta_url, headers=headers, params=params, timeout=10)
            del decrypted_for_api

            if resp.ok:
                meta_data = resp.json()
                meta_verified = True
                meta_details = f"Verified Name: {meta_data.get('verified_name')}, Phone: {meta_data.get('display_phone_number')}, Quality: {meta_data.get('quality_rating')}"
            else:
                meta_details = f"Meta API responded with HTTP {resp.status_code}"
        except Exception as exc:
            meta_details = f"Meta API check skipped/unavailable ({str(exc)})"

        # 8. Safe Output
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("WhatsApp connection seeded successfully."))
        self.stdout.write("")
        self.stdout.write(f"Organization: {user.email} (ID: {user.id})")
        self.stdout.write(f"Phone Number ID: {conn.phone_number_id}")
        self.stdout.write(f"Connection ID: {conn.id}")
        self.stdout.write(f"Active: {conn.is_active}")
        self.stdout.write(f"Token storage: Encrypted")
        self.stdout.write(f"Token plaintext displayed: No")
        self.stdout.write(f"Decryption test passed: Yes")
        self.stdout.write(f"Meta API Verified: {'Yes (' + meta_details + ')' if meta_verified else 'No (' + meta_details + ')'}")
        self.stdout.write("Real WhatsApp message sent: No (safety guarantee)")
