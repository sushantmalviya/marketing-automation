from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.campaigns.serializers import (
    TemplateCreateSerializer,
    TemplateSerializer,
    CampaignTemplateAssignSerializer,
    TemplateUpdateSerializer
)
from apps.campaigns.services import (
    TemplateService,
    CampaignTemplateService
)

class TemplateCreateAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def post(self, request):

        serializer = TemplateCreateSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        template = TemplateService.create_template(
            validated_data=serializer.validated_data,
            user=request.user,
        )

        return Response(
            TemplateSerializer(template).data,
            status=status.HTTP_201_CREATED,
        )
    
class TemplateListAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):

        templates = TemplateService.list_templates(user=request.user)

        return Response(
            TemplateSerializer(
                templates,
                many=True,
            ).data
        )
    

class CampaignTemplateAssignAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def post(self, request):

        serializer = CampaignTemplateAssignSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        campaign_template = CampaignTemplateService.assign_template(
            validated_data=serializer.validated_data,
            user=request.user,
        )

        return Response(
            {
                "message": "Template assigned to campaign successfully."
            },
            status=status.HTTP_201_CREATED,
        )
    
class TemplateUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, template_id):
        template = TemplateService.get_template_for_user(template_id, request.user)
        
        serializer = TemplateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        template = TemplateService.update_template(
            template=template,
            user=request.user,
            validated_data=serializer.validated_data,
        )

        return Response(
            {
                "message": "Template updated successfully.",
                "campaign_status": "DRAFT"
            },
            status=status.HTTP_200_OK,
        )


class TemplateSubmitAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, template_id):
        template = TemplateService.get_template_for_user(template_id, request.user)
        
        is_whatsapp = (
            getattr(template.channel, "code", "") == "WHATSAPP"
            or template.channel.name.upper() == "WHATSAPP"
        )
        if not is_whatsapp:
            return Response(
                {"detail": "Only WhatsApp templates can be submitted for verification."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        import uuid
        correlation_id = uuid.uuid4().hex[:12]
        from apps.communications.services.whatsapp import (
            submit_whatsapp_template,
            WhatsAppServiceError,
            MediaDownloadError,
            MetaUploadError,
            MetaTemplateRejectionError,
            MetaNetworkError,
        )
        try:
            template = submit_whatsapp_template(
                template,
                user=request.user,
                correlation_id=correlation_id,
            )
        except ValueError as e:
            return Response({
                "detail": str(e),
                "error_code": "VALIDATION_ERROR",
                "correlation_id": correlation_id,
            }, status=status.HTTP_400_BAD_REQUEST)
        except MetaTemplateRejectionError as e:
            return Response({
                "detail": e.message,
                "error_code": "META_TEMPLATE_REJECTED",
                "correlation_id": correlation_id,
                "meta_subcode": e.subcode,
                "meta_user_title": e.user_title,
                "meta_user_msg": e.user_msg,
                "meta_details": e.details,
                "fbtrace_id": e.fbtrace_id,
            }, status=status.HTTP_400_BAD_REQUEST)
        except MediaDownloadError as e:
            http_status = status.HTTP_400_BAD_REQUEST if e.is_client_error else status.HTTP_502_BAD_GATEWAY
            return Response({
                "detail": str(e),
                "error_code": "MEDIA_DOWNLOAD_ERROR",
                "correlation_id": correlation_id,
            }, status=http_status)
        except MetaNetworkError as e:
            http_status = status.HTTP_504_GATEWAY_TIMEOUT if e.is_timeout else status.HTTP_502_BAD_GATEWAY
            return Response({
                "detail": str(e),
                "error_code": "META_TIMEOUT" if e.is_timeout else "META_NETWORK_ERROR",
                "correlation_id": correlation_id,
                "is_ambiguous": e.is_ambiguous,
            }, status=http_status)
        except MetaUploadError as e:
            return Response({
                "detail": str(e),
                "error_code": "META_UPLOAD_ERROR",
                "correlation_id": correlation_id,
            }, status=status.HTTP_502_BAD_GATEWAY)
        except RuntimeError as e:
            return Response({
                "detail": str(e),
                "error_code": "SUBMISSION_FAILED",
                "correlation_id": correlation_id,
            }, status=status.HTTP_502_BAD_GATEWAY)

        return Response(
            {
                "message": "Template submitted to Meta successfully",
                "provider_data": template.provider_data,
                "meta_status": template.provider_data.get("meta_status", "PENDING"),
                "correlation_id": correlation_id,
            },
            status=status.HTTP_200_OK
        )


class TemplateSyncStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, template_id):
        template = TemplateService.get_template_for_user(template_id, request.user)

        is_whatsapp = (
            getattr(template.channel, "code", "") == "WHATSAPP"
            or template.channel.name.upper() == "WHATSAPP"
        )
        if not is_whatsapp:
            return Response(
                {"detail": "Only WhatsApp templates can be synchronized with Meta."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.communications.services.whatsapp import sync_whatsapp_template_status
        try:
            template = sync_whatsapp_template_status(template, user=request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(
            {
                "message": "Template status synchronized successfully",
                "provider_data": template.provider_data,
                "meta_status": template.provider_data.get("meta_status", "UNKNOWN"),
            },
            status=status.HTTP_200_OK
        )


class TemplateDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, template_id):
        template = TemplateService.get_template_for_user(template_id, request.user)
        
        TemplateService.delete_template(
            template=template,
            user=request.user,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
