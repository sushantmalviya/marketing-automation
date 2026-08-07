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
        
        if template.channel.name.upper() != "WHATSAPP":
            return Response(
                {"detail": "Only WhatsApp templates can be submitted for verification."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from apps.communications.services.whatsapp import submit_whatsapp_template
        try:
            template = submit_whatsapp_template(template)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {"message": "Template submitted successfully", "provider_data": template.provider_data},
            status=status.HTTP_200_OK
        )
