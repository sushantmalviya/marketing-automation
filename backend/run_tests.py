import os
import sys
import django

# Override environment variables for testing before loading settings
os.environ["DATABASE_URL"] = "sqlite:////IT_Softlab/Automarketer/marketing-automation/backend/test.db"
os.environ["META_APP_SECRET"] = "test-meta-app-secret"
os.environ["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] = "secret-verify-token"
os.environ["META_GRAPH_API_VERSION"] = "v19.0"
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django.setup()

from django.conf import settings
import dj_database_url

# Ensure sqlite is used in DATABASES['default'] with complete default settings dict
settings.DATABASES["default"] = dj_database_url.parse("sqlite:///:memory:")
settings.DATABASES["default"]["ATOMIC_REQUESTS"] = False


from django.test.utils import get_runner

TestRunner = get_runner(settings)
test_runner = TestRunner(verbosity=2, interactive=False)
failures = test_runner.run_tests(["apps.communications"])
if failures:
    sys.exit(1)
sys.exit(0)
