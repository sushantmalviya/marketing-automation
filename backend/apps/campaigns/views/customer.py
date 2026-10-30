from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.campaigns.models import CustomerUpload, Contact, CustomerRecord, Audience
from ..serializers import CustomerUploadSerializer,CustomerUploadListSerializer, CampaignCreateSerializer
from ..serializers.customer_record import CustomerRecordSerializer
from ..services import CustomerImportService , CampaignService
from apps.common.ownership import filter_customer_records_for_admin, filter_customer_uploads_for_admin
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated


class CustomerUploadAPIView(APIView):
    def post(self, request):
        serializer = CustomerUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = CustomerImportService.import_file(
            uploaded_file=serializer.validated_data["file"],
            uploaded_by=request.user,
        )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )

class CustomerUploadListAPIView(APIView):

    def get(self, request):

        uploads = filter_customer_uploads_for_admin(CustomerUpload.objects.all(), request.user).order_by("-uploaded_at")

        serializer = CustomerUploadListSerializer(
            uploads,
            many=True,
        )

        return Response(serializer.data)

class CustomerUploadDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        from django.shortcuts import get_object_or_404
        upload = get_object_or_404(CustomerUpload, pk=pk, uploaded_by=request.user)
        from apps.campaigns.models import Contact
        Contact.objects.filter(initial_upload=upload).delete()
        upload.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class CustomerSourceDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source = request.data.get("source")
        sub_source_id = request.data.get("sub_source_id")
        if not source or not sub_source_id:
            return Response({"error": "Missing source or sub_source_id"}, status=status.HTTP_400_BAD_REQUEST)
        from apps.campaigns.models import Contact, CustomerRecord, CustomerUpload
        from django.db.models import Q

        count, _ = Contact.objects.filter(owner=request.user, source=source, sub_source_id=sub_source_id).delete()
        if source == "meta":
            rec_count, _ = CustomerRecord.objects.filter(
                upload__uploaded_by=request.user
            ).filter(
                Q(data__form_id=str(sub_source_id)) | Q(data__sub_source_id=str(sub_source_id))
            ).delete()
            CustomerUpload.objects.filter(
                uploaded_by=request.user,
                file_type="meta"
            ).filter(
                Q(file_name__icontains=str(sub_source_id)) | Q(records__isnull=True)
            ).delete()
            count += rec_count
        return Response({"deleted": count}, status=status.HTTP_200_OK)


class CustomerRecordListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = min(int(request.query_params.get("size", 2000)), 5000)
        audience_ids_str = request.query_params.get("audience_ids") or request.query_params.get("audience_id")
        columns_only = str(request.query_params.get("columns_only", "false")).lower() == "true"
        
        from apps.campaigns.models import Contact, CustomerRecord
        from django.db.models import Q

        source_param = request.query_params.get("source")
        sub_source_type_param = request.query_params.get("sub_source_type")
        sub_source_id_param = request.query_params.get("sub_source_id")

        is_meta_form_query = (source_param == "meta") or (sub_source_type_param in ["meta_form", "meta_campaign"])
        if is_meta_form_query and sub_source_id_param:
            # Dedicated drill-down view for a specific Meta Instant Form
            meta_records_qs = CustomerRecord.objects.filter(
                upload__uploaded_by=request.user
            ).filter(
                Q(upload__file_type="meta") | Q(data__source="meta")
            )
            if sub_source_id_param != "meta_general":
                meta_records_qs = meta_records_qs.filter(
                    Q(data__form_id=str(sub_source_id_param)) |
                    Q(data__sub_source_id=str(sub_source_id_param)) |
                    Q(upload_id=int(sub_source_id_param) if str(sub_source_id_param).isdigit() else -1)
                )

            meta_records = list(meta_records_qs.order_by("-created_at")[:limit])

            # Also check if any Contact rows exist with this form_id that might not be in CustomerRecord
            contact_meta = list(Contact.objects.filter(owner=request.user, source="meta", sub_source_id=sub_source_id_param)[:limit])
            existing_emails = {r.data.get("email") for r in meta_records if r.data.get("email")}

            # Excluded internal/technical keys from dynamic columns
            excluded_keys = {
                "name", "full_name", "first_name", "last_name", "email", "phone", "phone_no", "phone_number",
                "source", "_source", "__source__", "activity", "tags", "list", "score", "status",
                "ad_id", "ad_name", "campaign_id", "campaign_name", "form_id", "form_name", "lead_id", "leadgen_id",
                "field_data", "custom_questions", "__col_order__", "routing_logs", "sub_source_type",
                "sub_source_id", "sub_source_name", "initial_upload", "initial_upload_id"
            }

            custom_fields = []
            seen_custom = set()

            # First discover custom questions in order of appearance
            for rec in meta_records:
                rdata = rec.data or {}
                # 1. custom_questions dict
                c_questions = rdata.get("custom_questions") or {}
                if isinstance(c_questions, dict):
                    for k in c_questions.keys():
                        if k not in seen_custom and k.lower() not in excluded_keys:
                            seen_custom.add(k)
                            custom_fields.append(k)
                # 2. field_data list
                f_data = rdata.get("field_data") or []
                if isinstance(f_data, list):
                    for fld in f_data:
                        fname = fld.get("name")
                        if fname and fname not in seen_custom and fname.lower() not in excluded_keys:
                            seen_custom.add(fname)
                            custom_fields.append(fname)
                # 3. top-level keys
                for k in rdata.keys():
                    if k not in seen_custom and k.lower() not in excluded_keys and not str(k).startswith("_"):
                        seen_custom.add(k)
                        custom_fields.append(k)

            if not meta_records:
                for c in contact_meta:
                    for k in (c.attributes or {}).keys():
                        if k not in seen_custom and k.lower() not in excluded_keys and not str(k).startswith("_"):
                            seen_custom.add(k)
                            custom_fields.append(k)

            # Check whether email and phone are present across leads in this form
            has_email = any(r.data.get("email") for r in meta_records) or any(c.email for c in contact_meta)
            has_phone = any(r.data.get("phone") or r.data.get("phone_no") or r.data.get("phone_number") for r in meta_records) or any(c.phone for c in contact_meta)

            col_order = ["name"]
            if has_email: col_order.append("email")
            if has_phone: col_order.append("phone_no")
            col_order.extend(custom_fields)

            meta_results = []
            for rec in meta_records:
                rdata = dict(rec.data or {})
                # Unpack custom questions into top level
                c_questions = rdata.get("custom_questions") or {}
                if isinstance(c_questions, dict):
                    for qk, qv in c_questions.items():
                        if qk not in rdata:
                            rdata[qk] = qv if isinstance(qv, str) else ", ".join(map(str, qv)) if isinstance(qv, list) else str(qv)
                # Unpack field_data into top level
                f_data = rdata.get("field_data") or []
                if isinstance(f_data, list):
                    for fld in f_data:
                        fname = fld.get("name")
                        fvals = fld.get("values") or []
                        if fname and fname not in rdata and fvals:
                            rdata[fname] = fvals[0] if len(fvals) == 1 else ", ".join(map(str, fvals))

                custom_vals = {}
                for k in custom_fields:
                    val = rdata.get(k, "")
                    if isinstance(val, (list, tuple)):
                        custom_vals[k] = ", ".join(map(str, val))
                    elif isinstance(val, dict):
                        custom_vals[k] = ", ".join(f"{dk}: {dv}" for dk, dv in val.items())
                    else:
                        custom_vals[k] = str(val) if val is not None else ""

                row_data = {
                    "__col_order__": col_order,
                    "name": rdata.get("name") or rdata.get("full_name") or "Unknown",
                    "email": rdata.get("email") or "",
                    "phone_no": rdata.get("phone") or rdata.get("phone_number") or rdata.get("phone_no") or "",
                    "phone": rdata.get("phone") or rdata.get("phone_number") or rdata.get("phone_no") or "",
                    "tags": rdata.get("tags") or [],
                    "list": "General",
                    "score": 50,
                    "status": "Active",
                    "source": "meta",
                    "activity": "Meta Lead",
                    **custom_vals
                }
                meta_results.append({
                    "id": rec.id,
                    "data": row_data,
                    "created_at": rec.created_at.isoformat()
                })

            # Add any Contact rows not captured in CustomerRecord
            for c in contact_meta:
                if c.email and c.email in existing_emails:
                    continue
                attrs = dict(c.attributes or {})
                custom_vals = {}
                for k in custom_fields:
                    val = attrs.get(k, "")
                    if isinstance(val, (list, tuple)):
                        custom_vals[k] = ", ".join(map(str, val))
                    elif isinstance(val, dict):
                        custom_vals[k] = ", ".join(f"{dk}: {dv}" for dk, dv in val.items())
                    else:
                        custom_vals[k] = str(val) if val is not None else ""

                row_data = {
                    "__col_order__": col_order,
                    "name": c.name or c.email or "Unknown",
                    "email": c.email or "",
                    "phone_no": c.phone or "",
                    "phone": c.phone or "",
                    "tags": c.tags or [],
                    "list": "General",
                    "score": c.score,
                    "status": c.status,
                    "source": "meta",
                    "activity": "Meta Lead",
                    **custom_vals
                }
                meta_results.append({
                    "id": str(c.id),
                    "data": row_data,
                    "created_at": c.created_at.isoformat()
                })

            return Response(meta_results)

        # Standard CRM Contact querying
        contacts_qs = Contact.objects.filter(owner=request.user)

        if source_param:
            if source_param == "imported":
                contacts_qs = contacts_qs.filter(source__in=["imported", "manual"])
            else:
                contacts_qs = contacts_qs.filter(source=source_param)
        if sub_source_type_param:
            contacts_qs = contacts_qs.filter(sub_source_type=sub_source_type_param)
        if sub_source_id_param:
            if sub_source_id_param == "manual":
                contacts_qs = contacts_qs.filter(sub_source_type="manual")
            else:
                if str(sub_source_id_param).isdigit():
                    contacts_qs = contacts_qs.filter(
                        Q(sub_source_id=sub_source_id_param) | Q(initial_upload_id=int(sub_source_id_param))
                    )
                else:
                    contacts_qs = contacts_qs.filter(sub_source_id=sub_source_id_param)

        if audience_ids_str:
            audience_ids = [int(x.strip()) for x in audience_ids_str.split(",") if x.strip().isdigit()]
            from apps.campaigns.models import Audience
            from apps.common.ownership import filter_audiences_for_admin
            from apps.campaigns.services import AudienceService
            
            audiences = filter_audiences_for_admin(Audience.objects.filter(is_active=True, id__in=audience_ids), request.user)
            filtered_contacts = Contact.objects.none()
            for aud in audiences:
                filtered_contacts = filtered_contacts | AudienceService.get_contacts(
                    user=request.user,
                    audience_definition=aud.definition,
                )
            contacts_qs = filtered_contacts.order_by("-created_at")
        else:
            contacts_qs = contacts_qs.order_by("-created_at")

        if columns_only:
            canonical_cols = ["Name", "Email", "Phone No", "Source", "Status", "Activity"]
            attribute_keys = set()
            for c in contacts_qs[:100]:
                for k in (c.attributes or {}).keys():
                    if not str(k).startswith("_"):
                        attribute_keys.add(str(k).title())
            return Response({"columns": canonical_cols + sorted(list(attribute_keys))})

        results = []
        contacts_list = list(contacts_qs[:limit])

        # Gather distinct custom attribute keys across this workspace subset
        custom_attr_keys = []
        seen_keys = set()
        for c in contacts_list:
            for k in (c.attributes or {}).keys():
                if not str(k).startswith("_") and k not in seen_keys:
                    seen_keys.add(k)
                    custom_attr_keys.append(k)

        # Standard canonical column headers in order
        col_order = ["name", "email", "phone_no", "source", "status", "activity"] + custom_attr_keys

        for c in contacts_list:
            act = "Form Submission" if c.source == "form" else "Meta Lead" if c.source == "meta" else "Imported" if c.source == "imported" else "Created"
            row_data = {
                "__col_order__": col_order,
                "name": c.name or c.email,
                "email": c.email,
                "phone_no": c.phone,
                "phone": c.phone,
                "tags": c.tags or [],
                "list": "General",
                "score": c.score,
                "status": c.status,
                "source": c.source,
                "activity": act,
                **(c.attributes or {})
            }
            results.append({
                "id": str(c.id),
                "data": row_data,
                "created_at": c.created_at.isoformat()
            })

        # Fallback to CustomerRecord if no Contact rows exist
        if not results:
            customers = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user).order_by("-created_at")[:limit]
            serializer = CustomerRecordSerializer(customers, many=True)
            return Response(serializer.data)

        return Response(results)

    def post(self, request):
        contact_payload = _validated_contact(request.data)
        audience_id = request.data.get("audience_id")
        file_id = request.data.get("file_id")
        
        from apps.campaigns.services import ContactService
        
        if file_id and str(file_id).isdigit():
            from django.shortcuts import get_object_or_404
            upload = get_object_or_404(CustomerUpload, pk=file_id, uploaded_by=request.user)
            contact_obj, _ = ContactService.upsert_contact(
                owner=request.user,
                payload=contact_payload,
                default_source="imported",
                initial_upload=upload,
                sub_source_type="file",
                sub_source_id=str(upload.id),
                sub_source_name=upload.file_name,
            )
            if contact_obj.initial_upload != upload or str(contact_obj.sub_source_id) != str(upload.id):
                contact_obj.initial_upload = upload
                contact_obj.sub_source_type = "file"
                contact_obj.sub_source_id = str(upload.id)
                contact_obj.save(update_fields=["initial_upload", "sub_source_type", "sub_source_id"])
            customer = CustomerRecord.objects.create(upload=upload, data={**contact_payload, "__source__": "imported"})
        else:
            upload, _ = CustomerUpload.objects.get_or_create(
                uploaded_by=request.user,
                file_name="Manual contacts",
                defaults={"file_type": "manual", "status": CustomerUpload.Status.COMPLETED},
            )
            contact_obj, _ = ContactService.upsert_contact(
                owner=request.user,
                payload=contact_payload,
                default_source="manual",
                initial_upload=upload,
                sub_source_type="manual",
                sub_source_id="manual",
                sub_source_name="Manual Contacts",
            )
            if contact_obj.initial_upload != upload or str(contact_obj.sub_source_id) != "manual":
                contact_obj.initial_upload = upload
                contact_obj.sub_source_type = "manual"
                contact_obj.sub_source_id = "manual"
                contact_obj.save(update_fields=["initial_upload", "sub_source_type", "sub_source_id"])
            customer = CustomerRecord.objects.create(upload=upload, data={**contact_payload, "__source__": "created"})
        
        if audience_id:
            from apps.campaigns.models import Audience
            audience = Audience.objects.filter(id=audience_id, is_active=True).first()
            if audience and str(audience.definition.get("type", "")).upper() == "STATIC":
                static_ids = audience.definition.get("static_ids", [])
                if customer.id not in static_ids:
                    audience.definition["static_ids"] = static_ids + [customer.id]
                    audience.save(update_fields=["definition"])
        
        upload.total_records = upload.records.count()
        upload.imported_records = upload.total_records
        upload.save(update_fields=["total_records", "imported_records"])
        return Response({
            "id": str(contact_obj.id),
            "data": {
                "name": contact_obj.name,
                "email": contact_obj.email,
                "phone_no": contact_obj.phone,
                "tags": contact_obj.tags,
                "status": contact_obj.status,
                "score": contact_obj.score
            },
            "created_at": contact_obj.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)


def _sync_delete_form_submission_for_customer(customer):
    try:
        data = customer.data or {}
        sub_id = data.get("__submission_id__")
        from apps.forms.models import FormSubmission
        
        if sub_id:
            FormSubmission.objects.filter(pk=sub_id).delete()
            return
            
        is_form = data.get("_source") == "form" or data.get("__source__") == "form" or (customer.upload and customer.upload.file_name == "Form Submissions")
        if not is_form:
            return
            
        email = str(data.get("Email") or data.get("email") or "").strip().lower()
        name = str(data.get("Name") or data.get("name") or "").strip()
        
        if email:
            for sub in FormSubmission.objects.all():
                ans_str = str(sub.answers).lower()
                if email in ans_str:
                    if name:
                        first_name = name.split()[0].lower()
                        if first_name in ans_str:
                            sub.delete()
                            break
                    else:
                        sub.delete()
                        break
    except Exception:
        pass


class CustomerRecordDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        from apps.campaigns.models import Contact
        contact = Contact.objects.filter(owner=request.user, pk=pk).first()
        if contact:
            data = request.data
            if "name" in data: contact.name = data["name"]
            if "email" in data: contact.email = data["email"]
            if "phone_no" in data or "phone" in data: contact.phone = data.get("phone_no", data.get("phone"))
            if "tags" in data: contact.tags = data["tags"]
            if "status" in data: contact.status = data["status"]
            if "score" in data: contact.score = data["score"]
            contact.save()
            return Response({
                "id": str(contact.id),
                "data": {
                    "name": contact.name,
                    "email": contact.email,
                    "phone_no": contact.phone,
                    "tags": contact.tags,
                    "status": contact.status,
                    "score": contact.score
                }
            })

        queryset = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user)
        customer = get_object_or_404(queryset, pk=pk)
        customer.data = _validated_contact({**customer.data, **request.data})
        customer.save(update_fields=["data"])
        return Response(CustomerRecordSerializer(customer).data)

    def delete(self, request, pk):
        from apps.campaigns.models import Contact
        contact = Contact.objects.filter(owner=request.user, pk=pk).first()
        if contact:
            contact.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        queryset = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user)
        customer = get_object_or_404(queryset, pk=pk)
        upload = customer.upload
        _sync_delete_form_submission_for_customer(customer)
        customer.delete()
        if upload:
            upload.total_records = upload.records.count()
            upload.imported_records = upload.total_records
            upload.save(update_fields=["total_records", "imported_records"])
        return Response(status=status.HTTP_204_NO_CONTENT)


