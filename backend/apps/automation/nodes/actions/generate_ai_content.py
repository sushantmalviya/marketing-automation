from apps.content_studio.services.content_draft_service import ContentDraftService


class GenerateAIContentAction:
    """
    Action node that generates AI content using the content studio.
    """

    def execute(
        self,
        execution,
        node,
        config,
    ):
        prompt = config.get("prompt")
        content_type = config.get("content_type", "SOCIAL")
        platform_name = config.get("platform", "NONE")
        
        owner = execution.automation.owner

        platforms = [platform_name] if platform_name and platform_name != "NONE" else []

        # Create Draft
        draft = ContentDraftService.create_content_draft(
            user=owner,
            original_prompt=prompt,
            platforms=platforms,
            content_type=content_type
        )
        
        # We need a version
        version = ContentDraftService.create_content_version(draft, owner, reason="Initial Generation from Automation")

        from apps.content_studio.ai.services import AILifecycleService
        lifecycle = AILifecycleService()
        
        # Automatically generate captions for the platforms
        for platform in draft.platforms.all():
            lifecycle.generate_caption_for_platform(platform, owner, "Initial generation")

        return {
            "success": True,
            "generated_content_id": str(draft.id),
            "content_version_id": str(version.id),
        }
