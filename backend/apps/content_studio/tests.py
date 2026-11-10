from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import MAUser, Organization, User
from apps.billing.models import Wallet


from django.utils import timezone
from apps.content_studio.models import ContentDraft, ContentPlatform, Approval
from apps.content_studio.services.content_draft_service import ContentDraftService
from apps.content_studio.services.approval_service import ApprovalService

class ContentWorkflowTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="test2@test.com", password="pwd")

    def test_Content_draft_creation(self):
        draft = ContentDraftService.create_content_draft(
            user=self.user,
            platforms=[ContentPlatform.PlatformChoices.LINKEDIN, ContentPlatform.PlatformChoices.X]
        )
        
        self.assertEqual(draft.workflow_state, ContentDraft.WorkflowState.DRAFT)
        self.assertEqual(draft.platforms.count(), 2)

    def test_approval_workflow(self):
        draft = ContentDraftService.create_content_draft(
            user=self.user,
            platforms=[ContentPlatform.PlatformChoices.LINKEDIN]
        )
        
        # Request approval
        ApprovalService.request_approval(draft)
        self.assertEqual(draft.workflow_state, ContentDraft.WorkflowState.IN_REVIEW)
        self.assertEqual(draft.platforms.first().approval_status, ContentPlatform.ApprovalStatus.REQUESTED)
        
        # Approve
        ApprovalService.approve_content(draft, self.user, "Looks good")
        self.assertEqual(draft.workflow_state, ContentDraft.WorkflowState.APPROVED)
        self.assertEqual(draft.platforms.first().approval_status, ContentPlatform.ApprovalStatus.APPROVED)
        self.assertEqual(draft.approvals.first().status, Approval.ApprovalState.APPROVED)

from unittest.mock import patch
from apps.content_studio.ai.orchestrator import AIOrchestrator
from apps.content_studio.ai.services import AILifecycleService
from apps.content_studio.ai.prompt_builders import CaptionPromptBuilder
from apps.billing.services import InsufficientCreditsError
from apps.billing.models import Wallet

class AIEngineTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="ai@test.com", password="pwd")
        self.wallet = Wallet.objects.create(balance=50)
        self.draft = ContentDraftService.create_content_draft(
            user=self.user,
            platforms=[ContentPlatform.PlatformChoices.INSTAGRAM]
        )
        self.platform = self.draft.platforms.first()
        self.lifecycle_service = AILifecycleService()

    def test_caption_prompt_builder_rules(self):
        builder = CaptionPromptBuilder()
        prompt = builder.build("Enhance this", "INSTAGRAM", {"tone": "Fun"})
        self.assertIn("visually descriptive", prompt)
        self.assertIn("Fun", prompt)

    @override_settings(DEFAULT_TEXT_PROVIDER="openai")
    @patch('apps.content_studio.ai.providers.openai_provider.OpenAIProvider.generate_text')
    def test_orchestrator_json_parsing(self, mock_openai):
        # Mock successful JSON response from default GPT-6 Luna text provider
        mock_openai.return_value = '{"Goal": "Sales", "Tone": "Urgent"}'

        orchestrator = AIOrchestrator()
        result = orchestrator.extract_content_spec("Make a sale post")

        self.assertEqual(result.get("Goal"), "Sales")
        self.assertEqual(result.get("Tone"), "Urgent")
        mock_openai.assert_called_once()

    @patch('apps.content_studio.ai.providers.openai_provider.OpenAIProvider.generate_text')
    def test_lifecycle_enhance_prompt(self, mock_openai):
        mock_openai.return_value = "Tone = Fun\nGoal = Sales"
        
        enhanced, version = self.lifecycle_service.enhance_content_prompt(
            draft=self.draft,
            content_spec={"Goal": "Sales"},
            user_answers={"Tone": "Fun"},
            user=self.user
        )
        
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 47)  # Deducted 3 credits
        self.assertEqual(enhanced, "Goal = Sales\nTone = Fun")
        self.assertEqual(version.version_number, 2)  # Draft starts at 1, so version captured is 2
        
    @patch('apps.content_studio.ai.providers.huggingface_provider.HuggingFaceProvider.generate_image')
    @patch('apps.content_studio.ai.providers.gemini_provider.GeminiProvider.generate_image')
    def test_lifecycle_generate_image(self, mock_gemini, mock_hf):
        mock_hf.return_value = "http://fake-image.url"
        mock_gemini.return_value = "http://fake-image.url"
        self.draft.enhanced_prompt = "Tone = Fun"
        self.draft.save()
        
        url, ref = self.lifecycle_service.generate_image_for_platform(
            platform_record=self.platform,
            user=self.user
        )
        
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 40) # Deducted 10
        self.assertEqual(url, "http://fake-image.url")
        self.assertEqual(ref.platform, self.platform)
        self.assertEqual(self.draft.versions.count(), 1)
        
    def test_insufficient_credits_aborts_ai(self):
        self.wallet.balance = 2
        self.wallet.save()
        
        with self.assertRaises(InsufficientCreditsError):
            self.lifecycle_service.enhance_content_prompt(
                draft=self.draft,
                content_spec={},
                user_answers={},
                user=self.user
            )


