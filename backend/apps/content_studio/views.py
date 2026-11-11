from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404


from apps.asset_library.models import Asset
from apps.asset_library.serializers import AssetSerializer, AssetCreateSerializer
import os, uuid
from django.conf import settings
from django.core.files.storage import default_storage


def _detect_asset_type(filename):
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    if ext in {"jpg","jpeg","png","webp","gif","svg","bmp"}:
        return Asset.AssetType.IMAGE
    if ext in {"mp4","mov","avi","mkv","webm","m4v"}:
        return Asset.AssetType.VIDEO
    if ext in {"pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv"}:
        return Asset.AssetType.DOCUMENT
    return Asset.AssetType.OTHER


class AssetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "size"
    max_page_size = 200


class AssetLibraryView(APIView):
    """GET /api/content/assets/ — list assets for the current user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Asset.objects.filter(
            uploaded_by=request.user
        ).select_related("uploaded_by").prefetch_related("tags")

        asset_type = request.query_params.get("type")
        if asset_type:
            qs = qs.filter(asset_type=asset_type.upper())

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(name__icontains=search)

        paginator = AssetPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AssetSerializer(page, many=True).data)

    def post(self, request):
        ser = AssetCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        file_url = data.get("file_url", "")
        uploaded_file = data.get("file")
        if uploaded_file:
            ext = os.path.splitext(uploaded_file.name)[1]
            save_path = f"assets/{uuid.uuid4().hex}{ext}"
            saved = default_storage.save(save_path, uploaded_file)
            file_url = request.build_absolute_uri(settings.MEDIA_URL + saved)

        asset_type = data.get("asset_type") or _detect_asset_type(data["name"])
        asset = Asset.objects.create(
            name=data["name"],
            file_url=file_url,
            asset_type=asset_type,
            is_personal=data.get("is_personal", False),
            uploaded_by=request.user,
        )
        return Response(AssetSerializer(asset).data, status=status.HTTP_201_CREATED)



from rest_framework import generics
from .models import BrandVoice, ContentTemplate
from .serializers import BrandVoiceSerializer, ContentTemplateSerializer

def _get_or_create_brand_voice_for_user(user):
    organization = getattr(user, "organization", None)
    if organization is not None:
        brand_voice, _ = BrandVoice.objects.get_or_create(organization=organization)
        return brand_voice
    brand_voice = BrandVoice.objects.filter(organization__isnull=True).order_by("created_at").first()
    if not brand_voice:
        brand_voice = BrandVoice.objects.create()
    return brand_voice


class BrandVoiceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand_voice = _get_or_create_brand_voice_for_user(request.user)
        serializer = BrandVoiceSerializer(brand_voice)
        return Response(serializer.data)

    def put(self, request):
        brand_voice = _get_or_create_brand_voice_for_user(request.user)
        serializer = BrandVoiceSerializer(brand_voice, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ContentTemplateListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContentTemplateSerializer

    def get_queryset(self):
        return ContentTemplate.objects.all()

    def perform_create(self, serializer):
        serializer.save()

class ContentTemplateDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContentTemplateSerializer

    def get_queryset(self):
        return ContentTemplate.objects.all()



# --- New Content Workflow Views ---
from rest_framework import viewsets
from rest_framework.decorators import action
from apps.accounts.permissions import IsContentStudioAuthorized
from .models import ContentDraft
from .serializers import (
    ContentDraftSerializer, ContentDraftCreateSerializer,
    ContentDraftUpdateSerializer, ContentScheduleSerializer
)
from .services.content_draft_service import ContentDraftService
from .services.approval_service import ApprovalService
from .services.schedule_service import ScheduleService
from .services.publishing_service import PublishingService

class ContentDraftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsContentStudioAuthorized]
    serializer_class = ContentDraftSerializer

    def get_queryset(self):
        from apps.common.utils import filter_by_tenant
        from django.utils.dateparse import parse_date
        from django.utils import timezone
        import datetime

        qs = filter_by_tenant(
            ContentDraft.objects.select_related('owner').prefetch_related(
                'platforms__images__asset',
                'approvals',
                'versions',
            ),
            self.request.user,
            'owner',
        )

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_from:
            parsed = parse_date(date_from)
            if parsed:
                qs = qs.filter(created_at__date__gte=parsed)

        if date_to:
            parsed = parse_date(date_to)
            if parsed:
                qs = qs.filter(created_at__date__lte=parsed)

        return qs

    @action(detail=False, methods=['post'])
    def analyze_prompt(self, request):
        from apps.billing.services import InsufficientCreditsError
        from .ai.exceptions import AIProviderError, AIRateLimitError, AITimeoutError
        from .serializers import AnalyzePromptSerializer
        from .ai.services import AILifecycleService

        serializer = AnalyzePromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prompt = serializer.validated_data['prompt']
        lifecycle = AILifecycleService()

        try:
            result = lifecycle.process_content_spec_and_questions(prompt, user=request.user)
            return Response(result, status=status.HTTP_200_OK)
        except InsufficientCreditsError as e:
            return Response(
                {"error": str(e), "code": "insufficient_credits"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        except AIRateLimitError as e:
            return Response({"error": str(e)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except AITimeoutError as e:
            return Response({"error": str(e)}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except AIProviderError as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def enhance_prompt(self, request, pk=None):
        from .serializers import EnhancePromptSerializer
        from .ai.services import AILifecycleService
        
        draft = self.get_object()
        serializer = EnhancePromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        content_spec = serializer.validated_data['content_spec']
        user_answers = serializer.validated_data['user_answers']
        
        lifecycle = AILifecycleService()
        try:
            enhanced_prompt, version = lifecycle.enhance_content_prompt(draft, content_spec, user_answers, request.user)
            return Response({
                "enhanced_prompt": enhanced_prompt,
                "version_id": version.id
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        from .ai.exceptions import UnsupportedImageOptionError
        from .ai.image_specs import resolve_image_spec

        serializer = ContentDraftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        platforms = serializer.validated_data['platforms']
        original_prompt = serializer.validated_data['original_prompt']
        preset_image_id = serializer.validated_data.get('preset_image_id')
        image_model = serializer.validated_data.get('image_model') or 'google_nano_banana'
        image_quality = serializer.validated_data.get('image_quality') or 'STANDARD'
        image_aspect_ratio = serializer.validated_data.get('image_aspect_ratio') or '1:1'

        try:
            spec = resolve_image_spec(
                model_key=image_model,
                quality=image_quality,
                aspect_ratio=image_aspect_ratio,
            )
        except UnsupportedImageOptionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        draft = ContentDraftService.create_content_draft(
            request.user,
            original_prompt,
            platforms,
            preset_image_id=preset_image_id,
            image_model=spec.model_key,
            image_quality=spec.quality,
            image_aspect_ratio=spec.aspect_ratio,
        )

        return Response(ContentDraftSerializer(draft).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        draft = self.get_object()
        serializer = ContentDraftUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        updated_draft = ContentDraftService.update_content_partial(draft, serializer.validated_data)
        return Response(ContentDraftSerializer(updated_draft).data)

    @action(detail=True, methods=['patch'], url_path=r'platforms/(?P<platform_id>[^/.]+)')
    def update_platform(self, request, pk=None, platform_id=None):
        """Persist caption edits or remove media for one generated platform."""
        from .serializers import ContentPlatformSerializer

        draft = self.get_object()
        platform = get_object_or_404(draft.platforms.all(), id=platform_id)
        for field in ('caption_text', 'hashtags', 'cta', 'location_id', 'first_comment'):
            if field in request.data:
                setattr(platform, field, request.data[field])
        platform.is_manually_edited = True
        platform.save()
        if request.data.get('remove_images'):
            platform.images.all().delete()
        return Response(ContentPlatformSerializer(platform).data)

    @action(detail=True, methods=['post'])
    def request_approval(self, request, pk=None):
        draft = self.get_object()
        try:
            ApprovalService.request_approval(draft)
            return Response({"message": "Approval requested successfully."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role not in ['ADMIN', 'USER']:
            return Response({"error": "Only Admins and Users can approve contents."}, status=status.HTTP_403_FORBIDDEN)
            
        draft = self.get_object()
        notes = request.data.get('notes', '')
        try:
            ApprovalService.approve_content(draft, request.user, notes)
            return Response({"message": "Content approved."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role not in ['ADMIN', 'USER']:
            return Response({"error": "Only Admins and Users can reject contents."}, status=status.HTTP_403_FORBIDDEN)
            
        draft = self.get_object()
        notes = request.data.get('notes', '')
        try:
            ApprovalService.reject_content(draft, request.user, notes)
            return Response({"message": "Content rejected."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        draft = self.get_object()
        serializer = ContentScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            ScheduleService.save_schedules(draft, serializer.validated_data['schedules'])
            return Response({"message": "Schedules saved successfully."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regeneration to capture version snapshot and call AI"""
        from apps.billing.services import BillingService, InsufficientCreditsError
        from apps.content_studio.ai.exceptions import (
            AIProviderError,
            AIRateLimitError,
            AITimeoutError,
            DuplicateImageRequestError,
            UnsupportedImageOptionError,
        )
        from apps.content_studio.ai.image_generation_service import ImageGenerationService
        from apps.content_studio.models import ImageGenerationJob

        draft = self.get_object()
        reason = request.data.get('reason', '')

        # Granular regeneration flags
        generate_images = bool(request.data.get('generate_images', True))
        generate_captions = bool(request.data.get('generate_captions', True))
        model = request.data.get('model') or draft.image_model or 'google_nano_banana'
        quality = request.data.get('quality') or draft.image_quality or 'STANDARD'
        aspect_ratio = request.data.get('aspect_ratio') or draft.image_aspect_ratio or '1:1'
        idempotency_key = (request.data.get('idempotency_key') or '').strip()

        organization = getattr(request.user, "organization", None)
        has_platforms = draft.platforms.exists()
        will_generate_image = generate_images and has_platforms

        # Check idempotent completed image replay before creating a new version or checking balance
        is_replayed_image = False
        if will_generate_image and idempotency_key:
            existing_job = ImageGenerationJob.objects.filter(
                user=request.user,
                idempotency_key=idempotency_key,
            ).first()
            if existing_job and existing_job.status == ImageGenerationJob.Status.COMPLETED:
                is_replayed_image = True

        try:
            platform_count = draft.platforms.count() if generate_captions else 0
            if (will_generate_image and not is_replayed_image) or platform_count > 0:
                estimate = ImageGenerationService.estimate_for_user(
                    user=request.user,
                    model_key=model,
                    quality=quality,
                    aspect_ratio=aspect_ratio,
                    generate_image=bool(will_generate_image and not is_replayed_image),
                    caption_count=platform_count,
                )
                if not estimate["sufficient_credits"]:
                    raise InsufficientCreditsError(
                        f"Not enough credits. Available balance: {estimate['wallet_balance']}, "
                        f"required: {estimate['credits']}."
                    )

            from apps.content_studio.ai.services import AILifecycleService
            lifecycle = AILifecycleService()

            if will_generate_image:
                lifecycle.generate_shared_image_for_draft(
                    draft,
                    request.user,
                    reason,
                    model=model,
                    quality=quality,
                    aspect_ratio=aspect_ratio,
                    idempotency_key=idempotency_key or None,
                )
                version = draft.versions.order_by("-version_number").first()
            else:
                version = None

            if generate_captions:
                for platform in draft.platforms.all():
                    lifecycle.generate_caption_for_platform(platform, request.user, reason)
                if version is None:
                    version = draft.versions.order_by("-version_number").first()

            if version is None:
                version = ContentDraftService.create_content_version(draft, request.user, reason)

            return Response({
                "message": "Content generated successfully.",
                "version_id": version.id,
                "version_number": version.version_number,
                "remaining_balance": BillingService.get_balance(organization=organization),
            }, status=status.HTTP_201_CREATED)
        except InsufficientCreditsError as e:
            return Response(
                {
                    "error": str(e),
                    "code": "insufficient_credits",
                    "remaining_balance": BillingService.get_balance(organization=organization),
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        except UnsupportedImageOptionError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DuplicateImageRequestError as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)
        except AIRateLimitError as e:
            return Response(
                {
                    "error": str(e),
                    "job_id": getattr(e, "job_id", None),
                    "refunded": getattr(e, "refunded", False),
                    "refunded_credits": getattr(e, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        e, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except AITimeoutError as e:
            return Response(
                {
                    "error": str(e),
                    "job_id": getattr(e, "job_id", None),
                    "refunded": getattr(e, "refunded", False),
                    "refunded_credits": getattr(e, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        e, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except AIProviderError as e:
            return Response(
                {
                    "error": str(e),
                    "job_id": getattr(e, "job_id", None),
                    "refunded": getattr(e, "refunded", False),
                    "refunded_credits": getattr(e, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        e, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "refunded": getattr(e, "refunded", False),
                    "refunded_credits": getattr(e, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        e, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        draft = self.get_object()
        try:
            PublishingService.publish_content(draft, request.user)
            # Reload to get updated statuses
            draft.refresh_from_db()
            return Response(ContentDraftSerializer(draft).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ImageConfigAPIView(APIView):
    """GET /api/content/images/config/ — supported AI image models, quality/aspect options & balance."""

    permission_classes = [IsAuthenticated, IsContentStudioAuthorized]

    def get(self, request):
        from apps.billing.services import BillingService
        from .ai.image_generation_service import (
            _get_configured_reference_entries,
            _has_meaningful_brand_identity,
            get_brand_voice_for_user,
            serialize_brand_identity,
        )
        from .ai.image_specs import get_model_capabilities

        organization = getattr(request.user, "organization", None)
        brand_voice = get_brand_voice_for_user(request.user)
        brand_dict = serialize_brand_identity(brand_voice)
        ref_entries = _get_configured_reference_entries(brand_dict)

        return Response({
            "models": get_model_capabilities(),
            "qualities": [
                {"key": "STANDARD", "label": "Standard"},
                {"key": "HIGH", "label": "High"},
                {"key": "ULTRA", "label": "Ultra"},
            ],
            "aspect_ratios": ["1:1", "4:5", "9:16", "16:9"],
            "wallet_balance": BillingService.get_balance(organization=organization),
            "brand_identity_active": _has_meaningful_brand_identity(brand_dict),
            "brand_logo_injected": bool(brand_dict.get("include_logo_in_images") and brand_dict.get("logo_url")),
            "brand_reference_count": len(ref_entries),
        })


class ImageEstimateAPIView(APIView):
    """GET/POST /api/content/images/estimate/ — authoritative credit calculation before generation."""

    permission_classes = [IsAuthenticated, IsContentStudioAuthorized]

    def _estimate(self, request, payload):
        from .serializers import ImageEstimateRequestSerializer
        from .ai.image_generation_service import ImageGenerationService
        from .ai.exceptions import UnsupportedImageOptionError

        ser = ImageEstimateRequestSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            estimate = ImageGenerationService.estimate_for_user(
                user=request.user,
                model_key=data["model"],
                quality=data["quality"],
                aspect_ratio=data["aspect_ratio"],
                generate_image=data.get("generate_image", True),
                caption_count=data.get("caption_count", 0),
            )
            return Response(estimate, status=status.HTTP_200_OK)
        except UnsupportedImageOptionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        return self._estimate(request, request.query_params)

    def post(self, request):
        return self._estimate(request, request.data)


class ImageGenerateAPIView(APIView):
    """POST /api/content/images/generate/ — generate an AI image with Brand Identity, credits & Asset sync."""

    permission_classes = [IsAuthenticated, IsContentStudioAuthorized]

    def post(self, request):
        from apps.billing.services import BillingService, InsufficientCreditsError
        from .serializers import ImageGenerateRequestSerializer, ImageGenerationJobSerializer
        from .ai.image_generation_service import ImageGenerationService
        from .ai.exceptions import (
            AIProviderError,
            AIRateLimitError,
            AITimeoutError,
            DuplicateImageRequestError,
            UnsupportedImageOptionError,
        )

        ser = ImageGenerateRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        service = ImageGenerationService()
        organization = getattr(request.user, "organization", None)

        try:
            result = service.generate_for_user(
                user=request.user,
                prompt=data["prompt"],
                model_key=data["model"],
                quality=data["quality"],
                aspect_ratio=data["aspect_ratio"],
                idempotency_key=data.get("idempotency_key"),
            )
            job_data = ImageGenerationJobSerializer(result["job"]).data
            asset_data = AssetSerializer(result["asset"]).data if result["asset"] else None
            http_status = status.HTTP_200_OK if result.get("deduplicated") else status.HTTP_201_CREATED
            return Response(
                {
                    "job": job_data,
                    "asset": asset_data,
                    "image_url": result["image_url"],
                    "credits_charged": result["credits_charged"],
                    "remaining_balance": result["remaining_balance"],
                    "deduplicated": bool(result.get("deduplicated")),
                },
                status=http_status,
            )
        except UnsupportedImageOptionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except InsufficientCreditsError as exc:
            return Response(
                {
                    "error": str(exc),
                    "code": "insufficient_credits",
                    "remaining_balance": BillingService.get_balance(organization=organization),
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        except DuplicateImageRequestError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except AIRateLimitError as exc:
            return Response(
                {
                    "error": str(exc),
                    "job_id": getattr(exc, "job_id", None),
                    "refunded": getattr(exc, "refunded", False),
                    "refunded_credits": getattr(exc, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        exc, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except AITimeoutError as exc:
            return Response(
                {
                    "error": str(exc),
                    "job_id": getattr(exc, "job_id", None),
                    "refunded": getattr(exc, "refunded", False),
                    "refunded_credits": getattr(exc, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        exc, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except AIProviderError as exc:
            return Response(
                {
                    "error": str(exc),
                    "job_id": getattr(exc, "job_id", None),
                    "refunded": getattr(exc, "refunded", False),
                    "refunded_credits": getattr(exc, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        exc, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            return Response(
                {
                    "error": str(exc),
                    "job_id": getattr(exc, "job_id", None),
                    "refunded": getattr(exc, "refunded", False),
                    "refunded_credits": getattr(exc, "refunded_credits", 0),
                    "remaining_balance": getattr(
                        exc, "remaining_balance", BillingService.get_balance(organization=organization)
                    ),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ImageHistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "size"
    max_page_size = 100


class ImageHistoryAPIView(APIView):
    """GET /api/content/images/history/ — paginated AI image generation history for current tenant."""

    permission_classes = [IsAuthenticated, IsContentStudioAuthorized]

    def get(self, request):
        from apps.common.utils import filter_by_tenant
        from .models import ImageGenerationJob
        from .serializers import ImageGenerationJobSerializer

        qs = filter_by_tenant(
            ImageGenerationJob.objects.select_related("asset", "user"),
            request.user,
            "user",
        )
        paginator = ImageHistoryPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(ImageGenerationJobSerializer(page, many=True).data)
