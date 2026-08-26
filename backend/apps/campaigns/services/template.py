from rest_framework.exceptions import ValidationError
from apps.accounts.models import MAUser
from apps.tasks.models import TaskAssignment
from apps.campaigns.models import (
    Template,
    CampaignChannel,
    CampaignTemplate,
    Campaign
)


class TemplateService:

    @staticmethod
    def create_template(
        *,
        validated_data,
        user,
    ):
        ma_user = MAUser.objects.filter(
            user_id=user
        ).first()

        if not ma_user or ma_user.role not in ["USER", "ADMIN"]:
            raise ValidationError(
                "Only users and admins can create templates."
            )

        return Template.objects.create(
            name=validated_data["name"],
            channel=validated_data["channel"],
            subject=validated_data.get("subject"),
            body=validated_data["body"],
            status=validated_data["status"],
            created_by=user,
        )

    @staticmethod
    def list_templates(
        *,
        user,
    ):
        templates = Template.objects.filter(status=Template.Status.ACTIVE).select_related("channel", "created_by")
        
        from apps.common.ownership import filter_templates_for_admin
        return filter_templates_for_admin(templates, user).order_by("name")

    @staticmethod
    def get_template_for_user(template_id, user):
        from django.shortcuts import get_object_or_404

        from apps.common.ownership import filter_templates_for_admin
        queryset = filter_templates_for_admin(Template.objects.all(), user)

        return get_object_or_404(queryset, id=template_id)

    @staticmethod
    def update_template(
        *,
        template,
        user,
        validated_data,
    ):
        ma_user = MAUser.objects.filter(user_id=user).first()
        is_admin = ma_user and ma_user.role == "ADMIN"
        
        if not is_admin and template.created_by != user:
            raise ValidationError(
                "You can only edit your own templates."
            )

        # Check all associated campaigns
        campaign_templates = template.campaign_templates.select_related("campaign")
        campaigns = [ct.campaign for ct in campaign_templates]

        for campaign in campaigns:
            if campaign.status not in [Campaign.Status.DRAFT, Campaign.Status.REJECTED]:
                raise ValidationError(
                    f"Template is used by a campaign in {campaign.status} status and cannot be edited."
                )

        if "subject" in validated_data:
            template.subject = validated_data["subject"]
        if "body" in validated_data:
            template.body = validated_data["body"]
            
        template.save(update_fields=["subject", "body", "updated_at"])

        from apps.campaigns.services.campaign import CampaignService
        for campaign in campaigns:
            CampaignService.handle_rejected_to_draft(campaign)

        return template

    @staticmethod
    def delete_template(
        *,
        template,
        user,
    ):
        ma_user = MAUser.objects.filter(user_id=user).first()
        is_admin = ma_user and ma_user.role == "ADMIN"
        
        if not is_admin and template.created_by != user:
            raise ValidationError(
                "You can only delete your own templates."
            )

        # Check all associated campaigns
        campaign_templates = template.campaign_templates.select_related("campaign")
        campaigns = [ct.campaign for ct in campaign_templates]

        for campaign in campaigns:
            if campaign.status not in [Campaign.Status.DRAFT, Campaign.Status.REJECTED]:
                raise ValidationError(
                    f"Template is used by a campaign in {campaign.status} status and cannot be deleted."
                )

        template.status = Template.Status.ARCHIVED
        template.save(update_fields=["status"])

        from apps.campaigns.services.campaign import CampaignService
        for campaign in campaigns:
            CampaignService.handle_rejected_to_draft(campaign)

        return template


class CampaignTemplateService:

    @staticmethod
    def assign_template(
        *,
        validated_data,
        user,
    ):
        campaign = validated_data["campaign"]
        channel = validated_data["channel"]
        template = validated_data["template"]

        # Rule 1
        if not TaskAssignment.objects.filter(
            task=campaign.task,
            user=user,
        ).exists():
            raise ValidationError(
                "You are not assigned to this task."
            )

        # Rule 2
        if not CampaignChannel.objects.filter(
            campaign=campaign,
            channel=channel,
        ).exists():
            raise ValidationError(
                "This channel is not assigned to the campaign."
            )
        
        # Rule 3: Template must belong to the logged-in user
        if template.created_by != user:
            raise ValidationError(
                "You can only assign your own templates."
            )
        
        # Rule 4: Template channel must match selected channel
        if template.channel != channel:
            raise ValidationError(
                "Template channel does not match the selected channel."
            )
        
        # Rule 5: Template must be ACTIVE
        if template.status != Template.Status.ACTIVE:
            raise ValidationError(
                "Only active templates can be assigned."
            )

        # Rule 6: Campaign must be editable
        if campaign.status not in [Campaign.Status.DRAFT, Campaign.Status.REJECTED]:
            raise ValidationError(
                "Templates can only be assigned while the campaign is in DRAFT or REJECTED status."
            )

        was_rejected = campaign.status == Campaign.Status.REJECTED

        campaign_template, created = CampaignTemplate.objects.update_or_create(
            campaign=campaign,
            channel=channel,
            defaults={
                "template": template,
            },
        )

        if was_rejected:
            from apps.campaigns.services.campaign import CampaignService
            CampaignService.handle_rejected_to_draft(campaign)

        return campaign_template