def _validated_contact(payload):
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    if not name or not email:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({"detail": "Name and email are required."})
    result = dict(payload)
    result.update({
        "name": name,
        "email": email,
        "phone_no": str(payload.get("phone_no", payload.get("phone", ""))).strip(),
        "tags": payload.get("tags", []),
        "list": str(payload.get("list", "General")).strip() or "General",
        "score": max(0, min(100, int(payload.get("score", 0) or 0))),
        "status": str(payload.get("status", "Active")),
        "activity": str(payload.get("activity", "Just added")),
    })
    return result

class CustomerBulkDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.campaigns.models import Contact

        if request.data.get("all"):
            Contact.objects.filter(owner=request.user).delete()
            qs = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user)
            for c in qs:
                _sync_delete_form_submission_for_customer(c)
            count, _ = qs.delete()
            return Response({"deleted": count})

        ids = request.data.get("ids", [])
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "Provide a list of ids."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete Contacts by UUID or CustomerRecords by numeric PK
        str_ids = [str(x) for x in ids]
        contact_count, _ = Contact.objects.filter(owner=request.user, pk__in=str_ids).delete()
        
        num_ids = [x for x in ids if str(x).isdigit()]
        cust_count = 0
        if num_ids:
            qs = filter_customer_records_for_admin(CustomerRecord.objects.filter(pk__in=num_ids), request.user)
            for c in qs:
                _sync_delete_form_submission_for_customer(c)
            cust_count, _ = qs.delete()

        return Response({"deleted": contact_count + cust_count})


