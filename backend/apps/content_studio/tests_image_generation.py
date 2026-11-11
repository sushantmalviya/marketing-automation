import base64
import tempfile
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser, Organization, User
from apps.asset_library.models import Asset
from apps.billing.models import Transaction, Wallet
from apps.content_studio.ai.exceptions import AITimeoutError
from apps.content_studio.ai.image_specs import resolve_image_spec
from apps.content_studio.models import (
    BrandVoice,
    ContentDraft,
    ContentPlatform,
    ImageCreditRate,
    ImageGenerationJob,
)


TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class ImageParameterMappingTests(APITestCase):
    def test_google_nano_banana_mapping_all_options(self):
        for quality, expected_size in [("STANDARD", "1K"), ("HIGH", "2K"), ("ULTRA", "4K")]:
            for ratio in ("1:1", "4:5", "9:16", "16:9"):
                spec = resolve_image_spec("google_nano_banana", quality, ratio)
                self.assertEqual(spec.provider, "google")
                self.assertEqual(spec.provider_model_id, "gemini-nano-banana-2.1")
                self.assertEqual(spec.mapped_parameters["aspectRatio"], ratio)
                self.assertEqual(spec.mapped_parameters["imageSize"], expected_size)

    def test_openai_gpt_image_2_5_sizes_are_multiples_of_16(self):
        for quality in ("STANDARD", "HIGH", "ULTRA"):
            for ratio in ("1:1", "4:5", "9:16", "16:9"):
                spec = resolve_image_spec("openai_gpt_image_2_5", quality, ratio)
                self.assertEqual(spec.provider, "openai")
                w, h = map(int, spec.mapped_parameters["size"].split("x"))
                self.assertEqual(w % 16, 0)
                self.assertEqual(h % 16, 0)
                self.assertGreaterEqual(w * h, 655360)
                self.assertLessEqual(w * h, 8294400)


class AIImageGenerationAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Acme Marketing",
            slug="acme-mkt",
            external_company_id="EXT-ACME-1",
        )
        self.other_org = Organization.objects.create(
            name="Other Org",
            slug="other-org",
            external_company_id="EXT-OTHER-2",
        )
        self.user = User.objects.create_user(
            email="creator@acme.test",
            password="StrongPass123!",
            organization=self.org,
        )
        MAUser.objects.create(user=self.user, organization=self.org, role="USER")

        self.other_user = User.objects.create_user(
            email="other@other.test",
            password="StrongPass123!",
            organization=self.other_org,
        )
        MAUser.objects.create(user=self.other_user, organization=self.other_org, role="USER")

        self.wallet = Wallet.objects.create(organization=self.org, balance=100)
        self.other_wallet = Wallet.objects.create(organization=self.other_org, balance=100)

        self.client.force_authenticate(self.user)

    def _local_storage_override(self, tmpdir):
        return override_settings(
            MEDIA_ROOT=tmpdir,
            MEDIA_URL="/media/",
            STORAGES={
                "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
                "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
            },
        )

    def test_estimate_uses_server_pricing_and_db_overrides(self):
        res = self.client.post(
            "/api/content/images/estimate/",
            {"model": "google_nano_banana", "quality": "HIGH", "aspect_ratio": "4:5"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["credits"], 10)
        self.assertEqual(res.data["wallet_balance"], 100)
        self.assertTrue(res.data["sufficient_credits"])

        ImageCreditRate.objects.create(
            provider="google",
            model_key="google_nano_banana",
            quality="HIGH",
            credits=18,
            reference_image_surcharge=3,
        )
        res2 = self.client.post(
            "/api/content/images/estimate/",
            {"model": "google_nano_banana", "quality": "HIGH", "aspect_ratio": "4:5"},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["credits"], 18)

    @override_settings(GEMINI_IMAGE_MODEL="gemini-2.5-flash-image")
    def test_unsupported_quality_for_model_rejected_before_charging(self):
        res = self.client.post(
            "/api/content/images/generate/",
            {
                "prompt": "Minimal product shot",
                "model": "google_nano_banana",
                "quality": "ULTRA",
                "aspect_ratio": "1:1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)

    def test_insufficient_credits_blocks_generation(self):
        self.wallet.balance = 2
        self.wallet.save()

        res = self.client.post(
            "/api/content/images/generate/",
            {
                "prompt": "Minimal product shot",
                "model": "openai_gpt_image_2_5",
                "quality": "HIGH",
                "aspect_ratio": "16:9",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(res.data["code"], "insufficient_credits")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 2)

    @override_settings(GEMINI_API_KEY="test-gemini-key")
    @patch("apps.content_studio.ai.providers.gemini_provider.genai.Client")
    def test_google_nano_banana_generate_brand_identity_asset_and_idempotency(self, mock_genai_client):
        with tempfile.TemporaryDirectory() as tmpdir, self._local_storage_override(tmpdir):
            saved_logo = default_storage.save("assets/acme_logo.png", ContentFile(TINY_PNG))
            BrandVoice.objects.create(
                organization=self.org,
                brand_description="Eco-friendly coffee roaster",
                tone="Warm, Artisan",
                visual_style="Sunlit editorial tabletop photography",
                brand_colors=["#3B2F2F", "#D97706"],
                guidelines="Never show plastic cups",
                logo_url=f"/media/{saved_logo}",
                include_logo_in_images=True,
            )
            # Ensure another org's brand voice does not leak
            BrandVoice.objects.create(
                organization=self.other_org,
                brand_description="Secret competitor brand",
            )

            fake_part = SimpleNamespace(inline_data=SimpleNamespace(data=TINY_PNG, mime_type="image/png"))
            fake_response = SimpleNamespace(
                candidates=[SimpleNamespace(content=SimpleNamespace(parts=[fake_part]))]
            )
            mock_instance = MagicMock()
            mock_instance.models.generate_content.return_value = fake_response
            mock_genai_client.return_value = mock_instance

            payload = {
                "prompt": "Pour-over coffee on oak wood table",
                "model": "google_nano_banana",
                "quality": "HIGH",
                "aspect_ratio": "4:5",
                "idempotency_key": "idem-google-1",
                "credits": 0,  # Tampered client field must be ignored
            }
            res = self.client.post("/api/content/images/generate/", payload, format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data["credits_charged"], 12)  # 10 HIGH + 2 logo surcharge
            self.assertEqual(res.data["remaining_balance"], 88)
            self.assertFalse(res.data["deduplicated"])
            self.assertTrue(res.data["job"]["brand_identity_applied"])
            self.assertEqual(res.data["job"]["reference_image_count"], 1)

            # Verify SDK call args & Brand Identity prompt injection
            call_kwargs = mock_instance.models.generate_content.call_args.kwargs
            self.assertEqual(call_kwargs["model"], "gemini-nano-banana-2.1")
            self.assertEqual(call_kwargs["config"].image_config.aspect_ratio, "4:5")
            self.assertEqual(call_kwargs["config"].image_config.image_size, "2K")
            self.assertIsNone(call_kwargs["config"].temperature)
            prompt_sent = call_kwargs["contents"][0].text
            self.assertIn("Eco-friendly coffee roaster", prompt_sent)
            self.assertIn("#3B2F2F", prompt_sent)
            self.assertNotIn("Secret competitor brand", prompt_sent)

            # Verify Asset Library creation & retrieval
            self.assertEqual(Asset.objects.filter(uploaded_by=self.user).count(), 1)
            asset_res = self.client.get("/api/assets/")
            self.assertEqual(asset_res.status_code, status.HTTP_200_OK)
            self.assertEqual(asset_res.data["count"], 1)

            # Repeat with same idempotency_key -> must NOT deduct again or call AI again
            res_dup = self.client.post("/api/content/images/generate/", payload, format="json")
            self.assertEqual(res_dup.status_code, status.HTTP_200_OK)
            self.assertTrue(res_dup.data["deduplicated"])
            self.assertEqual(mock_instance.models.generate_content.call_count, 1)
            self.wallet.refresh_from_db()
            self.assertEqual(self.wallet.balance, 88)

            # Other tenant cannot see Acme's generation history
            self.client.force_authenticate(self.other_user)
            other_hist = self.client.get("/api/content/images/history/")
            self.assertEqual(other_hist.status_code, status.HTTP_200_OK)
            self.assertEqual(other_hist.data["count"], 0)

    @override_settings(OPENAI_API_KEY="test-openai-key")
    @patch("apps.content_studio.ai.providers.openai_provider.openai.OpenAI")
    def test_openai_gpt_image_2_5_ultra_and_failure_refund(self, mock_openai_cls):
        with tempfile.TemporaryDirectory() as tmpdir, self._local_storage_override(tmpdir):
            mock_client = MagicMock()
            mock_client.images.generate.return_value = SimpleNamespace(
                data=[SimpleNamespace(b64_json=base64.b64encode(TINY_PNG).decode("ascii"), url=None)]
            )
            mock_openai_cls.return_value = mock_client

            res = self.client.post(
                "/api/content/images/generate/",
                {
                    "prompt": "Luxury matte espresso machine",
                    "model": "openai_gpt_image_2_5",
                    "quality": "ULTRA",
                    "aspect_ratio": "16:9",
                    "idempotency_key": "idem-openai-ok",
                },
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data["credits_charged"], 25)
            self.assertEqual(res.data["remaining_balance"], 75)

            gen_kwargs = mock_client.images.generate.call_args.kwargs
            self.assertEqual(gen_kwargs["model"], "gpt-image-2.5-sunburst")
            self.assertEqual(gen_kwargs["quality"], "max")
            self.assertEqual(gen_kwargs["size"], "2560x1440")
            self.assertEqual(gen_kwargs["output_format"], "png")

            # Now simulate timeout failure -> credits must be refunded automatically
            mock_client.images.generate.side_effect = AITimeoutError("OpenAI timeout")
            res_fail = self.client.post(
                "/api/content/images/generate/",
                {
                    "prompt": "Another shot",
                    "model": "openai_gpt_image_2_5",
                    "quality": "STANDARD",
                    "aspect_ratio": "1:1",
                    "idempotency_key": "idem-openai-fail",
                },
                format="json",
            )
            self.assertEqual(res_fail.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
            self.assertTrue(res_fail.data["refunded"])
            self.assertEqual(res_fail.data["refunded_credits"], 8)
            self.assertEqual(res_fail.data["remaining_balance"], 75)

            self.wallet.refresh_from_db()
            self.assertEqual(self.wallet.balance, 75)
            failed_job = ImageGenerationJob.objects.get(idempotency_key="idem-openai-fail")
            self.assertEqual(failed_job.status, ImageGenerationJob.Status.FAILED)
            self.assertEqual(failed_job.refunded_credits, 8)
            self.assertEqual(
                Transaction.objects.filter(
                    wallet=self.wallet,
                    reference_id=str(failed_job.id),
                    transaction_type=Transaction.Type.CREDIT,
                ).count(),
                1,
            )

    def test_caption_generation_updates_content_platform(self):
        from apps.content_studio.ai.services import AILifecycleService

        draft = ContentDraft.objects.create(owner=self.user, original_prompt="Coffee launch", enhanced_prompt="Coffee launch")
        platform = ContentPlatform.objects.create(draft=draft, platform=ContentPlatform.PlatformChoices.INSTAGRAM)
        service = AILifecycleService()
        with patch.object(service.orchestrator, "build_and_generate_caption", return_value="Fresh brew caption!"):
            service.generate_caption_for_platform(platform, self.user)
        platform.refresh_from_db()
        self.assertEqual(platform.caption_text, "Fresh brew caption!")

    @override_settings(GEMINI_API_KEY="test-gemini-key")
    @patch("apps.content_studio.ai.providers.gemini_provider.genai.Client")
    def test_merged_content_generator_estimate_and_draft_regenerate(self, mock_genai_client_cls):
        # 1. Combined estimate: Nano Banana HIGH (10 cr) + 2 channels * 5 cr caption (10 cr) = 20 cr
        est_res = self.client.post(
            "/api/content/images/estimate/",
            {
                "model": "google_nano_banana",
                "quality": "HIGH",
                "aspect_ratio": "4:5",
                "generate_image": True,
                "caption_count": 2,
            },
            format="json",
        )
        self.assertEqual(est_res.status_code, status.HTTP_200_OK)
        self.assertEqual(est_res.data["image_credits"], 10)
        self.assertEqual(est_res.data["caption_credits"], 10)
        self.assertEqual(est_res.data["credits"], 20)

        # Preset asset skips image credits -> only captions (2 * 5 = 10)
        preset_est = self.client.post(
            "/api/content/images/estimate/",
            {
                "model": "google_nano_banana",
                "quality": "ULTRA",
                "aspect_ratio": "1:1",
                "generate_image": False,
                "caption_count": 2,
            },
            format="json",
        )
        self.assertEqual(preset_est.status_code, status.HTTP_200_OK)
        self.assertEqual(preset_est.data["image_credits"], 0)
        self.assertEqual(preset_est.data["caption_credits"], 10)
        self.assertEqual(preset_est.data["credits"], 10)

        # 2. Create draft with chosen image options
        create_res = self.client.post(
            "/api/content/content-drafts/",
            {
                "original_prompt": "Launch summer cold brew",
                "platforms": ["INSTAGRAM", "LINKEDIN"],
                "image_model": "google_nano_banana",
                "image_quality": "HIGH",
                "image_aspect_ratio": "4:5",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        draft_id = create_res.data["id"]
        self.assertEqual(create_res.data["image_model"], "google_nano_banana")
        self.assertEqual(create_res.data["image_quality"], "HIGH")
        self.assertEqual(create_res.data["image_aspect_ratio"], "4:5")

        fake_part = SimpleNamespace(inline_data=SimpleNamespace(data=TINY_PNG, mime_type="image/png"))
        fake_response = SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[fake_part]))])
        mock_instance = MagicMock()
        mock_instance.models.generate_content.return_value = fake_response
        mock_genai_client_cls.return_value = mock_instance

        with tempfile.TemporaryDirectory() as tmpdir, self._local_storage_override(tmpdir):
            with patch(
                "apps.content_studio.ai.orchestrator.AIOrchestrator.build_and_generate_caption",
                return_value="Cold brew caption!",
            ):
                regen_res = self.client.post(
                    f"/api/content/content-drafts/{draft_id}/regenerate/",
                    {
                        "reason": "Initial content generation",
                        "generate_images": True,
                        "generate_captions": True,
                        "model": "google_nano_banana",
                        "quality": "HIGH",
                        "aspect_ratio": "4:5",
                        "idempotency_key": "merged-draft-1",
                    },
                    format="json",
                )

            self.assertEqual(regen_res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(regen_res.data["remaining_balance"], 80)  # 100 - (10 img + 2*5 captions)

            draft = ContentDraft.objects.get(id=draft_id)
            self.assertEqual(draft.image_quality, "HIGH")
            self.assertEqual(draft.image_aspect_ratio, "4:5")
            for plat in draft.platforms.all():
                self.assertEqual(plat.caption_text, "Cold brew caption!")
                self.assertEqual(plat.images.count(), 1)

            # 3. Regenerate image with user change notes and verify prompt includes change note
            regen_img_res = self.client.post(
                f"/api/content/content-drafts/{draft_id}/regenerate/",
                {
                    "reason": "Add golden morning sunlight and ice cubes",
                    "generate_images": True,
                    "generate_captions": False,
                    "model": "google_nano_banana",
                    "quality": "STANDARD",
                    "aspect_ratio": "16:9",
                    "idempotency_key": "merged-draft-2",
                },
                format="json",
            )
            self.assertEqual(regen_img_res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(regen_img_res.data["remaining_balance"], 75)  # 80 - 5 Standard
            latest_job = ImageGenerationJob.objects.get(idempotency_key="merged-draft-2")
            self.assertIn("Add golden morning sunlight and ice cubes", latest_job.final_prompt)
            self.assertEqual(latest_job.aspect_ratio, "16:9")

            # 4. Insufficient combined balance aborts cleanly without debiting
            self.wallet.balance = 12
            self.wallet.save()
            insuff_res = self.client.post(
                f"/api/content/content-drafts/{draft_id}/regenerate/",
                {
                    "reason": "Another pass",
                    "generate_images": True,
                    "generate_captions": True,
                    "model": "google_nano_banana",
                    "quality": "HIGH",
                    "aspect_ratio": "1:1",
                    "idempotency_key": "merged-draft-insuff",
                },
                format="json",
            )
            self.assertEqual(insuff_res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
            self.wallet.refresh_from_db()
            self.assertEqual(self.wallet.balance, 12)

