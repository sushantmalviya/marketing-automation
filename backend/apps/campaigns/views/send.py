from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.serializers import CampaignSendSerializer
from apps.campaigns.services.delivery import DeliveryService


from apps.campaigns.tasks import send_campaign_background

class CampaignSendAPIView(APIView):
    """
    Send a campaign immediately.
    """

    permission_classes = [
        IsAuthenticated,
    ]

    def post(self, request):

        serializer = CampaignSendSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        campaign = serializer.validated_data[
            "campaign"
        ]

        from rest_framework.exceptions import PermissionDenied
        from apps.common.ownership import can_manage_campaign

        if not can_manage_campaign(request.user, campaign):
            raise PermissionDenied(
                "You can only send your own campaigns."
            )

        # Trigger background task
        send_campaign_background.delay(campaign.id)

        return Response(
            {
                "message": "Campaign sent successfully."
            },
            status=status.HTTP_200_OK,
        )