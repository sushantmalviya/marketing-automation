# apps/automation/services/parser.py

from apps.automation.models import (
    Automation,
)


class WorkflowParser:

    def __init__(self, automation):

        self.automation = automation
        self.workflow_graph = automation.workflow_graph or {"nodes": [], "edges": []}

        self.nodes = {
            node.get("id"): node
            for node in self.workflow_graph.get("nodes", [])
        }

        self.edges = self.workflow_graph.get("edges", [])

    # =====================================================
    # BUILD GRAPH
    # =====================================================

    def build_graph(self):

        graph = {node_id: [] for node_id in self.nodes}

        for edge in self.edges:
            source = edge.get("source")
            if source in graph:
                graph[source].append({
                    "target": edge.get("target"),
                    "type": edge.get("edge_type", "DEFAULT"),
                })

        return graph

    # =====================================================
    # GET TRIGGER
    # =====================================================

    def get_trigger_node(self):

        for node in self.nodes.values():
            if node.get("type") == "TRIGGER":
                return node

        return None

    # =====================================================
    # PARSE
    # =====================================================

    def parse(self):

        return {
            "nodes": self.nodes,
            "graph": self.build_graph(),
            "trigger": self.get_trigger_node(),
        }


# =====================================================
# HELPER
# =====================================================

def parse_workflow(automation_id):

    automation = Automation.objects.get(
        pk=automation_id
    )

    parser = WorkflowParser(
        automation
    )

    return parser.parse()