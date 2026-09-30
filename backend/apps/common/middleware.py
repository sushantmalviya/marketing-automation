from django.http import JsonResponse
from apps.common.tenant import set_current_organization_id, clear_current_organization_id

class TenantContextMiddleware:
    """
    Middleware that extracts the authenticated user's organization_id
    and sets it in thread-local storage for auto-scoping DB queries.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            org_id = getattr(request.user, 'organization_id', None)
            set_current_organization_id(org_id)
        else:
            set_current_organization_id(None)

        try:
            response = self.get_response(request)
        finally:
            clear_current_organization_id()

        return response


class SubscriptionCheckMiddleware:
    """
    Middleware that enforces software rental validity and PAYG balance checks.
    Blocks write/mutate requests (POST, PUT, PATCH, DELETE) with HTTP 402 if rental is expired or suspended.
    Excludes authentication, health checks, static assets, and external provisioning APIs.
    """
    EXEMPT_PATH_PREFIXES = [
        '/admin/',
        '/api/v1/external/',
        '/api/v1/auth/',
        '/api/accounts/login/',
        '/api/accounts/token/',
        '/api/webhooks/',
        '/static/',
        '/media/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if any(path.startswith(prefix) for prefix in self.EXEMPT_PATH_PREFIXES):
            return self.get_response(request)

        # Check rental validity for write operations
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            if hasattr(request, 'user') and request.user.is_authenticated:
                user = request.user
                if not user.is_superuser:
                    org = getattr(user, 'organization', None)
                    if org:
                        sub = getattr(org, 'subscription', None)
                        if sub and not sub.is_rent_valid():
                            return JsonResponse(
                                {
                                    "error": "Rental_Expired",
                                    "detail": f"Your company software rental status is '{sub.rent_status}'. Please contact support or renew your subscription to continue using the software.",
                                },
                                status=402,
                            )

        return self.get_response(request)
