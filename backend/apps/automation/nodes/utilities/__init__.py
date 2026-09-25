from .wait import WaitNode
from apps.automation.nodes.actions.integration import SyncToCRMAction


UTILITY_REGISTRY = {
    "WAIT": WaitNode(),
    "DELAY": WaitNode(),
    "SEND_TO_CRM": SyncToCRMAction(),
    "SendToCRM": SyncToCRMAction(),
}
