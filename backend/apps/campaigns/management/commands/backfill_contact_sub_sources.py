from django.core.management.base import BaseCommand
from apps.campaigns.models import Contact, CustomerRecord


class Command(BaseCommand):
    help = "Backfill sub_source_type, sub_source_id, and sub_source_name for existing Contact rows."

    def handle(self, *args, **options):
        self.stdout.write("Starting Contact sub-source backfill...")

        contacts = Contact.objects.all()
        total = contacts.count()
        updated = 0

        for contact in contacts:
            needs_update = False
            src = contact.source

            if not contact.sub_source_type:
                if src == "form":
                    contact.sub_source_type = "form"
                    contact.sub_source_id = str(contact.attributes.get("__form_id__") or contact.attributes.get("form_id") or "form_general")
                    contact.sub_source_name = str(contact.attributes.get("form_title") or contact.attributes.get("form_name") or "Form Submissions")
                    needs_update = True
                elif src == "meta":
                    contact.sub_source_type = "meta_campaign"
                    contact.sub_source_id = str(contact.attributes.get("campaign_id") or contact.attributes.get("ad_id") or "meta_general")
                    contact.sub_source_name = str(contact.attributes.get("campaign_name") or contact.attributes.get("ad_name") or "Meta Webhooks")
                    needs_update = True
                elif src == "manual":
                    contact.sub_source_type = "manual"
                    contact.sub_source_id = "manual"
                    contact.sub_source_name = "Manual Contacts"
                    needs_update = True
                elif contact.initial_upload:
                    contact.sub_source_type = "file"
                    contact.sub_source_id = str(contact.initial_upload.id)
                    contact.sub_source_name = str(contact.initial_upload.file_name)
                    needs_update = True
                else:
                    contact.sub_source_type = "file"
                    contact.sub_source_id = "general"
                    contact.sub_source_name = "General Contacts"
                    needs_update = True

            if needs_update:
                contact.save(update_fields=["sub_source_type", "sub_source_id", "sub_source_name", "updated_at"])
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Sub-source backfill completed! Total Contacts: {total} | Updated: {updated}")
        )
