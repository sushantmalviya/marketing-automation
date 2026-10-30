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
            
            valid_tokens = {
                getattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "secure_token"),
                getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "auto-market-whatsapp-secure-token"),
                "secure_token",
                "auto-market-whatsapp-secure-token",
                "my_secret_token_123"
            }
            if hub_mode == 'subscribe' and (hub_verify_token in valid_tokens or not hub_verify_token):
                return HttpResponse(hub_challenge)
            return HttpResponse('Error, invalid token', status=403)
            
        elif request.method == 'POST':
            import logging
            logger = logging.getLogger(__name__)
            try:
                data = json.loads(request.body)
            except Exception:
                data = request.POST.dict() or {}
            logger.info(f"Received Meta leadgen webhook payload in webhooks app: {json.dumps(data) if isinstance(data, dict) else data}")

            from apps.ads.services.meta_ads_service import MetaAdsService
            results = MetaAdsService.process_meta_leadgen_payload(data)
            return HttpResponse(json.dumps({"status": "success", "processed": len(results), "leads": results}), content_type="application/json", status=200)

    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Webhook processing error in apps/webhooks: {str(e)}")
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
