import logging
from typing import Dict, Any, Optional
from apps.integrations.models import SocialConnection
from apps.integrations.providers.facebook import FacebookProvider

logger = logging.getLogger(__name__)


class FacebookAnalyticsService:
    @classmethod
    def get_connection(cls, user, connection_id: Optional[str] = None) -> Optional[SocialConnection]:
        qs = SocialConnection.objects.filter(
            platform=SocialConnection.PlatformChoices.FACEBOOK,
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
        )
        if hasattr(user, 'ma_users') and user.ma_users.exists():
            ma_user = user.ma_users.first()
            qs = qs.filter(user=ma_user)

        if connection_id:
            return qs.filter(id=connection_id).first()
        return qs.first()

    @classmethod
    def get_managed_pages(cls, user, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Facebook SocialConnection found for this user."}

        pages = connection.metadata.get("pages", []) if connection.metadata else []
        return {"success": True, "pages": pages}

    @classmethod
    def get_page_insights(cls, user, page_id: Optional[str] = None, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Facebook SocialConnection found for this user."}

        provider = FacebookProvider()
        return provider.get_page_insights(connection, page_id=page_id)

    @classmethod
    def get_recent_posts(cls, user, page_id: Optional[str] = None, limit: int = 25, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Facebook SocialConnection found for this user."}

        provider = FacebookProvider()
        return provider.get_recent_posts(connection, page_id=page_id, limit=limit)

    @classmethod
    def get_post_comments(cls, user, post_id: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Facebook SocialConnection found for this user."}

        provider = FacebookProvider()
        return provider.get_post_comments(connection, post_id=post_id)

    @classmethod
    def reply_to_comment(cls, user, comment_id: str, message: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Facebook SocialConnection found for this user."}

        provider = FacebookProvider()
        return provider.reply_to_comment(connection, comment_id=comment_id, message=message)
