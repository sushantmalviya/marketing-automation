import logging

from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import ValidationError

from apps.campaigns.models import (
    Campaign,
    CampaignAudience,
    CampaignChannel,
    CampaignDelivery,
    CampaignTemplate,
)
from apps.campaigns.services.dispatcher import Dispatcher
from apps.campaigns.services.renderer import TemplateRenderer

logger = logging.getLogger(__name__)

class DeliveryService:
    """
    Executes a campaign.

    Responsibilities:
        • Validate campaign
        • Update campaign status
        • Load recipients
        • Load templates
        • Render messages
        • Create delivery records
        • Dispatch messages
        • Complete campaign
    """

    @classmethod
    @transaction.atomic
    def send_campaign(
        cls,
        *,
        campaign: Campaign,
    ):
        """
        Execute the complete campaign.
        """

        # Lock the campaign to prevent race conditions during state transition
        campaign = Campaign.objects.select_for_update().get(id=campaign.id)

        cls._validate_campaign(campaign)
        cls._validate_no_existing_deliveries(campaign)

        cls._mark_campaign_sending(campaign)

        recipients = cls._load_recipients(campaign)
        templates = cls._load_templates(campaign)

        logger.info(
            "Campaign %s loaded %s recipients and %s templates.",
            campaign.id,
            recipients.count(),
            templates.count(),
        )

        for recipient in recipients:
            cls._process_recipient(
                campaign=campaign,
                recipient=recipient,
                templates=templates,
            )

        cls._mark_campaign_completed(campaign)

        return campaign

    # ==========================================================
    # Validation
    # ==========================================================

    @staticmethod
    def _validate_campaign(
        campaign: Campaign,
    ):
        """
        Ensure campaign is eligible for sending.
        """

        if campaign.status not in (
            Campaign.Status.DRAFT,
            Campaign.Status.APPROVED,
            Campaign.Status.SCHEDULED,
        ):
            raise ValidationError(
                "Campaign cannot be sent."
            )

        if not CampaignAudience.objects.filter(campaign=campaign).exists():
            raise ValidationError(
                "Campaign has no recipients."
            )

        campaign_channels = CampaignChannel.objects.filter(campaign=campaign)
        if not campaign_channels.exists():
            raise ValidationError(
                "Campaign has no channels."
            )

        template_count = CampaignTemplate.objects.filter(campaign=campaign).count()
        if template_count != campaign_channels.count():
            raise ValidationError(
                "Every selected channel must have an assigned template."
            )

        # Validate WhatsApp template approval status
        for ct in campaign.campaign_templates.select_related("channel", "template"):
            ch_code = (ct.channel.code or ct.channel.name or "").upper()
            if ch_code == "WHATSAPP":
                provider_data = ct.template.provider_data or {}
                meta_status = str(provider_data.get("meta_status", "")).upper()
                meta_name = provider_data.get("meta_template_name", "")

                if not meta_name or meta_status != "APPROVED":
                    status_display = meta_status or "NOT SUBMITTED"
                    raise ValidationError(
                        f"WhatsApp template '{ct.template.name}' is not approved by Meta (current status: {status_display}). "
                        "Only approved WhatsApp templates can be dispatched."
                    )

    @staticmethod
    def _validate_no_existing_deliveries(
        campaign: Campaign,
    ):
        """
        Prevent sending a campaign more than once.
        """

        if CampaignDelivery.objects.filter(
            campaign=campaign,
        ).exists():

            logger.warning(
                "Duplicate send prevented for campaign %s.",
                campaign.id,
            )

            raise ValidationError(
                "Campaign has already been sent."
            )

    # ==========================================================
    # Campaign Status
    # ==========================================================

    @staticmethod
    def _mark_campaign_sending(
        campaign: Campaign,
    ):
        """
        Mark campaign as sending.
        """

        from apps.campaigns.services.campaign import CampaignService

        CampaignService.change_status(
            campaign,
            Campaign.Status.SENDING,
            started_at=timezone.now()
        )

        logger.info(
            "Campaign %s started.",
            campaign.id,
        )

    @staticmethod
    def _mark_campaign_completed(
        campaign: Campaign,
    ):
        """
        Mark campaign as completed.
        """


        from apps.campaigns.services.campaign import CampaignService

        CampaignService.change_status(
            campaign,
            Campaign.Status.COMPLETED,
            completed_at=timezone.now()
        )

        logger.info(
            "Campaign %s completed successfully.",
            campaign.id,
        )


    # ==========================================================
    # Data Loading
    # ==========================================================

    @staticmethod
    def _load_recipients(
        campaign: Campaign,
    ):
        """
        Load frozen campaign recipients.
        """

        return campaign.audience.select_related(
            "customer",
        )

    @staticmethod
    def _load_templates(
        campaign: Campaign,
    ):
        """
        Load campaign templates.
        """

        return campaign.campaign_templates.select_related(
            "channel",
            "template",
        )

    # ==========================================================
    # Processing
    # ==========================================================

    @classmethod
    def _process_recipient(
        cls,
        *,
        campaign: Campaign,
        recipient,
        templates,
    ):
        """
        Send every template to one recipient.
        """

        customer = recipient.customer

        logger.info(
            "Processing customer %s for campaign %s.",
            customer.id,
            campaign.id,
        )

        for campaign_template in templates:
            cls._send_delivery(
                campaign=campaign,
                customer=customer,
                campaign_template=campaign_template,
            )

    @classmethod
    def _build_whatsapp_template_config(cls, *, template, customer_data):
        """
        Builds the structured Meta WhatsApp template configuration dictionary.
        Resolves dynamic positional variables and media header links against customer data.
        """
        import json
        import re

        provider_data = template.provider_data or {}
        meta_name = provider_data.get("meta_template_name") or template.name

        metadata = {}
        if template.subject and template.subject.strip().startswith("{"):
            try:
                metadata = json.loads(template.subject.strip())
            except Exception:
                metadata = {}

        language_code = metadata.get("language") or "en_US"
        components = []

        # 1. Header Component
        header_data = metadata.get("header")
        if header_data and isinstance(header_data, dict):
            h_type = (header_data.get("type") or "NONE").upper()
            if h_type == "TEXT":
                raw_text = header_data.get("text", "")
                resolved_text = TemplateRenderer.render(raw_text, customer_data)
                if resolved_text.strip():
                    components.append({
                        "type": "header",
                        "parameters": [
                            {"type": "text", "text": resolved_text.strip()}
                        ]
                    })
            elif h_type in ("IMAGE", "VIDEO", "DOCUMENT"):
                media_url = header_data.get("mediaUrl") or header_data.get("url")
                if media_url:
                    param_type = h_type.lower()
                    components.append({
                        "type": "header",
                        "parameters": [
                            {
                                "type": param_type,
                                param_type: {"link": media_url.strip()}
                            }
                        ]
                    })

        # 2. Body Component - Positional Variable Resolution
        raw_body = metadata.get("body") or template.body or ""
        placeholders = re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", raw_body)
        body_params = []
        for var_name in placeholders:
            resolved_val = None
            if customer_data:
                resolved_val = customer_data.get(var_name)
                if resolved_val is None:
                    for k, v in customer_data.items():
                        norm_k = k.lower().replace(" ", "_").strip()
                        if norm_k == var_name.lower().replace(" ", "_").strip():
                            resolved_val = v
                            break

            if resolved_val is None:
                resolved_val = ""
            body_params.append({
                "type": "text",
                "text": str(resolved_val),
            })

        if body_params:
            components.append({
                "type": "body",
                "parameters": body_params,
            })

        # 3. Button Component - Dynamic URL / Parameter Resolution
        buttons_data = metadata.get("buttons")
        if buttons_data and isinstance(buttons_data, list):
            for idx, btn in enumerate(buttons_data):
                b_type = (btn.get("type") or "URL").upper()
                if b_type in ("URL", "BOOK_DEMO"):
                    btn_url = btn.get("url", "")
                    url_placeholders = re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", btn_url)
                    if url_placeholders:
                        url_param_val = customer_data.get(url_placeholders[0], "") if customer_data else ""
                        components.append({
                            "type": "button",
                            "sub_type": "url",
                            "index": str(idx),
                            "parameters": [
                                {
                                    "type": "text",
                                    "text": str(url_param_val),
                                }
                            ]
                        })

        template_config = {
            "name": meta_name,
            "language": {
                "code": language_code,
            },
        }
        if components:
            template_config["components"] = components

        return template_config

    @classmethod
    def _send_delivery(
        cls,
        *,
        campaign: Campaign,
        customer,
        campaign_template,
    ):
        """
        Create and dispatch one delivery.
        """

        # -------------------------
        # Render Template
        # -------------------------

        channel_code = campaign_template.channel.code.upper() if campaign_template.channel else "GENERIC"
        template = campaign_template.template
        template_config = None

        if channel_code == "WHATSAPP":
            meta_status = (template.provider_data or {}).get("meta_status", "").upper()
            meta_name = (template.provider_data or {}).get("meta_template_name")
            if meta_status == "APPROVED" and meta_name:
                template_config = cls._build_whatsapp_template_config(
                    template=template,
                    customer_data=customer.data or {},
                )

        message = TemplateRenderer.render_for_channel(
            template.body,
            customer.data,
            channel=channel_code,
        )

        # -------------------------
        # Create Delivery Record
        # -------------------------

        delivery = CampaignDelivery.objects.create(
            campaign=campaign,
            customer=customer,
            channel=campaign_template.channel,
            rendered_message=message,
            status=CampaignDelivery.Status.PENDING,
        )

        # -------------------------
        # Dispatch
        # -------------------------

        result = Dispatcher.send(
            delivery=delivery,
            template_config=template_config,
        )

        # -------------------------
        # Update Delivery Status
        # -------------------------

        if result["success"]:

            delivery.status = CampaignDelivery.Status.SENT
            delivery.provider_message_id = result[
                "provider_message_id"
            ]
            delivery.sent_at = timezone.now()

        else:

            delivery.status = CampaignDelivery.Status.FAILED
            delivery.error_message = result.get(
                "error",
                "Unknown error",
            )

            logger.error(
                "Delivery failed | Campaign=%s Customer=%s Channel=%s Error=%s",
                campaign.id,
                customer.id,
                campaign_template.channel.code,
                delivery.error_message,
            )

        delivery.save(
            update_fields=[
                "status",
                "provider_message_id",
                "error_message",
                "sent_at",
            ]
        )


        # -------------------------
        # Logging
        # -------------------------

        logger.info(
            (
                "Delivery processed | "
                "Campaign=%s Customer=%s "
                "Channel=%s Status=%s"
            ),
            campaign.id,
            customer.id,
            campaign_template.channel.code,
            delivery.status,
        )