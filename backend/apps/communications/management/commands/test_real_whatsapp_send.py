import sys
import time
import requests
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.conf import settings
from apps.communications.models import WhatsAppConnection, CommunicationEvent, SenderIdentity
from apps.communications.services.whatsapp import send_whatsapp


class Command(BaseCommand):
    help = "Diagnostic and end-to-end verification command for Meta WhatsApp Cloud API."

    def add_arguments(self, parser):
        parser.add_argument(
            "--connection-id",
            type=str,
            default=None,
            help="WhatsAppConnection ID",
        )
        parser.add_argument(
            "--org",
            type=str,
            default="himanshu@gmail.com",
            help="Organization User Email or ID (defaults to himanshu@gmail.com)",
        )
        parser.add_argument(
            "--environment",
            type=str,
            default=None,
            help="Filter connection by environment ('development' or 'production')",
        )
        parser.add_argument(
            "--template",
            type=str,
            default=None,
            help="Use pre-approved template name (e.g. 'hello_world') instead of freeform text",
        )
        parser.add_argument(
            "--recipient",
            type=str,
            default="+917806030359",
            help="Recipient phone number",
        )
        parser.add_argument(
            "--message",
            type=str,
            default="Hi Mayur",
            help="Message body",
        )
        parser.add_argument(
            "--diagnose-only",
            action="store_true",
            help="Run safe configuration, credential, and 24-hr window checks without sending a message",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm send without interactive prompt",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        conn_id = options.get("connection_id")
        org_arg = options.get("org")
        recipient = options.get("recipient")
        message_body = options.get("message")
        diagnose_only = options.get("diagnose_only", False)
        auto_yes = options.get("yes", False)

        # 1. Resolve Connection
        conn = None
        if conn_id:
            conn = WhatsAppConnection.objects.filter(id=conn_id).first()
            if not conn:
                raise CommandError(f"WhatsAppConnection '{conn_id}' not found.")
        elif org_arg:
            user = None
            if org_arg.isdigit():
                user = User.objects.filter(id=int(org_arg)).first()
            if not user:
                user = User.objects.filter(email__iexact=org_arg).first()
            if not user and "@" in org_arg:
                prefix = org_arg.split("@")[0]
                user = User.objects.filter(email__istartswith=prefix).first()

            if user:
                qs = WhatsAppConnection.objects.filter(organization=user, is_active=True)
                env_arg = options.get("environment")
                if env_arg:
                    qs = qs.filter(environment=env_arg)
                conn = qs.order_by("-updated_at").first()
            else:
                raise CommandError(f"User/Organization '{org_arg}' not found.")

        if not conn:
            qs = WhatsAppConnection.objects.filter(is_active=True)
            env_arg = options.get("environment")
            if env_arg:
                qs = qs.filter(environment=env_arg)
            conn = qs.order_by("-updated_at", "-created_at").first()

        if not conn:
            raise CommandError("No active WhatsAppConnection found.")

        if not conn.is_active:
            raise CommandError("Connection is not active (is_active=False).")

        # 2. Safe Decryption Check
        try:
            token = conn.get_access_token()
            token_valid = bool(token)
        except Exception as e:
            raise CommandError(f"Failed to decrypt access token: {e}")

        # Clean recipient
        clean_recipient = str(recipient).strip().replace(" ", "").replace("-", "")
        if clean_recipient.startswith("+"):
            clean_recipient = clean_recipient[1:]
        if len(clean_recipient) == 10 and clean_recipient[0] in "6789":
            clean_recipient = "91" + clean_recipient

        # 3. Safe Diagnostic Info (Meta Graph API read-only checks)
        api_version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")
        meta_phone_data = {}
        meta_waba_data = {}
        templates_count = 0
        try:
            headers = {"Authorization": f"Bearer {token}"}
            phone_url = f"https://graph.facebook.com/{api_version}/{conn.phone_number_id}"
            p_resp = requests.get(phone_url, headers=headers, params={"fields": "id,display_phone_number,verified_name,quality_rating,code_verification_status,status"}, timeout=10)
            if p_resp.ok:
                meta_phone_data = p_resp.json()

            # Find matching SenderIdentity if any for WABA
            si = SenderIdentity.objects.filter(user=conn.organization, provider="WHATSAPP_CLOUD").first()
            if si and si.waba_id:
                w_resp = requests.get(f"https://graph.facebook.com/{api_version}/{si.waba_id}", headers=headers, timeout=10)
                if w_resp.ok:
                    meta_waba_data = w_resp.json()
                t_resp = requests.get(f"https://graph.facebook.com/{api_version}/{si.waba_id}/message_templates", headers=headers, timeout=10)
                if t_resp.ok:
                    templates_count = len(t_resp.json().get("data", []))
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"Diagnostic Meta API check warning: {exc}"))

        # Check 24-hr Customer Service Window
        last_inbound = CommunicationEvent.objects.filter(
            recipient__in=[clean_recipient, f"+{clean_recipient}", recipient],
            channel="WHATSAPP",
            status="RECEIVED",
        ).order_by("-created_at").first()

        window_open = False
        window_status_str = "No inbound messages recorded"
        if last_inbound:
            from django.utils import timezone
            import datetime
            time_since = timezone.now() - last_inbound.created_at
            if time_since < datetime.timedelta(hours=24):
                window_open = True
                window_status_str = f"OPEN (Last inbound: {last_inbound.created_at.isoformat()}, {time_since.total_seconds() / 3600:.1f}h ago)"
            else:
                window_open = False
                window_status_str = f"EXPIRED (Last inbound: {last_inbound.created_at.isoformat()}, {time_since.total_seconds() / 3600:.1f}h ago)"

        # 4. Display safety confirmation and diagnostic report
        self.stdout.write("==================================================")
        self.stdout.write("WhatsApp Diagnostic Check")
        self.stdout.write("==================================================")
        self.stdout.write(f"Organization: {conn.organization.email} (ID: {conn.organization_id})")
        self.stdout.write(f"Connection ID: {conn.id}")
        self.stdout.write(f"Phone Number ID: {conn.phone_number_id}")
        self.stdout.write(f"Display Phone Number: {meta_phone_data.get('display_phone_number', 'N/A')}")
        self.stdout.write(f"Verified Name: {meta_phone_data.get('verified_name', 'N/A')}")
        self.stdout.write(f"Meta Status: {meta_phone_data.get('status', 'N/A')}")
        self.stdout.write(f"Code Verification Status: {meta_phone_data.get('code_verification_status', 'N/A')}")
        self.stdout.write(f"WABA Name: {meta_waba_data.get('name', 'N/A')}")
        self.stdout.write(f"Approved Templates Count: {templates_count}")
        self.stdout.write(f"Recipient: +{clean_recipient}")
        self.stdout.write(f"24-Hour Customer Window: {window_status_str}")
        self.stdout.write(f"Message: {message_body}")
        self.stdout.write("==================================================")

        if diagnose_only:
            self.stdout.write(self.style.SUCCESS("\nDiagnostic completed. No message was sent (diagnose-only mode)."))
            return

        if not auto_yes:
            confirm = input("\nSend this message? [y/N]: ").strip().lower()
            if confirm not in ("y", "yes"):
                self.stdout.write(self.style.NOTICE("Test cancelled by user. No message was sent."))
                return

        # 5. Execution via existing production send service
        self.stdout.write("\nSubmitting message to Meta WhatsApp Cloud API...")
        meta_api_status = "FAIL"
        meta_msg_id = "N/A"
        meta_accepted = "NO"
        db_tracking = "FAIL"
        delivery_status = "NOT RECEIVED"
        read_status = "NOT RECEIVED"
        error_detail = None

        try:
            config = {}
            template_arg = options.get("template")
            if template_arg:
                config["metadata"] = {
                    "type": "template",
                    "template": {
                        "name": template_arg,
                        "language": {"code": "en_US"},
                    },
                }

            # send_whatsapp creates the CommunicationEvent record and calls MetaWhatsAppProvider
            msg_id = send_whatsapp(
                to=recipient,
                message=message_body,
                config=config,
                organization=conn.organization,
                connection=conn,
            )
            meta_msg_id = str(msg_id)
            meta_api_status = "PASS"
            meta_accepted = "YES"

            # Check database CommunicationEvent record
            event = CommunicationEvent.objects.filter(
                provider_message_id=meta_msg_id,
                channel="WHATSAPP",
            ).order_by("-created_at").first()

            if event:
                db_tracking = f"PASS (Event ID: {event.id}, Status: {event.status})"
            else:
                db_tracking = "FAIL (No event record created)"

            # Poll briefly (up to 3 seconds) for any immediate incoming webhook updates
            self.stdout.write("Checking for delivery updates (3s)...")
            for _ in range(3):
                time.sleep(1)
                event.refresh_from_db()
                if event.status in ("DELIVERED", "READ"):
                    delivery_status = "PASS"
                if event.status == "READ":
                    read_status = "PASS"
                    break

            if delivery_status != "PASS":
                delivery_status = "PENDING"
            if read_status != "PASS":
                read_status = "PENDING"

        except Exception as exc:
            err_str = str(exc)
            error_detail = err_str
            if "131047" in err_str or "template" in err_str.lower() or "outside the allowed window" in err_str.lower():
                self.stdout.write(
                    self.style.ERROR(
                        "\nMessage was not sent because Meta requires an approved WhatsApp template for this recipient/message context."
                    )
                )
            else:
                self.stdout.write(self.style.ERROR(f"\nMeta API Error: {err_str}"))

        # 4. Final structured report
        self.stdout.write("")
        self.stdout.write("==================================================")
        self.stdout.write("REAL WHATSAPP TEST")
        self.stdout.write("==================================================")
        self.stdout.write(f"Connection:\n{conn.id}")
        self.stdout.write("")
        self.stdout.write(f"Recipient:\n+91 7806030359")
        self.stdout.write("")
        self.stdout.write(f"Message:\n{message_body}")
        self.stdout.write("")
        self.stdout.write(f"Meta API:\n{meta_api_status}")
        self.stdout.write("")
        self.stdout.write(f"Meta Message ID:\n{meta_msg_id}")
        self.stdout.write("")
        self.stdout.write(f"Message accepted by Meta:\n{meta_accepted}")
        self.stdout.write("")
        self.stdout.write(f"Delivery webhook:\n{delivery_status}")
        self.stdout.write("")
        self.stdout.write(f"Read webhook:\n{read_status}")
        self.stdout.write("")
        self.stdout.write(f"Database tracking:\n{db_tracking}")
        if error_detail and meta_accepted == "NO":
            self.stdout.write("")
            self.stdout.write(f"Detail:\n{error_detail}")
        self.stdout.write("==================================================")
