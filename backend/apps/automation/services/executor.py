from apps.automation.services.parser import (
    parse_workflow,
)

from apps.automation.nodes.conditions import (
    CONDITION_REGISTRY
)

from apps.automation.services.logger import (
    log_execution,
)

from apps.automation.nodes.actions import (
    ACTION_REGISTRY,
)

from apps.automation.nodes.triggers import (
    TRIGGER_REGISTRY,
)

from apps.automation.nodes.utilities import (
    UTILITY_REGISTRY,
)


class WorkflowExecutor:

    def __init__(
        self,
        execution,
        start_node=None,
    ):

        self.execution = execution

        parsed = parse_workflow(
            execution.automation.id
        )

        self.nodes = parsed["nodes"]

        self.graph = parsed["graph"]

        self.current = (
            start_node
            or (self.nodes.get(execution.current_node_id) if execution.current_node_id else None)
            or parsed["trigger"]
        )

    # =====================================================
    # EXECUTE NODE
    # =====================================================

    def execute_node(
        self,
        node,
    ):

        node_type = node.get("type")
        raw_action = str(node.get("action_name") or "")
        action_name = raw_action.upper()

        if node_type == "TRIGGER":
            from apps.automation.nodes.triggers.generic import GenericEventTrigger
            handler = TRIGGER_REGISTRY.get(action_name) or TRIGGER_REGISTRY.get(raw_action) or GenericEventTrigger()

        elif node_type == "CONDITION":
            from apps.automation.nodes.conditions.equals import EqualsCondition
            handler = CONDITION_REGISTRY.get(action_name) or CONDITION_REGISTRY.get(raw_action) or EqualsCondition()

        elif node_type == "ACTION":
            handler = ACTION_REGISTRY.get(action_name) or ACTION_REGISTRY.get(raw_action)
            if not handler:
                if "EMAIL" in action_name:
                    handler = SendEmailAction()
                elif "SMS" in action_name:
                    handler = SendSMSAction()
                elif "WHATSAPP" in action_name:
                    handler = SendWhatsAppAction()
                elif "CRM" in action_name:
                    handler = SyncToCRMAction()
                else:
                    handler = UpdateUserPropertyAction()

        else:
            handler = UTILITY_REGISTRY.get(action_name) or UTILITY_REGISTRY.get(raw_action)
            if not handler:
                if "CRM" in action_name:
                    handler = SyncToCRMAction()
                else:
                    handler = WaitNode()

        return handler.execute(
            self.execution,
            node,
            node.get("business_config", {}),
        )

    # =====================================================
    # GET NEXT NODE
    # =====================================================

    def get_next(
        self,
        node,
        result=None,
    ):

        edges = self.graph.get(
            node.get("id"),
            []
        )

        if not edges:
            return None

        if isinstance(
            result,
            bool,
        ):

            label = (
                "YES"
                if result
                else "NO"
            )

            for edge in edges:
                edge_t = str(edge.get("type") or "").upper()
                sh = str(edge.get("source_handle") or "").lower()

                if edge_t == label or (result and sh in ("true", "yes", "success")) or (not result and sh in ("false", "no", "failed")):
                    return self.nodes[
                        edge["target"]
                    ]

        return self.nodes[
            edges[0]["target"]
        ]

    # =====================================================
    # RUN WORKFLOW
    # =====================================================

    def run(self):

        current = self.current

        while current:

            self.execution.current_node_id = current.get("id")

            self.execution.save(
                update_fields=[
                    "current_node_id"
                ]
            )

            try:

                log_execution(
                    execution=self.execution,
                    node=current,
                    status="STARTED",
                    message="Node execution started.",
                )

                result = self.execute_node(
                    current
                )

                log_execution(
                    execution=self.execution,
                    node=current,
                    status="SUCCESS",
                    message=str(result),
                )

            except Exception as e:

                log_execution(
                    execution=self.execution,
                    node=current,
                    status="FAILED",
                    message=str(e),
                )

                raise

            if self.execution.status == "WAITING":

                return False

            if current.get("action_name") == "END":

                break

            current = self.get_next(
                current,
                result,
            )

        return True
