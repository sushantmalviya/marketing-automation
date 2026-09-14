from django.contrib.auth.models import AbstractUser
from django.db import models
from .managers import UserManager

class User(AbstractUser):
    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
    )

    email = models.EmailField(unique=True)

    mobile_no = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )



    department = models.ForeignKey(
        "common.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email

class MAUser(models.Model):

    ROLE_CHOICES = [
        ("ADMIN", "Admin"),
        ("USER", "User"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ma_users",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="USER",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    requires_approval = models.BooleanField(
        default=True,
        help_text="If True, the user's content must be approved before publishing."
    )

    def __str__(self):
        if self.user_id:
            return f"{self.user_id.email} ({self.role})"
        return "No User"
    
