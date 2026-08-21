from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .services.meta_ads_service import MetaAdsService, MetaTokenExpiredError
import hmac
import hashlib
from .models import MetaUserCredential, MetaAdAccount
from django.http import HttpResponse
from django.conf import settings
from apps.campaigns.models import CustomerRecord
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers

class MetaAuthURLView(APIView):
    """
    Triggered when the user clicks 'Connect Meta Ads' in the frontend.
    Returns the OAuth URL to redirect the user to Meta for authorization.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = MetaAdsService.get_auth_url()
        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


class MetaAdAccountsView(APIView):
    """
    Triggered when the frontend needs to display the user's available Meta Ad Accounts
    (e.g., in a settings or dashboard page).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            code = request.query_params.get("code")
            if code:
                access_token = MetaAdsService.exchange_code_for_token(code)
                MetaUserCredential.objects.update_or_create(
                    user=request.user,
                    defaults={"access_token": access_token}
                )
            else:
                credential = MetaUserCredential.objects.get(user=request.user)
                access_token = credential.access_token

            if access_token and access_token.startswith("mock_"):
                data = [{"account_id": "act_12345", "name": "Mock Ad Account", "account_status": 1}]
            else:
                data = MetaAdsService.get_ad_accounts(access_token)

            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 10))
            start_index = (page - 1) * page_size
            end_index = start_index + page_size
            paginated_data = data[start_index:end_index]

            return Response({
                "status": "success", 
                "data": paginated_data,
                "meta": {
                    "total": len(data),
                    "page": page,
                    "page_size": page_size,
                    "total_pages": (len(data) + page_size - 1) // page_size
                }
            }, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response(
                {"status": "error", "message": msg}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class MetaAdInsightsView(APIView):
    """
    Triggered when the frontend loads a dashboard or specific ad account metrics view.
    Returns spend, impressions, clicks, etc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            access_token = credential.access_token
            
            account_id = request.query_params.get("account_id")
            date_preset = request.query_params.get("date_preset", "last_30d")
            time_increment = request.query_params.get("time_increment")
            
            if not account_id:
                return Response(
                    {"status": "error", "message": "account_id is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if time_increment == "1":
                data = MetaAdsService.get_ad_insights_timeseries(access_token, account_id, date_preset)
            else:
                data = MetaAdsService.get_ad_insights(access_token, account_id, date_preset)
                
            return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)
            
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response(
                {"status": "error", "message": msg}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class CreateMetaCampaignView(APIView):
    """
    Triggered when the user submits a form in the frontend to launch a new campaign.
    Requires account_id, name, and objective in the request body.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            name="CreateCampaignRequest",
            fields={
                "account_id": serializers.CharField(),
                "name": serializers.CharField(),
                "objective": serializers.CharField(),
                "daily_budget": serializers.IntegerField(),
                "location": serializers.CharField(),
                "ad_text": serializers.CharField(),
            }
        ),
        description="Create a new Meta Ads Campaign."
    )
    def post(self, request):
        try:
            account_id = request.data.get("account_id")
            name = request.data.get("name")
            objective = request.data.get("objective")
            daily_budget = request.data.get("daily_budget")
            location = request.data.get("location")
            ad_text = request.data.get("ad_text")
            
            if not all([account_id, name, objective, daily_budget, location, ad_text]):
                return Response(
                    {"status": "error", "message": "account_id, name, objective, daily_budget, location, and ad_text are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            credential = MetaUserCredential.objects.get(user=request.user)
            
            data = MetaAdsService.create_campaign(credential.access_token, account_id, request.data)
            return Response({"status": "success", "data": data}, status=status.HTTP_201_CREATED)
            
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response(
                {"status": "error", "message": msg}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class SelectMetaAdAccountView(APIView):
    """
    Triggered when the user selects a specific Meta Ad Account to connect.
    Saves or updates the selected account.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        account_id = request.data.get("account_id")
        name = request.data.get("name")
        currency = request.data.get("currency", "USD")

        if not account_id or not name:
            return Response(
                {"status": "error", "message": "account_id and name are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        MetaAdAccount.objects.update_or_create(
            user=request.user,
            account_id=account_id,
            defaults={
                "name": name,
                "currency": currency,
                "is_active": True
            }
        )

        return Response(
            {"status": "success", "message": "Ad account selected successfully."}, 
            status=status.HTTP_201_CREATED
        )


class MetaAdCampaignsListView(APIView):
    """
    Triggered when the frontend dashboard needs to load the table of campaigns
    associated with a specific ad account.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            account_id = request.query_params.get("account_id")
            if not account_id:
                return Response(
                    {"status": "error", "message": "account_id is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            credential = MetaUserCredential.objects.get(user=request.user)
            access_token = credential.access_token

            data = MetaAdsService.get_campaigns_list(access_token, account_id)
            
            status_filter = request.query_params.get("status")
            if status_filter:
                data = [c for c in data if c.get("status") == status_filter]
                
            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 10))
            start_index = (page - 1) * page_size
            end_index = start_index + page_size
            paginated_data = data[start_index:end_index]

            return Response({
                "status": "success", 
                "data": paginated_data,
                "meta": {
                    "total": len(data),
                    "page": page,
                    "page_size": page_size,
                    "total_pages": (len(data) + page_size - 1) // page_size
                }
            }, status=status.HTTP_200_OK)

        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response(
                {"status": "error", "message": msg}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class MetaLeadWebhookView(APIView):
    """
    Webhook to receive lead data from Meta Ads.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        hub_mode = request.query_params.get("hub.mode")
        hub_challenge = request.query_params.get("hub.challenge")
        hub_verify_token = request.query_params.get("hub.verify_token")

        if hub_mode == "subscribe" and hub_verify_token == getattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "secure_token"):
            return HttpResponse(hub_challenge)
        return HttpResponse("Verification failed", status=403)

    def post(self, request):
        try:
            signature = request.headers.get("X-Hub-Signature-256")
            payload_body = request.body
            secret = getattr(settings, "META_APP_SECRET", "secret").encode('utf-8')
            expected_signature = "sha256=" + hmac.new(secret, payload_body, hashlib.sha256).hexdigest()
            
            if not signature or not hmac.compare_digest(signature, expected_signature):
                if not settings.DEBUG:
                    msg = "Missing signature" if not signature else "Invalid signature"
                    return Response({"status": "error", "message": msg}, status=status.HTTP_403_FORBIDDEN)
                else:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning("Invalid or missing webhook signature, bypass allowed because DEBUG=True.")
                
            payload = request.data
            
            entries = payload.get("entry", [])
            if entries:
                changes = entries[0].get("changes", [])
                if changes:
                    value = changes[0].get("value", {})
                    leadgen_id = value.get("leadgen_id")
                    
                    if leadgen_id:
                        credential = MetaUserCredential.objects.first()
                        if credential:
                            lead_data = MetaAdsService.get_lead_details(credential.access_token, leadgen_id)
                            
                            email = None
                            full_name = "Unknown"
                            
                            field_data = lead_data.get("field_data", [])
                            for field in field_data:
                                name = field.get("name")
                                values = field.get("values", [])
                                if values:
                                    if name == "email":
                                        email = values[0]
                                    elif name == "full_name":
                                        full_name = values[0]

                            if email:
                                try:
                                    from apps.campaigns.models import CustomerUpload
                                    upload, _ = CustomerUpload.objects.get_or_create(
                                        file_name="Meta Webhooks",
                                        uploaded_by=credential.user
                                    )
                                    CustomerRecord.objects.create(
                                        upload=upload,
                                        data={
                                            'email': email,
                                            'name': full_name,
                                            '__source__': 'meta_webhook'
                                        }
                                    )
                                except Exception as db_err:
                                    import logging
                                    logging.getLogger(__name__).error(f"Error saving customer record from webhook: {db_err}")
                                
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({"status": "success"}, status=status.HTTP_200_OK)
