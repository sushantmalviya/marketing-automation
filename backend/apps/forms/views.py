from rest_framework import generics, status
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.response import Response
from django.db.models import Count

from .models import Form, FormStatus
from .permissions import (
    CanAccessForms,
    IsFormOwner,    
)
from .serializers import (
    FormCreateSerializer,
    FormDetailSerializer,
    FormListSerializer,
    FormSubmissionSerializer,
    SubmissionListSerializer,
)
from .services import FormService
from apps.common.ownership import _filter_resource_for_admin


class FormListCreateView(
    generics.ListAPIView
):

    permission_classes = [
        IsAuthenticated,
        CanAccessForms,
    ]

    serializer_class = FormListSerializer

    def get_queryset(self):
        qs = _filter_resource_for_admin(
            Form.objects.all(),
            self.request.user,
            "created_by"
        )
        return qs.annotate(
            annotated_responses=Count('submissions', distinct=True)
        )

    def post(
        self,
        request,
        *args,
        **kwargs
    ):

        serializer = FormCreateSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        form = FormService.create_form(
            user=request.user,
            data=serializer.validated_data,
        )

        return Response(
            FormDetailSerializer(
                form
            ).data,
            status=status.HTTP_201_CREATED,
        )


class FormDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    permission_classes = [
        IsAuthenticated,
        CanAccessForms,
        IsFormOwner,
    ]

    def get_queryset(self):
        qs = _filter_resource_for_admin(
            Form.objects.all(),
            self.request.user,
            "created_by"
        )
        return qs.annotate(
            annotated_responses=Count('submissions', distinct=True)
        )

    def get_serializer_class(self):

        if getattr(self, "request", None) and self.request.method == "GET":
            return FormDetailSerializer

        return FormCreateSerializer

    def perform_update(
        self,
        serializer
    ):

        FormService.update_form(
            form=self.get_object(),
            data=serializer.validated_data,
        )

from rest_framework.views import APIView

class PublishFormView(
    APIView
):

    permission_classes = [
        IsAuthenticated,
        CanAccessForms,
        IsFormOwner,
    ]

    def post(
        self,
        request,
        pk
    ):

        form = Form.objects.get(
            pk=pk
        )

        self.check_object_permissions(
            request,
            form
        )

        FormService.publish_form(
            form
        )

        return Response(
            {
                "success": True,
                "message": "Form published.",
            },
            status=status.HTTP_200_OK,
        )


class PublicFormView(
    generics.RetrieveAPIView
):

    permission_classes = [
        AllowAny
    ]

    serializer_class = (
        FormDetailSerializer
    )

    lookup_field = "uuid"

    def get_queryset(self):
        return Form.objects.filter(
            status=FormStatus.PUBLISHED
        )
    

class SubmitFormView(
    generics.GenericAPIView
):

    permission_classes = [
        AllowAny
    ]

    serializer_class = (
        FormSubmissionSerializer
    )

    def post(
        self,
        request,
        uuid
    ):

        form = Form.objects.get(
            uuid=uuid,
            status=FormStatus.PUBLISHED,
        )

        serializer = self.get_serializer(
            data=request.data,
            context={
                "form": form
            }
        )

        serializer.is_valid(
            raise_exception=True
        )

        submission = (
            FormService.submit_form(
                form=form,
                answers=serializer.validated_data[
                    "answers"
                ],
                ip_address=request.META.get(
                    "REMOTE_ADDR"
                ),
                user_agent=request.META.get(
                    "HTTP_USER_AGENT",
                    "",
                ),
            )
        )

        return Response(
            {
                "success": True,
                "submission_id": submission.id,
            },
            status=status.HTTP_201_CREATED,
        )
    
class FormResponsesView(
    generics.ListAPIView
):

    permission_classes = [
        IsAuthenticated,
        CanAccessForms,
        IsFormOwner,
    ]

    serializer_class = (
        SubmissionListSerializer
    )

    def get_queryset(self):

        form = Form.objects.get(
            pk=self.kwargs["pk"]
        )

        self.check_object_permissions(
            self.request,
            form
        )

        return form.submissions.all()


