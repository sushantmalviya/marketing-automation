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

    @classmethod
    def to_plain_text(cls, content: str, channel: str = "GENERIC") -> str:
        """
        Converts HTML or JSON template content into clean plain text suitable for
        plain-text channels like WhatsApp or SMS.
        """
        import html
        import json

        if not content:
            return ""

        raw_text = str(content).strip()

        # 1. Handle potential JSON string serialized from frontend drag-and-drop builders
        if raw_text.startswith("{") and raw_text.endswith("}"):
            try:
                data = json.loads(raw_text)
                if isinstance(data, dict):
                    raw_text = (
                        data.get("cleanBody")
                        or data.get("text")
                        or data.get("body")
                        or data.get("html")
                        or data.get("content")
                        or raw_text
                    )
            except Exception:
                pass

        if not isinstance(raw_text, str):
            raw_text = str(raw_text)

        # 2. Convert bold tags to WhatsApp bold markup (*text*) if channel is WHATSAPP
        if str(channel).upper() == "WHATSAPP":
            raw_text = re.sub(r"<(strong|b)>(.*?)</\1>", r"*\2*", raw_text, flags=re.IGNORECASE)

        # 3. Replace HTML block tags and breaks with explicit newline characters
        raw_text = re.sub(r"<(br|br\s*/|/p|/div|/li|/tr)>", "\n", raw_text, flags=re.IGNORECASE)

        # 4. Strip all remaining HTML tags (<...>)
        raw_text = re.sub(r"<[^>]+>", "", raw_text)

        # 5. Decode HTML entities (&amp; -> &, &lt; -> <, &nbsp; -> space, etc.)
        raw_text = html.unescape(raw_text)

        # 6. Normalize multi-line breaks to a maximum of two consecutive newlines
        lines = [line.strip() for line in raw_text.splitlines()]
        clean_text = "\n".join(lines)
        clean_text = re.sub(r"\n{3,}", "\n\n", clean_text)

        return clean_text.strip()

    @classmethod
    def render_for_channel(cls, template: str, context: dict, channel: str = "GENERIC") -> str:
        """
        Renders template placeholders and cleans output according to channel constraints.
        """
        rendered = cls.render(template, context)
        ch = str(channel).upper()
        if ch in ("WHATSAPP", "SMS"):
            return cls.to_plain_text(rendered, channel=ch)
        return rendered

