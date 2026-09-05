import os
from pathlib import Path
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
 
# DEBUG should be False in production (e.g., set DEBUG=False in Render env vars).
# Locally, it can default to True if not set.
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")

PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:8000")
 
# This setup allows the project to run locally, on ngrok, and on Render simultaneously
# without needing to comment/uncomment anything.
ALLOWED_HOSTS = [
    "127.0.0.1", 
    "localhost", 
    ".ngrok-free.dev",
    ".onrender.com"
]

# Allow adding more hosts dynamically via environment variable
_env_hosts = os.getenv("ALLOWED_HOSTS", "")
if _env_hosts:
    ALLOWED_HOSTS.extend([h.strip() for h in _env_hosts.split(",") if h.strip()])
 
HF_TOKEN = os.getenv("HF_TOKEN")
HF_IMAGE_MODEL = os.getenv("HF_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
HF_TEXT_MODEL = os.getenv("HF_TEXT_MODEL", "Qwen/Qwen2.5-7B-Instruct")
DEFAULT_TEXT_PROVIDER = os.getenv("DEFAULT_TEXT_PROVIDER", "gemini")
 
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

META_APP_ID = os.getenv("META_APP_ID")
META_APP_SECRET = os.getenv("META_APP_SECRET")
META_WEBHOOK_VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "secure_token")
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "http://localhost:3000/admin/ads")
META_MOCK_MODE = os.getenv("META_MOCK_MODE", "False").lower() in ("true", "1", "t")
 
# Auto-reload trigger (env change detected)
# --------------------------------------------------
# Applications
# --------------------------------------------------
 
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "cloudinary_storage",
    "django.contrib.staticfiles",
    "cloudinary",
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
    "corsheaders",
    'apps.campaigns',
    'apps.dashboard',
    'apps.ads',
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
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles") # Required for collectstatic in production (Render)

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# Cloudinary Configuration
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.getenv('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': os.getenv('CLOUDINARY_API_KEY'),
    'API_SECRET': os.getenv('CLOUDINARY_API_SECRET'),
}

STORAGES = {
    "default": {
        "BACKEND": "apps.common.storage.AutoCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
 
# --------------------------------------------------
# Default Primary Key
# --------------------------------------------------
 
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
 
# --------------------------------------------------
# Custom User Model
# --------------------------------------------------
 
AUTH_USER_MODEL = "accounts.User"
 
# These origins can access the API. It includes both local frontend and deployed Vercel frontend.
# No need to comment/uncomment when switching between local and deployed.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://marketing-automation-uo4q.onrender.com",
    "https://marketing-automation-smoky.vercel.app",
]

# Allow adding more CORS origins dynamically via environment variable
_env_cors = os.getenv("CORS_ALLOWED_ORIGINS", "")
if _env_cors:
    CORS_ALLOWED_ORIGINS.extend([o.strip() for o in _env_cors.split(",") if o.strip()])

# Required if your frontend sends cookies or authorization headers
CORS_ALLOW_CREDENTIALS = True
 
# CSRF Trusted Origins are required for Django admin and API POST requests from the frontend in production
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://marketing-automation-uo4q.onrender.com",
    "https://marketing-automation-smoky.vercel.app",
]
 
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
 
# --------------------------------------------------
# IMAP Polling Configuration (for Bounces & Replies)
# --------------------------------------------------
IMAP_HOST = os.getenv("IMAP_HOST")
IMAP_PORT = int(os.getenv("IMAP_PORT", 993))
IMAP_USER = os.getenv("IMAP_USER", EMAIL_HOST_USER)
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", EMAIL_HOST_PASSWORD)
TRACKING_EMAIL = os.getenv("TRACKING_EMAIL", IMAP_USER) # Generic catch-all or dedicated inbox for tracking

 
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
_redis_url = os.environ.get("REDIS_URL")

if _redis_url:
    CELERY_BROKER_URL = _redis_url
    CELERY_RESULT_BACKEND = _redis_url
    CELERY_TASK_ALWAYS_EAGER = False
else:
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = None
    CELERY_TASK_ALWAYS_EAGER = True
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC' 
from .celerybeat import CELERY_BEAT_SCHEDULE