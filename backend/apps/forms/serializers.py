from rest_framework import serializers

from .models import (
    Form,
    FormSubmission,
)


# -----------------------------------
# CREATE / UPDATE FORM
# -----------------------------------

class FormCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Form
        fields = [
            "id",
            "uuid",
            "title",
            "description",
            "slug",
            "allow_multiple_submissions",
            "collect_ip",
            "collect_device",
            "collect_location",
            "submission_limit",
            "start_date",
            "end_date",
            "thank_you_message",
            "redirect_url",
            "fields_schema",
        ]


# -----------------------------------
# FORM LIST
# -----------------------------------

class FormListSerializer(serializers.ModelSerializer):

    total_responses = serializers.SerializerMethodField()

    class Meta:
        model = Form
        fields = [
            "id",
            "uuid",
            "title",
            "status",
            "published_at",
            "created_at",
            "total_responses",
            "fields_schema",
        ]

    def get_total_responses(self, obj):
        if hasattr(obj, 'annotated_responses'):
            return obj.annotated_responses
        return obj.submissions.count()


# -----------------------------------
# FORM DETAILS
# -----------------------------------

class FormDetailSerializer(serializers.ModelSerializer):

    total_responses = serializers.SerializerMethodField()

    class Meta:
        model = Form
        fields = "__all__"

    def get_total_responses(self, obj):
        if hasattr(obj, 'annotated_responses'):
            return obj.annotated_responses
        return obj.submissions.count()


# -----------------------------------
# SUBMISSION
# -----------------------------------

class FormSubmissionSerializer(serializers.Serializer):
    
    answers = serializers.JSONField(default=dict)

    def create(self, validated_data):
        form = self.context["form"]
        answers = validated_data.get("answers", {})
        submission = FormSubmission.objects.create(
            form=form,
            answers=answers
        )
        return submission


# -----------------------------------
# RESPONSE LIST
# -----------------------------------

class SubmissionListSerializer(serializers.ModelSerializer):

    class Meta:
        model = FormSubmission
        fields = [
            "id",
            "submitted_at",
            "ip_address",
            "answers",
        ]
