import uuid
from django.db import models

class SystemEvent(models.Model):
    class EventType(models.TextChoices):
        WEBSITE = "WEBSITE", "Website"
        WEBHOOK = "WEBHOOK", "Webhook"
        SYSTEM = "SYSTEM", "System"

    SUPPORTED_EVENTS = [
        ("PAGE_VISITED", "Page Visited"),
        ("BUTTON_CLICKED", "Button Clicked"),
        ("LINK_CLICKED", "Link Clicked"),
        ("PRODUCT_VIEWED", "Product Viewed"),
        ("CART_ABANDONED", "Cart Abandoned"),
        ("CHECKOUT_STARTED", "Checkout Started"),
        ("CHECKOUT_COMPLETED", "Checkout Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=20, choices=EventType.choices, default=EventType.WEBSITE, db_index=True)
    
    event_name = models.CharField(max_length=100, db_index=True, blank=True)
    user_identifier = models.CharField(max_length=255, db_index=True, blank=True)
    
    session_id = models.CharField(max_length=255, blank=True, db_index=True)
    url = models.CharField(max_length=2048, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    headers = models.JSONField(default=dict, blank=True)
    processed = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "system_event"
        indexes = [
            models.Index(fields=["event_type"]),
            models.Index(fields=["event_name"]),
            models.Index(fields=["user_identifier"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"[{self.event_type}] {self.event_name or 'Event'} - {self.user_identifier}"

