import json
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.ads.models import MetaUserCredential, MetaAdAccount

User = get_user_model()

from unittest.mock import patch, MagicMock

class Command(BaseCommand):
    help = 'Simulates the E2E flow of the Meta Ads integration'

    @patch('apps.ads.services.meta_ads_service.requests.get')
    @patch('apps.ads.services.meta_ads_service.requests.post')
    def handle(self, mock_post, mock_get, *args, **options):
        # Mock responses
        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {"data": [], "id": "mock_123", "success": True}
        mock_get.return_value = mock_resp_200
        mock_post.return_value = mock_resp_200
        
        # specific for get_lead_details which is called by webhook
        mock_lead_resp = MagicMock()
        mock_lead_resp.status_code = 200
        mock_lead_resp.json.return_value = {
            "id": "dummy_lead_999",
            "field_data": [{"name": "email", "values": ["test_lead@example.com"]}, {"name": "full_name", "values": ["Simulated Lead"]}]
        }
        mock_get.side_effect = lambda url, **kw: mock_lead_resp if "dummy_lead_999" in url else mock_resp_200

        self.stdout.write(self.style.SUCCESS("Starting E2E Meta Ads Simulation..."))
        client = APIClient()

        # Step 1: Create a test user
        email = "test_marketer@example.com"
        user, created = User.objects.get_or_create(email=email, defaults={
            "first_name": "Test",
            "last_name": "Marketer",
            "password": "testpassword123"
        })
        if created:
            user.set_password("testpassword123")
            user.save()
            
        client.force_authenticate(user=user)
        self.stdout.write(self.style.SUCCESS(f"Step 1: Authenticated as {email}"))

        # Step 2: Create a mock MetaUserCredential
        credential, cred_created = MetaUserCredential.objects.update_or_create(
            user=user,
            defaults={"access_token": "mock_e2e_access_token_123"}
        )
        self.stdout.write(self.style.SUCCESS("Step 2: Created mock MetaUserCredential"))

        # Step 3: Call GET /api/ads/meta/ad-accounts/
        res_accounts = client.get('/api/ads/meta/ad-accounts/')
        if res_accounts.status_code == 200:
            self.stdout.write(self.style.SUCCESS("Step 3: Fetched Ad Accounts Successfully!"))
        else:
            self.stdout.write(self.style.ERROR(f"Step 3 Failed: {getattr(res_accounts, 'data', res_accounts.content)}"))

        # Step 4: Call POST /api/ads/meta/ad-accounts/select/
        res_select = client.post('/api/ads/meta/ad-accounts/select/', {"account_id": "act_dummy123", "name": "Dummy Account"}, format='json')
        if res_select.status_code in [200, 201]:
            self.stdout.write(self.style.SUCCESS("Step 4: Selected Ad Account Successfully!"))
        else:
            self.stdout.write(self.style.ERROR(f"Step 4 Failed: {getattr(res_select, 'data', res_select.content)}"))

        # Step 5: Call GET /api/ads/meta/insights/
        res_insights = client.get('/api/ads/meta/insights/?account_id=act_dummy123')
        if res_insights.status_code == 200:
            self.stdout.write(self.style.SUCCESS("Step 5: Fetched Insights Successfully!"))
        else:
            self.stdout.write(self.style.ERROR(f"Step 5 Failed: {getattr(res_insights, 'data', res_insights.content)}"))

        # Step 6: Call POST /api/ads/meta/campaigns/create/
        payload = {
            "account_id": "act_dummy123",
            "name": "Test Campaign",
            "objective": "OUTCOME_LEADS",
            "daily_budget": 5000,
            "location": "US",
            "ad_text": "Join our platform today!"
        }
        res_campaign = client.post('/api/ads/meta/campaigns/create/', payload, format='json')
        if res_campaign.status_code in [200, 201]:
            self.stdout.write(self.style.SUCCESS("Step 6: Campaign Created Successfully!"))
        else:
            self.stdout.write(self.style.ERROR(f"Step 6 Failed: {getattr(res_campaign, 'data', res_campaign.content)}"))

        # Step 7: Call POST /api/ads/meta/webhook/
        webhook_payload = {
            "object": "page",
            "entry": [
                {
                    "changes": [
                        {
                            "field": "leadgen",
                            "value": {
                                "leadgen_id": "dummy_lead_999",
                                "page_id": "dummy_page_123",
                                "form_id": "dummy_form_456"
                            }
                        }
                    ]
                }
            ]
        }
        client.force_authenticate(user=None) # webhook is unauthenticated
        res_webhook = client.post('/api/ads/meta/webhook/', webhook_payload, format='json')
        if res_webhook.status_code == 200:
            self.stdout.write(self.style.SUCCESS("Step 7: Webhook Ingested Successfully!"))
        else:
            self.stdout.write(self.style.ERROR(f"Step 7 Failed: {res_webhook.status_code}"))

        self.stdout.write(self.style.SUCCESS("\n--- E2E Simulation Completed! ---"))
