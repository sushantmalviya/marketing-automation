from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0023_customerrecord_routing_logs"),
    ]

    operations = [
        migrations.AlterField(
            model_name="campaign",
            name="task",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="campaigns",
                to="accounts.user",
            ),
        ),
    ]
