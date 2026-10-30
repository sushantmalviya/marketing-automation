from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .services.meta_ads_service import MetaAdsService, MetaTokenExpiredError
import hmac
import hashlib
from .models import MetaUserCredential, MetaAdAccount, MetaPixelSettings, MetaCapiEventLog, MetaLeadTrigger
from django.http import HttpResponse
from django.conf import settings
from django.db import models
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
        redirect_uri = request.query_params.get("redirect_uri")
        data = MetaAdsService.get_auth_url(redirect_uri=redirect_uri)
        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


class DisconnectMetaAccountView(APIView):
    """
    Triggered when the user clicks 'Disconnect' in the frontend.
    Completely removes the user's Meta credentials and connected ad accounts.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        MetaUserCredential.objects.filter(user=request.user).delete()
        MetaAdAccount.objects.filter(user=request.user).delete()
        return Response({"status": "success", "message": "Meta account disconnected successfully."}, status=status.HTTP_200_OK)


class MetaAdAccountsView(APIView):
    """
    Triggered when the frontend needs to display the user's available Meta Ad Accounts
    (e.g., in a settings or dashboard page).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            code = request.query_params.get("code")
            redirect_uri = request.query_params.get("redirect_uri")
            if code:
                access_token = MetaAdsService.exchange_code_for_token(code, redirect_uri=redirect_uri)
                MetaUserCredential.objects.update_or_create(
                    user=request.user,
                    defaults={"access_token": access_token}
                )
            else:
                credential = MetaUserCredential.objects.get(user=request.user)
                access_token = credential.access_token

            if getattr(settings, 'META_MOCK_MODE', False) or (access_token and access_token.startswith("mock_")):
                data = [{"account_id": "act_12345", "name": "Mock Ad Account", "currency": "INR", "account_status": 1}]
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


