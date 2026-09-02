from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.campaigns.models import CustomerUpload
from ..serializers import CustomerUploadSerializer,CustomerUploadListSerializer, CampaignCreateSerializer
from ..serializers.customer_record import CustomerRecordSerializer
from ..services import CustomerImportService , CampaignService
from ..models import CustomerRecord
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


class CustomerRecordListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = min(int(request.query_params.get("size", 2000)), 5000)
        audience_ids_str = request.query_params.get("audience_ids") or request.query_params.get("audience_id")
        columns_only = str(request.query_params.get("columns_only", "false")).lower() == "true"
        
        if audience_ids_str:
            audience_ids = [int(x.strip()) for x in audience_ids_str.split(",") if x.strip().isdigit()]
            from apps.campaigns.models import Audience
            from apps.common.ownership import filter_audiences_for_admin
            from apps.campaigns.services import AudienceService
            
            audiences = filter_audiences_for_admin(Audience.objects.filter(is_active=True, id__in=audience_ids), request.user)
            customers = CustomerRecord.objects.none()
            for aud in audiences:
                customers = customers | AudienceService.get_customers(
                    user=request.user,
                    audience_definition=aud.definition,
                )
            customers = customers.order_by("-created_at")
        else:
            customers = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user).order_by("-created_at")
            
        if columns_only:
            sample_customers = customers[:50]
            all_cols = set()
            for c in sample_customers:
                data = c.data or {}
                if "__col_order__" in data and isinstance(data["__col_order__"], list):
                    for col in data["__col_order__"]:
                        if not str(col).startswith("__"):
                            all_cols.add(str(col).capitalize())
                for key in data.keys():
                    if not str(key).startswith("__"):
                        all_cols.add(str(key).capitalize())
            
            if not all_cols:
                all_cols = {"Name", "Email", "Phone", "City", "Country", "Age"}
                
            all_cols.add("Source")
            return Response({"columns": sorted(list(all_cols))})

        customers = customers[:limit]
        serializer = CustomerRecordSerializer(customers, many=True)
        return Response(serializer.data)

    def post(self, request):
        contact = _validated_contact(request.data)
        audience_id = request.data.get("audience_id")
        
        upload, _ = CustomerUpload.objects.get_or_create(
            uploaded_by=request.user,
            file_name="Manual contacts",
            defaults={"file_type": "manual", "status": CustomerUpload.Status.COMPLETED},
        )
        customer = CustomerRecord.objects.create(upload=upload, data={**contact, "__source__": "created"})
        
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
        return Response(CustomerRecordSerializer(customer).data, status=status.HTTP_201_CREATED)


class CustomerRecordDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        queryset = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user)
        return get_object_or_404(queryset, pk=pk)

    def patch(self, request, pk):
        customer = self.get_object(request, pk)
        customer.data = _validated_contact({**customer.data, **request.data})
        customer.save(update_fields=["data"])
        return Response(CustomerRecordSerializer(customer).data)

    def delete(self, request, pk):
        customer = self.get_object(request, pk)
        upload = customer.upload
        customer.delete()
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
        """
        POST /api/customers/bulk-delete/
        body: { "ids": [1,2,3] }   — delete specific contacts
        body: { "all": true }       — delete ALL contacts visible to this user
        """
        if request.data.get("all"):
            qs = filter_customer_records_for_admin(CustomerRecord.objects.all(), request.user)
            count, _ = qs.delete()
            return Response({"deleted": count})

        ids = request.data.get("ids", [])
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "Provide a list of ids."}, status=status.HTTP_400_BAD_REQUEST)
        qs = filter_customer_records_for_admin(CustomerRecord.objects.filter(pk__in=ids), request.user)
        count, _ = qs.delete()
        return Response({"deleted": count})


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
    
