from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url
 
# --------------------------------------------------
# Base Directory
# --------------------------------------------------
 
BASE_DIR = Path(__file__).resolve().parent.parent
 
# This project intentionally uses backend/.env as its single local config
# source. Override inherited machine variables so DEBUG, database, and API
# settings match that file consistently when started from an IDE or terminal.
load_dotenv(BASE_DIR / ".env", override=True)
 
# --------------------------------------------------
# Security
# --------------------------------------------------
 
SECRET_KEY = os.getenv("SECRET_KEY")
 
DEBUG = os.getenv("DEBUG", "False") == "True"
 
ALLOWED_HOSTS = ["127.0.0.1", "localhost", ".ngrok-free.dev"]
 
HF_TOKEN = os.getenv("HF_TOKEN")
HF_IMAGE_MODEL = os.getenv("HF_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
HF_TEXT_MODEL = os.getenv("HF_TEXT_MODEL", "Qwen/Qwen2.5-7B-Instruct")
DEFAULT_TEXT_PROVIDER = os.getenv("DEFAULT_TEXT_PROVIDER", "gemini")
 
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
 
# Auto-reload trigger
# --------------------------------------------------
# Applications
# --------------------------------------------------
 
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
 
    "apps.common",
    "apps.billing",
    "apps.integrations",
    "apps.content_studio",
    "apps.asset_library",
    "apps.accounts",
    "apps.tasks",
    "apps.forms",
    'apps.automation',
    "apps.events",
    "apps.webhooks",
    "apps.communications",
    "apps.analytics",
    'corsheaders',
    'apps.campaigns',
    'apps.dashboard',
    'rest_framework',
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
]
 
# --------------------------------------------------
# Middleware
# --------------------------------------------------
 
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
 
ROOT_URLCONF = "config.urls"
 
# --------------------------------------------------
# Templates
# --------------------------------------------------
 
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
 
WSGI_APPLICATION = "config.wsgi.application"
 
# --------------------------------------------------
# Database (Neon PostgreSQL)
# --------------------------------------------------
 
import os
import dj_database_url

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=int(os.getenv("DB_CONN_MAX_AGE", "0")),
        conn_health_checks=True,
        disable_server_side_cursors=True,
        ssl_require=DATABASE_URL.startswith(("postgres://", "postgresql://")),
    )
}
 
if DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")):
    DATABASES["default"].setdefault("OPTIONS", {}).update(
        {
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 3,
        }
    )
 
# --------------------------------------------------
# Password Validation
# --------------------------------------------------
 
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]
 
# --------------------------------------------------
# Internationalization
# --------------------------------------------------
 
LANGUAGE_CODE = "en-us"
 
TIME_ZONE = "Asia/Kolkata"
 
USE_I18N = True
 
USE_TZ = True
 
# --------------------------------------------------
# Static & Media Files
# --------------------------------------------------
 
STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")
 
# --------------------------------------------------
# Default Primary Key
# --------------------------------------------------
 
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
 
# --------------------------------------------------
# Custom User Model
# --------------------------------------------------
 
AUTH_USER_MODEL = "accounts.User"
 
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
 
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}
from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
 
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
 
    "UPDATE_LAST_LOGIN": True,
 
    "AUTH_HEADER_TYPES": ("Bearer",),
}
 
# --------------------------------------------------
# Email Configuration
# --------------------------------------------------
 
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
 
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
 
OAUTH_REDIRECT_BASE_URL = os.getenv("OAUTH_REDIRECT_BASE_URL")
OAUTH_SUCCESS_REDIRECT_URL = os.getenv("OAUTH_SUCCESS_REDIRECT_URL")

WHATSAPP_WEBHOOK_VERIFY_TOKEN = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "auto-market-whatsapp-secure-token")

EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
 
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL",EMAIL_HOST_USER)
 
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
 
# --------------------------------------------------
# Cache Configuration
# --------------------------------------------------
 
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-snowflake",
    }
}
 
# --------------------------------------------------
# Celery Configuration for Demo (Bypass Redis)
# --------------------------------------------------
CELERY_TASK_ALWAYS_EAGER = False
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC' 
from .celerybeat import CELERY_BEAT_SCHEDULE