from django.contrib import admin
from .models import MetaAdAccount, MetaUserCredential

@admin.register(MetaAdAccount)
class MetaAdAccountAdmin(admin.ModelAdmin):
    pass

@admin.register(MetaUserCredential)
class MetaUserCredentialAdmin(admin.ModelAdmin):
    pass
