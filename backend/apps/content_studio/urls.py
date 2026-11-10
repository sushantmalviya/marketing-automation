from django.urls import path
from .views import (
    BrandVoiceAPIView,
    ContentTemplateListCreateAPIView,
    ContentTemplateDetailAPIView,
    AssetLibraryView,
    ImageConfigAPIView,
    ImageEstimateAPIView,
    ImageGenerateAPIView,
    ImageHistoryAPIView,
)

urlpatterns = [
    path('assets/', AssetLibraryView.as_view(), name='asset-library'),

    path('brand-voice/', BrandVoiceAPIView.as_view(), name='brand-voice'),

    path('images/config/', ImageConfigAPIView.as_view(), name='image-config'),
    path('images/estimate/', ImageEstimateAPIView.as_view(), name='image-estimate'),
    path('images/generate/', ImageGenerateAPIView.as_view(), name='image-generate'),
    path('images/history/', ImageHistoryAPIView.as_view(), name='image-history'),

    path('templates/', ContentTemplateListCreateAPIView.as_view(), name='template-list-create'),
    path('templates/<uuid:pk>/', ContentTemplateDetailAPIView.as_view(), name='template-detail'),
]

from rest_framework.routers import DefaultRouter
from .views import ContentDraftViewSet

router = DefaultRouter()
router.register(r'content-drafts', ContentDraftViewSet, basename='Content')

urlpatterns += router.urls
