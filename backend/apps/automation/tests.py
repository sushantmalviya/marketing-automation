from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser

from apps.automation.models import (
    Automation,
    AutomationExecution,
)
from apps.automation.nodes.utilities.wait import WaitNode
from apps.automation.services.executor import WorkflowExecutor
from apps.automation.services.retry import mark_retry_or_failed


class AutomationExecutionEngineTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="owner@example.com",
            password="password",
        )
        self.automation = Automation.objects.create(
            name="Lifecycle test",
            owner=self.user,
            status=Automation.Status.PUBLISHED,
            workflow_graph={"nodes": [], "edges": []}
        )

    def add_node(self, node_id, node_type, action_name, label, config=None):
        node = {
            "id": node_id,
            "type": node_type,
            "action_name": action_name,
            "label": label,
            "business_config": config or {},
        }
        self.automation.workflow_graph["nodes"].append(node)
        self.automation.save()
        return node

    def add_edge(self, edge_id, source_id, target_id, edge_type="DEFAULT"):
        edge = {
            "id": edge_id,
            "source": source_id,
            "target": target_id,
            "edge_type": edge_type,
        }
        self.automation.workflow_graph["edges"].append(edge)
        self.automation.save()

    def test_wait_node_pauses_execution_with_resume_at(self):
        node = self.add_node(
            "wait-1",
            "UTILITY",
            "WAIT",
            "Wait five minutes",
            {
                "minutes": 5,
            },
        )
        execution = AutomationExecution.objects.create(
            automation=self.automation,
            triggered_by=self.user,
            current_node_id="wait-1"
        )

        before = timezone.now()
        result = WaitNode().execute(
            execution,
            node,
            node.get("business_config"),
        )
        execution.refresh_from_db()

        self.assertTrue(result["paused"])
        self.assertEqual(execution.status, "WAITING")
        self.assertEqual(execution.current_node_id, "wait-1")
        self.assertIsNotNone(execution.paused_at)
        self.assertGreaterEqual(
            execution.resume_at,
            before + timedelta(minutes=5),
        )

    def test_condition_result_follows_yes_or_no_edge(self):
        trigger = self.add_node("trigger-1", "TRIGGER", "MANUAL", "Manual")
        condition = self.add_node("cond-1", "CONDITION", "EQUALS", "Equals", {"left": "$.event.url", "right": "/pricing"})
        yes_node = self.add_node("yes-1", "ACTION", "END", "Yes end")
        no_node = self.add_node("no-1", "ACTION", "END", "No end")

        self.add_edge("e1", "trigger-1", "cond-1")
        self.add_edge("e2", "cond-1", "yes-1", "YES")
        self.add_edge("e3", "cond-1", "no-1", "NO")

        execution = AutomationExecution.objects.create(
            automation=self.automation,
            triggered_by=self.user,
            context={
                "event": {
                    "url": "/pricing",
                }
            },
        )

        executor = WorkflowExecutor(
            execution,
            start_node=condition,
        )
        result = executor.execute_node(condition)

        self.assertEqual(
            executor.get_next(condition, result),
            yes_node,
        )

    def test_retry_service_marks_retrying_until_max_attempts(self):
        node = self.add_node("retry-1", "ACTION", "SEND_EMAIL", "Retryable email", {
            "retry_count": 1,
            "retry_delay": 30,
            "retry_strategy": "FIXED",
        })
        execution = AutomationExecution.objects.create(
            automation=self.automation,
            triggered_by=self.user,
            current_node_id="retry-1",
        )

        delay = mark_retry_or_failed(
            execution,
            RuntimeError("temporary"),
        )
        execution.refresh_from_db()

        self.assertEqual(delay, 30)
        self.assertEqual(execution.status, "RETRYING")
        self.assertEqual(execution.retry_count, 1)
        self.assertIsNotNone(execution.retry_after)

        mark_retry_or_failed(
            execution,
            RuntimeError("permanent"),
        )
        execution.refresh_from_db()

        self.assertEqual(execution.status, "FAILED")
        self.assertIn("permanent", execution.error_message)


class AutomationPermissionAPITests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            email="automation-owner@example.com",
            password="StrongPass123!",
        )
        self.other = user_model.objects.create_user(
            email="automation-other@example.com",
            password="StrongPass123!",
        )
        MAUser.objects.create(user=self.owner, role="USER")
        MAUser.objects.create(user=self.other, role="USER")
        self.automation = Automation.objects.create(
            name="Private automation",
            owner=self.owner,
        )

    def test_non_owner_cannot_read_or_update_automation(self):
        self.client.force_authenticate(self.other)
        detail = f"/api/automations/{self.automation.id}/"
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.patch(detail, {"name": "Stolen"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
