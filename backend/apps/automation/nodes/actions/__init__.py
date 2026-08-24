from .integration import (
    SyncToCRMAction,
    InternalAPICallAction,
)
from .send_email import SendBulkEmailAction, SendEmailAction
from .send_notification import SendNotificationAction
from .send_sms import SendSMSAction
from .send_whatsapp import SendWhatsAppAction
from .create_task import CreateTaskAction
from .end import EndAction
from .website import TrackEventAction, UpdateUserPropertyAction
from .workflow import TriggerWorkflowAction
from .generate_ai_content import GenerateAIContentAction


ACTION_REGISTRY = {

    "SEND_EMAIL":
        SendEmailAction(),

    "SEND_BULK_EMAIL":
        SendBulkEmailAction(),

    "SEND_SMS":
        SendSMSAction(),

    "SEND_WHATSAPP":
        SendWhatsAppAction(),

    "SEND_NOTIFICATION":
        SendNotificationAction(),

    "TRACK_EVENT":
        TrackEventAction(),

    "UPDATE_USER_PROPERTY":
        UpdateUserPropertyAction(),

    "SendToCRM":
        SyncToCRMAction(),

    "INTERNAL_API_CALL":
        InternalAPICallAction(),

    "TRIGGER_WORKFLOW":
        TriggerWorkflowAction(),

    "CREATE_TASK":
        CreateTaskAction(),

    "END":
        EndAction(),

    "GENERATE_AI_CONTENT":
        GenerateAIContentAction(),
}
