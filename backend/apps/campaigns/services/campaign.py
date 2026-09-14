from rest_framework.exceptions import PermissionDenied

from apps.campaigns.models import (
    Campaign,
    CampaignAudience,
    CampaignChannel,
)
from apps.accounts.models import MAUser
from apps.campaigns.services.audience import AudienceService

class CampaignService:

    @classmethod
    def update_campaign(cls, *, campaign, user, validated_data):
        from rest_framework.exceptions import ValidationError
        
        if campaign.created_by != user:
            raise PermissionDenied("You can only edit your own campaigns.")
            
        if campaign.status not in [Campaign.Status.DRAFT, Campaign.Status.REJECTED]:
            raise ValidationError("Only draft or rejected campaigns can be edited.")
            
        was_rejected = campaign.status == Campaign.Status.REJECTED
        
        if "name" in validated_data:
            campaign.name = validated_data["name"]
        if "description" in validated_data:
            campaign.description = validated_data["description"]
            
        audience_updated = False
        if "target_audience" in validated_data:
            new_target_audience = validated_data["target_audience"]
            if campaign.target_audience != new_target_audience:
                campaign.target_audience = new_target_audience
                audience_updated = True

        if was_rejected:
            cls.handle_rejected_to_draft(campaign)
            
        campaign.save(update_fields=["name", "description", "target_audience", "updated_at"])

        if audience_updated:
            CampaignAudience.objects.filter(campaign=campaign).delete()
            if campaign.target_audience and campaign.target_audience.customer_upload:
                customers = AudienceService.get_customers(
                    customer_upload=campaign.target_audience.customer_upload,
                    audience_definition=campaign.target_audience.definition or {},
                )
                CampaignAudience.objects.bulk_create(
                    [
                        CampaignAudience(campaign=campaign, customer=customer)
                        for customer in customers
                    ]
                )

        return campaign

    @classmethod
    def handle_rejected_to_draft(cls, campaign):
        if campaign.status == Campaign.Status.REJECTED:
            return cls.change_status(
                campaign,
                Campaign.Status.DRAFT,
                approved_by=None,
                approved_at=None,
                rejection_reason=None,
                review_comments=None
            )
        return campaign

    @classmethod
    def change_status(cls, campaign, new_status, **update_fields):
        campaign.status = new_status
        for field, value in update_fields.items():
            setattr(campaign, field, value)
            
        fields_to_save = ["status"] + list(update_fields.keys())
        campaign.save(update_fields=fields_to_save)
        return campaign

    @staticmethod
    def create_campaign(
        validated_data,
        user,
    ):
        target_audience = validated_data.get("target_audience")

        ma_user = MAUser.objects.filter(
            user_id=user
        ).first()

        if not ma_user:
            raise PermissionDenied(
                "A valid account profile is required to create campaigns."
            )

        # Create campaign
        campaign = Campaign.objects.create(
            target_audience=target_audience,
            name=validated_data["name"],
            description=validated_data.get("description"),
            created_by=user,
            status=Campaign.Status.DRAFT,
        )

        if target_audience and target_audience.customer_upload:
            customers = AudienceService.get_customers(
                customer_upload=target_audience.customer_upload,
                audience_definition=target_audience.definition or {},
            )

            CampaignAudience.objects.bulk_create(
                [
                    CampaignAudience(
                        campaign=campaign,
                        customer=customer,
                    )
                    for customer in customers
                ]
            )

        return campaign

    @classmethod
    def submit_campaign(cls,*, campaign, user):
        from rest_framework.exceptions import ValidationError
        from apps.campaigns.models import CampaignTemplate
        from django.utils import timezone
        
        if campaign.created_by != user:
            raise PermissionDenied("You can only submit your own campaigns.")

        if campaign.status != Campaign.Status.DRAFT:
            raise ValidationError("Only draft campaigns can be submitted.")

        if not CampaignAudience.objects.filter(campaign=campaign).exists():
            raise ValidationError("Campaign has no recipients.")

        campaign_channels = CampaignChannel.objects.filter(campaign=campaign)
        template_count = CampaignTemplate.objects.filter(campaign=campaign).count()

        if template_count == 0 or template_count != campaign_channels.count():
            raise ValidationError("Every selected channel must have an assigned template.")

        return cls.change_status(
            campaign,
            Campaign.Status.PENDING_APPROVAL,
            submitted_by=user,
            submitted_at=timezone.now()
        )

    @classmethod
    def approve_campaign(cls,*, campaign, admin_user):
        from rest_framework.exceptions import ValidationError
        from django.utils import timezone
        
        from apps.common.ownership import can_manage_campaign
        
        if not can_manage_campaign(admin_user, campaign):
            raise PermissionDenied("You do not have permission to approve this campaign.")

        if campaign.status != Campaign.Status.PENDING_APPROVAL:
            raise ValidationError("Campaign must be pending approval.")

        return cls.change_status(
            campaign,
            Campaign.Status.APPROVED,
            approved_by=admin_user,
            approved_at=timezone.now()
        )

    @classmethod
    def reject_campaign(cls,*, campaign, admin_user, rejection_reason, review_comments=None):
        from rest_framework.exceptions import ValidationError
        from django.utils import timezone
        
        from apps.common.ownership import can_manage_campaign
        
        if not can_manage_campaign(admin_user, campaign):
            raise PermissionDenied("You do not have permission to reject this campaign.")

        if campaign.status != Campaign.Status.PENDING_APPROVAL:
            raise ValidationError("Campaign must be pending approval.")

        return cls.change_status(
            campaign,
            Campaign.Status.REJECTED,
            approved_by=admin_user,
            approved_at=timezone.now(),
            rejection_reason=rejection_reason,
            review_comments=review_comments
        )
