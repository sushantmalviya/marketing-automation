from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import MAUser, User
from apps.forms.models import Form, FormStatus


class FormAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="forms@example.com",
            password="StrongPass123!",
        )
        MAUser.objects.create(user=self.user, role="USER")
        self.client.force_authenticate(self.user)
        self.form = Form.objects.create(
            title="Test form",
            created_by=self.user,
            status=FormStatus.PUBLISHED,
            fields_schema=[{
                "id": 1,
                "field_type": "text",
                "label": "Name",
                "required": True,
            }]
        )

    def test_public_published_form_is_retrievable(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(
            reverse("public-form", kwargs={"uuid": self.form.uuid})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["uuid"], str(self.form.uuid))

    def test_submission_rejects_malformed_answers(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse("submit-form", kwargs={"uuid": self.form.uuid}),
            {"answers": [{"answer": "Ada"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("field_id", response.data["answers"][0])

    def test_submission_accepts_verified_field_answer_objects(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse("submit-form", kwargs={"uuid": self.form.uuid}),
            {"answers": [{"field_id": 1, "answer": "Ada"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
