from rest_framework import serializers
from .models import MetaAdAccount

class MetaAdAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaAdAccount
        fields = ['id', 'account_id', 'name', 'currency', 'account_status', 'is_active', 'created_at']
