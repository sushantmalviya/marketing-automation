"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.accounts.views import ListAdminsView, ListUsersView, AdminDetailView

# ── Inline asset library view (avoids sub-module reload timing issues) ─────────
import os, uuid as _uuid
from django.conf import settings as _settings
from django.core.files.storage import default_storage as _storage
from rest_framework.views import APIView as _APIView
from rest_framework.permissions import IsAuthenticated as _IsAuth
from rest_framework.response import Response as _Resp
from rest_framework.pagination import PageNumberPagination as _Pager
from rest_framework import status as _status
from apps.asset_library.models import Asset as _Asset
from apps.asset_library.serializers import AssetSerializer as _AssetSer, AssetCreateSerializer as _AssetCreateSer

def _auto_type(name):
    ext = os.path.splitext(name)[1].lower().lstrip(".")
    if ext in {"jpg","jpeg","png","webp","gif","svg","bmp"}: return _Asset.AssetType.IMAGE
    if ext in {"mp4","mov","avi","mkv","webm","m4v"}:        return _Asset.AssetType.VIDEO
    if ext in {"pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv"}: return _Asset.AssetType.DOCUMENT
    return _Asset.AssetType.OTHER

class _AssetPager(_Pager):
    page_size = 50
    page_size_query_param = "size"
    max_page_size = 200

class _AssetListCreate(_APIView):
    permission_classes = [_IsAuth]
    def get(self, request):
        qs = _Asset.objects.filter(uploaded_by=request.user).select_related("uploaded_by")
        t = request.query_params.get("type")
        if t: qs = qs.filter(asset_type=t.upper())
        s = request.query_params.get("search","").strip()
        if s: qs = qs.filter(name__icontains=s)
        path = request.query_params.get("path")
        if path: qs = qs.filter(path__startswith=path)
        p = _AssetPager(); page = p.paginate_queryset(qs, request)
        return p.get_paginated_response(_AssetSer(page, many=True).data)
    def post(self, request):
        ser = _AssetCreateSer(data=request.data); ser.is_valid(raise_exception=True); d = ser.validated_data
        file_url = d.get("file_url",""); f = d.get("file")
        if f:
            ext = os.path.splitext(f.name)[1]
            saved = _storage.save(f"assets/{_uuid.uuid4().hex}{ext}", f)
            file_url = request.build_absolute_uri(_settings.MEDIA_URL + saved)
        asset = _Asset.objects.create(name=d["name"], file_url=file_url,
            asset_type=d.get("asset_type") or _auto_type(d["name"]),
            is_personal=d.get("is_personal", False), uploaded_by=request.user,
            path=d.get("path", "/"), tags=d.get("tags", []))
        return _Resp(_AssetSer(asset).data, status=_status.HTTP_201_CREATED)

class _AssetDetail(_APIView):
    permission_classes = [_IsAuth]
    def get(self, request, pk):
        try: return _Resp(_AssetSer(_Asset.objects.get(pk=pk, uploaded_by=request.user)).data)
        except _Asset.DoesNotExist: return _Resp({"detail":"Not found."}, status=404)
    def delete(self, request, pk):
        try: _Asset.objects.get(pk=pk, uploaded_by=request.user).delete(); return _Resp(status=204)
        except _Asset.DoesNotExist: return _Resp({"detail":"Not found."}, status=404)
# ──────────────────────────────────────────────────────────────────────────────

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # Swagger API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    path("api/auth/", include("apps.accounts.urls")),
    path("api/billing/", include("apps.billing.urls")),
    
    # List endpoints
    path("api/admins/", ListAdminsView.as_view(), name="list-admins"),
    path("api/admins/<int:user_id>/", AdminDetailView.as_view(), name="admin-detail"),
    path("api/users/", ListUsersView.as_view(), name="list-users"),


    path("api/tasks/", include("apps.tasks.urls")),

    path(
        "api/customers/",
        include("apps.campaigns.urls.customers"),
    ),

    path(
        "api/audiences/",
        include("apps.campaigns.urls.audiences"),
    ),

    path(
        "api/campaigns/",
        include("apps.campaigns.urls.campaigns"),
    ),

    path(
        "api/channels/",
        include("apps.campaigns.urls.channels"),

    ),

    path(
        "api/forms/",
        include("apps.forms.urls"),
    ),

    path(
        "api/automations/",
        include("apps.automation.api.urls"),
    ),
    path(
        "api/events/",
        include("apps.events.urls"),
    ),
    path(
        "api/webhooks/",
        include("apps.webhooks.urls"),
    ),
    path(
        "api/communications/",
        include("apps.communications.urls"),
    ),
    path(
        "api/analytics/",
        include("apps.analytics.urls"),
    ),
    path("api/templates/", include("apps.campaigns.urls.templates")),
    path("api/ads/", include("apps.ads.urls")),

    path(
        "api/dashboard/",
        include("apps.dashboard.urls"),
    ),
    path(
        "api/content/",
        include("apps.content_studio.urls"),
    ),
    path(
        "api/integrations/",
        include("apps.integrations.urls"),
    ),
    path("api/assets/",          _AssetListCreate.as_view(), name="asset-list-create"),
    path("api/assets/<uuid:pk>/", _AssetDetail.as_view(),    name="asset-detail"),
]

import sys

from django.conf import settings
from django.conf.urls.static import static

# Serve generated media from Django during local development. The machine can
# define DEBUG=False globally, so checking the runserver command keeps local
# prompt previews working without enabling this behavior in production.
if settings.DEBUG or "runserver" in sys.argv:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
