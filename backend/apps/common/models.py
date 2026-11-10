from contextlib import AbstractContextManager
from typing import TYPE_CHECKING, Any, cast
import uuid
from django.db import models, transaction


def atomic_transaction() -> AbstractContextManager[Any]:
    """Typed wrapper around ``django.db.transaction.atomic()`` for static type checkers."""
    return cast(AbstractContextManager[Any], transaction.atomic())

class TimeStampedUUIDModel(models.Model):
    if TYPE_CHECKING:
        objects: models.Manager[Any]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Department(TimeStampedUUIDModel):

    name = models.CharField(max_length=255, db_index=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "departments"

    def __str__(self):
        return f"{self.name}"