class CampaignCreateAPIView(APIView):

    def post(self, request):

        serializer = CampaignCreateSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        campaign = CampaignService.create_campaign(
            serializer.validated_data,
            request.user,
        )

        return Response(
            {
                "id": campaign.id,
                "name": campaign.name,
                "status": campaign.status,
            },
            status=status.HTTP_201_CREATED,
        )


from django.db.models import Count

class ContactHierarchyAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        contacts = Contact.objects.filter(owner=user)

        # 1. Imported Files & Manual contacts
        uploads = (
            CustomerUpload.objects.filter(uploaded_by=user)
            .exclude(file_type__in=["forms", "meta", "manual"])
            .values("id", "file_name")
            .annotate(count=Count("contacts"))
            .order_by("-count")
        )

        imported_items = []
        for u in uploads:
            if u["count"] > 0:
                imported_items.append({
                    "id": str(u["id"]),
                    "name": u["file_name"],
                    "count": u["count"],
                    "type": "file",
                    "sub_source_type": "file",
                })

        manual_count = contacts.filter(sub_source_type="manual").count()
        if manual_count > 0:
            imported_items.append({
                "id": "manual",
                "name": "Manual Contacts",
                "count": manual_count,
                "type": "manual",
                "sub_source_type": "manual",
            })

        unassigned_count = contacts.exclude(source__in=["form", "meta"]).filter(initial_upload__isnull=True).exclude(sub_source_type="manual").count()
        if unassigned_count > 0:
            imported_items.append({
                "id": "general",
                "name": "General Contacts",
                "count": unassigned_count,
                "type": "file",
                "sub_source_type": "file",
            })

        # 2. Form Leads
        forms_list = (
            contacts.filter(source="form")
            .values("sub_source_id", "sub_source_name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        form_items = [
            {
                "id": f["sub_source_id"] or "form_general",
                "name": f["sub_source_name"] or "Form Lead",
                "count": f["count"],
                "type": "form",
                "sub_source_type": "form",
            }
            for f in forms_list
            if f["count"] > 0
        ]

        # 3. Meta Leads by Instant Form
        from apps.ads.models import MetaLeadTrigger, MetaUserCredential
        from apps.ads.services.meta_ads_service import MetaAdsService
        from apps.campaigns.models import CustomerRecord
        from django.db.models import Q

        active_cred = MetaUserCredential.objects.filter(user=user, status='ACTIVE').first() or MetaUserCredential.objects.filter(status='ACTIVE').first()

        meta_records = CustomerRecord.objects.filter(upload__uploaded_by=user).filter(
            Q(upload__file_type="meta") | Q(data__source="meta")
        )

        form_counts: dict[str, int] = {}
        form_names: dict[str, str] = {}

        # 1. Tally from CustomerRecord
        for r in meta_records:
            rdata = r.data or {}
            fid = str(rdata.get("form_id") or "")
            fname = rdata.get("form_name") or ""
            if not fid:
                fid = "meta_general"
                fname = fname or "General Meta Leads"
            form_counts[fid] = form_counts.get(fid, 0) + 1
            if fname and fname not in ["Meta Leads", "Meta Webhooks", "Meta Campaign"]:
                form_names[fid] = fname

        # 2. Tally from Contact (if any contact not already counted or has sub_source_id)
        for c in contacts.filter(source="meta"):
            fid = str(c.sub_source_id or "")
            if not fid:
                fid = "meta_general"
            if fid not in form_counts:
                form_counts[fid] = 1
            fname = c.sub_source_name or ""
            if fname and fname not in ["Meta Leads", "Meta Webhooks", "Meta Campaign"]:
                form_names[fid] = fname

        # 3. Include configured MetaLeadTriggers even if count is 0
        triggers = MetaLeadTrigger.objects.filter(user=user, is_active=True).exclude(form_id="all")
        for trig in triggers:
            fid = str(trig.form_id)
            if fid not in form_counts:
                form_counts[fid] = 0
            if trig.form_name and trig.form_name != "All Forms on this Page":
                form_names[fid] = trig.form_name

        # 4. Resolve form names from Meta Graph API if still generic or unknown
        meta_items = []
        for fid, count in form_counts.items():
            name = form_names.get(fid)
            if not name or name in ["Meta Leads", "Meta Webhooks", "Meta Campaign", f"Meta Form {fid}"]:
                if fid != "meta_general" and active_cred:
                    try:
                        finfo = MetaAdsService.get_form_info(active_cred.access_token, fid)
                        if finfo.get("name"):
                            name = finfo["name"]
                            form_names[fid] = name
                    except Exception:
                        pass
            if not name:
                name = "General Meta Leads" if fid == "meta_general" else f"Meta Form {fid}"

            meta_items.append({
                "id": fid,
                "name": name,
                "count": count,
                "type": "meta_form",
                "sub_source_type": "meta_form",
            })

        meta_items.sort(key=lambda x: x["count"], reverse=True)

        # Category level counts
        imported_total = contacts.exclude(source__in=["form", "meta"]).count()
        forms_total = contacts.filter(source="form").count()
        meta_total = sum(item["count"] for item in meta_items)

        return Response({
            "categories": {
                "imported": {"count": imported_total, "items": imported_items},
                "forms": {"count": forms_total, "items": form_items},
                "meta": {"count": meta_total, "items": meta_items},
            }
        })
    
