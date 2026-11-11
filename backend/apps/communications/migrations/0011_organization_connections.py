import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_communications_organizations(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    DomainAuthentication = apps.get_model("communications", "DomainAuthentication")
    SenderIdentity = apps.get_model("communications", "SenderIdentity")
    WhatsAppConnection = apps.get_model("communications", "WhatsAppConnection")
    CommunicationEvent = apps.get_model("communications", "CommunicationEvent")

    user_org_map = dict(User.objects.values_list("id", "organization_id"))

    for dom in DomainAuthentication.objects.all():
        if dom.user_id and dom.organization_id is None:
            org_id = user_org_map.get(dom.user_id)
            if org_id is not None:
                dom.organization_id = org_id
                dom.save(update_fields=["organization"])

    for ident in SenderIdentity.objects.all():
        if ident.user_id and ident.organization_id is None:
            org_id = user_org_map.get(ident.user_id)
            if org_id is not None:
                ident.organization_id = org_id
                ident.save(update_fields=["organization"])

    seen_wa = {}
    for conn in WhatsAppConnection.objects.order_by("-is_active", "-updated_at", "-created_at"):
        old_user_id = conn.organization_id
        org_id = user_org_map.get(old_user_id) if old_user_id is not None else None
        conn.connected_by_id = old_user_id
        conn.tenant_org_id = org_id

        if org_id is not None:
            key = (str(org_id), conn.phone_number_id)
            if key in seen_wa:
                keeper_id = seen_wa[key]
                CommunicationEvent.objects.filter(whatsapp_connection_id=conn.id).update(
                    whatsapp_connection_id=keeper_id
                )
                conn.delete()
                continue
            seen_wa[key] = conn.id

        conn.save(update_fields=["connected_by", "tenant_org"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0022_backfill_default_organization"),
        ("communications", "0010_domainauthentication_dkim_records_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="domainauthentication",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="domain_authentications",
                to="accounts.organization",
            ),
        ),
        migrations.AlterField(
            model_name="domainauthentication",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="domain_authentications",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="domainauthentication",
            index=models.Index(fields=["organization", "status"], name="domain_auth_organiz_6f18a2_idx"),
        ),
        migrations.AddField(
            model_name="senderidentity",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sender_identities",
                to="accounts.organization",
            ),
        ),
        migrations.AlterField(
            model_name="senderidentity",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sender_identities",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="senderidentity",
            name="connection_type",
            field=models.CharField(
                choices=[
                    ("AWS_SES", "Amazon SES"),
                    ("SMTP", "SMTP"),
                    ("API_KEY", "API Key / Token"),
                    ("OAUTH", "OAuth / Meta Embedded Signup"),
                ],
                max_length=30,
            ),
        ),
        migrations.AddIndex(
            model_name="senderidentity",
            index=models.Index(fields=["organization", "provider"], name="sender_iden_organiz_bcd508_idx"),
        ),
        migrations.AddField(
            model_name="whatsappconnection",
            name="connected_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_whatsapp_connections",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="whatsappconnection",
            name="tenant_org",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="whatsapp_connections_tmp",
                to="accounts.organization",
            ),
        ),
        migrations.RunPython(backfill_communications_organizations, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name="whatsappconnection",
            unique_together=set(),
        ),
        migrations.RemoveIndex(
            model_name="whatsappconnection",
            name="whatsapp_co_organiz_862732_idx",
        ),
        migrations.RemoveField(
            model_name="whatsappconnection",
            name="organization",
        ),
        migrations.RenameField(
            model_name="whatsappconnection",
            old_name="tenant_org",
            new_name="organization",
        ),
        migrations.AlterField(
            model_name="whatsappconnection",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="whatsapp_connections",
                to="accounts.organization",
            ),
        ),
        migrations.AddIndex(
            model_name="whatsappconnection",
            index=models.Index(fields=["organization", "is_active"], name="whatsapp_co_organiz_862732_idx"),
        ),
        migrations.AddIndex(
            model_name="whatsappconnection",
            index=models.Index(fields=["connected_by", "is_active"], name="whatsapp_co_connect_00989e_idx"),
        ),
        migrations.AddConstraint(
            model_name="whatsappconnection",
            constraint=models.UniqueConstraint(
                condition=models.Q(("organization__isnull", False)),
                fields=("organization", "phone_number_id"),
                name="uniq_whatsapp_org_phone",
            ),
        ),
        migrations.AddConstraint(
            model_name="whatsappconnection",
            constraint=models.UniqueConstraint(
                condition=models.Q(("connected_by__isnull", False), ("organization__isnull", True)),
                fields=("connected_by", "phone_number_id"),
                name="uniq_whatsapp_user_phone",
            ),
        ),
    ]
