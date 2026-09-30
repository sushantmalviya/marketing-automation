import re
from django.db import transaction
from apps.campaigns.models import Contact


class ContactService:

    CANONICAL_EMAIL_KEYS = {"email", "email_address", "email address", "mail"}
    CANONICAL_PHONE_KEYS = {
        "phone", "phone_no", "phone no", "phone_number", "phone number",
        "mobile", "mobile_no", "mobile no", "mobile_number", "mobile number",
        "number", "contact", "contact_number", "contact number", "cell", "telephone"
    }
    CANONICAL_NAME_KEYS = {"name", "full_name", "full name", "customer_name", "customer name"}
    CANONICAL_FIRST_NAME_KEYS = {"first_name", "first name"}
    CANONICAL_LAST_NAME_KEYS = {"last_name", "last name"}

    ALL_CANONICAL_KEYS = (
        CANONICAL_EMAIL_KEYS
        | CANONICAL_PHONE_KEYS
        | CANONICAL_NAME_KEYS
        | CANONICAL_FIRST_NAME_KEYS
        | CANONICAL_LAST_NAME_KEYS
        | {
            "status", "score", "tags", "_source", "__source__", "source",
            "__col_order__", "routing_logs", "__submission_id__", "__form_id__"
        }
    )

    @staticmethod
    def normalize_email(email_str: str) -> str:
        if not email_str:
            return ""
        return str(email_str).strip().lower()

    @staticmethod
    def normalize_phone(phone_str: str) -> str:
        if not phone_str:
            return ""
        p = str(phone_str).strip()
        # Keep leading + if present, strip dashes, spaces, brackets
        has_plus = p.startswith("+")
        digits = re.sub(r"[^\d]", "", p)
        return f"+{digits}" if has_plus and digits else digits

    @staticmethod
    def split_name(full_name: str) -> tuple[str, str]:
        if not full_name:
            return ("", "")
        parts = str(full_name).strip().split()
        if not parts:
            return ("", "")
        if len(parts) == 1:
            return (parts[0], "")
        return (parts[0], " ".join(parts[1:]))

    @classmethod
    def extract_canonical_and_attributes(cls, payload: dict) -> dict:
        """
        Parses raw dict payload, extracts canonical contact fields,
        and collects remaining unmapped keys into an attributes dict.
        """
        email = ""
        phone = ""
        full_name = ""
        first_name = ""
        last_name = ""
        status = "Active"
        score = 50
        tags = []
        source = ""
        attributes = {}

        from apps.campaigns.utils import SmartColumnResolver

        for raw_key, value in payload.items():
            if value is None:
                continue
            k_clean = str(raw_key).strip().lower()
            val_str = str(value).strip() if not isinstance(value, (list, dict, int, float, bool)) else value

            if k_clean in ("__col_order__", "routing_logs"):
                continue

            resolved_key = SmartColumnResolver.resolve_header(raw_key, [value] if value else None)

            if k_clean in cls.CANONICAL_EMAIL_KEYS or resolved_key == "email":
                if not email:
                    email = cls.normalize_email(str(value))
            elif k_clean in cls.CANONICAL_PHONE_KEYS or resolved_key == "phone":
                if not phone:
                    phone = cls.normalize_phone(str(value))
            elif k_clean in cls.CANONICAL_NAME_KEYS or resolved_key == "name":
                if not full_name:
                    full_name = str(value).strip()
            elif k_clean in cls.CANONICAL_FIRST_NAME_KEYS:
                if not first_name:
                    first_name = str(value).strip()
            elif k_clean in cls.CANONICAL_LAST_NAME_KEYS:
                if not last_name:
                    last_name = str(value).strip()
            elif k_clean == "status":
                if val_str:
                    status = str(value).strip()
            elif k_clean == "score":
                if value is not None:
                    try:
                        score = int(value)
                    except (ValueError, TypeError):
                        pass
            elif k_clean == "tags":
                if isinstance(value, list):
                    tags = [str(t).strip() for t in value if str(t).strip()]
                elif isinstance(value, str) and value.strip():
                    tags = [t.strip() for t in value.split(",") if t.strip()]
            elif k_clean in ("_source", "__source__", "source"):
                if not source:
                    source = str(value).strip().lower()
            elif not str(raw_key).startswith("__") and not str(raw_key).startswith("_"):
                if k_clean not in cls.ALL_CANONICAL_KEYS and resolved_key not in ("email", "phone", "name"):
                    attributes[raw_key] = value

        if full_name and not (first_name or last_name):
            first_name, last_name = cls.split_name(full_name)
        elif (first_name or last_name) and not full_name:
            full_name = f"{first_name} {last_name}".strip()

        # Clean attributes dict of any canonical keys
        clean_attributes = {
            k: v for k, v in attributes.items()
            if str(k).strip().lower() not in cls.ALL_CANONICAL_KEYS
        }

        return {
            "email": email,
            "phone": phone,
            "name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "status": status,
            "score": score,
            "tags": tags,
            "source": source,
            "attributes": clean_attributes,
        }

    @classmethod
    @transaction.atomic
    def upsert_contact(
        cls,
        *,
        owner,
        payload: dict,
        default_source: str = Contact.Source.MANUAL,
        initial_upload=None,
        sub_source_type: str = "",
        sub_source_id: str = "",
        sub_source_name: str = "",
    ) -> tuple[Contact, bool]:
        """
        Upserts a single Contact record per owner matching by email or phone.
        Returns (contact_instance, created_bool).
        """
        extracted = cls.extract_canonical_and_attributes(payload)
        email = extracted["email"] or None
        phone = extracted["phone"]

        if not email and not phone:
            raise ValueError("Contact must have either an email or phone number.")

        source = extracted["source"] or default_source

        # Infer sub-source fields if underspecified
        if not sub_source_type:
            if source == "form" or "__form_id__" in payload or "form_id" in payload:
                sub_source_type = "form"
                sub_source_id = str(payload.get("__form_id__") or payload.get("form_id") or "")
                sub_source_name = str(payload.get("form_title") or payload.get("form_name") or (f"Form {sub_source_id}" if sub_source_id else "Form Lead"))
            elif source == "meta" or "campaign_id" in payload:
                sub_source_type = "meta_campaign"
                sub_source_id = str(payload.get("campaign_id") or payload.get("ad_id") or "meta_campaign")
                sub_source_name = str(payload.get("campaign_name") or payload.get("ad_name") or "Meta Lead Campaign")
            elif source == "manual" or default_source == "manual":
                sub_source_type = "manual"
                sub_source_id = "manual"
                sub_source_name = "Manual Contacts"
            elif initial_upload:
                sub_source_type = "file"
                sub_source_id = str(initial_upload.id)
                sub_source_name = str(initial_upload.file_name)
            else:
                sub_source_type = "file"
                sub_source_id = "general"
                sub_source_name = "General Contacts"

        # Lookup existing contact by owner & email (or phone if email absent)
        contact = None
        if email:
            contact = Contact.objects.filter(owner=owner, email__iexact=email).first()
        if not contact and phone:
            contact = Contact.objects.filter(owner=owner, phone=phone).first()

        created = False
        if not contact:
            contact = Contact.objects.create(
                owner=owner,
                email=email,
                phone=phone,
                name=extracted["name"],
                first_name=extracted["first_name"],
                last_name=extracted["last_name"],
                source=source,
                sub_source_type=sub_source_type,
                sub_source_id=sub_source_id,
                sub_source_name=sub_source_name,
                status=extracted["status"] or Contact.Status.ACTIVE,
                score=extracted["score"],
                tags=extracted["tags"],
                attributes=extracted["attributes"],
                initial_upload=initial_upload,
            )
            created = True
        else:
            # Update existing contact safely
            updated_fields = []

            if not contact.phone and phone:
                contact.phone = phone
                updated_fields.append("phone")
            if not contact.name and extracted["name"]:
                contact.name = extracted["name"]
                contact.first_name = extracted["first_name"]
                contact.last_name = extracted["last_name"]
                updated_fields.extend(["name", "first_name", "last_name"])

            if sub_source_type and not contact.sub_source_type:
                contact.sub_source_type = sub_source_type
                contact.sub_source_id = sub_source_id
                contact.sub_source_name = sub_source_name
                updated_fields.extend(["sub_source_type", "sub_source_id", "sub_source_name"])

            # Merge tags
            if extracted["tags"]:
                existing_tags = set(contact.tags or [])
                new_tags = set(extracted["tags"])
                merged_tags = sorted(list(existing_tags.union(new_tags)))
                if merged_tags != contact.tags:
                    contact.tags = merged_tags
                    updated_fields.append("tags")

            # Merge attributes
            if extracted["attributes"]:
                merged_attrs = {**(contact.attributes or {}), **extracted["attributes"]}
                if merged_attrs != contact.attributes:
                    contact.attributes = merged_attrs
                    updated_fields.append("attributes")

            if updated_fields:
                contact.save(update_fields=updated_fields + ["updated_at"])

        return contact, created

    @classmethod
    @transaction.atomic
    def bulk_upsert_contacts(
        cls,
        *,
        owner,
        rows: list[dict],
        default_source: str = Contact.Source.IMPORT,
        initial_upload=None,
        sub_source_type: str = "file",
        sub_source_id: str = "",
        sub_source_name: str = "",
    ) -> int:
        if not rows:
            return 0

        sub_id = sub_source_id or (str(initial_upload.id) if initial_upload else "general")
        sub_name = sub_source_name or (initial_upload.file_name if initial_upload else "Imported File")

        existing_contacts = list(Contact.objects.filter(owner=owner))
        email_map = {c.email.lower(): c for c in existing_contacts if c.email}
        phone_map = {c.phone: c for c in existing_contacts if c.phone}

        to_create = []
        to_update = []

        for row_dict in rows:
            extracted = cls.extract_canonical_and_attributes(row_dict)
            email = extracted["email"] or None
            phone = extracted["phone"]
            if not email and not phone:
                continue

            contact = (email_map.get(email.lower()) if email else None) or (phone_map.get(phone) if phone else None)

            if not contact:
                c = Contact(
                    owner=owner,
                    email=email,
                    phone=phone,
                    name=extracted["name"],
                    first_name=extracted["first_name"],
                    last_name=extracted["last_name"],
                    source=extracted["source"] or default_source,
                    sub_source_type=sub_source_type,
                    sub_source_id=sub_id,
                    sub_source_name=sub_name,
                    status=extracted["status"] or Contact.Status.ACTIVE,
                    score=extracted["score"],
                    tags=extracted["tags"],
                    attributes=extracted["attributes"],
                    initial_upload=initial_upload,
                )
                to_create.append(c)
                if email:
                    email_map[email.lower()] = c
                if phone:
                    phone_map[phone] = c
            else:
                updated_fields = []
                if not contact.phone and phone:
                    contact.phone = phone
                    updated_fields.append("phone")
                if not contact.name and extracted["name"]:
                    contact.name = extracted["name"]
                    contact.first_name = extracted["first_name"]
                    contact.last_name = extracted["last_name"]
                    updated_fields.extend(["name", "first_name", "last_name"])
                if not contact.sub_source_type:
                    contact.sub_source_type = sub_source_type
                    contact.sub_source_id = sub_id
                    contact.sub_source_name = sub_name
                    updated_fields.extend(["sub_source_type", "sub_source_id", "sub_source_name"])

                if updated_fields:
                    to_update.append((contact, updated_fields))

        if to_create:
            Contact.objects.bulk_create(to_create, ignore_conflicts=True)
        if to_update:
            for c, _ in to_update:
                c.save(update_fields=["phone", "name", "first_name", "last_name", "sub_source_type", "sub_source_id", "sub_source_name", "updated_at"])

        return len(to_create) + len(to_update)
