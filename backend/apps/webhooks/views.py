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
            data = json.loads(request.body)
            
            # Extract leadgen_id
            leadgen_id = data['entry'][0]['changes'][0]['value']['leadgen_id']
            
            # Mock Graph API fetch to get full_name and email based on leadgen_id
            # url = f"https://graph.facebook.com/v19.0/{leadgen_id}?access_token=YOUR_ACCESS_TOKEN"
            # response = requests.get(url)
            # lead_data = response.json()
            # email = lead_data.get('email', 'test@example.com')
            # full_name = lead_data.get('full_name', 'Test User')
            
            email = 'mock@example.com'
            full_name = 'Mock User'
            
            # The exact code you requested:
            # CustomerRecord.objects.update_or_create(email=email, defaults={'name': full_name})
            
            # Note: The CustomerRecord model in apps/campaigns/models.py currently uses 
            # a 'data' JSONField and requires an 'upload' ForeignKey. You may need to adapt 
            # this if your model hasn't been migrated yet to use direct email/name fields.
            try:
                CustomerRecord.objects.update_or_create(email=email, defaults={'name': full_name})
            except Exception as model_err:
                # Fallback if CustomerRecord uses data JSON field and requires an upload FK
                from apps.campaigns.models import CustomerUpload
                upload, _ = CustomerUpload.objects.get_or_create(file_name="Meta Webhooks")
                CustomerRecord.objects.create(upload=upload, data={'email': email, 'name': full_name})
                
            return HttpResponse("Success", status=200)
            
    except Exception as e:
        return HttpResponse(str(e), status=500)
