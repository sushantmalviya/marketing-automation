import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.campaigns.models import Audience

User = get_user_model()
admin_user = User.objects.filter(is_superuser=True).first()
if not admin_user:
    print("No superuser found.")
    exit()

def create_source_audience(name, source):
    Audience.objects.get_or_create(
        name=name,
        created_by=admin_user,
        defaults={
            "definition": {
                "type": "DYNAMIC",
                "operator": "AND",
                "conditions": [
                    {
                        "field": "source",
                        "operator": "equals",
                        "value": source
                    }
                ]
            }
        }
    )

create_source_audience("Form Leads", "form")
create_source_audience("Meta Leads", "meta")
print("Seeded default groups.")
