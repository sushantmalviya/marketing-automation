from django.urls import path
from apps.campaigns.views import (
    CustomerUploadAPIView,
    CustomerUploadListAPIView,
    CustomerRecordListAPIView,
    CustomerRecordDetailAPIView,
    CustomerBulkDeleteAPIView,
    ContactHierarchyAPIView,
)

urlpatterns = [
    path("uploads/", CustomerUploadAPIView.as_view(), name="customer-upload"),
    path("uploads/list/", CustomerUploadListAPIView.as_view(), name="customer-upload-list"),
    path("hierarchy/", ContactHierarchyAPIView.as_view(), name="customer-hierarchy"),
    path("", CustomerRecordListAPIView.as_view(), name="customer-list"),
    path("<int:pk>/", CustomerRecordDetailAPIView.as_view(), name="customer-detail"),
    path("bulk-delete/", CustomerBulkDeleteAPIView.as_view(), name="customer-bulk-delete"),
]
