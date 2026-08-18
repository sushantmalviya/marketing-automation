from rest_framework.response import Response
from rest_framework.views import APIView

from apps.automation.models import (
    Automation,
    AutomationExecution,
    AutomationExecutionLog,
)
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from apps.automation.services.permissions import can_view


class ExecutionHistoryView(APIView):

    def get(
        self,
        request,
        pk,
    ):

        automation = get_object_or_404(Automation, pk=pk)
        if not can_view(request.user, automation):
            raise PermissionDenied("You do not have permission to view these executions.")

        executions = (

            AutomationExecution

            .objects

            .filter(
                automation_id=pk
            )

            .order_by(
                "-started_at"
            )

        )

        data = []

        for execution in executions:

            data.append({

                "id":
                    execution.id,

                "status":
                    execution.status,

                "started_at":
                    execution.started_at,

                "finished_at":
                    execution.finished_at,

                "retry_count":
                    execution.retry_count,

                "error_message":
                    execution.error_message,

            })

        return Response(
            data
        )


class ExecutionLogsView(APIView):

    def get(
        self,
        request,
        pk,
    ):

        execution = get_object_or_404(
            AutomationExecution.objects.select_related("automation"),
            pk=pk,
        )
        if not can_view(request.user, execution.automation):
            raise PermissionDenied("You do not have permission to view these logs.")

        logs = (
            AutomationExecutionLog
            .objects
            .filter(execution_id=pk)
            .order_by("started_at")
        )

        nodes = execution.automation.workflow_graph.get("nodes", []) if execution.automation.workflow_graph else []
        node_map = {node.get("id"): node for node in nodes}

        data = []

        for log in logs:

            node_data = node_map.get(log.node_id, {})

            data.append({
                "node_id": log.node_id,
                "node_name": node_data.get("label", "Unknown Node"),
                "status": log.status,
                "message": log.message,
                "started_at": log.started_at,
                "finished_at": log.finished_at,
            })

        return Response(data)
