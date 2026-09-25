import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0024_alter_campaign_task_optional"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaign",
            name="target_audience",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="direct_campaigns",
                to="campaigns.audience",
            ),
        ),
    ]
