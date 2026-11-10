import logging
from apps.content_studio.ai.providers.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


class OpenAIService:
    @staticmethod
    def generate_content(prompt, content_type="email"):
        """
        Calls OpenAI GPT-6 Luna (Responses API) to generate content, enforcing marketing constraints.
        """
        logger.info(f"Generating {content_type} with prompt: {prompt}")

        # Enforce constraints via Responses API instructions.
        system_prompt = (
            "You are a professional marketing assistant. "
            f"Only generate marketing-related content. Task: generate {content_type}."
        )

        provider = OpenAIProvider()
        return provider.generate_text(prompt, instructions=system_prompt)

    @staticmethod
    def generate_image(prompt):
        """
        Calls OpenAI to generate an image.
        Placeholder implementation.
        """
        logger.info(f"Generating image with prompt: {prompt}")

        return "https://fake-s3-bucket.s3.amazonaws.com/ai-image.jpg"
