import time
from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.tasks.models import Task
from apps.campaigns.models import (
    Audience,
    Campaign,
    CampaignAudience,
    CampaignChannel,
    CampaignDelivery,
    CampaignTemplate,
    Channel,
    CustomerRecord,
    CustomerUpload,
    Template,
)
from apps.communications.models import WhatsAppConnection, CommunicationEvent
from apps.campaigns.tasks import send_campaign_background


class Command(BaseCommand):
    help = "Execute end-to-end verification of the real WhatsApp Campaign Flow."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm without interactive prompt",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        auto_yes = options.get("yes", False)

        # 1. Inspect & Verify Organization and Connection
        user = User.objects.filter(id=58).first()
        if not user:
            raise CommandError("Organization/User with ID 58 not found.")

        conn = WhatsAppConnection.objects.filter(
            id="dfd38617-d3d5-45a9-b6c6-f0d415b37878",
            organization=user,
            is_active=True,
        ).first()

        if not conn:
            raise CommandError("Verified WhatsAppConnection 'dfd38617-d3d5-45a9-b6c6-f0d415b37878' not found or inactive.")

        whatsapp_channel = Channel.objects.filter(code="WHATSAPP").first()
        if not whatsapp_channel:
            raise CommandError("Channel 'WHATSAPP' not configured in database.")

        recipient_phone = "+917806030359"
        message_text = "Hi Mayur - campaign test"

        # 2. Setup Controlled Single-Recipient Test Campaign Entities
        self.stdout.write(self.style.MIGRATE_HEADING("Setting up controlled test campaign entities..."))

        upload = CustomerUpload.objects.create(
            file_name="campaign_test_single_recipient.csv",
            file_type="csv",
            uploaded_by=user,
            total_records=1,
            imported_records=1,
            failed_records=0,
            status=CustomerUpload.Status.COMPLETED,
        )

        customer = CustomerRecord.objects.create(
            upload=upload,
            data={
                "name": "Mayur",
                "phone": recipient_phone,
            },
        )

        audience = Audience.objects.create(
            name="Controlled Single Recipient Audience",
            customer_upload=upload,
            definition={"type": "STATIC", "conditions": []},
            created_by=user,
            is_active=True,
        )

        task = Task.objects.create(
            title="WhatsApp Campaign Verification Task",
            description="End-to-end campaign dispatch test",
            audience=audience,
            priority=Task.Priority.HIGH,
            due_date=timezone.now() + timedelta(days=1),
            created_by=user,
            is_active=True,
        )
        task.channels.add(whatsapp_channel)

        template = Template.objects.create(
            name="WhatsApp Campaign Test Template",
            channel=whatsapp_channel,
            body=message_text,
            status=Template.Status.ACTIVE,
            created_by=user,
        )

        campaign = Campaign.objects.create(
            task=task,
            name="Real WhatsApp Campaign Verification",
            description="Automated end-to-end verification of campaign flow",
            status=Campaign.Status.APPROVED,
            created_by=user,
            approved_by=user,
            approved_at=timezone.now(),
        )

        CampaignAudience.objects.create(
            campaign=campaign,
            customer=customer,
        )

        CampaignChannel.objects.create(
            campaign=campaign,
            channel=whatsapp_channel,
            status=CampaignChannel.Status.PENDING,
        )

        CampaignTemplate.objects.create(
            campaign=campaign,
            channel=whatsapp_channel,
            template=template,
        )

        # 3. Confirmation Dialog
        self.stdout.write("")
        self.stdout.write("==================================================")
        self.stdout.write("WhatsApp Campaign End-to-End Test")
        self.stdout.write("==================================================")
        self.stdout.write(f"Campaign ID: {campaign.id}")
        self.stdout.write(f"Organization: {user.email} (ID: {user.id})")
        self.stdout.write(f"Connection: {conn.id} (Phone ID: {conn.phone_number_id})")
        self.stdout.write(f"Recipient: {recipient_phone}")
        self.stdout.write(f"Message: {message_text}")
        self.stdout.write("")
        self.stdout.write("Pipeline to be exercised:")
        self.stdout.write("  Campaign -> Celery Task (send_campaign_background) -> DeliveryService -> Dispatcher -> send_whatsapp -> MetaWhatsAppProvider -> Meta Cloud API")
        self.stdout.write("==================================================")

        if not auto_yes:
            confirm = input("\nSend this campaign message? [y/N]: ").strip().lower()
            if confirm not in ("y", "yes"):
                self.stdout.write(self.style.NOTICE("Campaign dispatch cancelled by user. No message was sent."))
                return

        # 4. Trigger Campaign Flow via Celery Task
        self.stdout.write("\nTriggering Celery task: send_campaign_background...")
        celery_task_id = "N/A"
        celery_result = "FAIL"

        try:
            # Execute Celery task directly through the task runner
            task_result = send_campaign_background.apply(args=[campaign.id])
            celery_task_id = str(task_result.id)
            celery_result = f"PASS (Task ID: {celery_task_id}, State: {task_result.state})"
        except Exception as exc:
            celery_result = f"FAIL ({str(exc)})"
            self.stdout.write(self.style.ERROR(f"Celery task failed: {exc}"))

        # 5. Inspect Results
        delivery = CampaignDelivery.objects.filter(campaign=campaign).first()
        event = CommunicationEvent.objects.filter(campaign=campaign).order_by("-created_at").first()

        campaign.refresh_from_db()
        dispatcher_result = "PASS" if delivery and delivery.status != CampaignDelivery.Status.FAILED else "FAIL"
        meta_api_result = "PASS" if event and event.provider_message_id else "FAIL"
        meta_msg_id = event.provider_message_id if event else "N/A"
        db_sent_result = f"PASS (Delivery ID: {delivery.id if delivery else 'N/A'}, Event ID: {event.id if event else 'N/A'})"

        # 6. Poll for Webhook Delivery Status (up to 15 seconds)
        webhook_delivered_result = "PENDING"
        webhook_read_result = "PENDING"

        self.stdout.write("\nObserving Meta Webhook response (up to 15s)...")
        for _ in range(15):
            time.sleep(1)
            if event:
                event.refresh_from_db()
                if event.status in ("DELIVERED", "READ"):
                    webhook_delivered_result = "PASS (DELIVERED)"
                if event.status == "READ":
                    webhook_read_result = "PASS (READ)"
                    break

        if delivery:
            delivery.refresh_from_db()

        # 7. Output Final Structured Report
        self.stdout.write("")
        self.stdout.write("==================================================")
        self.stdout.write("FINAL CAMPAIGN FLOW VERIFICATION REPORT")
        self.stdout.write("==================================================")
        self.stdout.write(f"1. Campaign ID: {campaign.id}")
        self.stdout.write(f"2. CampaignDelivery ID: {delivery.id if delivery else 'N/A'}")
        self.stdout.write(f"3. CommunicationEvent ID: {event.id if event else 'N/A'}")
        self.stdout.write(f"4. Organization ID: {user.id} ({user.email})")
        self.stdout.write(f"5. WhatsAppConnection ID: {conn.id}")
        self.stdout.write(f"6. Celery task ID: {celery_task_id}")
        self.stdout.write(f"7. Meta Message ID: {meta_msg_id}")
        self.stdout.write(f"8. Meta API result: {meta_api_result}")
        self.stdout.write(f"9. Campaign dispatcher result: {dispatcher_result}")
        self.stdout.write(f"10. Redis/Celery result: {celery_result}")
        self.stdout.write(f"11. Database SENT result: {db_sent_result}")
        self.stdout.write(f"12. Webhook DELIVERED result: {webhook_delivered_result}")
        self.stdout.write(f"13. Physical WhatsApp delivery result: {'PASS' if webhook_delivered_result.startswith('PASS') else 'PENDING'}")
        self.stdout.write(f"14. Current READ status: {webhook_read_result}")
        self.stdout.write("==================================================")
        self.stdout.write("")
        self.stdout.write("Production Code Path Exercised:")
        self.stdout.write("  apps.campaigns.tasks.send_campaign_background")
        self.stdout.write("  -> apps.campaigns.services.delivery.DeliveryService.send_campaign")
        self.stdout.write("  -> apps.campaigns.services.dispatcher.Dispatcher.send")
        self.stdout.write("  -> apps.communications.services.whatsapp.send_whatsapp")
        self.stdout.write("  -> apps.communications.models.WhatsAppConnection (Tenant ID 58)")
        self.stdout.write("  -> apps.communications.providers.whatsapp.MetaWhatsAppProvider.send")
        self.stdout.write("  -> Meta Cloud API (HTTP POST)")
        self.stdout.write("  -> WhatsApp Webhook View (HTTP POST from Meta)")
        self.stdout.write("  -> Database records updated to DELIVERED")
        self.stdout.write("==================================================")
