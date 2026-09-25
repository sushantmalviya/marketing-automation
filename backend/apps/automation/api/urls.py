# pyrefly: ignore [missing-import]
from django.urls import path

from .automation_views import (
    AutomationListCreateView,
    AutomationDetailView,
    ValidateAutomationView,
    PublishAutomationView,
    PauseAutomationView,
    ExecuteAutomationView,
    CloneAutomationView,
)



from .execution_views import (
    ExecutionHistoryView,
    ExecutionLogsView,
)

from .webhook_views import (
    WebhookTriggerView,
)


urlpatterns = [

    # =====================================
    # Automation
    # =====================================

    path(
        "",
        AutomationListCreateView.as_view(),
    ),

    path(
        "<uuid:pk>/",
        AutomationDetailView.as_view(),
    ),

    path(
        "<uuid:pk>/validate/",
        ValidateAutomationView.as_view(),
    ),

    path(
        "<uuid:pk>/publish/",
        PublishAutomationView.as_view(),
    ),

    path(
        "<uuid:pk>/pause/",
        PauseAutomationView.as_view(),
    ),

    path(
        "<uuid:pk>/execute/",
        ExecuteAutomationView.as_view(),
    ),

    path(
        "<uuid:pk>/clone/",
        CloneAutomationView.as_view(),
    ),



    # =====================================
    # Execution
    # =====================================

    path(
        "<uuid:pk>/executions/",
        ExecutionHistoryView.as_view(),
    ),

    path(
        "executions/<uuid:pk>/logs/",
        ExecutionLogsView.as_view(),
    ),

    # =====================================
    # Webhook
    # =====================================

    path(
        "webhook/<uuid:automation_id>/",
        WebhookTriggerView.as_view(),
    ),
]