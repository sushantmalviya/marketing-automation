from django.urls import path
from .views import (
    LoginView, ProfileView, LogoutView, ForgotPasswordView, ResetPasswordView,
    CreateSuperAdminView, CreateAdminView, DeleteAdminView,
    AdminDetailView, BrandIdentityView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("forgot-password/",ForgotPasswordView.as_view(),name="forgot-password"),
    path("reset-password/",ResetPasswordView.as_view(),name="reset-password"),
    path("create-super-admin/",CreateSuperAdminView.as_view(),name="create-super-admin"),
    path("admins/",CreateAdminView.as_view(),name="create-admin"),
    path("admins/<int:user_id>/", DeleteAdminView.as_view(), name="delete-admin"),
    path("brand-identity/", BrandIdentityView.as_view(), name="brand-identity"),
]
