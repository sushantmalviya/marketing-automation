from rest_framework import generics, status, filters
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User , MAUser
from .serializers import LoginSerializer, ProfileSerializer, ProfileUpdateSerializer, LogoutSerializer,ForgotPasswordSerializer,ResetPasswordSerializer , CreateSuperAdminSerializer , CreateAdminSerializer , CreateUserSerializer, UserListSerializer
from django.utils import timezone
from .permissions import IsAdminOrSuperAdmin,IsSuperAdmin , IsAdmin, CanBootstrapSuperAdmin
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from .services import UserManagementService
from .pagination import AccountsPagination


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

       
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        ma_user = MAUser.objects.filter(user_id=user).first()
        refresh = RefreshToken.for_user(user)

        role = ma_user.role if ma_user else ("ADMIN" if user.is_superuser else "USER")

        return Response(
            {
                "success": True,
                "message": "Login successful.",
                "data": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "role": role,
                        "is_active": user.is_active,
                        "last_login": user.last_login,
                    },
                },
            },
            status=status.HTTP_200_OK,
        )
    
class ProfileView(generics.RetrieveAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProfileSerializer(request.user).data)
    

class LogoutView(generics.GenericAPIView):
    serializer_class = LogoutSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Logout successful."
            },
            status=status.HTTP_200_OK,
        )
    
class ForgotPasswordView(generics.GenericAPIView):
    serializer_class = ForgotPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Password reset OTP has been sent to your email."
            },
            status=status.HTTP_200_OK,
        )
    
class ResetPasswordView(generics.GenericAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Password reset successfully."
            },
            status=status.HTTP_200_OK,
        )

class CreateSuperAdminView(generics.CreateAPIView):
    serializer_class = CreateSuperAdminSerializer
    permission_classes = [CanBootstrapSuperAdmin]

    def create(self, request, *args, **kwargs):

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Super Admin created successfully.",
                "data": {
                    "id": user.id,
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )

class CreateAdminView(generics.CreateAPIView):
    """
    Create a new Admin user.
    Accessible only by Super Admin.
    """

    serializer_class = CreateAdminSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        admin = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Admin created successfully.",
                "data": {
                    "id": admin.id,
                    "email": admin.email,
                    "role": "ADMIN",
                },
            },
            status=status.HTTP_201_CREATED,
        )
    
class CreateUserView(generics.CreateAPIView):
    """
    Create a new User.
    Accessible only by Admin.
    """

    serializer_class = CreateUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        return Response(
            {
                "success": True,
                "message": "User created successfully.",
                "data": {
                    "id": user.id,
                    "email": user.email,
                    "role": "USER",
                },
            },
            status=status.HTTP_201_CREATED,
        )

class DeleteAdminView(APIView):
    """
    Deletes an Admin user.
    Accessible only by Super Admin.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def delete(self, request, user_id):
        UserManagementService.delete_admin(request.user, user_id)
        return Response(
            {"message": "Admin deleted successfully."},
            status=status.HTTP_200_OK,
        )

class DeleteUserView(APIView):
    """
    Deletes a User.
    Accessible by Admin or Super Admin.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get_object(self, user_id):
        user = get_object_or_404(User.objects.prefetch_related("ma_users"), id=user_id)
        ma_user = user.ma_users.first()
        if not ma_user or ma_user.role != "USER":
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "This endpoint only manages User accounts."})

        from apps.common.ownership import is_managed_user
        if not is_managed_user(self.request.user, user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to access this user.")
            
        return user

    def get(self, request, user_id):
        return Response(UserListSerializer(self.get_object(user_id)).data)

    def patch(self, request, user_id):
        from .serializers import UserUpdateSerializer
        user = self.get_object(user_id)
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserListSerializer(user).data)

    def delete(self, request, user_id):
        UserManagementService.delete_user(request.user, user_id)
        return Response(
            {"message": "User deleted successfully."},
            status=status.HTTP_200_OK,
        )

class ListAdminsView(generics.ListAPIView):
    """
    List all Admins. Accessible only by Super Admin.
    """
    serializer_class = UserListSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    pagination_class = AccountsPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "email"]
    ordering_fields = ["first_name", "email", "date_joined"]
    
    def get_queryset(self):
        return UserManagementService.get_admins_queryset()


class AdminDetailView(APIView):
    """
    GET  /api/admins/<user_id>/  – retrieve admin details
    PATCH /api/admins/<user_id>/ – toggle or update admin status (Super Admin only)
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def _get_admin(self, user_id):
        user = get_object_or_404(User.objects.prefetch_related("ma_users"), id=user_id)
        ma_user = user.ma_users.first()
        if not ma_user or ma_user.role != "ADMIN":
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "This endpoint only manages Admin accounts."})
        return user

    def get(self, request, user_id):
        user = self._get_admin(user_id)
        return Response(UserListSerializer(user).data)

    def patch(self, request, user_id):
        user = self._get_admin(user_id)
        # Only allow toggling is_active through this endpoint
        if "is_active" in request.data:
            user.is_active = bool(request.data["is_active"])
            user.save(update_fields=["is_active"])
        return Response(UserListSerializer(user).data)

class ListUsersView(generics.ListAPIView):
    """
    List all Users. Accessible by Admin or Super Admin.
    """
    serializer_class = UserListSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    pagination_class = AccountsPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "email"]
    ordering_fields = ["first_name", "email", "date_joined"]

    def get_queryset(self):
        return UserManagementService.get_users_queryset(self.request.user)


class BrandIdentityView(APIView):
    """
    GET  /api/accounts/brand-identity/  — fetch current brand identity settings
    PUT  /api/accounts/brand-identity/  — update brand identity settings
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.content_studio.models import BrandVoice
        from apps.content_studio.serializers import BrandVoiceSerializer
        brand_voice, _ = BrandVoice.objects.get_or_create()
        return Response(BrandVoiceSerializer(brand_voice).data)

    def put(self, request):
        from apps.content_studio.models import BrandVoice
        from apps.content_studio.serializers import BrandVoiceSerializer
        brand_voice, _ = BrandVoice.objects.get_or_create()
        serializer = BrandVoiceSerializer(brand_voice, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