class MetaPagesListView(APIView):
    """
    Fetch Facebook Pages managed by the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            pages = MetaAdsService.get_user_pages(credential.access_token)
            return Response({"status": "success", "data": pages}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaPageLeadFormsView(APIView):
    """
    Fetch Instant Forms (Lead Forms) created under a Facebook Page.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, page_id):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            forms = MetaAdsService.get_page_lead_forms(credential.access_token, page_id)
            return Response({"status": "success", "data": forms}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaSubscribePageWebhookView(APIView):
    """
    Subscribes a Facebook Page to this app's webhooks for lead generation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, page_id):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            page_token = request.data.get("page_access_token") or credential.access_token
            res = MetaAdsService.subscribe_page_to_webhooks(page_token, page_id)
            return Response({"status": "success", "data": res}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaTargetingSearchInterestView(APIView):
    """
    Search Meta ad interests for auto-complete and ID mapping.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            query = request.query_params.get("q", "").strip()
            if not query:
                return Response({"status": "success", "data": []}, status=status.HTTP_200_OK)
            credential = MetaUserCredential.objects.get(user=request.user)
            results = MetaAdsService.search_targeting_interests(credential.access_token, query)
            return Response({"status": "success", "data": results}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaAdInsightsView(APIView):
    """
    Triggered when the frontend loads a dashboard or specific ad account metrics view.
    Returns spend, impressions, clicks, leads, conversions, roas.
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
    Requires account_id, name, objective, and daily_budget in the request body.
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
                "location": serializers.CharField(required=False),
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
            ad_text = request.data.get("ad_text")
            lifetime_budget = request.data.get("lifetime_budget")
            location = request.data.get("location")
            
            budget_val = daily_budget or lifetime_budget or request.data.get("budget_amount")
            if not (account_id and name and objective and budget_val and location and ad_text):
                return Response(
                    {"status": "error", "message": "account_id, name, objective, budget, location, and ad_text are required."},
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

            after_cursor = request.query_params.get("after")
            limit = int(request.query_params.get("limit", 100))

            data = MetaAdsService.get_campaigns_list(access_token, account_id, limit=limit, after_cursor=after_cursor)
            
            status_filter = request.query_params.get("status")
            if status_filter:
                data = [c for c in data if c.get("status") == status_filter]
                
            return Response({
                "status": "success", 
                "data": data,
                "meta": {
                    "total": len(data),
                    "page": 1,
                    "page_size": len(data),
                    "total_pages": 1
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


class UpdateMetaCampaignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            endpoint = f"{MetaAdsService.BASE_URL}/{campaign_id}"
            params = {
                "access_token": credential.access_token,
            }
            if "name" in request.data:
                params["name"] = request.data["name"]
            if "status" in request.data:
                params["status"] = request.data["status"]
            
            response = requests.post(endpoint, data=params)
            if response.status_code == 200:
                return Response({"status": "success", "data": response.json()}, status=status.HTTP_200_OK)
            else:
                return Response({"status": "error", "message": response.text}, status=status.HTTP_400_BAD_REQUEST)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UpdateMetaCampaignStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id):
        try:
            status_val = request.data.get("status")
            if not status_val:
                return Response(
                    {"status": "error", "message": "status is required in request body."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            credential = MetaUserCredential.objects.get(user=request.user)
            res = MetaAdsService.update_campaign_status(credential.access_token, campaign_id, status_val)
            return Response({"status": "success", "data": res}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DeleteMetaCampaignView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, campaign_id):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            res = MetaAdsService.delete_campaign(credential.access_token, campaign_id)
            return Response({"status": "success", "data": res}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaLeadWebhookView(APIView):
    """
    Webhook to receive real-time lead data from Meta Ads Instant Forms.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        hub_mode = request.query_params.get("hub.mode")
        hub_challenge = request.query_params.get("hub.challenge")
        hub_verify_token = request.query_params.get("hub.verify_token")

        valid_tokens = {
            getattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "secure_token"),
            getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "auto-market-whatsapp-secure-token"),
            "secure_token",
            "auto-market-whatsapp-secure-token",
            "my_secret_token_123"
        }

        if hub_mode == "subscribe" and (hub_verify_token in valid_tokens or not hub_verify_token):
            return HttpResponse(hub_challenge)
        return HttpResponse("Verification failed", status=403)

    def post(self, request):
        import logging
        logger = logging.getLogger(__name__)
        try:
            signature = request.headers.get("X-Hub-Signature-256")
            payload_body = request.body
            secret = getattr(settings, "META_APP_SECRET", "").encode('utf-8')
            if signature and secret:
                expected_signature = "sha256=" + hmac.new(secret, payload_body, hashlib.sha256).hexdigest()
                if not hmac.compare_digest(signature, expected_signature):
                    if not settings.DEBUG:
                        logger.warning("Invalid webhook signature received from Meta.")
                        return Response({"status": "error", "message": "Invalid signature"}, status=status.HTTP_403_FORBIDDEN)
                    else:
                        logger.warning("Invalid webhook signature, but DEBUG=True allows bypass.")

            payload = request.data
            logger.info(f"Processing Meta leadgen webhook payload in MetaLeadWebhookView: {payload}")
            results = MetaAdsService.process_meta_leadgen_payload(payload)
            return Response({"status": "success", "processed": len(results), "leads": results}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Error handling Meta leadgen webhook: {e}")
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MetaWebhookLeadsView(APIView):
    """
    Returns captured Meta Ads leads for display in the dashboard table.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            target_user = request.user
            records = CustomerRecord.objects.filter(
                models.Q(upload__file_type="meta") | models.Q(data__source="meta") | models.Q(upload__file_name__startswith="Meta"),
                upload__uploaded_by=target_user
            ).order_by('-created_at')
            
            data = []
            for r in records:
                rdata = r.data or {}
                data.append({
                    "id": r.id,
                    "email": rdata.get("email"),
                    "name": rdata.get("name") or "Unknown",
                    "phone": rdata.get("phone") or rdata.get("phone_number") or "",
                    "campaign_name": rdata.get("campaign_name") or "Meta Campaign",
                    "form_id": rdata.get("form_id") or "",
                    "custom_questions": rdata.get("custom_questions", {}),
                    "created_at": r.created_at.isoformat()
                })
            return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaPixelSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            settings_obj, _ = MetaPixelSettings.objects.get_or_create(user=request.user)
            data = {
                "pixel_id": settings_obj.pixel_id or "",
                "access_token": settings_obj.access_token or "",
                "test_event_code": settings_obj.test_event_code or "",
                "is_active": settings_obj.is_active
            }
            return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        try:
            settings_obj, _ = MetaPixelSettings.objects.get_or_create(user=request.user)
            settings_obj.pixel_id = request.data.get("pixel_id", "").strip()
            settings_obj.access_token = request.data.get("access_token", "").strip()
            settings_obj.test_event_code = request.data.get("test_event_code", "").strip()
            settings_obj.is_active = request.data.get("is_active", False)
            settings_obj.save()
            
            test_triggered = False
            is_test_action = request.data.get("is_test_action", False)
            if settings_obj.pixel_id and (settings_obj.test_event_code or is_test_action):
                test_triggered = True
                MetaCapiEventLog.objects.create(
                    user=request.user,
                    event_name="PageView" if not is_test_action else "Lead",
                    pixel_id=settings_obj.pixel_id,
                    test_event_code=settings_obj.test_event_code,
                    status="Success",
                    response_payload={"message": "Mock CAPI event dispatched successfully"}
                )
                
            return Response({
                "status": "success",
                "message": "Pixel settings updated successfully.",
                "test_triggered": test_triggered
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaCapiEventLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            logs = MetaCapiEventLog.objects.filter(user=request.user).order_by('-created_at')[:20]
            data = []
            for log in logs:
                data.append({
                    "id": str(log.id),
                    "event_name": log.event_name,
                    "pixel_id": log.pixel_id,
                    "test_event_code": log.test_event_code or "",
                    "status": log.status,
                    "created_at": log.created_at.isoformat()
                })
            return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UpdateMetaObjectStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, object_id):
        try:
            status_val = request.data.get("status")
            if not status_val:
                return Response(
                    {"status": "error", "message": "status is required in request body."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            credential = MetaUserCredential.objects.get(user=request.user)
            res = MetaAdsService.update_object_status(credential.access_token, object_id, status_val)
            return Response({"status": "success", "data": res}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UpdateMetaAdsetBudgetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, adset_id):
        try:
            budget = request.data.get("budget")
            if not budget:
                return Response(
                    {"status": "error", "message": "budget is required in request body."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            credential = MetaUserCredential.objects.get(user=request.user)
            res = MetaAdsService.update_adset_budget(credential.access_token, adset_id, int(budget))
            return Response({"status": "success", "data": res}, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SyncMetaFormLeadsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, form_id):
        try:
            credential = MetaUserCredential.objects.get(user=request.user)
            # Try getting leads using the user's token
            res = MetaAdsService.get_form_leads(credential.access_token, form_id)
            if not res.get('data'):
                # Try with page access tokens for pages owned by this user
                pages = MetaAdsService.get_pages(credential.access_token)
                for page in pages:
                    ptoken = page.get("access_token")
                    if ptoken:
                        page_res = MetaAdsService.get_form_leads(ptoken, form_id)
                        if page_res.get('data'):
                            res = page_res
                            break

            leads_data = res.get('data', [])
            synced_count = 0
            
            from apps.campaigns.models import CustomerUpload, CustomerRecord
            from apps.campaigns.services import ContactService
            from apps.events.models import SystemEvent

            upload, _ = CustomerUpload.objects.get_or_create(
                file_name="Meta Webhooks",
                uploaded_by=request.user,
                defaults={"file_type": "meta", "status": CustomerUpload.Status.COMPLETED}
            )

            for lead in leads_data:
                field_data = lead.get("field_data", [])
                email = None
                full_name = "Unknown"
                phone_number = None
                custom_questions = {}

                for field in field_data:
                    fname = field.get("name", "")
                    values = field.get("values", [])
                    if values:
                        val = values[0]
                        if fname in ("email", "user_email"):
                            email = val
                        elif fname in ("full_name", "name", "first_name"):
                            full_name = val
                        elif fname in ("phone_number", "phone", "contact_number"):
                            phone_number = val
                        else:
                            custom_questions[fname] = val if len(values) == 1 else values

                lead_id = str(lead.get("id") or "")
                meta_payload = {
                    'email': email or "",
                    'name': full_name,
                    'phone': phone_number or "",
                    'source': 'meta',
                    '__source__': 'meta',
                    '_source': 'meta',
                    'lead_id': lead_id,
                    'ad_id': str(lead.get("ad_id") or ""),
                    'ad_name': lead.get("ad_name") or "Meta Lead Form Ad",
                    'campaign_id': str(lead.get("campaign_id") or ""),
                    'campaign_name': lead.get("campaign_name") or "Meta Leads",
                    'form_id': str(form_id),
                    'custom_questions': custom_questions,
                    'field_data': field_data
                }

                existing_record = CustomerRecord.objects.filter(
                    upload=upload,
                    data__lead_id=lead_id
                ).first() if lead_id else None

                if not existing_record:
                    CustomerRecord.objects.create(
                        upload=upload,
                        data=meta_payload
                    )
                    synced_count += 1

                if email or phone_number:
                    try:
                        ContactService.upsert_contact(
                            owner=request.user,
                            payload=meta_payload,
                            default_source="meta",
                            initial_upload=upload,
                            sub_source_type="meta_campaign",
                            sub_source_id=str(lead.get("campaign_id") or form_id),
                            sub_source_name=lead.get("campaign_name") or "Meta Leads",
                        )
                    except Exception:
                        pass

            return Response({
                "status": "success",
                "data": {"leads": leads_data, "synced": synced_count}
            }, status=status.HTTP_200_OK)
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UploadMetaMediaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            account_id = request.data.get("account_id")
            media_type = request.data.get("media_type")
            file_obj = request.FILES.get("file")
            
            if not all([account_id, media_type, file_obj]):
                return Response(
                    {"status": "error", "message": "account_id, media_type, and file are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            credential = MetaUserCredential.objects.get(user=request.user)
            res = MetaAdsService.upload_media(credential.access_token, account_id, media_type, file_obj)
            
            if "error" in res:
                return Response({"status": "error", "message": res["error"]}, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({"status": "success", "data": res}, status=status.HTTP_201_CREATED)
            
        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            msg = "Meta account not connected." if isinstance(e, MetaUserCredential.DoesNotExist) else str(e)
            return Response({"status": "error", "message": msg}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaLeadTriggerListView(APIView):
    """
    List and create n8n-style Meta Lead Ads triggers for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        triggers = MetaLeadTrigger.objects.filter(user=request.user)
        data = [
            {
                "id": str(t.id),
                "page_id": t.page_id,
                "page_name": t.page_name,
                "form_id": t.form_id,
                "form_name": t.form_name,
                "is_active": t.is_active,
                "last_lead_at": t.last_lead_at.isoformat() if t.last_lead_at else None,
                "leads_count": t.leads_count,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in triggers
        ]
        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            page_id = str(request.data.get("page_id") or "").strip()
            page_name = str(request.data.get("page_name") or page_id).strip()
            form_id = str(request.data.get("form_id") or "all").strip()
            form_name = str(request.data.get("form_name") or ("All Forms" if form_id == "all" else form_id)).strip()
            is_active = request.data.get("is_active", True)

            if not page_id:
                return Response(
                    {"status": "error", "message": "page_id is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Retrieve Page Access Token
            credential = MetaUserCredential.objects.filter(user=request.user).first()
            if not credential:
                return Response(
                    {"status": "error", "message": "Meta account not connected. Please connect your Facebook account first."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            page_token = MetaAdsService.get_page_access_token(credential.access_token, page_id)
            if not page_token:
                page_token = credential.access_token

            # Subscribe page on Meta Graph API
            sub_res = MetaAdsService.subscribe_page_to_webhooks(page_token, page_id)

            # Create or update trigger
            trigger, created = MetaLeadTrigger.objects.update_or_create(
                user=request.user,
                page_id=page_id,
                form_id=form_id,
                defaults={
                    "page_name": page_name,
                    "page_access_token": page_token,
                    "form_name": form_name,
                    "is_active": bool(is_active),
                }
            )

            return Response({
                "status": "success",
                "message": f"Lead Ads trigger {'created' if created else 'updated'} successfully.",
                "data": {
                    "id": str(trigger.id),
                    "page_id": trigger.page_id,
                    "page_name": trigger.page_name,
                    "form_id": trigger.form_id,
                    "form_name": trigger.form_name,
                    "is_active": trigger.is_active,
                    "leads_count": trigger.leads_count,
                    "meta_subscription": sub_res
                }
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except (MetaUserCredential.DoesNotExist, MetaTokenExpiredError) as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MetaLeadTriggerDetailView(APIView):
    """
    Toggle or delete a specific Meta Lead Ads trigger.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            trigger = MetaLeadTrigger.objects.get(id=pk, user=request.user)
            if "is_active" in request.data:
                trigger.is_active = bool(request.data["is_active"])
                trigger.save(update_fields=["is_active"])

                # If deactivated, check if any OTHER active trigger uses this page
                if not trigger.is_active:
                    other_active = MetaLeadTrigger.objects.filter(
                        page_id=trigger.page_id,
                        is_active=True
                    ).exclude(id=trigger.id).exists()
                    if not other_active:
                        MetaAdsService.unsubscribe_page_from_webhooks(trigger.page_access_token, trigger.page_id)
                else:
                    # Reactivated: ensure subscribed
                    MetaAdsService.subscribe_page_to_webhooks(trigger.page_access_token, trigger.page_id)

            return Response({
                "status": "success",
                "message": "Trigger updated.",
                "data": {
                    "id": str(trigger.id),
                    "is_active": trigger.is_active
                }
            }, status=status.HTTP_200_OK)
        except MetaLeadTrigger.DoesNotExist:
            return Response({"status": "error", "message": "Trigger not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            trigger = MetaLeadTrigger.objects.get(id=pk, user=request.user)
            page_id = trigger.page_id
            page_token = trigger.page_access_token
            trigger.delete()

            # Clean up subscription if no other active triggers on this page
            other_active = MetaLeadTrigger.objects.filter(page_id=page_id, is_active=True).exists()
            if not other_active:
                MetaAdsService.unsubscribe_page_from_webhooks(page_token, page_id)

            return Response({"status": "success", "message": "Trigger deleted."}, status=status.HTTP_200_OK)
        except MetaLeadTrigger.DoesNotExist:
            return Response({"status": "error", "message": "Trigger not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

