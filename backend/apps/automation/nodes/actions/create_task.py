class CreateTaskAction:

    def execute(
        self,
        execution,
        node,
        config,
    ):
        return {
            "success": True,
            "message": "Task action completed (deprecated)",
        }