from apps.automation.models import (
    AutomationMember,
)
from apps.accounts.models import MAUser


def get_role(user):
    if user.is_superuser:
        return "ADMIN"
    return MAUser.objects.filter(user=user).values_list("role", flat=True).first()


def can_view(user, automation):

    if get_role(user) == "ADMIN":
        return True

    if automation.owner_id == user.id:
        return True

    return AutomationMember.objects.filter(
        automation=automation,
        user=user,
        permission__in=[
            "VIEW",
            "EDIT",
            "EXECUTE",
            "ADMIN",
        ],
    ).exists()


def can_edit(user, automation):

    if get_role(user) == "ADMIN":
        return True

    if automation.owner_id == user.id:
        return True

    return AutomationMember.objects.filter(
        automation=automation,
        user=user,
        permission__in=[
            "EDIT",
            "ADMIN",
        ],
    ).exists()


def can_execute(user, automation):

    if get_role(user) == "ADMIN":
        return True

    if automation.owner_id == user.id:
        return True

    return AutomationMember.objects.filter(
        automation=automation,
        user=user,
        permission__in=[
            "EXECUTE",
            "EDIT",
            "ADMIN",
        ],
    ).exists()


def can_manage(user, automation):

    if get_role(user) == "ADMIN":
        return True

    if automation.owner_id == user.id:
        return True

    return AutomationMember.objects.filter(
        automation=automation,
        user=user,
        permission="ADMIN",
    ).exists()
