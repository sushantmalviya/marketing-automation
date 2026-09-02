from rest_framework import serializers

from apps.campaigns.models import Audience,Channel
from .models import (
    Task,
    TaskAssignment,
    TaskComment,
    TaskAttachment,
)

class TaskAttachmentSerializer(serializers.ModelSerializer):

    uploaded_by_name = serializers.CharField(
        source="uploaded_by.email",

        read_only=True,
    )
    class Meta:

        fields = [
            "id",
            "file",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        ]

        read_only_fields = [
            "uploaded_by",
            "uploaded_at",
        ]


class TaskCommentSerializer(serializers.ModelSerializer):

    created_by_name = serializers.CharField(
        source="created_by.email",
        read_only=True,
    )

    class Meta:
        model = TaskComment

        fields = [
            "id",
            "comment",
            "created_by",
            "created_by_name",
            "created_at",
        ]

        read_only_fields = [
            "created_by",
            "created_at",
        ]


class TaskAssignmentSerializer(serializers.ModelSerializer):

    user_name = serializers.SerializerMethodField()

    approved_by_name = serializers.CharField(
        source="approved_by.email",
        read_only=True,
    )

    comments = TaskCommentSerializer(
        many=True,
        read_only=True,
    )

    attachments = TaskAttachmentSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = TaskAssignment

        fields = [
            "id",

            "user",
            "user_name",

            "status",

            "remarks",

            "submitted_at",

            "approved_at",

            "approved_by",
            "approved_by_name",

            "comments",

            "attachments",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "approved_by",
            "approved_at",
            "submitted_at",
            "created_at",
            "updated_at",
        ]

    def get_user_name(self, obj):
        full_name = obj.user.get_full_name().strip()
        return full_name or obj.user.email


class CreateTaskSerializer(serializers.ModelSerializer):

    users = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        min_length=1,
        max_length=1,
    )

    channels = serializers.PrimaryKeyRelatedField(
        queryset=Channel.objects.filter(
            is_active=True,
        ),
        many=True,
        allow_empty=False,
    )

    instructions = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    
    audience = serializers.PrimaryKeyRelatedField(
        queryset=Audience.objects.filter(
            is_active=True,
        )
    )

    class Meta:
        model = Task

        fields = [
            "id",

            "title",
            "description",
            "instructions",

            "audience",
            "channels",
            "priority",
            "due_date",

            "users",
        ]

    def validate_users(self, value):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return value

        from apps.common.ownership import get_managed_user_ids, is_super_admin
        if is_super_admin(request.user):
            return value
            
        managed_user_ids = get_managed_user_ids(request.user)
        invalid_users = [u for u in value if u not in managed_user_ids]
        
        if invalid_users:
            raise serializers.ValidationError(
                f"You do not have permission to assign tasks to users: {invalid_users}"
            )
            
        return value


class TaskUpdateSerializer(CreateTaskSerializer):
    users = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        min_length=1,
        max_length=1,
        required=False,
    )

    def update(self, instance, validated_data):
        users = validated_data.pop("users", None)
        channels = validated_data.pop("channels", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if channels is not None:
            instance.channels.set(channels)
        if users is not None:
            instance.assignments.exclude(user_id__in=users).delete()
            for user_id in users:
                TaskAssignment.objects.get_or_create(task=instance, user_id=user_id)
        return instance


class TaskSerializer(serializers.ModelSerializer):

    created_by_name = serializers.CharField(
        source="created_by.email",
        read_only=True,
    )

    audience_name = serializers.CharField(
        source="audience.name",
        read_only=True,
    )

    audience_size = serializers.SerializerMethodField()

    def get_audience_size(self, obj):
        try:
            return obj.audience.customer_upload.total_records
        except AttributeError:
            return 0


    channels = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
    )

    assignments = TaskAssignmentSerializer(
        many=True,
        read_only=True,
    )

    statistics = serializers.SerializerMethodField()

    def get_statistics(self, obj):
        from apps.tasks.services import TaskStatusService
        return TaskStatusService.get_task_statistics(obj)

    class Meta:
        model = Task

        fields = [
            "id",

            "title",
            "description",
            "instructions",

            "audience",
            "audience_name",
            "channels",
            "priority",
            
            "status",
            "last_activity_at",
            "statistics",

            "due_date",

            "created_by",
            "created_by_name",

            "assignments",

            "created_at",
            "updated_at",
        ]

class UpdateTaskStatusSerializer(serializers.Serializer):

    status = serializers.ChoiceField(
        choices=[
            "IN_PROGRESS",
            "SUBMITTED",
        ]
    )

    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
    )


class ApprovalSerializer(serializers.Serializer):

    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
    )

class TaskSummarySerializer(serializers.ModelSerializer):

    audience_name = serializers.CharField(
        source="audience.name",
        read_only=True,
    )

    audience_size = serializers.SerializerMethodField()

    def get_audience_size(self, obj):
        try:
            return obj.audience.customer_upload.total_records
        except AttributeError:
            return 0

    statistics = serializers.SerializerMethodField()

    def get_statistics(self, obj):
        from apps.tasks.services import TaskStatusService
        return TaskStatusService.get_task_statistics(obj)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "instructions",
            "audience",
            "audience_name",
            "priority",
            "status",
            "last_activity_at",
            "statistics",
            "due_date",
            "channels",
        ]

class MyTaskSerializer(serializers.ModelSerializer):

    task = TaskSummarySerializer(
        read_only=True,
    )

    class Meta:
        model = TaskAssignment
        fields = [
            "id",
            "task",
            "status",
            "remarks",
            "submitted_at",
            "created_at",
            "updated_at",
        ]

