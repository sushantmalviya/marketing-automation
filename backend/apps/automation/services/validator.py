from apps.automation.models import (
    Automation,
)
from apps.automation.services.parser import (
    WorkflowParser,
)


class WorkflowValidationError(Exception):
    """
    Raised when workflow validation fails.
    """
    pass


class WorkflowValidator:

    def __init__(self, automation: Automation):

        self.automation = automation
        parser = WorkflowParser(automation)
        self.parsed = parser.parse()

        self.nodes = self.parsed["nodes"]
        self.raw_edges = (
            automation.workflow_graph.get("edges", [])
            if automation.workflow_graph and isinstance(automation.workflow_graph, dict)
            else []
        )
        self.node_ids = set(self.nodes.keys())

    # =====================================================
    # PUBLIC
    # =====================================================

    def validate(self):

        self.validate_exists()

        self.validate_not_empty()

        self.validate_has_trigger()

        self.validate_edge_integrity()

        self.validate_connected()

        self.validate_cycles()

        return True

    # =====================================================
    # BASIC
    # =====================================================

    def validate_exists(self):

        if not self.automation:
            raise WorkflowValidationError(
                "Automation not found."
            )

    def validate_not_empty(self):

        if not self.nodes:
            raise WorkflowValidationError(
                "Workflow contains no nodes."
            )

    # =====================================================
    # TRIGGER
    # =====================================================

    def validate_has_trigger(self):

        triggers = [
            node
            for node in self.nodes.values()
            if node.get("type") == "TRIGGER"
        ]

        if len(triggers) == 0:
            raise WorkflowValidationError(
                "Workflow must contain at least one trigger."
            )

    # =====================================================
    # EDGE VALIDATION
    # =====================================================

    def validate_edge_integrity(self):

        for edge in self.raw_edges:
            source = edge.get("source")
            target = edge.get("target")

            if not source or source not in self.node_ids:
                raise WorkflowValidationError(
                    f"Invalid source node: {source}"
                )

            if not target or target not in self.node_ids:
                raise WorkflowValidationError(
                    f"Invalid target node: {target}"
                )

    # =====================================================
    # CONNECTIVITY
    # =====================================================

    def validate_connected(self):

        graph = {}

        for edge in self.raw_edges:
            source = edge.get("source")
            target = edge.get("target")
            if source and target:
                graph.setdefault(source, []).append(target)

        triggers = [
            node for node in self.nodes.values() if node.get("type") == "TRIGGER"
        ]

        if not triggers:
            return

        visited = set()

        def dfs(node_id):
            if node_id in visited:
                return
            visited.add(node_id)
            for nxt in graph.get(node_id, []):
                dfs(nxt)

        for trigger in triggers:
            dfs(trigger["id"])

        if len(visited) != len(self.nodes):
            disconnected = [
                str(node_id)
                for node_id in self.nodes
                if node_id not in visited
            ]
            raise WorkflowValidationError(
                "Disconnected nodes found: " + ", ".join(disconnected)
            )

    # =====================================================
    # CYCLE DETECTION
    # =====================================================

    def validate_cycles(self):

        graph = {}

        for edge in self.raw_edges:
            source = edge.get("source")
            target = edge.get("target")
            if source and target:
                graph.setdefault(source, []).append(target)

        visited = set()
        stack = set()

        def dfs(node_id):
            if node_id in stack:
                return True
            if node_id in visited:
                return False

            visited.add(node_id)
            stack.add(node_id)

            for nxt in graph.get(node_id, []):
                if dfs(nxt):
                    return True

            stack.remove(node_id)
            return False

        for node_id in self.node_ids:
            if node_id not in visited:
                if dfs(node_id):
                    raise WorkflowValidationError(
                        "Circular dependency detected."
                    )


# =========================================================
# HELPER FUNCTION
# =========================================================

def validate_workflow(
    automation_id
):

    automation = Automation.objects.get(
        pk=automation_id
    )

    validator = WorkflowValidator(
        automation
    )

    return validator.validate()

