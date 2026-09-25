from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..serializers import CampaignCreateSerializer
from ..services import CampaignService
from django.shortcuts import get_object_or_404
from ..serializers import CampaignSubmitSerializer, CampaignApproveSerializer, CampaignRejectSerializer
from ..models import Campaign
from apps.accounts.permissions import IsAdminOrSuperAdmin
from ..serializers import PendingApprovalSerializer
from rest_framework import generics
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Q
from apps.common.utils import filter_by_tenant
from apps.communications.models import CommunicationEvent
from apps.accounts.pagination import AccountsPagination
from ..serializers import MyCampaignListSerializer

class CampaignCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campaign = CampaignService.create_campaign(
            validated_data=serializer.validated_data,
            user=request.user,
        )

        return Response(
            {
                "message": "Campaign created successfully.",
                "campaign": {
                    "id": campaign.id,
                    "task": None,
                    "name": campaign.name,
                    "description": campaign.description,
                    "status": campaign.status,
                    "created_by": campaign.created_by.email,
                    "created_at": campaign.created_at,
                },
            },
        )

class CampaignDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, campaign_id):
        from apps.common.ownership import filter_campaigns_for_admin
        queryset = filter_campaigns_for_admin(
            Campaign.objects.filter(is_deleted=False),
            request.user,
        )
        campaign = get_object_or_404(queryset, id=campaign_id)
        campaign.is_deleted = True
        campaign.is_active = False
        campaign.save(update_fields=["is_deleted", "is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, campaign_id):
        from ..serializers import CampaignUpdateSerializer
        from django.shortcuts import get_object_or_404
        from ..models import Campaign
        
        campaign = get_object_or_404(Campaign, id=campaign_id)
        
        serializer = CampaignUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        campaign = CampaignService.update_campaign(
            campaign=campaign,
            user=request.user,
            validated_data=serializer.validated_data,
        )

        return Response(
            {
                "message": "Campaign updated successfully.",
                "campaign": {
                    "id": campaign.id,
                    "task": campaign.task.id if campaign.task else None,
                    "name": campaign.name,
                    "description": campaign.description,
                    "status": campaign.status,
                    "updated_at": campaign.updated_at,
                },
            },
            status=status.HTTP_200_OK,
        )


class CampaignSubmitAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id):
        serializer = CampaignSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campaign = get_object_or_404(Campaign, id=campaign_id)

        campaign = CampaignService.submit_campaign(
            campaign=campaign,
            user=request.user,
        )

        return Response(
            {
                "message": "Campaign submitted for approval.",
                "status": campaign.status,
            },
            status=status.HTTP_200_OK,
        )


class CampaignApproveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id):
        serializer = CampaignApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campaign = get_object_or_404(Campaign, id=campaign_id)

        campaign = CampaignService.approve_campaign(
            campaign=campaign,
            admin_user=request.user,
        )

        return Response(
            {
                "message": "Campaign approved.",
                "status": campaign.status,
            },
            status=status.HTTP_200_OK,
        )


class CampaignRejectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id):
        serializer = CampaignRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campaign = get_object_or_404(Campaign, id=campaign_id)

        campaign = CampaignService.reject_campaign(
            campaign=campaign,
            admin_user=request.user,
            rejection_reason=serializer.validated_data["rejection_reason"],
            review_comments=serializer.validated_data.get("review_comments"),
        )

        return Response(
            {
                "message": "Campaign rejected.",
                "status": campaign.status,
            },
            status=status.HTTP_200_OK,
        )



class PendingApprovalAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        from apps.common.ownership import filter_campaigns_for_admin
        
        campaigns = filter_campaigns_for_admin(Campaign.objects.filter(
            status=Campaign.Status.PENDING_APPROVAL
        ), request.user).select_related(
            "created_by",
            "submitted_by",
        ).prefetch_related(
            "campaign_channels__channel"
        ).order_by("submitted_at")

        serializer = PendingApprovalSerializer(campaigns, many=True)
        return Response(serializer.data)



class MyCampaignsAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MyCampaignListSerializer
    pagination_class = AccountsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["created_at", "updated_at", "name", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = filter_by_tenant(Campaign.objects.filter(
            is_active=True,
            is_deleted=False
        ), user, "created_by").select_related(
            "target_audience",
            "created_by",
            "submitted_by",
            "approved_by",
        ).prefetch_related(
            "campaign_channels__channel"
        ).annotate(
            contacts=Count("audience__customer", distinct=True),
            sent=Count("communication_events__recipient", filter=Q(communication_events__status__in=["SENT", "DELIVERED", "OPENED", "CLICKED"]), distinct=True),
            delivered=Count("communication_events__recipient", filter=Q(communication_events__status__in=["DELIVERED", "OPENED", "CLICKED"]), distinct=True),
            opened=Count("communication_events__recipient", filter=Q(communication_events__status__in=["OPENED", "CLICKED"]), distinct=True),
            clicked=Count("communication_events__recipient", filter=Q(communication_events__status="CLICKED"), distinct=True),
        )

        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)

        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            from django.utils.dateparse import parse_date
            parsed = parse_date(date_from)
            if parsed:
                queryset = queryset.filter(created_at__date__gte=parsed)
        if date_to:
            from django.utils.dateparse import parse_date
            parsed = parse_date(date_to)
            if parsed:
                queryset = queryset.filter(created_at__date__lte=parsed)

        return queryset


class CampaignWorkspaceSummaryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        campaigns = filter_by_tenant(
            Campaign.objects.filter(is_active=True, is_deleted=False),
            request.user,
            "created_by",
        )
        events = CommunicationEvent.objects.filter(campaign__in=campaigns)

        def recipients(statuses):
            return events.filter(status__in=statuses).values("recipient").distinct().count()

        return Response({
            "total_campaigns": campaigns.count(),
            "total_sent": recipients(["SENT", "DELIVERED", "OPENED", "CLICKED"]),
            "delivered": recipients(["DELIVERED", "OPENED", "CLICKED"]),
            "opened": recipients(["OPENED", "CLICKED"]),
            "clicked": recipients(["CLICKED"]),
        })


class CampaignDetailAPIView(APIView):
    """Return campaign info + per-channel template details for preview and editing."""
    permission_classes = [IsAuthenticated]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(
            Campaign.objects.select_related(
                "task", "task__audience", "target_audience", "submitted_by", "created_by",
            ).prefetch_related(
                "campaign_channels__channel",
                "campaign_templates__channel",
                "campaign_templates__template",
                "audience",
            ),
            id=campaign_id,
            is_active=True,
            is_deleted=False,
        )

        submitted_by = campaign.submitted_by or campaign.created_by
        if submitted_by:
            full = f"{submitted_by.first_name} {submitted_by.last_name}".strip()
            assigned_to = full or submitted_by.email
        else:
            assigned_to = ""

        # Count contacts via CampaignAudience rows
        from apps.campaigns.models import CampaignAudience, Audience
        contacts = CampaignAudience.objects.filter(campaign=campaign).count()

        # Resolve audience_id & audience_name
        audience_id = None
        audience_name = ""
        if campaign.target_audience:
            audience_id = campaign.target_audience.id
            audience_name = campaign.target_audience.name
        else:
            first_ca = CampaignAudience.objects.filter(campaign=campaign).select_related("customer__upload").first()
            if first_ca and first_ca.customer and first_ca.customer.upload:
                aud = Audience.objects.filter(customer_upload=first_ca.customer.upload).first()
                if aud:
                    audience_id = aud.id
                    audience_name = aud.name

        # Map channel templates by channel_id
        templates_by_channel = {
            ct.channel_id: ct for ct in campaign.campaign_templates.all()
        }

        channels_data = []
        selected_channel_ids = []
        for cc in campaign.campaign_channels.all():
            selected_channel_ids.append(cc.channel.id)
            ct = templates_by_channel.get(cc.channel.id)
            channels_data.append({
                "channel_id": cc.channel.id,
                "channel_name": cc.channel.name,
                "channel": cc.channel.name,
                "template_id": ct.template.id if ct else None,
                "template_name": ct.template.name if ct else "",
                "subject": (ct.template.subject or "") if ct else "",
                "body": (ct.template.body or "") if ct else "",
            })

        return Response({
            "id": campaign.id,
            "campaign_name": campaign.name,
            "name": campaign.name,
            "description": campaign.description or "",
            "task_id": None,
            "task": None,
            "audience_id": audience_id,
            "audience_name": audience_name,
            "selected_channel_ids": selected_channel_ids,
            "status": campaign.status,
            "contacts": contacts,
            "scheduled_at": str(campaign.scheduled_at) if campaign.scheduled_at else None,
            "start_date": str(campaign.scheduled_at or campaign.submitted_at or campaign.created_at),
            "assigned_to": assigned_to,
            "channels": channels_data,
            "available_actions": MyCampaignListSerializer().get_available_actions(campaign),
        })
