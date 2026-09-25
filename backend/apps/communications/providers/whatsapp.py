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

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_to,
            "type": message_type,
        }
        
        if message_type == "text":
            payload["text"] = {"preview_url": False, "body": str(message)}
        elif message_type == "template":
            payload["template"] = metadata.get("template", {})
        else:
            payload[message_type] = metadata.get(message_type, {})

        try:
            logger.info(f"Sending WhatsApp message to {clean_to}")
            response = session.post(url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            message_id = ""
            if "messages" in data and len(data["messages"]) > 0:
                message_id = data["messages"][0].get("id", "")
                
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
            logger.error(f"WhatsApp request failed: {err_msg}")
            raise RuntimeError(f"Meta WhatsApp request failed: {err_msg}") from exc


