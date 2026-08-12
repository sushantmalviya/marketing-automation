from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SocialConnectionViewSet,
    MetaAuthURLView,
    MetaAdAccountsView,
    MetaAdInsightsView,
)

router = DefaultRouter()
router.register(r'social/connections', SocialConnectionViewSet, basename='social-connections')

urlpatterns = [
    path('', include(router.urls)),
    path('meta/auth-url/', MetaAuthURLView.as_view(), name='meta_auth_url'),
    path('meta/ad-accounts/', MetaAdAccountsView.as_view(), name='meta_ad_accounts'),
    path('meta/insights/', MetaAdInsightsView.as_view(), name='meta_insights'),
]

