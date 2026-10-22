from django.db import migrations, models


def add_column_if_not_exists(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE ads_meta_ad_accounts ADD COLUMN IF NOT EXISTS amount_spent numeric(15,2) DEFAULT 0.00;")
    elif schema_editor.connection.vendor == "sqlite":
        cursor = schema_editor.connection.cursor()
        cursor.execute("PRAGMA table_info(ads_meta_ad_accounts);")
        cols = [r[1] for r in cursor.fetchall()]
        if "amount_spent" not in cols:
            schema_editor.execute("ALTER TABLE ads_meta_ad_accounts ADD COLUMN amount_spent decimal(15,2) DEFAULT 0.00;")

def remove_column_if_exists(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE ads_meta_ad_accounts DROP COLUMN IF EXISTS amount_spent;")


class Migration(migrations.Migration):

    dependencies = [
        ('ads', '0005_metaadaccount_amount_spent_metacapieventlog'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='metaadaccount',
                    name='amount_spent',
                    field=models.DecimalField(decimal_places=2, default=0.0, max_digits=15),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_column_if_not_exists, remove_column_if_exists),
            ],
        ),
    ]
