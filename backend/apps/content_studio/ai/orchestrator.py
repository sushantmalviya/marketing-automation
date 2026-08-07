import json
import logging
from django.conf import settings
from .providers.gemini_provider import GeminiProvider
from .providers.huggingface_provider import HuggingFaceProvider
from .prompt_builders import (
    SpecPromptBuilder,
    QuestionPromptBuilder,
    EnhancerPromptBuilder,
    ImagePromptBuilder,
    CaptionPromptBuilder
)
from .exceptions import AIProviderError

logger = logging.getLogger(__name__)

class AIOrchestrator:
    """
    Coordinates the AI workflow by selecting prompt builders and calling the provider.
    Business logic and side-effects (billing, versioning) are handled by AILifecycleService, not here.
    """
    
    def __init__(self):
        default_text_provider = getattr(settings, "DEFAULT_TEXT_PROVIDER", "gemini")
        if default_text_provider == "huggingface" and getattr(settings, "HF_TOKEN", None):
            self.text_provider = HuggingFaceProvider()
        else:
            self.text_provider = GeminiProvider()
        # Use Hugging Face when explicitly configured; otherwise reuse the
        # configured Gemini key so prompt-based image generation still works.
        self.image_provider = (
            HuggingFaceProvider()
            if getattr(settings, "HF_TOKEN", None)
            else GeminiProvider()
        )

    def _clean_json_response(self, text: str) -> str:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    def extract_content_spec(self, user_prompt: str) -> dict:
        """
        Extracts a structured JSON spec from raw user text.
        """
        builder = SpecPromptBuilder()
        prompt = builder.build(user_prompt)
        
        raw_response = self.text_provider.generate_text(prompt, json_response=True)
        raw_response = self._clean_json_response(raw_response)
        try:
            return json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse spec JSON: {raw_response}")
            raise AIProviderError("AI returned invalid JSON for the Content Spec.") from e

    def generate_questions(self, content_spec: dict, brand_identity: dict) -> list:
        """
        Generates clarifying questions based on the spec and brand identity.
        """
        builder = QuestionPromptBuilder()
        prompt = builder.build(content_spec, brand_identity)
        
        raw_response = self.text_provider.generate_text(prompt, json_response=True)
        raw_response = self._clean_json_response(raw_response)
        try:
            parsed = json.loads(raw_response)
            return parsed.get("questions", [])
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse questions JSON: {raw_response}")
            raise AIProviderError("AI returned invalid JSON for the Questions.") from e

    def extract_spec_and_questions(self, user_prompt: str, brand_identity: dict) -> dict:
        """
        Single-call optimised version: extracts the content spec AND generates
        clarifying questions in one Gemini request, cutting latency roughly in half.

        Returns: {"content_spec": {...}, "questions": [...]}
        """
        prompt = f"""
You are an expert marketing strategist and creative director.
Given the user's raw content idea, do TWO things in a SINGLE JSON response:

1. Extract a structured content spec.
2. Generate up to 8 highly relevant multiple-choice questions to collect the missing details needed to produce excellent content.

USER INPUT:
"{user_prompt}"

BRAND IDENTITY:
- Brand Description: {brand_identity.get('brand_description', 'Not provided')}
- Target Audience: {brand_identity.get('target_audience', 'Not provided')}
- Brand Tone: {brand_identity.get('tone', 'Not provided')}
- Content Pillars/Topics: {brand_identity.get('content_pillars', 'Not provided')}
- Unique Value / Differentiator: {brand_identity.get('unique_value', 'Not provided')}
- Content Guidelines (Do's & Don'ts): {brand_identity.get('guidelines', 'Not provided')}
- Desired Call to Action: {brand_identity.get('call_to_action', 'Not provided')}

INSTRUCTIONS:
- Be concise. Keep option text under 60 characters.
- Return ONLY valid JSON matching the schema below. No markdown, no prose.

EXPECTED JSON SCHEMA:
{{
  "content_spec": {{
    "Goal": "string or null",
    "Target Audience": "string or null",
    "Tone": "string or null",
    "Key Message": "string or null",
    "Visual Preferences": "string or null",
    "Additional Requirements": "string or null"
  }},
  "questions": [
    {{
      "question_text": "string",
      "type": "single_select | multi_select | text",
      "options": ["string", "string"]
    }}
  ]
}}
        """.strip()

        raw_response = self.text_provider.generate_text(
            prompt,
            max_tokens=1500,
            temperature=0.5,
            json_response=True,
        )
        raw_response = self._clean_json_response(raw_response)
        try:
            parsed = json.loads(raw_response)
            return {
                "content_spec": parsed.get("content_spec", {}),
                "questions": parsed.get("questions", []),
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse combined spec+questions JSON: {raw_response}")
            raise AIProviderError("AI returned invalid JSON for spec and questions.") from e

    def enhance_prompt(self, content_spec: dict, user_answers: dict) -> str:
        """
        Enhances the prompt into a master generative prompt.
        """
        builder = EnhancerPromptBuilder()
        prompt = builder.build(content_spec, user_answers)
        
        return self.text_provider.generate_text(prompt)

    def build_and_generate_image(self, enhanced_prompt: str, brand_identity: dict, platform: str, size: str, reason: str = "") -> str:
        """
        Generates an image specific to the platform.
        """
        builder = ImagePromptBuilder()
        image_prompt = builder.build(enhanced_prompt, brand_identity, platform, size)
        
        if reason:
            image_prompt += f"\n\nUSER FEEDBACK FOR REGENERATION: Please explicitly apply this feedback when generating the image: {reason}"
            
        logger.info(f"Generated optimized image prompt: {image_prompt}")
        
        return self.image_provider.generate_image(image_prompt, size)

    def build_and_generate_caption(self, enhanced_prompt: str, platform: str, brand_identity: dict, reason: str = "") -> str:
        """
        Generates a caption specific to the platform.
        """
        builder = CaptionPromptBuilder()
        caption_prompt = builder.build(enhanced_prompt, platform, brand_identity)
        
        if reason:
            caption_prompt += f"\n\nUSER FEEDBACK FOR REGENERATION: Please explicitly modify the caption based on this feedback: {reason}"
            
        return self.text_provider.generate_text(caption_prompt)
