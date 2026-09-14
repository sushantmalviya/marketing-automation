from django.db import migrations, models

def update_role_names(apps, schema_editor):
    MAUser = apps.get_model("accounts", "MAUser")
    # Shift roles safely:
    # First convert USER -> DUMMY
    MAUser.objects.filter(role="USER").update(role="DUMMY")
    # Then ADMIN -> USER
    MAUser.objects.filter(role="ADMIN").update(role="USER")
    # Then SUPER_ADMIN -> ADMIN
    MAUser.objects.filter(role="SUPER_ADMIN").update(role="ADMIN")

def reverse_role_names(apps, schema_editor):
    MAUser = apps.get_model("accounts", "MAUser")
    MAUser.objects.filter(role="ADMIN").update(role="SUPER_ADMIN")
    MAUser.objects.filter(role="USER").update(role="ADMIN")
    MAUser.objects.filter(role="DUMMY").update(role="USER")

class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_mauser_requires_approval"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mauser",
            name="role",
            field=models.CharField(
                choices=[("ADMIN", "Admin"), ("USER", "User"), ("DUMMY", "Dummy")],
                default="DUMMY",
                max_length=20,
            ),
        ),
        migrations.RunPython(update_role_names, reverse_role_names),
    ]
