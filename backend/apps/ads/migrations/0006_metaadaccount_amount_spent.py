from django.db import migrations, models


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
                migrations.RunSQL(
                    sql="""
                    ALTER TABLE ads_meta_ad_accounts ADD COLUMN IF NOT EXISTS amount_spent numeric(15,2) DEFAULT 0.00;
                    """,
                    reverse_sql="""
                    ALTER TABLE ads_meta_ad_accounts DROP COLUMN IF EXISTS amount_spent;
                    """,
                ),
            ],
        ),
    ]
