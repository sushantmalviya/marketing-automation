from django.utils import timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.automation.models import (
    Automation,
    AutomationNode,
    AutomationEdge,
)

from .serializers import (
    AutomationSerializer,
)

from apps.automation.services.validator import (
    validate_workflow,
)

from apps.automation.services.dispatcher import (
    dispatch_workflow,
)
from apps.common.ownership import _filter_resource_for_admin
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from apps.automation.services.permissions import can_view, can_edit, can_execute


def permitted_automation(user, pk, permission):
    automation = get_object_or_404(Automation, pk=pk)
    if not permission(user, automation):
        raise PermissionDenied("You do not have permission to access this automation.")
    return automation



class AutomationListCreateView(APIView):

    def get(self, request):

        automations = _filter_resource_for_admin(
            Automation.objects.filter(is_active=True), 
            request.user, 
            "owner"
        ).order_by("-updated_at")

        serializer = (
            AutomationSerializer(
                automations,
                many=True,
            )
        )

        return Response(
            serializer.data
        )

    def post(self, request):

        serializer = (
            AutomationSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            owner=request.user
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class AutomationDetailView(APIView):

    def get(self, request, pk):

        automation = permitted_automation(request.user, pk, can_view)

        serializer = (
            AutomationSerializer(
                automation
            )
        )

        return Response(
            serializer.data
        )

    def patch(self, request, pk):

        automation = permitted_automation(request.user, pk, can_edit)

        serializer = (
            AutomationSerializer(
                automation,
                data=request.data,
                partial=True,
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data
        )

    def delete(self, request, pk):

        automation = permitted_automation(request.user, pk, can_edit)

        automation.delete()

        return Response(
            status=204
        )


class ValidateAutomationView(APIView):

    def post(self, request, pk):
        permitted_automation(request.user, pk, can_edit)
        validate_workflow(pk)

        return Response({

            "success": True,

            "message":
                "Workflow validated."

        })


class PublishAutomationView(APIView):

    def post(self, request, pk):

        automation = permitted_automation(request.user, pk, can_edit)

        validate_workflow(pk)

        automation.status = (
            "PUBLISHED"
        )

        automation.published_at = (
            timezone.now()
        )

        automation.save()

        return Response({

            "success": True

        })


class PauseAutomationView(APIView):

    def post(self, request, pk):

        automation = permitted_automation(request.user, pk, can_edit)

        automation.status = (
            "PAUSED"
        )

        automation.save()

        return Response({

            "success": True

        })


class ExecuteAutomationView(APIView):

    def post(self, request, pk):

        automation = permitted_automation(request.user, pk, can_execute)

        execution = (
            dispatch_workflow(
                automation,
                request.user,
            )
        )

        return Response({

            "success": True,

            "execution_id":
                execution.id,

        })


class CloneAutomationView(APIView):

    def post(self, request, pk):

        source = permitted_automation(request.user, pk, can_view)

        clone = (
            Automation.objects.create(
                name=
                    source.name
                    + " Copy",

                description=
                    source.description,

                owner=
                    request.user,
            )
        )

        node_map = {}

        for node in source.nodes.all():

            new_node = (
                AutomationNode
                .objects
                .create(
                    automation=clone,
                    node_type=node.node_type,
                    action_name=node.action_name,
                    label=node.label,
                    business_config=node.business_config,
                    ui_config=node.ui_config,
                )
            )

            node_map[node.id] = new_node

        for edge in source.edges.all():

            AutomationEdge.objects.create(
                automation=clone,

                source_node=
                    node_map[
                        edge.source_node_id
                    ],

                target_node=
                    node_map[
                        edge.target_node_id
                    ],

                edge_type=
                    edge.edge_type,
            )

        return Response({

            "success": True,

            "id":
                clone.id,

        })
