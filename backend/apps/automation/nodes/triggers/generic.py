class GenericEventTrigger:
    def execute(self, execution, node, config):
        action_name = node.get("action_name") if isinstance(node, dict) else getattr(node, "action_name", "")
        return {
            "success": True,
            "message": f"{action_name} trigger fired.",
            "context": execution.context,
        }
