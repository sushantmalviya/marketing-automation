import threading
from django.db import models

_thread_locals = threading.local()

def get_current_organization_id():
    """Retrieve the current organization ID bound to the active HTTP request thread."""
    return getattr(_thread_locals, 'organization_id', None)

def set_current_organization_id(org_id):
    """Bind an organization ID to the active HTTP request thread."""
    _thread_locals.organization_id = org_id

def clear_current_organization_id():
    """Clear the organization ID from the active thread."""
    if hasattr(_thread_locals, 'organization_id'):
        del _thread_locals.organization_id


class TenantQuerySet(models.QuerySet):
    """QuerySet that automatically scopes database queries to the active organization thread context."""
    def for_tenant(self, organization):
        if hasattr(organization, 'id'):
            organization = organization.id
        return self.filter(organization_id=organization)


class TenantManager(models.Manager):
    """Model Manager that automatically enforces multi-tenant scoping based on thread context."""
    def get_queryset(self):
        qs = TenantQuerySet(self.model, using=self._db)
        org_id = get_current_organization_id()
        if org_id is not None:
            return qs.filter(organization_id=org_id)
        return qs


class TenantModel(models.Model):
    """Abstract Base Model for all tenant-bound resources in the system."""
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        db_index=True,
        related_name='%(class)s_resources',
    )

    objects = TenantManager()
    all_objects = models.Manager()  # Unscoped escape hatch for platform maintenance scripts

    class Meta:
        abstract = True
