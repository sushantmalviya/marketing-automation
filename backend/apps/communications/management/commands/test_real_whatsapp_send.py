import sys
import time
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from apps.communications.models import WhatsAppConnection, CommunicationEvent
from apps.communications.services.whatsapp import send_whatsapp


class Command(BaseCommand):
    help = "Temporary end-to-end test command for sending exactly one WhatsApp message via existing verified connection."

    def add_arguments(self, parser):
        parser.add_argument(
            "--connection-id",
            type=str,
            default="dfd38617-d3d5-45a9-b6c6-f0d415b37878",
            help="WhatsAppConnection ID",
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
            "--yes",
            action="store_true",
            help="Confirm send without interactive prompt",
        )

    def handle(self, *args, **options):
        conn_id = options.get("connection_id")
        recipient = options.get("recipient")
        message_body = options.get("message")
        auto_yes = options.get("yes", False)

        # 1. Inspect & verify connection
        conn = WhatsAppConnection.objects.filter(id=conn_id).first()
        if not conn:
            raise CommandError(f"WhatsAppConnection '{conn_id}' not found.")

        if conn.organization_id != 58:
            raise CommandError(f"Connection organization mismatch: expected 58, got {conn.organization_id}")

        if conn.phone_number_id != "1390483030803930":
            raise CommandError(f"Connection phone_number_id mismatch: expected 1390483030803930, got {conn.phone_number_id}")

        if not conn.is_active:
            raise CommandError("Connection is not active (is_active=False).")

        # 2. Display safety confirmation
        self.stdout.write("==================================================")
        self.stdout.write("WhatsApp Test")
        self.stdout.write("")
        self.stdout.write(f"Connection:\n{conn.id}")
        self.stdout.write("")
        self.stdout.write(f"Phone Number ID:\n{conn.phone_number_id}")
        self.stdout.write("")
        self.stdout.write(f"Recipient:\n+91 7806030359")
        self.stdout.write("")
        self.stdout.write(f"Message:\n{message_body}")
        self.stdout.write("")
        self.stdout.write("This test will send EXACTLY ONE WhatsApp message.")
        self.stdout.write("==================================================")

        if not auto_yes:
            confirm = input("\nSend this message? [y/N]: ").strip().lower()
            if confirm not in ("y", "yes"):
                self.stdout.write(self.style.NOTICE("Test cancelled by user. No message was sent."))
                return

        # 3. Execution via existing production send service
        self.stdout.write("\nSubmitting message to Meta WhatsApp Cloud API...")
        meta_api_status = "FAIL"
        meta_msg_id = "N/A"
        meta_accepted = "NO"
        db_tracking = "FAIL"
        delivery_status = "NOT RECEIVED"
        read_status = "NOT RECEIVED"
        error_detail = None

        try:
            # send_whatsapp creates the CommunicationEvent record and calls MetaWhatsAppProvider
            msg_id = send_whatsapp(
                to=recipient,
                message=message_body,
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
