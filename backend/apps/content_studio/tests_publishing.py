from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import ContentDraft, ContentPlatform
from .services.publishing_service import PublishingService
from unittest.mock import patch, MagicMock

User = get_user_model()

class PublishingServiceTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@test.com", password="pwd")
        self.admin.role = "ADMIN"
        self.admin.save()
        
        self.user = User.objects.create_user(email="user@test.com", password="pwd")
        self.user.role = "USER"
        self.user.save()
        
        from apps.accounts.models import MAUser
        from apps.integrations.models import SocialConnection
        self.admin_ma = MAUser.objects.create(user=self.admin, role="ADMIN")
        self.user_ma = MAUser.objects.create(user=self.user, role="USER", managed_by=self.admin_ma)
        
        conn1 = SocialConnection.objects.create(user=self.admin_ma, platform=ContentPlatform.PlatformChoices.FACEBOOK)
        conn1.set_tokens(access_token="test")
        conn1.save()
        
        conn2 = SocialConnection.objects.create(user=self.admin_ma, platform=ContentPlatform.PlatformChoices.INSTAGRAM)
        conn2.set_tokens(access_token="test")
        conn2.save()
        
        self.draft = ContentDraft.objects.create(
            owner=self.user,
            workflow_state=ContentDraft.WorkflowState.APPROVED,
            enhanced_prompt="Test prompt"
        )
        self.platform1 = ContentPlatform.objects.create(
            draft=self.draft,
            platform=ContentPlatform.PlatformChoices.FACEBOOK
        )
        self.platform2 = ContentPlatform.objects.create(
            draft=self.draft,
            platform=ContentPlatform.PlatformChoices.INSTAGRAM
        )

    @patch('apps.integrations.providers.factory.ProviderFactory.get_provider')
    def test_successful_publish(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.publish_post.return_value = {"success": True, "platform_post_id": "123"}
        mock_get_provider.return_value = mock_provider
        
        updated_draft = PublishingService.publish_content(self.draft, self.admin)
        updated_draft.refresh_from_db()
        
        self.assertEqual(updated_draft.workflow_state, ContentDraft.WorkflowState.PUBLISHED)
        self.platform1.refresh_from_db()
        self.assertEqual(self.platform1.status, ContentPlatform.PlatformStatus.POSTED)
        self.assertEqual(self.platform1.external_post_id, "123")

    @patch('apps.integrations.providers.factory.ProviderFactory.get_provider')
    def test_failed_publish_one_platform(self, mock_get_provider):
        mock_provider = MagicMock()
        def side_effect(connection, content, image_url=None):
            if connection.platform == 'FACEBOOK':
                return {"success": False, "error": "Invalid token"}
            return {"success": True, "platform_post_id": "456"}
            
        mock_provider.publish_post.side_effect = side_effect
        mock_get_provider.return_value = mock_provider
        
        updated_draft = PublishingService.publish_content(self.draft, self.admin)
        updated_draft.refresh_from_db()
        
        self.assertEqual(updated_draft.workflow_state, ContentDraft.WorkflowState.APPROVED) # Overall not published because one failed
        
        self.platform1.refresh_from_db()
        self.assertEqual(self.platform1.status, ContentPlatform.PlatformStatus.FAILED)
        self.assertEqual(self.platform1.error_message, "Invalid token")
        
        self.platform2.refresh_from_db()
        self.assertEqual(self.platform2.status, ContentPlatform.PlatformStatus.POSTED)

    def test_unauthorized_user_cannot_publish_unapproved(self):
        self.draft.workflow_state = ContentDraft.WorkflowState.DRAFT
        self.draft.save()
        
        with self.assertRaises(ValueError):
            PublishingService.publish_content(self.draft, self.user)
            
    @patch('apps.integrations.providers.factory.ProviderFactory.get_provider')
    def test_admin_can_bypass_approval(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.publish_post.return_value = {"success": True, "platform_post_id": "123"}
        mock_get_provider.return_value = mock_provider
        self.draft.workflow_state = ContentDraft.WorkflowState.DRAFT
        self.draft.save()
        
        # Admin can publish even if draft
        updated_draft = PublishingService.publish_content(self.draft, self.admin)
        updated_draft.refresh_from_db()
        self.assertEqual(updated_draft.workflow_state, ContentDraft.WorkflowState.PUBLISHED)
