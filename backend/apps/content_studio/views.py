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

class BrandVoiceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand_voice, created = BrandVoice.objects.get_or_create()
        serializer = BrandVoiceSerializer(brand_voice)
        return Response(serializer.data)

    def put(self, request):
        brand_voice, created = BrandVoice.objects.get_or_create()
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
        from .serializers import AnalyzePromptSerializer
        from .ai.services import AILifecycleService
        
        serializer = AnalyzePromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        prompt = serializer.validated_data['prompt']
        lifecycle = AILifecycleService()
        
        try:
            result = lifecycle.process_content_spec_and_questions(prompt)
            return Response(result, status=status.HTTP_200_OK)
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
        serializer = ContentDraftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
            
        platforms = serializer.validated_data['platforms']
        original_prompt = serializer.validated_data['original_prompt']
        preset_image_id = serializer.validated_data.get('preset_image_id')
        
        draft = ContentDraftService.create_content_draft(
            request.user, 
            original_prompt, 
            platforms,
            preset_image_id=preset_image_id
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
        for field in ('caption_text', 'hashtags', 'cta'):
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
        if request.user.role not in ['ADMIN', 'SUPER_ADMIN']:
            return Response({"error": "Only Admins can approve contents."}, status=status.HTTP_403_FORBIDDEN)
            
        draft = self.get_object()
        notes = request.data.get('notes', '')
        try:
            ApprovalService.approve_content(draft, request.user, notes)
            return Response({"message": "Content approved."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role not in ['ADMIN', 'SUPER_ADMIN']:
            return Response({"error": "Only Admins can reject contents."}, status=status.HTTP_403_FORBIDDEN)
            
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
        draft = self.get_object()
        reason = request.data.get('reason', '')
        
        # Granular regeneration flags
        generate_images = request.data.get('generate_images', True)
        generate_captions = request.data.get('generate_captions', True)
        
        try:
            # First create the version snapshot
            version = ContentDraftService.create_content_version(draft, request.user, reason)
            
            # Now trigger actual generation
            from apps.content_studio.ai.services import AILifecycleService
            lifecycle = AILifecycleService()
            
            if generate_images and draft.platforms.exists():
                lifecycle.generate_shared_image_for_draft(draft, request.user, reason)
                
            for platform in draft.platforms.all():
                if generate_captions:
                    lifecycle.generate_caption_for_platform(platform, request.user, reason)
                
            return Response({
                "message": "Content generated successfully.",
                "version_id": version.id,
                "version_number": version.version_number
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
