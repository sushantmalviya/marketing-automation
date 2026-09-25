import re
from apps.automation.nodes.conditions.base import resolve_path

class TemplateRenderer:
    """
    Renders template placeholders using execution context.

    Example:
        Template: Hello {{ contact.first_name }}
        Context: {"contact": {"first_name": "Carlos"}}
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

            if value is None or value == "":
                # Attempt fallback lookups
                field_lower = field.lower()
                if "first_name" in field_lower:
                    value = resolve_path(context, "contact.first_name") or context.get("first_name") or (context.get("name", "").split()[0] if context.get("name") else None)
                elif "name" in field_lower:
                    value = resolve_path(context, "contact.name") or context.get("name") or resolve_path(context, "contact.first_name")
                elif "email" in field_lower:
                    value = resolve_path(context, "contact.email") or context.get("email")
                elif "phone" in field_lower:
                    value = resolve_path(context, "contact.phone") or context.get("phone")

            if value is None:
                return ""

            return str(value)

        return cls.PLACEHOLDER_PATTERN.sub(replace, template)
