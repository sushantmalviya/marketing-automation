from django.shortcuts import render

# Create your views here.
from django.shortcuts import get_object_or_404
from django.db.models import TextField
from django.db.models.functions import Cast

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.models import MAUser
from .models import (
    Task,
    TaskAssignment,
)

from .serializers import (
    TaskSerializer,
    CreateTaskSerializer,
    TaskAssignmentSerializer,
    UpdateTaskStatusSerializer,
    ApprovalSerializer,
    MyTaskSerializer,
    TaskUpdateSerializer,
)

from .permissions import (
    IsAdminManager,
)

from .services import (
    create_task,
    get_user_tasks,
    get_admin_tasks,
    start_task,
    submit_task,
    approve_task,
    reject_task,
)


class CreateTaskView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsAdminManager,
    ]

    def post(self, request):

        serializer = CreateTaskSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        task = create_task(
            title=serializer.validated_data["title"],

            description=serializer.validated_data.get(
                "description",
            ),

            instructions=serializer.validated_data.get(
                "instructions",
            ),

            audience=serializer.validated_data["audience"],

            channels=serializer.validated_data["channels"],   # NEW

            priority=serializer.validated_data["priority"],

            due_date=serializer.validated_data["due_date"],

            created_by=request.user,

            users=serializer.validated_data["users"],
        )

        return Response(
            TaskSerializer(task).data,
            status=status.HTTP_201_CREATED,
        )
    
class MyTasksView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):
        from django.utils.dateparse import parse_date

        tasks = get_user_tasks(request.user)

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            parsed = parse_date(date_from)
            if parsed:
                tasks = tasks.filter(task__created_at__date__gte=parsed)
        if date_to:
            parsed = parse_date(date_to)
            if parsed:
                tasks = tasks.filter(task__created_at__date__lte=parsed)

        serializer = MyTaskSerializer(tasks, many=True)
        return Response(serializer.data)


class TaskAudiencePreviewView(APIView):
    """Preview only the audience attached to a task assigned to the current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        assignment = get_object_or_404(
            TaskAssignment.objects.select_related("task__audience__customer_upload"),
            task_id=task_id,
            user=request.user,
            task__is_active=True,
            task__is_deleted=False,
        )
        from apps.campaigns.services import AudienceService

        audience = assignment.task.audience
        try:
            customers = AudienceService.get_customers(
                customer_upload=audience.customer_upload,
                audience_definition=audience.definition or {},
            )
        except (KeyError, TypeError, ValueError):
            # Legacy audiences may contain null/unsupported operators. Their
            # established behavior is to represent the complete source upload.
            customers = audience.customer_upload.records.all()
        search = request.query_params.get("search", "").strip()
        if search:
            customers = customers.annotate(
                searchable_data=Cast("data", output_field=TextField())
            ).filter(searchable_data__icontains=search)

        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(10, max(1, int(request.query_params.get("page_size", 5))))
        except (TypeError, ValueError):
            page, page_size = 1, 5

        total = customers.count()
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        start = (page - 1) * page_size
        records = customers.order_by("id")[start:start + page_size]
        return Response(
            {
                "audience": {"id": audience.id, "name": audience.name},
                "total_customers": total,
                "page": page,
                "pages": pages,
                "preview": [
                    {"id": customer.id, "data": customer.data}
                    for customer in records
                ],
            }
        )
    

class TeamTasksView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsAdminManager,
    ]

    def get(self, request):

        tasks = get_admin_tasks(
            request.user
        )

        serializer = TaskSerializer(
            tasks,
            many=True,
        )

        return Response(
            serializer.data
        )


class TaskDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminManager]

    def get_object(self, request, task_id):
        from django.db.models import Prefetch
        role = MAUser.objects.filter(user=request.user).values_list("role", flat=True).first()
        queryset = Task.objects.filter(is_active=True, is_deleted=False).select_related("created_by", "audience").prefetch_related(
            "channels",
            "assignments",
            "assignments__user",
            "assignments__approved_by",
            "assignments__comments",
            "assignments__attachments",
            Prefetch("campaigns", to_attr="prefetched_campaigns")
        )
        if role != "SUPER_ADMIN":
            queryset = queryset.filter(created_by=request.user)
        return get_object_or_404(queryset, id=task_id)

    def get(self, request, task_id):
        return Response(TaskSerializer(self.get_object(request, task_id)).data)

    def patch(self, request, task_id):
        task = self.get_object(request, task_id)
        serializer = TaskUpdateSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(TaskSerializer(task).data)

    def delete(self, request, task_id):
        task = self.get_object(request, task_id)
        task.is_active = False
        task.is_deleted = True
        task.save(update_fields=["is_active", "is_deleted", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
    

class UpdateTaskStatusView(
    APIView
):

    permission_classes = [
        IsAuthenticated,
    ]

    def patch(
        self,
        request,
        assignment_id,
    ):

        assignment = (
            get_object_or_404(
                TaskAssignment,
                id=assignment_id,
                user=request.user,
            )
        )

        serializer = (
            UpdateTaskStatusSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        new_status = (
            serializer.validated_data[
                "status"
            ]
        )

        if (
            new_status
            == "IN_PROGRESS"
        ):

            assignment = (
                start_task(
                    assignment
                )
            )

        elif (
            new_status
            == "SUBMITTED"
        ):

            assignment = (
                submit_task(
                    assignment,
                    serializer.validated_data.get(
                        "remarks"
                    ),
                )
            )

        return Response(
            TaskAssignmentSerializer(
                assignment
            ).data
        )

class ApproveTaskView(
    APIView
):

    permission_classes = [
        IsAuthenticated,
        IsAdminManager,
    ]

    def post(
        self,
        request,
        assignment_id,
    ):

        assignment = (
            get_object_or_404(
                TaskAssignment,
                id=assignment_id,
            )
        )

        from apps.common.ownership import can_manage_task
        if not can_manage_task(request.user, assignment.task):
            return Response(
                {
                    "detail":
                    "Permission denied."
                },
                status=403,
            )

        serializer = (
            ApprovalSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        assignment = (
            approve_task(
                assignment,
                request.user,
                serializer.validated_data.get(
                    "remarks"
                ),
            )
        )

        return Response(
            TaskAssignmentSerializer(
                assignment
            ).data
        )
    
class RejectTaskView(
    APIView
):

    permission_classes = [
        IsAuthenticated,
        IsAdminManager,
    ]

    def post(
        self,
        request,
        assignment_id,
    ):

        assignment = (
            get_object_or_404(
                TaskAssignment,
                id=assignment_id,
            )
        )

        from apps.common.ownership import can_manage_task
        if not can_manage_task(request.user, assignment.task):
            return Response(
                {
                    "detail":
                    "Permission denied."
                },
                status=403,
            )

        serializer = (
            ApprovalSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        assignment = (
            reject_task(
                assignment,
                request.user,
                serializer.validated_data.get(
                    "remarks"
                ),
            )
        )

        return Response(
            TaskAssignmentSerializer(
                assignment
            ).data
        )
    
