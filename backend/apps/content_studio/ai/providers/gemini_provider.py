import base64
import logging
import uuid

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from ..exceptions import AIProviderError, AIRateLimitError, AITimeoutError

logger = logging.getLogger(__name__)


class GeminiProvider:
    """
    Provider wrapper for Google Gemini / Nano Banana API.
    Handles text generation and native image generation via google-genai SDK.
    """

    def __init__(self):
        self.api_key = getattr(settings, "GEMINI_API_KEY", None)

        if not self.api_key:
            logger.warning("GEMINI_API_KEY not set. Gemini API calls will fail.")

    def generate_text(self, prompt, model="gemini-flash-latest", max_tokens=1000, temperature=0.7, json_response=False):
        """
        Calls the Gemini API to generate text.
        """
        if not self.api_key:
            raise AIProviderError("Gemini API token (GEMINI_API_KEY) is not configured.")

        try:
            model = getattr(settings, "GEMINI_TEXT_MODEL", None) or model
            # Use the fastest available Flash model for text generation
            if model in ("gemini-flash-latest", "gemini-3-flash-preview"):
                model = "gemini-2.0-flash"
            generation_config = {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
            if json_response:
                generation_config["responseMimeType"] = "application/json"

            response = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent",
                headers={
                    "x-goog-api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": generation_config,
                },
                timeout=45,
            )
            if response.status_code == 429:
                raise AIRateLimitError("Gemini text generation rate limit exceeded.")
            if response.status_code >= 400:
                try:
                    detail = response.json().get("error", {}).get("message")
                except ValueError:
                    detail = None
                raise AIProviderError(
                    "Gemini text generation failed "
                    f"({response.status_code}): {detail or 'provider error'}"
                )

            candidates = response.json().get("candidates", [])
            parts = (
                candidates[0].get("content", {}).get("parts", [])
                if candidates
                else []
            )
            text = "".join(part.get("text", "") for part in parts).strip()
            if not text:
                raise AIProviderError("Gemini returned no generated text.")
            return text
        except requests.Timeout as exc:
            raise AITimeoutError("Gemini text generation timed out.") from exc
        except requests.RequestException as exc:
            raise AIProviderError("Failed to connect to Gemini text generation.") from exc

    def generate_image_bytes(
        self,
        prompt: str,
        *,
        model_id: str | None = None,
        aspect_ratio: str = "1:1",
        image_size: str = "1K",
        reference_images: list[tuple[bytes, str, str]] | None = None,
        timeout: int = 180,
    ) -> tuple[bytes, str]:
        """
        Generate an image using Google Nano Banana via the official google-genai SDK.
        Returns (image_bytes, mime_type).
        """
        if not self.api_key:
            raise AIProviderError("GEMINI_API_KEY is not configured.")

        resolved_model = model_id or getattr(settings, "GEMINI_IMAGE_MODEL", "gemini-nano-banana-2.1")

        # Build contents: prompt + any reference images (brand logo / visual references)
        if reference_images:
            contents: genai_types.ContentListUnionDict = [
                genai_types.Part.from_text(text=prompt),
                *[
                    genai_types.Part.from_bytes(data=img_bytes, mime_type=mime_type)
                    for img_bytes, mime_type, _label in reference_images
                ],
            ]
        else:
            contents = prompt

        # Nano Banana rejects LLM sampling params (temperature, topP, topK, seed, logprobs),
        # so only pass response_modalities and image_config.
        config = genai_types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=genai_types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            ),
        )

        try:
            client = genai.Client(
                api_key=self.api_key,
                http_options=genai_types.HttpOptions(timeout=int(timeout * 1000)),
            )
            response = client.models.generate_content(
                model=resolved_model,
                contents=contents,
                config=config,
            )

            candidates = getattr(response, "candidates", None) or []
            parts: list[genai_types.Part] = []
            if candidates and getattr(candidates[0], "content", None):
                candidate_parts = getattr(candidates[0].content, "parts", None)
                if candidate_parts:
                    parts = list(candidate_parts)
            else:
                response_parts = getattr(response, "parts", None)
                if response_parts:
                    parts = list(response_parts)

            for part in parts:
                inline_data = getattr(part, "inline_data", None)
                if not inline_data:
                    continue
                raw_data = getattr(inline_data, "data", None)
                if not raw_data:
                    continue
                mime_type = getattr(inline_data, "mime_type", None) or "image/png"
                if isinstance(raw_data, str):
                    image_bytes = base64.b64decode(raw_data)
                else:
                    image_bytes = bytes(raw_data)
                return image_bytes, mime_type

            raise AIProviderError("Google Nano Banana returned no generated image.")
        except (AIRateLimitError, AITimeoutError, AIProviderError):
            raise
        except genai_errors.APIError as exc:
            code = getattr(exc, "code", None)
            message = getattr(exc, "message", None) or str(exc)
            if code == 429:
                raise AIRateLimitError("Google Nano Banana rate limit exceeded.") from exc
            if code in (408, 504):
                raise AITimeoutError("Google Nano Banana image generation timed out.") from exc
            raise AIProviderError(f"Google Nano Banana generation failed ({code}): {message}") from exc
        except TimeoutError as exc:
            raise AITimeoutError("Google Nano Banana image generation timed out.") from exc
        except Exception as exc:
            if "timeout" in str(exc).lower() or "timed out" in str(exc).lower():
                raise AITimeoutError("Google Nano Banana image generation timed out.") from exc
            raise AIProviderError(f"Failed to generate image with Google Nano Banana: {exc}") from exc

    def generate_image(self, prompt, size="1024x1024", aspect_ratio="1:1", image_size="1K", model_id=None):
        """Backward-compatible wrapper returning a persisted storage URL."""
        image_bytes, mime_type = self.generate_image_bytes(
            prompt,
            model_id=model_id,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        )
        extension = "jpg" if "jpeg" in mime_type else "png"
        saved_path = default_storage.save(
            f"generated_images/{uuid.uuid4()}.{extension}",
            ContentFile(image_bytes),
        )
        return default_storage.url(saved_path)
