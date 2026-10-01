from django.db.models import Q
from apps.accounts.models import MAUser
from django.contrib.auth import get_user_model

User = get_user_model()

def get_admin_profile(user):
    """
    Returns the MAUser profile for the given user, avoiding N+1 if already selected.
    In practice, using select_related/prefetch_related on the view level helps here.
    """
    if not user.is_authenticated:
        return None
    # If ma_users is prefetched, use it without querying.
    ma_users = getattr(user, '_prefetched_objects_cache', {}).get('ma_users')
    if ma_users:
        return ma_users[0] if ma_users else None
    return user.ma_users.first()

def is_super_admin(user):
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    profile = get_admin_profile(user)
    return profile is not None and profile.role == "ADMIN"

def get_tenant_owner_profile(user):
    """
    Returns the MAUser profile for the given user.
    """
    return get_admin_profile(user)

def get_managed_users_queryset(admin_user):
    """
    Returns a queryset of User objects managed by this admin_user within their organization.
    """
    if not admin_user or not admin_user.is_authenticated:
        return User.objects.none()

    if admin_user.is_superuser and not getattr(admin_user, 'organization_id', None):
        return User.objects.filter(is_active=True).prefetch_related("ma_users")

    org_id = getattr(admin_user, 'organization_id', None)
    if org_id:
        return User.objects.filter(organization_id=org_id, is_active=True).prefetch_related("ma_users")

    return User.objects.none()

def get_managed_user_ids(admin_user):
    """Returns a list of IDs of users managed by this admin/user."""
    return list(get_managed_users_queryset(admin_user).values_list("id", flat=True))

def is_managed_user(admin_user, target_user):
    """
    Checks if target_user is managed by admin_user within the same organization.
    """
    if not target_user or not target_user.is_authenticated or not admin_user or not admin_user.is_authenticated:
        return False
    if admin_user.is_superuser and not getattr(admin_user, 'organization_id', None):
        return True
    return getattr(admin_user, 'organization_id', None) == getattr(target_user, 'organization_id', None)

def filter_users_for_admin(queryset, admin_user):
    """Filters a queryset of User objects based on organization boundaries."""
    if not admin_user or not admin_user.is_authenticated:
        return queryset.none()
    if admin_user.is_superuser and not getattr(admin_user, 'organization_id', None):
        return queryset
    org_id = getattr(admin_user, 'organization_id', None)
    if org_id:
        return queryset.filter(organization_id=org_id)
    return queryset.none()

def _filter_resource_for_admin(queryset, admin_user, user_field="created_by"):
    """
    Core tenant isolation filter:
    1. Global superuser -> all resources
    2. Tenant user -> resources in user's organization_id
    """
    if not admin_user or not admin_user.is_authenticated:
        return queryset.none()
    if admin_user.is_superuser and not getattr(admin_user, 'organization_id', None):
        return queryset

    org_id = getattr(admin_user, 'organization_id', None)
    if org_id:
        field_names = [f.name for f in queryset.model._meta.get_fields()]
        if 'organization' in field_names:
            return queryset.filter(organization_id=org_id)

    return queryset.filter(**{user_field: admin_user})

def filter_by_tenant(queryset, user, user_field="created_by"):
    return _filter_resource_for_admin(queryset, user, user_field)

def filter_campaigns_for_admin(queryset, admin_user):
    return _filter_resource_for_admin(queryset, admin_user, "created_by")

def filter_templates_for_admin(queryset, admin_user):
    return _filter_resource_for_admin(queryset, admin_user, "created_by")

def filter_dashboard_queryset(queryset, admin_user, user_field="created_by"):
    return _filter_resource_for_admin(queryset, admin_user, user_field)

def filter_audiences_for_admin(queryset, admin_user):
    return _filter_resource_for_admin(queryset, admin_user, "created_by")

def can_manage_campaign(admin_user, campaign):
    if not admin_user or not admin_user.is_authenticated:
        return False
    if admin_user.is_superuser and not getattr(admin_user, 'organization_id', None):
        return True
    org_id = getattr(admin_user, 'organization_id', None)
    if org_id and getattr(campaign, 'organization_id', None):
        return campaign.organization_id == org_id
    return campaign.created_by_id == admin_user.id

def can_manage_template(admin_user, template):
    if not admin_user or not admin_user.is_authenticated:
        return False
    if admin_user.is_superuser and not getattr(admin_user, 'organization_id', None):
        return True
    org_id = getattr(admin_user, 'organization_id', None)
    if org_id and getattr(template, 'organization_id', None):
        return template.organization_id == org_id
    return template.created_by_id == admin_user.id

def filter_customer_records_for_admin(queryset, admin_user):
    """For CustomerRecord which has upload__uploaded_by or organization"""
    return _filter_resource_for_admin(queryset, admin_user, "upload__uploaded_by")

def filter_customer_uploads_for_admin(queryset, admin_user):
    return _filter_resource_for_admin(queryset, admin_user, "uploaded_by")