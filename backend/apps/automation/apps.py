from django.apps import AppConfig


class AutomationConfig(AppConfig):
    name = 'apps.automation'

    def ready(self):
        import apps.automation.services.event_listener
