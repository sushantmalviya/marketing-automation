import os

# 1. Update backend/apps/campaigns/views/customer.py
customer_py_path = "backend/apps/campaigns/views/customer.py"
with open(customer_py_path, "r", encoding="utf-8") as f:
    customer_py = f.read()

customer_py = customer_py.replace("""    def post(self, request):
        contact_payload = _validated_contact(request.data)
        audience_id = request.data.get("audience_id")
        
        from apps.campaigns.services import ContactService
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

        customer = CustomerRecord.objects.create(upload=upload, data={**contact_payload, "__source__": "created"})""", """    def post(self, request):
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
            customer = CustomerRecord.objects.create(upload=upload, data={**contact_payload, "__source__": "created"})""")

customer_py = customer_py.replace("""        return Response(serializer.data)


class CustomerRecordListAPIView(APIView):""", """        return Response(serializer.data)

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
        from apps.campaigns.models import Contact
        count, _ = Contact.objects.filter(owner=request.user, source=source, sub_source_id=sub_source_id).delete()
        return Response({"deleted": count}, status=status.HTTP_200_OK)


class CustomerRecordListAPIView(APIView):""")

with open(customer_py_path, "w", encoding="utf-8") as f:
    f.write(customer_py)


# 2. Update backend/apps/campaigns/urls/customers.py
urls_py_path = "backend/apps/campaigns/urls/customers.py"
with open(urls_py_path, "r", encoding="utf-8") as f:
    urls_py = f.read()

if "CustomerUploadDetailAPIView" not in urls_py:
    urls_py = urls_py.replace("""    CustomerUploadListAPIView,
    CustomerRecordListAPIView,""", """    CustomerUploadListAPIView,
    CustomerUploadDetailAPIView,
    CustomerSourceDeleteAPIView,
    CustomerRecordListAPIView,""")

    urls_py = urls_py.replace("""    path("uploads/list/", CustomerUploadListAPIView.as_view(), name="customer-upload-list"),
    path("hierarchy/", ContactHierarchyAPIView.as_view(), name="customer-hierarchy"),""", """    path("uploads/list/", CustomerUploadListAPIView.as_view(), name="customer-upload-list"),
    path("uploads/<int:pk>/", CustomerUploadDetailAPIView.as_view(), name="customer-upload-detail"),
    path("source-delete/", CustomerSourceDeleteAPIView.as_view(), name="customer-source-delete"),
    path("hierarchy/", ContactHierarchyAPIView.as_view(), name="customer-hierarchy"),""")

with open(urls_py_path, "w", encoding="utf-8") as f:
    f.write(urls_py)


# 3. Update backend/apps/campaigns/views/__init__.py
init_py_path = "backend/apps/campaigns/views/__init__.py"
with open(init_py_path, "r", encoding="utf-8") as f:
    init_py = f.read()

if "CustomerUploadDetailAPIView" not in init_py:
    init_py = init_py.replace("""    CustomerUploadListAPIView,
    CustomerRecordListAPIView,""", """    CustomerUploadListAPIView,
    CustomerUploadDetailAPIView,
    CustomerSourceDeleteAPIView,
    CustomerRecordListAPIView,""")

with open(init_py_path, "w", encoding="utf-8") as f:
    f.write(init_py)

print("Backend changes applied!")
