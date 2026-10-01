import logging
from typing import Dict, Any, Optional
from apps.integrations.models import SocialConnection
from apps.integrations.providers.x import XProvider

logger = logging.getLogger(__name__)


class XAnalyticsService:
    @classmethod
    def get_connection(cls, user, connection_id: Optional[str] = None) -> Optional[SocialConnection]:
        qs = SocialConnection.objects.filter(
            platform=SocialConnection.PlatformChoices.X,
            connection_status=SocialConnection.ConnectionStatus.CONNECTED,
        )
        if hasattr(user, 'ma_users') and user.ma_users.exists():
            ma_user = user.ma_users.first()
            qs = qs.filter(user=ma_user)

        if connection_id:
            return qs.filter(id=connection_id).first()
        return qs.first()

    @classmethod
    def get_user_insights(cls, user, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active X (Twitter) SocialConnection found for this user."}

        provider = XProvider()
        return provider.get_user_analytics(connection)

    @classmethod
    def get_recent_tweets(cls, user, limit: int = 25, connection_id: Optional[str] = None) -> Dict[str, Any]:
        connection = cls.get_connection(user, connection_id)
        if not connection:
            return {"success": False, "error": "No active X (Twitter) SocialConnection found for this user."}

        provider = XProvider()
        return provider.get_recent_tweets(connection, limit=limit)
