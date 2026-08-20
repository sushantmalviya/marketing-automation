import re
from apps.automation.nodes.conditions.base import resolve_path

class TemplateRenderer:
    """
    Renders template placeholders using execution context.

    Example:
        Template: Hello {{ $.form_submission.first_name }}
        Context: {"form_submission": {"first_name": "Carlos"}}
        Output: Hello Carlos
    """

    PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*(.*?)\s*\}\}")

    @classmethod
    def render(cls, template: str, context: dict) -> str:
        if not template:
            return ""

        if context is None:
            context = {}

        def replace(match):
            field = match.group(1).strip()
            
            # Handle the $. convention or plain paths
            if field.startswith("$."):
                field = field[2:]
                
            value = resolve_path(context, field)

            if value is None:
                return ""

            return str(value)

        return cls.PLACEHOLDER_PATTERN.sub(replace, template)
