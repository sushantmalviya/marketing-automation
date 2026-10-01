import logging
from typing import Dict, Any, Optional
from apps.integrations.models import SocialConnection
from apps.integrations.providers.instagram import InstagramProvider

logger = logging.getLogger(__name__)

class InstagramAnalyticsService:
    @classmethod
    def get_connection(cls, user, connection_id: Optional[str] = None) -> Optional[SocialConnection]:
        qs = SocialConnection.objects.filter(
            platform=SocialConnection.PlatformChoices.INSTAGRAM,
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
        )
        if hasattr(user, 'ma_users') and user.ma_users.exists():
            ma_user = user.ma_users.first()
            qs = qs.filter(user=ma_user)

        if connection_id:
            return qs.filter(id=connection_id).first()
        return qs.first()

    @classmethod
    def get_account_insights(cls, user, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Instagram SocialConnection found for this user."}

        provider = InstagramProvider()
        return provider.get_user_insights(connection)

    @classmethod
    def get_recent_media_feed(cls, user, limit: int = 25, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Instagram SocialConnection found for this user."}

        provider = InstagramProvider()
        return provider.get_recent_media(connection, limit=limit)

    @classmethod
    def get_media_performance(cls, user, media_id: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Instagram SocialConnection found for this user."}

        provider = InstagramProvider()
        return provider.get_media_insights(connection, media_id=media_id)

    @classmethod
    def get_media_comments(cls, user, media_id: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Instagram SocialConnection found for this user."}

        provider = InstagramProvider()
        return provider.get_media_comments(connection, media_id=media_id)

    @classmethod
    def post_comment_reply(cls, user, comment_id: str, message: str, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active Instagram SocialConnection found for this user."}

        provider = InstagramProvider()
        return provider.reply_to_comment(connection, comment_id=comment_id, message=message)
