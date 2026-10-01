import logging
from typing import Dict, Any, Optional
from apps.integrations.models import SocialConnection
from apps.integrations.providers.linkedin import LinkedInProvider

logger = logging.getLogger(__name__)


class LinkedInAnalyticsService:
    @classmethod
    def get_connection(cls, user, connection_id: Optional[str] = None) -> Optional[SocialConnection]:
        qs = SocialConnection.objects.filter(
            platform=SocialConnection.PlatformChoices.LINKEDIN,
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
        )
        if hasattr(user, 'ma_users') and user.ma_users.exists():
            ma_user = user.ma_users.first()
            qs = qs.filter(user=ma_user)

        if connection_id:
            return qs.filter(id=connection_id).first()
        return qs.first()

    @classmethod
    def get_managed_organizations(cls, user, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active LinkedIn SocialConnection found for this user."}

        orgs = connection.metadata.get("managed_organizations", []) if connection.metadata else []
        if not orgs:
            provider = LinkedInProvider()
            access_token = connection.get_access_token()
            if access_token:
                orgs = provider.get_managed_organizations(access_token)

        return {"success": True, "organizations": orgs}

    @classmethod
    def get_organization_insights(cls, user, org_urn: Optional[str] = None, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active LinkedIn SocialConnection found for this user."}

        # If org_urn is not specified, attempt to extract first managed organization URN
        if not org_urn:
            orgs_res = cls.get_managed_organizations(user, connection_id=connection_id)
            orgs = orgs_res.get("organizations", [])
            if orgs and isinstance(orgs, list) and len(orgs) > 0:
                org_urn = orgs[0].get("organization_urn")

        if not org_urn:
            return {
                "success": False,
                "error": "No LinkedIn Organization URN provided and user does not manage any Company Pages.",
            }

        provider = LinkedInProvider()
        return provider.get_organization_insights(connection, org_urn=org_urn)

    @classmethod
    def get_follower_demographics(cls, user, org_urn: Optional[str] = None, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active LinkedIn SocialConnection found for this user."}

        if not org_urn:
            orgs_res = cls.get_managed_organizations(user, connection_id=connection_id)
            orgs = orgs_res.get("organizations", [])
            if orgs and isinstance(orgs, list) and len(orgs) > 0:
                org_urn = orgs[0].get("organization_urn")

        if not org_urn:
            return {
                "success": False,
                "error": "No LinkedIn Organization URN provided and user does not manage any Company Pages.",
            }

        provider = LinkedInProvider()
        return provider.get_follower_demographics(connection, org_urn=org_urn)

    @classmethod
    def get_post_comments(cls, user, share_urn: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active LinkedIn SocialConnection found for this user."}

        provider = LinkedInProvider()
        return provider.get_post_comments(connection, share_urn=share_urn)

    @classmethod
    def reply_to_comment(cls, user, comment_urn: str, message: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active LinkedIn SocialConnection found for this user."}

        provider = LinkedInProvider()
        return provider.reply_to_comment(connection, comment_urn=comment_urn, message=message)
