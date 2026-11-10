import logging
from apps.content_studio.ai.orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


class GeminiService:
    @staticmethod
    def generate_content(prompt, content_type="email"):
        """
        Generates marketing content through the configured AI text provider (GPT-6 Luna by default).
        """
        logger.info(f"Generating {content_type} with prompt: {prompt}")

        # Enforce constraints: pass marketing role/task cleanly as system instructions.
        system_prompt = (
            "You are a professional marketing assistant. "
            f"Only generate marketing-related content. Task: generate {content_type}."
        )
        full_prompt = f"{system_prompt}\n\n{prompt}"

        orchestrator = AIOrchestrator()
        return orchestrator.text_provider.generate_text(full_prompt)
