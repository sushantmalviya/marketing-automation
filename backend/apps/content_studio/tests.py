from django.test import TestCase
from unittest.mock import patch
from apps.accounts.models import User
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

    @patch('apps.content_studio.ai.providers.huggingface_provider.HuggingFaceProvider.generate_text')
    @patch('apps.content_studio.ai.providers.gemini_provider.GeminiProvider.generate_text')
    def test_orchestrator_json_parsing(self, mock_gemini, mock_hf):
        # Mock successful JSON response
        mock_hf.return_value = '{"Goal": "Sales", "Tone": "Urgent"}'
        mock_gemini.return_value = '{"Goal": "Sales", "Tone": "Urgent"}'
        
        orchestrator = AIOrchestrator()
        result = orchestrator.extract_content_spec("Make a sale post")
        
        self.assertEqual(result.get("Goal"), "Sales")
        self.assertEqual(result.get("Tone"), "Urgent")

    @patch('apps.content_studio.ai.providers.huggingface_provider.HuggingFaceProvider.generate_text')
    @patch('apps.content_studio.ai.providers.gemini_provider.GeminiProvider.generate_text')
    def test_lifecycle_enhance_prompt(self, mock_gemini, mock_hf):
        mock_hf.return_value = "Tone = Fun\nGoal = Sales"
        mock_gemini.return_value = "Tone = Fun\nGoal = Sales"
        
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
