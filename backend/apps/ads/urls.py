from django.urls import path
from .views import (
    MetaAuthURLView,
    MetaAdAccountsView,
    MetaAdInsightsView,
    CreateMetaCampaignView,
    SelectMetaAdAccountView,
    MetaAdCampaignsListView,
    MetaLeadWebhookView
)

urlpatterns = [
    path('meta/auth-url/', MetaAuthURLView.as_view(), name='meta_auth_url'),
    path('meta/ad-accounts/', MetaAdAccountsView.as_view(), name='meta_ad_accounts'),
    path('meta/ad-accounts/select/', SelectMetaAdAccountView.as_view(), name='select_meta_ad_account'),
    path('meta/insights/', MetaAdInsightsView.as_view(), name='meta_ad_insights'),
    path('meta/campaigns/create/', CreateMetaCampaignView.as_view(), name='create_meta_campaign'),
    path('meta/campaigns/list/', MetaAdCampaignsListView.as_view(), name='meta_ad_campaigns_list'),
    path('meta/webhook/', MetaLeadWebhookView.as_view(), name='meta_lead_webhook'),
]
