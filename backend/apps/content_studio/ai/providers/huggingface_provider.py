import logging
from django.conf import settings
from ..exceptions import AIProviderError

logger = logging.getLogger(__name__)

class HuggingFaceProvider:
    """
    Provider wrapper for Hugging Face Inference API.
    Handles formatting of calls, structured responses, and exception translation.
    """
    
    def __init__(self):
        self.api_key = getattr(settings, "HF_TOKEN", None)
        self.model = getattr(settings, "HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-dev")
        if self.model == "stabilityai/stable-diffusion-xl-base-1.0":
            self.model = "black-forest-labs/FLUX.1-dev"
        
        if not self.api_key:
            logger.warning("HF_TOKEN not set. Hugging Face API calls will fail.")

    def generate_text(self, prompt, model=None, max_tokens=1000, temperature=0.7, json_response=False):
        """
        Calls the Hugging Face API to generate text.
        """
        if not self.api_key:
            raise AIProviderError("Hugging Face API token (HF_TOKEN) is not configured.")

        try:
            from huggingface_hub import InferenceClient
            client = InferenceClient(provider="auto", api_key=self.api_key)
            
            model = getattr(settings, "HF_TEXT_MODEL", model) or "Qwen/Qwen2.5-7B-Instruct"

            messages = [{"role": "user", "content": prompt}]
            
            response = client.chat_completion(
                messages,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            text = response.choices[0].message.content.strip()
            if not text:
                raise AIProviderError("Hugging Face returned no generated text.")
            return text
            
        except Exception as exc:
            logger.exception("Hugging Face text generation failed")
            raise AIProviderError(f"Hugging Face text generation failed: {exc}") from exc

    def generate_image(self, prompt, size="1024x1024"):
        """
        Generate an image through Hugging Face Inference Providers and persist it.
        """
        if not self.api_key:
            raise AIProviderError("Hugging Face API token (HF_TOKEN) is not configured.")

        try:
            from huggingface_hub import InferenceClient

            client = InferenceClient(provider="auto", api_key=self.api_key)
            image = client.text_to_image(prompt, model=self.model)

            import io
            import uuid
            from django.core.files.base import ContentFile
            from django.core.files.storage import default_storage

            image_bytes = io.BytesIO()
            image.save(image_bytes, format="JPEG", quality=92)
            saved_path = default_storage.save(
                f"generated_images/{uuid.uuid4()}.jpg",
                ContentFile(image_bytes.getvalue()),
            )
            return default_storage.url(saved_path)
        except AIProviderError:
            raise
        except Exception as exc:
            logger.exception("Hugging Face image generation failed")
            raise AIProviderError(f"Hugging Face image generation failed: {exc}") from exc
