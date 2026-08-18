from django.urls import path
from .views import (
    BrandVoiceAPIView,
    ContentTemplateListCreateAPIView,
    ContentTemplateDetailAPIView,
    AssetLibraryView,
)

urlpatterns = [
    path('assets/', AssetLibraryView.as_view(), name='asset-library'),

    path('brand-voice/', BrandVoiceAPIView.as_view(), name='brand-voice'),

    path('templates/', ContentTemplateListCreateAPIView.as_view(), name='template-list-create'),
    path('templates/<uuid:pk>/', ContentTemplateDetailAPIView.as_view(), name='template-detail'),
]

from rest_framework.routers import DefaultRouter
from .views import ContentDraftViewSet

router = DefaultRouter()
router.register(r'content-drafts', ContentDraftViewSet, basename='Content')

urlpatterns += router.urls
