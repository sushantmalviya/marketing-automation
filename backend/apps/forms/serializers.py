from rest_framework import serializers

from .models import (
    Form,
    FormField,
    FormSubmission,
    SubmissionAnswer,
)


# -----------------------------------
# FORM FIELD
# -----------------------------------

class FormFieldSerializer(serializers.ModelSerializer):

    class Meta:
        model = FormField
        fields = [
            "id",
            "step_number",
            "field_type",
            "label",
            "placeholder",
            "help_text",
            "required",
            "unique_field",
            "options",
            "validation_rules",
            "conditional_logic",
            "settings",
            "field_order",
        ]


# -----------------------------------
# CREATE / UPDATE FORM
# -----------------------------------

class FormCreateSerializer(serializers.ModelSerializer):

    fields = FormFieldSerializer(
        many=True
    )

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
            "fields",
        ]

    def create(self, validated_data):

        fields_data = validated_data.pop("fields")

        form = Form.objects.create(
            **validated_data
        )

        for field in fields_data:
            FormField.objects.create(
                form=form,
                **field
            )

        return form

    def update(self, instance, validated_data):

        fields_data = validated_data.pop(
            "fields",
            None
        )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if fields_data is not None:

            instance.fields.all().delete()

            for field in fields_data:
                FormField.objects.create(
                    form=instance,
                    **field
                )

        return instance


# -----------------------------------
# FORM LIST
# -----------------------------------

class FormListSerializer(serializers.ModelSerializer):

    total_responses = serializers.SerializerMethodField()
    fields = FormFieldSerializer(
        many=True,
        read_only=True
    )

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
            "fields",
        ]

    def get_total_responses(self, obj):
        return obj.submissions.count()


# -----------------------------------
# FORM DETAILS
# -----------------------------------

class FormDetailSerializer(serializers.ModelSerializer):

    fields = FormFieldSerializer(
        many=True,
        read_only=True
    )

    total_responses = serializers.SerializerMethodField()

    class Meta:
        model = Form
        fields = "__all__"

    def get_total_responses(self, obj):
        return obj.submissions.count()


# -----------------------------------
# ANSWERS
# -----------------------------------

class SubmissionAnswerSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = SubmissionAnswer
        fields = [
            "field",
            "answer",
        ]


# -----------------------------------
# SUBMISSION
# -----------------------------------

class FormSubmissionSerializer(
    serializers.Serializer
):

    class AnswerSerializer(serializers.Serializer):
        field_id = serializers.IntegerField(min_value=1)
        answer = serializers.CharField(allow_blank=True)

    answers = AnswerSerializer(many=True, allow_empty=False)

    def create(self, validated_data):

        form = self.context["form"]

        submission = FormSubmission.objects.create(
            form=form
        )

        answers = validated_data["answers"]

        for item in answers:

            SubmissionAnswer.objects.create(
                submission=submission,
                field_id=item["field_id"],
                answer=item["answer"],
            )

        return submission


# -----------------------------------
# RESPONSE LIST
# -----------------------------------

class SubmissionListSerializer(
    serializers.ModelSerializer
):

    answers = SubmissionAnswerSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = FormSubmission
        fields = [
            "id",
            "submitted_at",
            "ip_address",
            "answers",
        ]
