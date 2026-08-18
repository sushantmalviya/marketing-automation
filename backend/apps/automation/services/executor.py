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
        action_name = node.get("action_name")

        if node_type == "TRIGGER":

            handler = (
                TRIGGER_REGISTRY[
                action_name
                ]
            )

        elif node_type == "CONDITION":

            handler = (
                CONDITION_REGISTRY[
                    action_name
                ]
            )

        elif node_type == "ACTION":

            handler = (
                ACTION_REGISTRY[
                    action_name
                ]
            )

        else:

            handler = (
                UTILITY_REGISTRY[
                    action_name
                ]
            )

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

                if (
                    edge["type"]
                    == label
                ):

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
