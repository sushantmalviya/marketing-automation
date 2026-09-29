from django.urls import path
from apps.campaigns.views import (
    CustomerUploadAPIView,
    CustomerUploadListAPIView,
    CustomerUploadDetailAPIView,
    CustomerSourceDeleteAPIView,
    CustomerRecordListAPIView,
    CustomerRecordDetailAPIView,
    CustomerBulkDeleteAPIView,
    ContactHierarchyAPIView,
)

urlpatterns = [
    path("uploads/", CustomerUploadAPIView.as_view(), name="customer-upload"),
    path("uploads/list/", CustomerUploadListAPIView.as_view(), name="customer-upload-list"),
    path("uploads/<int:pk>/", CustomerUploadDetailAPIView.as_view(), name="customer-upload-detail"),
    path("source-delete/", CustomerSourceDeleteAPIView.as_view(), name="customer-source-delete"),
    path("hierarchy/", ContactHierarchyAPIView.as_view(), name="customer-hierarchy"),
    path("", CustomerRecordListAPIView.as_view(), name="customer-list"),
    path("bulk-delete/", CustomerBulkDeleteAPIView.as_view(), name="customer-bulk-delete"),
    path("<str:pk>/", CustomerRecordDetailAPIView.as_view(), name="customer-detail"),
]
