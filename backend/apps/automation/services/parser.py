# apps/automation/services/parser.py

from apps.automation.models import (
    Automation,
)


import re

def pascal_to_snake_upper(name):
    if not name:
        return name
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).upper()


class WorkflowParser:

    def __init__(self, automation):

        self.automation = automation
        self.workflow_graph = automation.workflow_graph or {"nodes": [], "edges": []}

        type_mapping = {
            "triggerNode": "TRIGGER",
            "actionNode": "ACTION",
            "conditionNode": "CONDITION",
            "utilityNode": "UTILITY",
        }

        self.nodes = {}
        for node in self.workflow_graph.get("nodes", []):
            data = node.get("data", {})
            self.nodes[node.get("id")] = {
                "id": node.get("id"),
                "type": type_mapping.get(node.get("type"), "UTILITY"),
                "action_name": pascal_to_snake_upper(data.get("actionName")),
                "business_config": data,
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
                source_handle = str(edge.get("sourceHandle") or edge.get("edge_type") or "").lower()
                edge_type = "DEFAULT"
                if source_handle in ("true", "yes", "success", "on_true"):
                    edge_type = "YES"
                elif source_handle in ("false", "no", "failed", "on_false"):
                    edge_type = "NO"
                else:
                    edge_type = str(edge.get("edge_type") or "DEFAULT").upper()

                graph[source].append({
                    "target": edge.get("target"),
                    "type": edge_type,
                    "source_handle": source_handle,
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