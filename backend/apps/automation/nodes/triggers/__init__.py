from .manual import ManualTrigger
from .form_submitted import (
    FormSubmittedTrigger
)
from .generic import GenericEventTrigger
from .webhook import WebhookTrigger


GENERIC_TRIGGER_NAMES = [
    "FORM_ABANDONED",
    "MULTISTEP_COMPLETED",
    "PAGE_VISITED",
    "BUTTON_CLICKED",
    "LINK_CLICKED",
    "PRODUCT_VIEWED",
    "CART_ABANDONED",
    "CHECKOUT_STARTED",
    "CHECKOUT_COMPLETED",
    "EMAIL_SENT",
    "EMAIL_DELIVERED",
    "EMAIL_OPENED",
    "EMAIL_CLICKED",
    "EMAIL_REPLIED",
    "EMAIL_BOUNCED",
    "EMAIL_UNSUBSCRIBED",
    "SMS_SENT",
    "SMS_DELIVERED",
    "SMS_FAILED",
    "SMS_CLICKED",
    "WHATSAPP_SENT",
    "WHATSAPP_DELIVERED",
    "WHATSAPP_READ",
    "WHATSAPP_REPLIED",
    "NOTIFICATION_SENT",
    "NOTIFICATION_OPENED",
    "NOTIFICATION_CLICKED",
    "API_EVENT",
    "CUSTOM_EVENT",
]


TRIGGER_REGISTRY = {

    "MANUAL":
        ManualTrigger(),

    "FORM_SUBMITTED":
        FormSubmittedTrigger(),

    "WEBHOOK_RECEIVED":
        WebhookTrigger(),

    "CONTACT_ADDED":
        GenericEventTrigger(),

    "NEW_CONTACT_ADDED":
        GenericEventTrigger(),
}

TRIGGER_REGISTRY.update({
    name: GenericEventTrigger()
    for name in GENERIC_TRIGGER_NAMES
})
