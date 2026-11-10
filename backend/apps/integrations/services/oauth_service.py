import os
import secrets
import logging
from django.core.cache import cache
from datetime import timedelta
from django.utils import timezone
from apps.accounts.models import MAUser, Organization
from apps.common.ownership import get_user_organization, scope_queryset_by_org
from apps.integrations.models import SocialConnection
from apps.integrations.providers.factory import ProviderFactory

logger = logging.getLogger(__name__)


def _extract_auth_context(actor):
    """Resolve (auth_user, ma_user, organization) from either a User or MAUser."""
    if isinstance(actor, MAUser):
        auth_user = actor.user
        ma_user = actor
        org = actor.organization or (getattr(auth_user, "organization", None) if auth_user else None)
        return auth_user, ma_user, org
    auth_user = actor
    org = get_user_organization(auth_user)
    ma_user = auth_user.ma_users.first() if hasattr(auth_user, "ma_users") else None
    return auth_user, ma_user, org


class OAuthService:
    @staticmethod
    def _get_redirect_uri(platform: str) -> str:
        base_url = os.environ.get("OAUTH_REDIRECT_BASE_URL")
        if not base_url:
            raise ValueError("OAUTH_REDIRECT_BASE_URL environment variable is missing.")
            
        if not base_url.endswith("/"):
            base_url += "/"
            
        redirect_uri = f"{base_url}{platform.lower()}/"
        logger.info(f"Generated redirect URI for {platform}: {redirect_uri}")
        return redirect_uri

    @staticmethod
    def generate_auth_url(user, platform: str, portal_prefix: str = None) -> str:
        auth_user, ma_user, org = _extract_auth_context(user)
        logger.info(f"OAuth started for user {getattr(user, 'id', None)} org {getattr(org, 'id', None)} on platform {platform}")
        
        provider = ProviderFactory.get_provider(platform)
        if not provider:
            logger.error(f"Provider not found for platform: {platform}")
            raise ValueError(f"Provider not found for platform: {platform}")

        state = secrets.token_urlsafe(32)
        cache_key = f"oauth_state_{state}"
        cache.set(
            cache_key,
            {
                "user_id": ma_user.id if ma_user else None,
                "auth_user_id": auth_user.id if auth_user else None,
                "organization_id": str(org.id) if org else None,
                "portal_prefix": portal_prefix,
                "platform": platform,
            },
            timeout=600,
        )

        redirect_uri = OAuthService._get_redirect_uri(platform)
        auth_url = provider.get_authorization_url(state, redirect_uri)

        logger.info(f"Generated authorization URL for {platform}.")
        return auth_url

    @staticmethod
    def handle_callback(state: str, code: str, expected_platform: str):
        logger.info(f"Callback received for platform: {expected_platform}")
        
        cache_key = f"oauth_state_{state}"
        state_data = cache.get(cache_key)
        
        try:
            if not state_data:
                logger.warning(f"State validation failed: expired or missing state for {expected_platform}")
                raise ValueError("invalid_state")
                
            if state_data["platform"].lower() != expected_platform.lower():
                logger.warning(f"State platform mismatch. Expected: {expected_platform}, Found: {state_data['platform']}")
                raise ValueError("invalid_platform")
                
            provider = ProviderFactory.get_provider(expected_platform)
            if not provider:
                logger.error(f"Provider unavailable: {expected_platform}")
                raise ValueError("provider_unavailable")
                
            redirect_uri = OAuthService._get_redirect_uri(expected_platform)
            
            logger.info(f"Starting token exchange for {expected_platform}")
            try:
                token_data = provider.exchange_code(code, redirect_uri)
            except Exception as e:
                logger.exception(f"Token exchange failed for {expected_platform}")
                raise ValueError("token_exchange_failed")
            
            ma_user = None
            if state_data.get("user_id") is not None:
                ma_user = MAUser.objects.filter(id=state_data["user_id"]).select_related("organization", "user").first()

            org = None
            if state_data.get("organization_id"):
                org = Organization.objects.filter(id=state_data["organization_id"]).first()
            if org is None and ma_user is not None:
                org = ma_user.organization or (getattr(ma_user.user, "organization", None) if ma_user.user_id else None)

            if ma_user is None and org is None:
                logger.error(f"User/organization mapping failed for state data {state_data}")
                raise ValueError("user_mapping_failed")
            
            logger.info(f"Saving database record for {expected_platform} account ID: {token_data.get('account_id')}")

            platform_upper = expected_platform.upper()
            account_id = token_data["account_id"]
            defaults = {
                "organization": org,
                "user": ma_user,
                "account_name": token_data["account_name"],
                "metadata": token_data.get("metadata", {}),
                "connection_status": SocialConnection.ConnectionStatus.CONNECTED,
            }

            if org is not None:
                connection = SocialConnection.objects.filter(
                    organization=org,
                    platform=platform_upper,
                    platform_account_id=account_id,
                ).first()
            else:
                connection = SocialConnection.objects.filter(
                    organization__isnull=True,
                    user=ma_user,
                    platform=platform_upper,
                    platform_account_id=account_id,
                ).first()

            if connection:
                for key, value in defaults.items():
                    setattr(connection, key, value)
            else:
                connection = SocialConnection(
                    platform=platform_upper,
                    platform_account_id=account_id,
                    **defaults,
                )

            connection.set_tokens(
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token")
            )
            
            expires_in = token_data.get("expires_in")
            if expires_in:
                connection.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
            else:
                connection.token_expires_at = None
                
            connection.save()
            connection._portal_prefix = state_data.get("portal_prefix")
            logger.info(f"Database save successful for connection ID: {connection.id}")
            
            return connection
        finally:
            if state_data:
                cache.delete(cache_key)

    @staticmethod
    def _get_scoped_connection(connection_id: str, actor):
        auth_user, ma_user, org = _extract_auth_context(actor)
        if org is not None:
            return SocialConnection.objects.get(id=connection_id, organization=org)
        if auth_user is not None:
            return scope_queryset_by_org(SocialConnection.objects.all(), auth_user, user_field="user__user").get(id=connection_id)
        return SocialConnection.objects.get(id=connection_id, organization__isnull=True, user=ma_user)

    @staticmethod
    def disconnect_account(connection_id: str, user):
        connection = OAuthService._get_scoped_connection(connection_id, user)
        provider = ProviderFactory.get_provider(connection.platform)
        
        if provider:
            access_token = connection.get_access_token()
            if access_token:
                provider.revoke_token(access_token)
                
        connection.delete()
        return True

    @staticmethod
    def validate_connection(connection_id: str, user) -> bool:
        connection = OAuthService._get_scoped_connection(connection_id, user)
        provider = ProviderFactory.get_provider(connection.platform)
        
        if not provider:
            return False
            
        access_token = connection.get_access_token()
        is_valid = provider.validate_token(access_token)
        
        if not is_valid:
            connection.connection_status = SocialConnection.ConnectionStatus.EXPIRED
            connection.save(update_fields=['connection_status'])
            
        return is_valid
