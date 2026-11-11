from django.conf import settings


class BaseWhatsAppProvider:
    def send(self, to, message, metadata=None):
        raise NotImplementedError

    def validate_configuration(self):
        return True

    def health_check(self):
        return True

    def test_connection(self):
        return True


class MetaWhatsAppProvider(BaseWhatsAppProvider):
    def __init__(self, access_token=None, phone_number_id=None, api_version=None):
        self.access_token = access_token
        self.phone_number_id = phone_number_id
        self.api_version = api_version or getattr(settings, "META_GRAPH_API_VERSION", "v19.0")

    def send(self, to, message, metadata=None):
        if not self.access_token:
            raise ValueError("Meta WhatsApp access token is required.")
        if not self.phone_number_id:
            raise ValueError("Meta WhatsApp phone number ID is required.")
        if not to:
            raise ValueError("Recipient phone number is required.")

        try:
            import requests
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry
            import logging
        except ImportError as exc:
            raise RuntimeError(
                "requests is required for Meta WhatsApp delivery."
            ) from exc

        logger = logging.getLogger(__name__)
        session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        session.mount("https://", HTTPAdapter(max_retries=retries))

        version = self.api_version.lstrip("/")
        url = f"https://graph.facebook.com/{version}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        
        metadata = metadata or {}
        message_type = metadata.get("type", "text")
        
        # Clean recipient phone number (remove + or whitespace if needed)
        clean_to = str(to).strip().replace(" ", "").replace("-", "")
        if clean_to.startswith("+"):
            clean_to = clean_to[1:]
        if len(clean_to) == 10 and clean_to[0] in "6789":
            clean_to = "91" + clean_to

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_to,
            "type": message_type,
        }
        
        if message_type == "text":
            from apps.campaigns.services.renderer import TemplateRenderer
            clean_body = TemplateRenderer.to_plain_text(message, channel="WHATSAPP")
            payload["text"] = {"preview_url": False, "body": clean_body}
        elif message_type == "template":
            raw_template = metadata.get("template", {})
            template_name = raw_template.get("name")
            if not template_name:
                raise ValueError("Meta template name is required when sending a template message.")

            lang = raw_template.get("language", "en_US")
            lang_code = lang.get("code") if isinstance(lang, dict) else (lang or "en_US")

            payload["template"] = {
                "name": template_name,
                "language": {"code": lang_code},
            }
            if "components" in raw_template and raw_template["components"]:
                payload["template"]["components"] = raw_template["components"]
        else:
            payload[message_type] = metadata.get(message_type, {})

        import json
        masked_recipient = f"{clean_to[:3]}****{clean_to[-4:]}" if len(clean_to) >= 7 else "****"
        safe_payload = {
            "messaging_product": payload.get("messaging_product"),
            "recipient_type": payload.get("recipient_type"),
            "to": masked_recipient,
            "type": message_type,
        }
        if message_type == "template":
            safe_payload["template"] = {
                "name": payload.get("template", {}).get("name"),
                "language": payload.get("template", {}).get("language"),
                "component_count": len(payload.get("template", {}).get("components", [])),
            }

        logger.info(
            "Meta WhatsApp Dispatch | Recipient=%s | Type=%s | Template=%s | Payload=%s",
            masked_recipient,
            message_type,
            payload.get("template", {}).get("name", "N/A") if message_type == "template" else "N/A",
            json.dumps(safe_payload),
        )

        try:
            response = session.post(url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            message_id = ""
            if "messages" in data and len(data["messages"]) > 0:
                message_id = data["messages"][0].get("id", "")

            logger.info(
                "Meta WhatsApp Dispatch Success | Recipient=%s | Type=%s | HTTP=%s | MsgID=%s",
                masked_recipient,
                message_type,
                response.status_code,
                message_id,
            )
                
            class WhatsAppResponse:
                def __init__(self, msg_id, raw_response=None):
                    self.id = msg_id
                    self.raw_response = raw_response or {}
                    
            return WhatsAppResponse(msg_id=message_id, raw_response=data)
        except requests.RequestException as exc:
            err_msg = str(exc)
            if hasattr(exc, "response") and exc.response is not None:
                try:
                    err_json = exc.response.json()
                    err_msg = f"{exc}: {err_json}"
                except Exception:
                    err_msg = f"{exc}: {exc.response.text}"
            logger.error("Meta WhatsApp Dispatch Failed | Recipient=%s | Error=%s", masked_recipient, err_msg)
            raise RuntimeError(f"Meta WhatsApp request failed: {err_msg}") from exc


