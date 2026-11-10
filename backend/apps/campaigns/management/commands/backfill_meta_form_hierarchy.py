from django.core.management.base import BaseCommand
from apps.campaigns.models import CustomerRecord, CustomerUpload, Contact
from apps.ads.models import MetaUserCredential, MetaLeadTrigger
from apps.ads.services.meta_ads_service import MetaAdsService
from django.db.models import Q

class Command(BaseCommand):
    help = "Backfills existing Meta leads into dynamic form hierarchy with resolved form names and flattened custom fields."

    def handle(self, *args, **options):
        active_cred = MetaUserCredential.objects.filter(status='ACTIVE').first() or MetaUserCredential.objects.first()
        token = active_cred.access_token if active_cred else ""

        records = CustomerRecord.objects.filter(
            Q(upload__file_type="meta") | Q(data__source="meta")
        )
        self.stdout.write(f"Found {records.count()} Meta customer records to inspect...")

        updated_records = 0
        for rec in records:
            data = dict(rec.data or {})
            form_id = str(data.get("form_id") or "")
            if not form_id:
                continue

            # Resolve real form name
            form_name = None
            trig = MetaLeadTrigger.objects.filter(form_id=form_id).first()
            if trig and trig.form_name and trig.form_name != "All Forms on this Page":
                form_name = trig.form_name

            if not form_name and token:
                try:
                    finfo = MetaAdsService.get_form_info(token, form_id)
                    if finfo.get("name"):
                        form_name = finfo["name"]
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Could not fetch form {form_id} name: {e}"))

            if not form_name:
                form_name = f"Meta Form {form_id}"

            data["form_name"] = form_name

            # Flatten custom_questions
            c_questions = data.get("custom_questions") or {}
            if isinstance(c_questions, dict):
                for qk, qv in c_questions.items():
                    if qk not in data:
                        data[qk] = qv if isinstance(qv, str) else ", ".join(map(str, qv)) if isinstance(qv, list) else str(qv)

            # Flatten field_data
            f_data = data.get("field_data") or []
            if isinstance(f_data, list):
                for fld in f_data:
                    fname = fld.get("name")
                    fvals = fld.get("values") or []
                    if fname and fname not in data and fvals:
                        data[fname] = fvals[0] if len(fvals) == 1 else ", ".join(map(str, fvals))

            # Assign to dedicated CustomerUpload per form
            upload_user = rec.upload.uploaded_by if rec.upload else (active_cred.user if active_cred else None)
            if upload_user:
                form_upload, _ = CustomerUpload.objects.get_or_create(
                    file_name=f"Meta Form: {form_name}",
                    uploaded_by=upload_user,
                    defaults={"file_type": "meta", "status": CustomerUpload.Status.COMPLETED}
                )
                rec.upload = form_upload

            rec.data = data
            rec.save()
            updated_records += 1

            # Update corresponding Contact attributes and sub_source
            email = data.get("email")
            phone = data.get("phone") or data.get("phone_no") or data.get("phone_number")
            name = data.get("name") or data.get("full_name")

            if upload_user and (email or phone):
                contact = None
                if email:
                    contact = Contact.objects.filter(owner=upload_user, email__iexact=email).first()
                if not contact and phone:
                    contact = Contact.objects.filter(owner=upload_user, phone=phone).first()

                custom_attrs = {
                    k: v for k, v in data.items()
                    if k not in ["name", "email", "phone", "phone_no", "source", "_source", "__source__",
                                 "tags", "list", "score", "status", "field_data", "custom_questions"]
                }

                if contact:
                    contact.sub_source_type = "meta_form"
                    contact.sub_source_id = form_id
                    contact.sub_source_name = form_name
                    contact.source = "meta"
                    contact.attributes = {**(contact.attributes or {}), **custom_attrs}
                    contact.save(update_fields=["sub_source_type", "sub_source_id", "sub_source_name", "source", "attributes"])
                else:
                    Contact.objects.create(
                        owner=upload_user,
                        email=email or None,
                        phone=phone or "",
                        name=name or "",
                        source="meta",
                        sub_source_type="meta_form",
                        sub_source_id=form_id,
                        sub_source_name=form_name,
                        attributes=custom_attrs,
                    )

        self.stdout.write(self.style.SUCCESS(f"Successfully migrated {updated_records} records to dynamic Meta Form hierarchy!"))