class GPT6LunaTextGenerationTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Luna Org",
            slug="luna-org",
            external_company_id="EXT-LUNA-1",
        )
        self.user = User.objects.create_user(
            email="luna@test.com",
            password="StrongPass123!",
            organization=self.org,
        )
        MAUser.objects.create(user=self.user, organization=self.org, role="USER")
        self.wallet = Wallet.objects.create(organization=self.org, balance=100)
        from apps.content_studio.models import BrandVoice
        self.brand_voice = BrandVoice.objects.create(
            organization=self.org,
            brand_description="Eco-friendly smart home devices",
            target_audience="Urban homeowners aged 25-45",
            tone="Warm, optimistic, trustworthy",
            guidelines="Highlight sustainability. Avoid exaggerated claims.",
            call_to_action="Shop the Autumn Collection",
        )
        self.client.force_authenticate(self.user)

    @override_settings(DEFAULT_TEXT_PROVIDER="openai")
    def test_orchestrator_defaults_to_openai_provider(self):
        from apps.content_studio.ai.providers.openai_provider import OpenAIProvider

        orchestrator = AIOrchestrator()
        self.assertIsInstance(orchestrator.text_provider, OpenAIProvider)

    @override_settings(
        OPENAI_API_KEY="test-openai-key",
        OPENAI_TEXT_MODEL="gpt-6-luna",
        OPENAI_TEXT_REASONING_EFFORT="none",
    )
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_openai_provider_responses_api_payload_and_reasoning_guard(self, mock_openai_cls):
        from apps.content_studio.ai.exceptions import AIProviderError
        from apps.content_studio.ai.providers.openai_provider import OpenAIProvider

        mock_client = MagicMock()
        mock_client.responses.create.return_value = SimpleNamespace(
            status="completed",
            output_text='{"Goal": "Sales"}',
        )
        mock_openai_cls.return_value = mock_client

        provider = OpenAIProvider()
        result = provider.generate_text(
            "Extract Goal in json.",
            max_tokens=1200,
            temperature=0.5,
            json_response=True,
            instructions="Return JSON only.",
        )
        self.assertEqual(result, '{"Goal": "Sales"}')
        kwargs = mock_client.responses.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-6-luna")
        self.assertEqual(kwargs["input"], "Extract Goal in json.")
        self.assertEqual(kwargs["instructions"], "Return JSON only.")
        self.assertEqual(kwargs["max_output_tokens"], 1200)
        self.assertEqual(kwargs["reasoning"], {"effort": "none"})
        self.assertEqual(kwargs["temperature"], 0.5)
        self.assertEqual(kwargs["text"], {"format": {"type": "json_object"}})

        # When reasoning effort != "none", sampling parameter `temperature` must be omitted
        provider.generate_text("Draft copy", temperature=0.8, reasoning_effort="low")
        low_kwargs = mock_client.responses.create.call_args.kwargs
        self.assertEqual(low_kwargs["reasoning"], {"effort": "low"})
        self.assertNotIn("temperature", low_kwargs)

        # Incomplete status raises AIProviderError clearly
        mock_client.responses.create.return_value = SimpleNamespace(
            status="incomplete",
            incomplete_details=SimpleNamespace(reason="max_output_tokens"),
            output_text='{"partial":',
        )
        with self.assertRaises(AIProviderError):
            provider.generate_text("Extract Goal", json_response=True)

        # Native OpenAI SDK errors map cleanly to normalized AI exceptions
        import httpx
        from openai import APITimeoutError, RateLimitError
        from apps.content_studio.ai.exceptions import AIRateLimitError, AITimeoutError

        dummy_request = httpx.Request("POST", "https://api.openai.com/v1/responses")
        mock_client.responses.create.side_effect = APITimeoutError(request=dummy_request)
        with self.assertRaises(AITimeoutError):
            provider.generate_text("Timed out")

        dummy_response = httpx.Response(429, request=dummy_request)
        mock_client.responses.create.side_effect = RateLimitError(
            "rate limit", response=dummy_response, body=None
        )
        with self.assertRaises(AIRateLimitError):
            provider.generate_text("Rate limited")

    @override_settings(
        DEFAULT_TEXT_PROVIDER="openai",
        OPENAI_API_KEY="test-openai-key",
        OPENAI_TEXT_MODEL="gpt-6-luna",
        OPENAI_TEXT_REASONING_EFFORT="none",
    )
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_analyze_prompt_returns_10_questions_uses_brand_identity_and_credits(self, mock_openai_cls):
        import json

        mock_client = MagicMock()
        questions = [
            {
                "question_text": f"Contextual question {idx}?",
                "type": "single_select",
                "options": ["Option A", "Option B"],
            }
            for idx in range(1, 11)
        ]
        mock_client.responses.create.return_value = SimpleNamespace(
            status="completed",
            output_text=json.dumps({
                "content_spec": {
                    "Goal": "Product Launch",
                    "Target Audience": "Urban homeowners",
                    "Tone": "Warm",
                    "Key Message": "Save energy automatically",
                    "Visual Preferences": "Minimalist sunlit interior",
                    "Additional Requirements": None,
                },
                "questions": questions,
            }),
        )
        mock_openai_cls.return_value = mock_client

        res = self.client.post(
            "/api/content/content-drafts/analyze_prompt/",
            {"prompt": "Launch our smart thermostat for autumn"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["questions"]), 10)
        self.assertEqual(res.data["content_spec"]["Goal"], "Product Launch")

        call_kwargs = mock_client.responses.create.call_args.kwargs
        self.assertEqual(call_kwargs["model"], "gpt-6-luna")
        self.assertIn("10 contextual", call_kwargs["input"])
        self.assertIn("Eco-friendly smart home devices", call_kwargs["input"])

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 95)

    @override_settings(
        DEFAULT_TEXT_PROVIDER="openai",
        OPENAI_API_KEY="test-openai-key",
        OPENAI_TEXT_MODEL="gpt-6-luna",
    )
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_failed_analyze_prompt_rolls_back_credits(self, mock_openai_cls):
        from apps.content_studio.ai.exceptions import AITimeoutError

        mock_client = MagicMock()
        mock_client.responses.create.side_effect = AITimeoutError("Request timed out")
        mock_openai_cls.return_value = mock_client

        res = self.client.post(
            "/api/content/content-drafts/analyze_prompt/",
            {"prompt": "Launch winter campaign"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)

    @override_settings(
        DEFAULT_TEXT_PROVIDER="openai",
        OPENAI_API_KEY="test-openai-key",
        OPENAI_TEXT_MODEL="gpt-6-luna",
    )
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_caption_generation_all_four_platforms_with_brand_identity_and_credits(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_client.responses.create.side_effect = [
            SimpleNamespace(status="completed", output_text=f"Caption for {p} #SmartHome #EcoLiving")
            for p in ("INSTAGRAM", "FACEBOOK", "LINKEDIN", "X")
        ]
        mock_openai_cls.return_value = mock_client

        draft = ContentDraftService.create_content_draft(
            user=self.user,
            original_prompt="Smart thermostat launch",
            platforms=[
                ContentPlatform.PlatformChoices.INSTAGRAM,
                ContentPlatform.PlatformChoices.FACEBOOK,
                ContentPlatform.PlatformChoices.LINKEDIN,
                ContentPlatform.PlatformChoices.X,
            ],
        )
        draft.enhanced_prompt = "Goal = Launch\nTone = Warm"
        draft.save()

        service = AILifecycleService()
        for platform_record in draft.platforms.all():
            service.generate_caption_for_platform(platform_record, self.user)
            platform_record.refresh_from_db()
            self.assertIn("#SmartHome", platform_record.caption_text)

        self.assertEqual(mock_client.responses.create.call_count, 4)
        for call in mock_client.responses.create.call_args_list:
            self.assertEqual(call.kwargs["model"], "gpt-6-luna")
            self.assertIn("Warm, optimistic, trustworthy", call.kwargs["input"])

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 80)

    @override_settings(
        DEFAULT_TEXT_PROVIDER="openai",
        OPENAI_API_KEY="test-openai-key",
        OPENAI_TEXT_MODEL="gpt-6-luna",
    )
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_integrations_services_route_email_blog_ad_copy_to_gpt6_luna(self, mock_openai_cls):
        from apps.integrations.gemini_service import GeminiService
        from apps.integrations.openai_service import OpenAIService

        mock_client = MagicMock()
        mock_client.responses.create.side_effect = [
            SimpleNamespace(status="completed", output_text="Email body generated"),
            SimpleNamespace(status="completed", output_text="Blog article generated"),
            SimpleNamespace(status="completed", output_text="Ad copy generated"),
        ]
        mock_openai_cls.return_value = mock_client

        email_text = GeminiService.generate_content("Promote spring sale", content_type="email")
        blog_text = OpenAIService.generate_content("Write SEO post", content_type="blog")
        ad_text = OpenAIService.generate_content("Write Google ad", content_type="ad_copy")

        self.assertEqual(email_text, "Email body generated")
        self.assertEqual(blog_text, "Blog article generated")
        self.assertEqual(ad_text, "Ad copy generated")
        for call in mock_client.responses.create.call_args_list:
            self.assertEqual(call.kwargs["model"], "gpt-6-luna")

    @override_settings(
        DEFAULT_TEXT_PROVIDER="openai",
        OPENAI_API_KEY="test-openai-key",
        OPENAI_TEXT_MODEL="gpt-6-luna",
    )
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_automation_generate_ai_content_node_uses_gpt6_luna(self, mock_openai_cls):
        from types import SimpleNamespace as _NS
        from apps.automation.nodes.actions.generate_ai_content import GenerateAIContentAction

        mock_client = MagicMock()
        mock_client.responses.create.return_value = SimpleNamespace(
            status="completed",
            output_text="Automated caption from GPT-6 Luna #AutoMarket",
        )
        mock_openai_cls.return_value = mock_client

        execution = _NS(automation=_NS(owner=self.user))
        action = GenerateAIContentAction()
        result = action.execute(
            execution=execution,
            node={"id": "n1"},
            config={"prompt": "Seasonal promo", "content_type": "SOCIAL", "platform": "INSTAGRAM"},
        )
        self.assertTrue(result["success"])
        call_kwargs = mock_client.responses.create.call_args.kwargs
        self.assertEqual(call_kwargs["model"], "gpt-6-luna")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 95)
