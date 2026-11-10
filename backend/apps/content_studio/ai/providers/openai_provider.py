import base64
import logging
from typing import Any, Literal, cast
import uuid

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from ..exceptions import AIProviderError, AIRateLimitError, AITimeoutError

logger = logging.getLogger(__name__)

try:
    import openai as _openai_sdk
    from openai import (
        APIConnectionError as _OpenAIAPIConnectionError,
        APITimeoutError as _OpenAIAPITimeoutError,
        OpenAIError as _OpenAIError,
        RateLimitError as _OpenAIRateLimitError,
    )

    openai = _openai_sdk
    APIConnectionError = _OpenAIAPIConnectionError
    APITimeoutError = _OpenAIAPITimeoutError
    OpenAIError = _OpenAIError
    RateLimitError = _OpenAIRateLimitError
    HAS_OPENAI = True
except ImportError:
    openai = None
    APIConnectionError = Exception
    APITimeoutError = TimeoutError
    OpenAIError = Exception
    RateLimitError = Exception
    HAS_OPENAI = False

OpenAIImageQuality = Literal["low", "medium", "high", "xhigh", "max", "auto", "standard"]
OpenAIImageOutputFormat = Literal["png", "jpeg", "webp"]


class OpenAIProvider:
    """
    Provider wrapper for OpenAI SDK supporting text and GPT Image 2.5 image generation.
    """

    def __init__(self):
        self.api_key = getattr(settings, "OPENAI_API_KEY", None)
        self.has_client = HAS_OPENAI and openai is not None and bool(self.api_key)
        if self.has_client and openai is not None:
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("OpenAI SDK not available or OPENAI_API_KEY not set.")

    def _require_client(self):
        if not HAS_OPENAI:
            raise AIProviderError("OpenAI Python SDK is not installed on the server.")
        if not self.api_key or self.client is None:
            raise AIProviderError("OpenAI API key (OPENAI_API_KEY) is not configured.")
        return self.client

    def generate_text(
        self,
        prompt,
        model=None,
        max_tokens=1500,
        temperature=0.7,
        json_response=False,
        instructions=None,
        reasoning_effort=None,
    ):
        """
        Generate text via OpenAI Responses API using GPT-6 Luna (`gpt-6-luna` by default).
        """
        client = self._require_client()
        resolved_model = (
            model
            or getattr(settings, "OPENAI_TEXT_MODEL", "gpt-6-luna")
            or "gpt-6-luna"
        )
        resolved_effort = (
            reasoning_effort
            if reasoning_effort is not None
            else (getattr(settings, "OPENAI_TEXT_REASONING_EFFORT", "none") or "none")
        )
        normalized_effort = str(resolved_effort).strip().lower()

        try:
            request_payload: dict[str, Any] = {
                "model": resolved_model,
                "input": prompt,
                "max_output_tokens": max_tokens,
            }

            effective_instructions = instructions
            if json_response:
                combined_text = f"{effective_instructions or ''}\n{prompt}".lower()
                if "json" not in combined_text:
                    effective_instructions = (
                        f"{effective_instructions}\nReturn valid JSON.".strip()
                        if effective_instructions
                        else "Return valid JSON."
                    )
                request_payload["text"] = {"format": {"type": "json_object"}}

            if effective_instructions:
                request_payload["instructions"] = effective_instructions

            if normalized_effort:
                request_payload["reasoning"] = {"effort": normalized_effort}

            # GPT-6 series models reject sampling params (e.g. temperature) when reasoning effort != "none".
            if normalized_effort == "none" and temperature is not None:
                request_payload["temperature"] = temperature

            response = client.responses.create(**request_payload)

            if getattr(response, "status", None) == "incomplete":
                details = getattr(response, "incomplete_details", None)
                reason = getattr(details, "reason", None) or "unknown"
                raise AIProviderError(
                    f"OpenAI text generation returned incomplete response ({reason})."
                )

            output_text = getattr(response, "output_text", None)
            if not isinstance(output_text, str) or not output_text.strip():
                raise AIProviderError("OpenAI returned empty text output.")

            return output_text.strip()

        except RateLimitError as e:
            raise AIRateLimitError("OpenAI rate limit exceeded.") from e
        except APITimeoutError as e:
            raise AITimeoutError("OpenAI request timed out.") from e
        except APIConnectionError as e:
            raise AIProviderError("Failed to connect to OpenAI.") from e
        except OpenAIError as e:
            raise AIProviderError(f"OpenAI error: {str(e)}") from e
        except (AIRateLimitError, AITimeoutError, AIProviderError):
            raise
        except Exception as e:
            raise AIProviderError(f"Unexpected error calling OpenAI: {str(e)}") from e

    def generate_image_bytes(
        self,
        prompt: str,
        *,
        model_id: str = "gpt-image-2.5-flare",
        size: str = "1024x1024",
        quality: str = "medium",
        output_format: str = "png",
        reference_images: list[tuple[bytes, str, str]] | None = None,
        timeout: int = 180,
    ) -> tuple[bytes, str]:
        """
        Generate an image via OpenAI GPT Image 2.5 (images.generate or images.edit with references).
        Returns (image_bytes, mime_type).
        """
        client = self._require_client()
        typed_quality = cast(OpenAIImageQuality, quality)
        typed_output_format = cast(OpenAIImageOutputFormat, output_format)

        try:
            if reference_images:
                image_files = []
                for idx, (img_bytes, mime_type, label) in enumerate(reference_images):
                    ext = "jpg" if "jpeg" in mime_type else ("webp" if "webp" in mime_type else "png")
                    safe_name = f"{label or 'ref'}_{idx}.{ext}"
                    image_files.append((safe_name, img_bytes, mime_type))

                response = client.images.edit(
                    model=model_id,
                    image=image_files if len(image_files) > 1 else image_files[0],
                    prompt=prompt,
                    n=1,
                    size=size,
                    quality=typed_quality,
                    output_format=typed_output_format,
                    input_fidelity="high",
                    timeout=timeout,
                )
            else:
                response = client.images.generate(
                    model=model_id,
                    prompt=prompt,
                    n=1,
                    size=size,
                    quality=typed_quality,
                    output_format=typed_output_format,
                    timeout=timeout,
                )

            data_list = getattr(response, "data", None) or []
            if not data_list:
                raise AIProviderError("OpenAI GPT Image 2.5 returned no generated image.")

            item = data_list[0]
            b64_payload = getattr(item, "b64_json", None)
            if b64_payload:
                return base64.b64decode(b64_payload), f"image/{output_format}"

            url = getattr(item, "url", None)
            if url:
                dl = requests.get(url, timeout=45)
                dl.raise_for_status()
                return dl.content, dl.headers.get("Content-Type", f"image/{output_format}")

            raise AIProviderError("OpenAI GPT Image 2.5 returned neither b64_json nor image URL.")

        except RateLimitError as e:
            raise AIRateLimitError("OpenAI GPT Image 2.5 rate limit exceeded.") from e
        except APITimeoutError as e:
            raise AITimeoutError("OpenAI GPT Image 2.5 generation timed out.") from e
        except APIConnectionError as e:
            raise AIProviderError("Failed to connect to OpenAI GPT Image 2.5.") from e
        except OpenAIError as e:
            raise AIProviderError(f"OpenAI GPT Image 2.5 error: {str(e)}") from e
        except (AIRateLimitError, AITimeoutError, AIProviderError):
            raise
        except Exception as e:
            raise AIProviderError(f"Unexpected error calling OpenAI GPT Image 2.5: {str(e)}") from e

    def generate_image(self, prompt, size="1024x1024", model_id=None, quality="medium"):
        """Backward-compatible wrapper returning a persisted storage URL."""
        resolved_model = model_id or getattr(settings, "OPENAI_IMAGE_MODEL_STANDARD", "gpt-image-2.5-flare")
        image_bytes, mime_type = self.generate_image_bytes(
            prompt,
            model_id=resolved_model,
            size=size,
            quality=quality,
        )
        extension = "jpg" if "jpeg" in mime_type else ("webp" if "webp" in mime_type else "png")
        saved_path = default_storage.save(
            f"generated_images/{uuid.uuid4()}.{extension}",
            ContentFile(image_bytes),
        )
        return default_storage.url(saved_path)
