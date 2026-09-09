import json
from urllib import request


from django.conf import settings

class SyncToCRMAction:
    def execute(self, execution, node, config):
        # We assume `execution.contact` is the contact currently passing through the automation.
        # If your execution model stores it differently, adjust accordingly.
        contact = getattr(execution, "contact", None)
        
        if not contact:
            return {
                "success": False,
                "message": "No contact associated with this execution. Cannot sync to CRM.",
            }

        # Format the exact JSON structure the internal CRM expects
        payload_data = {
            "source": "Marketing Automation",
            "lead": {
                "id": contact.id,
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone_no,
                "tags": [tag.name for tag in contact.tags.all()] if hasattr(contact, 'tags') else [],
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

