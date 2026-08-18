from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser, User
from apps.accounts.permissions import (
    IsAdminOrSuperAdmin,
    IsContentStudioAuthorized,
    IsSuperAdminOrOwnManagedUser,
    get_request_role,
)


class PermissionRequest:
    def __init__(self, user):
        self.user = user


class AuthenticationAPITests(APITestCase):
    password = "StrongPass123!"

    def create_role_user(self, email, role, **extra):
        user = User.objects.create_user(
            email=email,
            password=self.password,
            **extra,
        )
        MAUser.objects.create(user=user, role=role)
        return user

    def test_login_returns_tokens_and_role_without_password(self):
        self.create_role_user("user@example.com", "USER")
        response = self.client.post(
            reverse("login"),
            {"email": "user@example.com", "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertEqual(data["user"]["role"], "USER")
        self.assertNotIn("password", str(response.data).lower())

    def test_refresh_route_rotates_a_valid_refresh_token(self):
        self.create_role_user("refresh@example.com", "USER")
        login = self.client.post(
            reverse("login"),
            {"email": "refresh@example.com", "password": self.password},
            format="json",
        )
        response = self.client.post(
            reverse("token_refresh"),
            {"refresh": login.data["data"]["refresh"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_super_admin_bootstrap_is_one_time_for_anonymous_clients(self):
        first = self.client.post(
            reverse("create-super-admin"),
            {"email": "root@example.com", "password": self.password},
            format="json",
        )
        second = self.client.post(
            reverse("create-super-admin"),
            {"email": "root2@example.com", "password": self.password},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_existing_super_admin_can_create_another_super_admin(self):
        root = self.create_role_user(
            "existing-root@example.com",
            "SUPER_ADMIN",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(root)
        response = self.client.post(
            reverse("create-super-admin"),
            {"email": "new-root@example.com", "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_profile_name_can_be_updated_without_changing_role(self):
        user = self.create_role_user("profile@example.com", "USER")
        self.client.force_authenticate(user)
        response = self.client.patch(
            reverse("profile"),
            {"first_name": "Ada", "last_name": "Lovelace", "role": "SUPER_ADMIN"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Ada")
        self.assertEqual(response.data["role"], "USER")

    def test_django_superuser_without_ma_user_can_create_admin(self):
        root = User.objects.create_superuser(
            email="django-root@example.com",
            password=self.password,
        )
        self.client.force_authenticate(root)
        response = self.client.post(
            reverse("create-admin"),
            {
                "email": "created-admin@example.com",
                "password": self.password,
                "first_name": "Created",
                "last_name": "Admin",
                "mobile_no": "9876543210",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            MAUser.objects.filter(
                user__email="created-admin@example.com",
                role="ADMIN",
            ).exists()
        )


class AccountPermissionTests(APITestCase):
    password = "StrongPass123!"

    def create_role_user(self, email, role, managed_by=None, **extra):
        user = User.objects.create_user(
            email=email,
            password=self.password,
            **extra,
        )
        profile = MAUser.objects.create(
            user=user,
            role=role,
            managed_by=managed_by,
        )
        return user, profile

    def test_django_superuser_role_is_never_downgraded(self):
        root = User.objects.create_superuser(
            email="root-role@example.com",
            password=self.password,
        )
        MAUser.objects.create(user=root, role="USER")

        self.assertEqual(get_request_role(root), "SUPER_ADMIN")
        self.assertTrue(
            IsAdminOrSuperAdmin().has_permission(PermissionRequest(root), None)
        )

    def test_content_permission_supports_django_superuser_without_profile(self):
        root = User.objects.create_superuser(
            email="content-root@example.com",
            password=self.password,
        )
        request = PermissionRequest(root)

        self.assertTrue(IsContentStudioAuthorized().has_permission(request, None))
        self.assertEqual(root.role, "SUPER_ADMIN")
        self.assertFalse(root.requires_approval)

    def test_admin_can_manage_only_directly_managed_marketing_users(self):
        admin, admin_profile = self.create_role_user(
            "owner-admin@example.com",
            "ADMIN",
        )
        managed_user, managed_profile = self.create_role_user(
            "managed@example.com",
            "USER",
            managed_by=admin_profile,
        )
        other_user, _ = self.create_role_user(
            "unmanaged@example.com",
            "USER",
        )
        permission = IsSuperAdminOrOwnManagedUser()
        request = PermissionRequest(admin)

        self.assertTrue(permission.has_permission(request, None))
        self.assertTrue(permission.has_object_permission(request, None, managed_user))
        self.assertTrue(permission.has_object_permission(request, None, managed_profile))
        self.assertFalse(permission.has_object_permission(request, None, other_user))

    def test_anonymous_bootstrap_is_closed_when_django_superuser_exists(self):
        User.objects.create_superuser(
            email="existing-django-root@example.com",
            password=self.password,
        )

        response = self.client.post(
            reverse("create-super-admin"),
            {"email": "anonymous-root@example.com", "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
