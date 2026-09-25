import json
from urllib import request


from django.conf import settings

class SyncToCRMAction:
    def execute(self, execution, node, config):
        # We assume `execution.contact` is the contact currently passing through the automation.
        # If your execution model stores it differently, adjust accordingly.
        contact = getattr(execution, "contact", None) or (execution.context.get("contact") if isinstance(execution.context, dict) else None)
        
        if not contact:
            return {
                "success": False,
                "message": "No contact associated with this execution. Cannot sync to CRM.",
            }

        if isinstance(contact, dict):
            email = contact.get("email") or contact.get("Email")
            name = contact.get("name") or contact.get("Name") or ""
            phone = contact.get("phone") or contact.get("phone_no") or ""
            tags = contact.get("tags") or []
            contact_id = contact.get("id", "")
        else:
            email = getattr(contact, "email", None)
            name = f"{getattr(contact, 'first_name', '')} {getattr(contact, 'last_name', '')}".strip() or getattr(contact, "name", "")
            phone = getattr(contact, "phone_no", getattr(contact, "phone", ""))
            tags = [tag.name for tag in contact.tags.all()] if hasattr(contact, 'tags') else []
            contact_id = getattr(contact, "id", "")

        if not email:
            return {
                "success": False,
                "message": "No contact email address associated with this execution.",
            }

        # Format the exact JSON structure the internal CRM expects
        payload_data = {
            "source": "Marketing Automation",
            "lead": {
                "id": str(contact_id),
                "name": name,
                "email": email,
                "phone": phone,
                "tags": tags,
            }
        }
        
        payload = json.dumps(payload_data).encode("utf-8")
        
        # Internal secure authentication headers
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {getattr(settings, 'CRM_API_SECRET', '')}",
            "X-Internal-Source": "auto-market"
        }

        url = getattr(settings, "CRM_API_URL", "")
        if not url:
            return {"success": False, "message": "CRM_API_URL is not configured."}

        req = request.Request(
            url,
            data=payload,
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=10) as res:
                status = res.status
                return {
                    "success": True,
                    "status": status,
                    "message": "Successfully pushed to CRM",
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to sync with CRM: {str(e)}"
            }


class InternalAPICallAction:
    def execute(self, execution, node, config):
        return {
            "success": True,
            "message": "Internal API call queued.",
            "config": config,
        }

