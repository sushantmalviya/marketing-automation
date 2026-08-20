from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
import json
import requests
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from apps.campaigns.models import CustomerRecord

from apps.events.models import SystemEvent
from apps.webhooks.services.dispatcher import (
    dispatch_webhook_event,
    matching_webhook_automations,
)
from apps.webhooks.services.signatures import is_valid_signature


class IncomingWebhookView(APIView):
    permission_classes = [
        AllowAny,
    ]
    authentication_classes = []

    def post(self, request, secret):
        automations = list(
            matching_webhook_automations(secret)
        )

        if not automations:
            return Response(
                {
                    "detail": "Invalid webhook secret.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        signature = (
            request.headers.get("X-Automarket-Signature")
            or request.headers.get("X-Hub-Signature-256")
        )

        if not is_valid_signature(secret, request.body, signature):
            return Response(
                {
                    "detail": "Invalid webhook signature.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        event = SystemEvent.objects.create(
            event_type=SystemEvent.EventType.WEBHOOK,
            user_identifier=secret,
            metadata=request.data,
            headers=dict(request.headers),
        )
        executions = dispatch_webhook_event(event)

        return Response(
            {
                "success": True,
                "event_id": event.id,
                "execution_ids": [
                    execution.id
                    for execution in executions
                ],
            },
            status=status.HTTP_202_ACCEPTED,
        )


@csrf_exempt
def meta_lead_webhook(request):
    try:
        if request.method == 'GET':
            hub_mode = request.GET.get('hub.mode')
            hub_verify_token = request.GET.get('hub.verify_token')
            hub_challenge = request.GET.get('hub.challenge')
            
            if hub_verify_token == 'my_secret_token_123':
                return HttpResponse(hub_challenge)
            return HttpResponse('Error, invalid token', status=403)
            
        elif request.method == 'POST':
            import logging
            logger = logging.getLogger(__name__)
            data = json.loads(request.body)
            logger.info(f"Received Meta leadgen webhook payload: {json.dumps(data)}")
            
            entry = data.get('entry', [{}])[0]
            changes = entry.get('changes', [{}])[0]
            value = changes.get('value', {})
            
            leadgen_id = value.get('leadgen_id')
            campaign_id = value.get('campaign_id')
            ad_id = value.get('ad_id')
            
            if not leadgen_id:
                return HttpResponse("Missing leadgen_id", status=400)
                
            from apps.ads.services.meta_ads_service import MetaAdsService
            from apps.ads.models import MetaUserCredential
            
            credential = MetaUserCredential.objects.filter(status='ACTIVE').first()
            if not credential:
                logger.error("No active MetaUserCredential found for fetching lead details.")
                return HttpResponse("System not authenticated with Meta", status=500)
                
            lead_data = MetaAdsService.get_lead_details(credential.access_token, leadgen_id)
            logger.info(f"Fetched lead data from Meta: {json.dumps(lead_data)}")
            
            field_data = lead_data.get('field_data', [])
            parsed_answers = {field.get('name'): field.get('values', [''])[0] for field in field_data}
            
            email = parsed_answers.get('email', '')
            full_name = parsed_answers.get('full_name', '')
            
            customer_data = {
                'email': email,
                'name': full_name,
                'campaign_id': campaign_id,
                'ad_id': ad_id,
                'custom_questions': parsed_answers
            }
            
            try:
                from apps.campaigns.models import CustomerUpload
                upload, _ = CustomerUpload.objects.get_or_create(file_name="Meta Webhooks")
                CustomerRecord.objects.create(upload=upload, data=customer_data)
            except Exception as model_err:
                logger.error(f"Failed to create CustomerRecord: {str(model_err)}")
                
            return HttpResponse("Success", status=200)
            
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Webhook processing error: {str(e)}")
        return HttpResponse(str(e), status=500)

import base64
import hashlib
import hmac
from django.conf import settings
from apps.ads.models import MetaUserCredential

class MetaDeauthWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        # When removing an app, Meta sends POST with signed_request
        signed_request = request.POST.get('signed_request') or request.data.get('signed_request')
        if not signed_request:
            return Response(status=status.HTTP_200_OK)

        try:
            encoded_sig, payload = signed_request.split('.', 1)
            
            sig = base64.urlsafe_b64decode(encoded_sig + '=' * (4 - len(encoded_sig) % 4))
            data = json.loads(base64.urlsafe_b64decode(payload + '=' * (4 - len(payload) % 4)))

            app_secret = getattr(settings, 'META_APP_SECRET', '')
            if app_secret:
                expected_sig = hmac.new(
                    app_secret.encode('utf-8'), 
                    payload.encode('utf-8'), 
                    hashlib.sha256
                ).digest()
                if not hmac.compare_digest(expected_sig, sig):
                    return Response(status=status.HTTP_200_OK)

            meta_user_id = data.get('user_id')
            if meta_user_id:
                credentials = MetaUserCredential.objects.filter(meta_user_id=meta_user_id)
                for cred in credentials:
                    cred.status = 'REVOKED'
                    cred.access_token = ''
                    cred.save()
                    
        except Exception:
            pass

        return Response(status=status.HTTP_200_OK)
