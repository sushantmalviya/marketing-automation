from django.core.management.base import BaseCommand
from apps.campaigns.models import CustomerRecord
from apps.campaigns.services import ContactService


class Command(BaseCommand):
    help = "Migrate legacy CustomerRecord JSON data into unified Contact profiles."

    def handle(self, *args, **options):
        self.stdout.write("Starting legacy CustomerRecord to Contact migration...")
        
        records = CustomerRecord.objects.select_related("upload", "upload__uploaded_by").all()
        total_records = records.count()
        created_count = 0
        updated_count = 0
        skipped_count = 0

        self.stdout.write(f"Found {total_records} legacy CustomerRecord entries to process.")

        for record in records:
            owner = record.upload.uploaded_by if record.upload else None
            if not owner:
                skipped_count += 1
                continue

            payload = record.data or {}
            src = payload.get("_source") or payload.get("__source__") or payload.get("source") or "imported"

            try:
                contact, created = ContactService.upsert_contact(
                    owner=owner,
                    payload=payload,
                    default_source=src,
                    initial_upload=record.upload,
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            except Exception as e:
                skipped_count += 1
                self.stderr.write(f"Error processing record {record.id}: {e}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Migration completed! Total Processed: {total_records} | "
                f"Contacts Created: {created_count} | Contacts Updated: {updated_count} | "
                f"Skipped/Errors: {skipped_count}"
            )
        )
