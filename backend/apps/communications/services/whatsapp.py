import logging
from django.conf import settings
from apps.accounts.models import Organization
from apps.common.ownership import get_user_organization
from apps.communications.models import CommunicationEvent, WhatsAppConnection, SenderIdentity
from apps.communications.providers.whatsapp import MetaWhatsAppProvider
from apps.integrations.utils.crypto import decrypt_token

logger = logging.getLogger(__name__)


class WhatsAppServiceError(Exception):
    """Base exception for all WhatsApp service operations."""
    def __init__(self, message, correlation_id=None):
        super().__init__(message)
        self.message = message
        self.correlation_id = correlation_id


class MediaDownloadError(WhatsAppServiceError):
    """Raised when downloading sample media fails or produces invalid content."""
    def __init__(self, message, is_client_error=False, correlation_id=None):
        super().__init__(message, correlation_id=correlation_id)
        self.is_client_error = is_client_error


class MetaUploadError(WhatsAppServiceError):
    """Raised when Meta's resumable upload API or server fails."""
    pass


class MetaTemplateRejectionError(WhatsAppServiceError):
    """Raised when Meta Graph API rejects a template submission with 4xx client error."""
    def __init__(self, message, subcode=None, user_title=None, user_msg=None, details=None, fbtrace_id=None, correlation_id=None):
        super().__init__(message, correlation_id=correlation_id)
        self.subcode = subcode
        self.user_title = user_title
        self.user_msg = user_msg
        self.details = details
        self.fbtrace_id = fbtrace_id


class MetaNetworkError(WhatsAppServiceError):
    """Raised when an external network error or timeout occurs contacting Meta."""
    def __init__(self, message, is_timeout=False, is_ambiguous=False, correlation_id=None):
        super().__init__(message, correlation_id=correlation_id)
        self.is_timeout = is_timeout
        self.is_ambiguous = is_ambiguous

def _resolve_org_and_user(target):
    if target is None:
        return None, None
    if isinstance(target, Organization):
        return target, None
    return get_user_organization(target), target

# CORRECT
def get_whatsapp_connection(organization=None, connection=None, environment=None):
    """
    Resolves the WhatsAppConnection strictly for the given organization/user,
    or returns the explicit connection. Never falls back across tenants.
    """
    if connection:
        return connection

    if organization is not None:
        org, fallback_user = _resolve_org_and_user(organization)

        if org is not None:
            qs = WhatsAppConnection.objects.filter(
                organization=org,
                is_active=True,
            )
            if environment:
                qs = qs.filter(environment=environment)
            conn = qs.order_by("-updated_at", "-created_at").first()
            if conn:
                return conn

        if fallback_user is not None:
            # Check for connection owned by this user
            from django.db.models import Q
            qs = WhatsAppConnection.objects.filter(
                Q(connected_by=fallback_user) | Q(organization=getattr(fallback_user, "organization", None)),
                is_active=True,
            )
            if environment:
                qs = qs.filter(environment=environment)
            conn = qs.order_by("-updated_at", "-created_at").first()
            if conn:
                return conn

        return None

    # Unscoped fallback (only when no tenant/organization context was specified)
    qs = WhatsAppConnection.objects.filter(is_active=True)
    if environment:
        qs = qs.filter(environment=environment)
    return qs.order_by("-created_at").first()


def get_whatsapp_identity(user=None, identity_id=None):
    """
    Find active SenderIdentity for WHATSAPP_CLOUD with strict organization scoping.
    """
    if identity_id:
        return SenderIdentity.objects.filter(id=identity_id, provider="WHATSAPP_CLOUD").first()
    if not user:
        return None

    org, fallback_user = _resolve_org_and_user(user)
    if org is not None:
        return SenderIdentity.objects.filter(
            organization=org,
            provider="WHATSAPP_CLOUD",
            status="CONNECTED",
        ).order_by("-updated_at").first()

    if fallback_user is not None:
        return SenderIdentity.objects.filter(
            organization__isnull=True,
            user=fallback_user,
            provider="WHATSAPP_CLOUD",
            status="CONNECTED",
        ).order_by("-updated_at").first()

    return None


def get_whatsapp_credentials(identity):
    """
    Safely extract decrypted access_token, phone_number_id, and waba_id from SenderIdentity.
    """
    if not identity:
        raise ValueError("No active WhatsApp provider configured")

    creds = identity.encrypted_credentials or {}
    raw_token = creds.get("access_token", "")

    # Try decrypting token; fallback to raw if not encrypted
    access_token = ""
    if raw_token:
        try:
            access_token = decrypt_token(raw_token)
        except Exception:
            access_token = raw_token

    phone_number_id = identity.phone_number_id or creds.get("phone_number_id", "")
    waba_id = identity.waba_id or creds.get("waba_id", "")

    if not access_token or not phone_number_id:
        raise ValueError("Incomplete WhatsApp Cloud API credentials")

    return {
        "access_token": access_token,
        "phone_number_id": phone_number_id,
        "waba_id": waba_id,
    }


def get_whatsapp_provider(organization=None, connection=None, user=None, identity_id=None, environment=None):
    """
    Returns an initialized MetaWhatsAppProvider instance for the organization, user, or explicit connection.
    Supports both WhatsAppConnection and SenderIdentity.
    """
    org = organization or user
    whatsapp_conn = get_whatsapp_connection(organization=org, connection=connection, environment=environment)

    if whatsapp_conn:
        raw_token = whatsapp_conn.get_access_token()
        if not raw_token:
            raise ValueError("WhatsApp connection access token could not be decrypted or is empty.")

        return MetaWhatsAppProvider(
            access_token=raw_token,
            phone_number_id=whatsapp_conn.phone_number_id,
            api_version=getattr(settings, "META_GRAPH_API_VERSION", "v19.0"),
        )

    # Fallback to SenderIdentity if configured
    identity = get_whatsapp_identity(user=org, identity_id=identity_id)
    if identity:
        creds = get_whatsapp_credentials(identity)
        return MetaWhatsAppProvider(
            access_token=creds["access_token"],
            phone_number_id=creds["phone_number_id"],
            api_version=getattr(settings, "META_GRAPH_API_VERSION", "v19.0"),
        )

    raise ValueError("No active WhatsApp connection configured.")


def send_whatsapp(to, message, config=None, execution=None, campaign=None, organization=None, connection=None, environment=None):
    """
    Sends an outbound WhatsApp message via Meta Cloud API using the organization's connection.
    """
    config = config or {}

    # Resolve organization context from campaign or execution if not explicitly provided
    if not organization:
        if campaign and hasattr(campaign, "created_by") and campaign.created_by:
            organization = campaign.created_by
        elif execution and hasattr(execution, "automation") and hasattr(execution.automation, "owner") and execution.automation.owner:
            organization = execution.automation.owner

    whatsapp_conn = get_whatsapp_connection(organization=organization, connection=connection, environment=environment)
    if not whatsapp_conn:
        identity = get_whatsapp_identity(user=organization)
        if identity:
            try:
                creds = get_whatsapp_credentials(identity)
                target_org, target_user = _resolve_org_and_user(organization)
                conn_org = identity.organization or target_org
                conn_user = identity.user or target_user
                if conn_org is not None:
                    whatsapp_conn, _ = WhatsAppConnection.objects.get_or_create(
                        organization=conn_org,
                        phone_number_id=creds["phone_number_id"],
                        defaults={
                            "connected_by": conn_user,
                            "encrypted_access_token": identity.encrypted_credentials.get("access_token", ""),
                            "is_active": True,
                        },
                    )
                elif conn_user is not None:
                    whatsapp_conn = WhatsAppConnection.objects.filter(
                        organization__isnull=True,
                        connected_by=conn_user,
                        phone_number_id=creds["phone_number_id"],
                    ).first()
                    if not whatsapp_conn:
                        whatsapp_conn = WhatsAppConnection.objects.create(
                            connected_by=conn_user,
                            phone_number_id=creds["phone_number_id"],
                            encrypted_access_token=identity.encrypted_credentials.get("access_token", ""),
                            is_active=True,
                        )
            except Exception as e:
                logger.warning(f"Could not auto-link WhatsAppConnection from SenderIdentity: {e}")

    if not whatsapp_conn:
        raise ValueError(
            f"No active WhatsApp connection found for organization: {organization}"
            if organization else "No active WhatsApp connection configured."
        )

    provider = get_whatsapp_provider(connection=whatsapp_conn, user=organization)
    response = provider.send(
        to=to,
        message=message,
        metadata=config.get("metadata", {}),
    )

    msg_id = str(getattr(response, "id", ""))
    event = CommunicationEvent.objects.create(
        execution=execution,
        campaign=campaign,
        whatsapp_connection=whatsapp_conn,
        channel="WHATSAPP",
        event_name="WHATSAPP_SENT",
        recipient=to,
        status="SENT",
        provider_message_id=msg_id,
        metadata=config.get("metadata", {}),
    )

    return msg_id or True


def resolve_whatsapp_credentials_and_waba(template=None, organization=None, connection=None, user=None, identity_id=None):
    """
    Resolves the Meta access token and WABA ID for template management with multi-tenant isolation.
    """
    org = organization or user
    if not org and template and hasattr(template, "created_by") and template.created_by:
        org = template.created_by

    whatsapp_conn = get_whatsapp_connection(organization=org, connection=connection)
    identity = get_whatsapp_identity(user=org, identity_id=identity_id)
    access_token = None
    waba_id = None

    if whatsapp_conn:
        try:
            access_token = whatsapp_conn.get_access_token()
        except Exception as e:
            logger.error(f"Failed to decrypt WhatsApp access token: {e}")
            raise ValueError("Failed to decrypt WhatsApp access token. Please reconnect your WhatsApp account.")

        if template and isinstance(template.provider_data, dict) and template.provider_data.get("waba_id"):
            waba_id = template.provider_data["waba_id"]
        if not waba_id and whatsapp_conn.waba_id:
            waba_id = whatsapp_conn.waba_id
        if not waba_id and identity:
            waba_id = identity.waba_id or (identity.encrypted_credentials or {}).get("waba_id")
        if not waba_id:
            waba_id = getattr(settings, "META_WABA_ID", None)
    elif identity:
        creds = get_whatsapp_credentials(identity)
        access_token = creds.get("access_token")
        waba_id = creds.get("waba_id")

    if not access_token:
        raise ValueError("No access token available for WhatsApp connection.")

    if not waba_id:
        raise ValueError("WhatsApp Business Account ID (WABA ID) is required to submit templates.")

    return access_token, waba_id, org


def upload_media_to_meta_resumable(
    media_url_or_bytes,
    file_name,
    file_type,
    access_token,
    app_id=None,
    api_version=None,
    correlation_id=None,
    download_timeout=(5, 15),
    session_timeout=(5, 10),
    upload_timeout=(5, 20),
):
    """
    Uploads a sample media file (image/video/document) using Meta's Resumable Upload API
    to acquire a media handle (header_handle) for WhatsApp template creation.

    Step 1: POST https://graph.facebook.com/{version}/{app_id}/uploads
            Query params: file_length, file_type, file_name
            Returns: {"id": "upload:SESSION_ID"}
    Step 2: POST https://graph.facebook.com/{version}/{upload_session_id}
            Headers: Authorization: OAuth {access_token}, file_offset: 0
            Body: raw binary data
            Returns: {"h": "MEDIA_HANDLE"}
    """
    import requests
    from urllib.parse import urlparse

    app_id = app_id or getattr(settings, "META_APP_ID", "") or getattr(settings, "FACEBOOK_CLIENT_ID", "")
    if not app_id:
        raise ValueError("Meta App ID is required for Resumable Upload API to generate media handles.")

    version = (api_version or getattr(settings, "META_GRAPH_API_VERSION", "v19.0")).lstrip("/")
    MAX_MEDIA_BYTES = 16 * 1024 * 1024  # 16 MB Meta limit

    # Resolve binary content safely
    if isinstance(media_url_or_bytes, (bytes, bytearray)):
        content = bytes(media_url_or_bytes)
        if len(content) > MAX_MEDIA_BYTES:
            raise MediaDownloadError("Media content exceeds maximum allowed size (16 MB).", is_client_error=True, correlation_id=correlation_id)
    elif isinstance(media_url_or_bytes, str):
        parsed = urlparse(media_url_or_bytes.strip())
        if parsed.scheme not in ("http", "https"):
            raise MediaDownloadError("Media URL must use http or https scheme.", is_client_error=True, correlation_id=correlation_id)
        try:
            dl_resp = requests.get(media_url_or_bytes, timeout=download_timeout, stream=True)
            if not dl_resp.ok:
                raise MediaDownloadError(
                    f"Media host returned HTTP {dl_resp.status_code}",
                    is_client_error=(400 <= dl_resp.status_code < 500),
                    correlation_id=correlation_id,
                )
            content_len_hdr = dl_resp.headers.get("Content-Length")
            if content_len_hdr:
                try:
                    if int(content_len_hdr) > MAX_MEDIA_BYTES:
                        raise MediaDownloadError(f"Media file size ({content_len_hdr} bytes) exceeds limit (16MB).", is_client_error=True, correlation_id=correlation_id)
                except ValueError:
                    pass

            ct_hdr = dl_resp.headers.get("Content-Type")
            if ct_hdr:
                detected_type = ct_hdr.split(";")[0].strip()
                if detected_type and detected_type != "application/octet-stream":
                    file_type = detected_type

            chunks = []
            total_bytes = 0
            if hasattr(dl_resp, "iter_content"):
                try:
                    for chunk in dl_resp.iter_content(chunk_size=64 * 1024):
                        if chunk:
                            total_bytes += len(chunk)
                            if total_bytes > MAX_MEDIA_BYTES:
                                raise MediaDownloadError("Media download exceeded 16MB limit.", is_client_error=True, correlation_id=correlation_id)
                            chunks.append(chunk)
                except Exception:
                    pass

            content = b"".join(chunks)
            if not content and hasattr(dl_resp, "content") and dl_resp.content:
                content = bytes(dl_resp.content)
        except requests.Timeout as exc:
            raise MediaDownloadError(f"Timeout downloading media from URL: {exc}", is_client_error=False, correlation_id=correlation_id) from exc
        except requests.RequestException as exc:
            raise MediaDownloadError(f"Network error downloading media from URL: {exc}", is_client_error=False, correlation_id=correlation_id) from exc
    else:
        raise ValueError("media_url_or_bytes must be raw bytes or a valid HTTP/HTTPS URL.")

    file_length = len(content)
    if file_length == 0:
        raise MediaDownloadError("Media file content is empty.", is_client_error=True, correlation_id=correlation_id)

    file_type = file_type or "image/png"
    file_name = file_name or "sample_media.png"

    # Validate mime type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "video/mp4", "application/pdf"]
    if file_type.lower() not in allowed_types:
        raise MediaDownloadError(f"Unsupported media Content-Type: {file_type}. Supported: {', '.join(allowed_types)}", is_client_error=True, correlation_id=correlation_id)

    # Step 1: Create upload session
    step1_url = f"https://graph.facebook.com/{version}/{app_id}/uploads"
    params = {
        "file_length": file_length,
        "file_type": file_type,
        "file_name": file_name,
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    try:
        step1_resp = requests.post(step1_url, params=params, headers=headers, timeout=session_timeout)
    except requests.Timeout as exc:
        raise MetaNetworkError(f"Timeout initiating Meta upload session: {exc}", is_timeout=True, correlation_id=correlation_id) from exc
    except requests.RequestException as exc:
        raise MetaNetworkError(f"Network error initiating Meta upload session: {exc}", is_timeout=False, correlation_id=correlation_id) from exc

    if not step1_resp.ok:
        err_msg = step1_resp.text
        try:
            err_data = step1_resp.json().get("error", {})
            err_msg = err_data.get("message") or err_msg
        except Exception:
            pass
        raise MetaUploadError(f"Meta Resumable Upload session initiation failed: {err_msg}", correlation_id=correlation_id)

    session_id = step1_resp.json().get("id")
    if not session_id:
        raise MetaUploadError("Meta Resumable Upload session initiation did not return an upload ID.", correlation_id=correlation_id)

    # Step 2: Upload file bytes
    step2_url = f"https://graph.facebook.com/{version}/{session_id}"
    step2_headers = {
        "Authorization": f"OAuth {access_token}",
        "file_offset": "0",
        "Content-Type": "application/octet-stream",
    }
    try:
        step2_resp = requests.post(step2_url, data=content, headers=step2_headers, timeout=upload_timeout)
    except requests.Timeout as exc:
        raise MetaNetworkError(f"Timeout transferring file to Meta upload session: {exc}", is_timeout=True, correlation_id=correlation_id) from exc
    except requests.RequestException as exc:
        raise MetaNetworkError(f"Network error transferring file to Meta upload session: {exc}", is_timeout=False, correlation_id=correlation_id) from exc

    if not step2_resp.ok:
        err_msg = step2_resp.text
        try:
            err_data = step2_resp.json().get("error", {})
            err_msg = err_data.get("message") or err_msg
        except Exception:
            pass
        raise MetaUploadError(f"Meta Resumable Upload binary transfer failed: {err_msg}", correlation_id=correlation_id)

    handle = step2_resp.json().get("h")
    if not handle or not isinstance(handle, str) or not handle.strip():
        raise MetaUploadError("Meta Resumable Upload did not return a valid media handle ('h').", correlation_id=correlation_id)

    return handle.strip()


def submit_whatsapp_template(
    template,
    organization=None,
    connection=None,
    user=None,
    identity_id=None,
    correlation_id=None,
    graph_api_timeout=(5, 15),
):
    """
    Submits a WhatsApp message template to Meta for approval.
    Follows Meta Cloud API requirements for components, variables, and categories.
    Implements idempotency checking to prevent duplicate template creation on retries.
    """
    import json
    import re
    import requests
    from django.utils import timezone

    access_token, waba_id, org = resolve_whatsapp_credentials_and_waba(
        template=template,
        organization=organization,
        connection=connection,
        user=user,
        identity_id=identity_id,
    )

    # 1. Parse structured metadata from subject if available
    metadata = {}
    if template.subject and template.subject.strip().startswith("{"):
        try:
            metadata = json.loads(template.subject.strip())
        except Exception:
            metadata = {}

    category = (metadata.get("category") or "MARKETING").upper()
    if category not in ["MARKETING", "UTILITY", "AUTHENTICATION"]:
        category = "MARKETING"

    language = metadata.get("language") or "en_US"

    # 2. Extract and sanitize template name for Meta (^[a-z0-9_]+$, max 512)
    raw_name = template.name.strip().lower()
    norm_name = re.sub(r"[\s\-]+", "_", raw_name)
    norm_name = re.sub(r"[^a-z0-9_]", "", norm_name)
    norm_name = re.sub(r"_+", "_", norm_name).strip("_")[:512]
    if not norm_name:
        norm_name = f"template_{template.id}"

    version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")

    # Idempotency check: if template already has meta_template_id, verify or adopt
    if isinstance(template.provider_data, dict) and template.provider_data.get("meta_template_id"):
        return template

    # Check if a template with this name already exists at Meta under this WABA
    try:
        check_url = f"https://graph.facebook.com/{version}/{waba_id}/message_templates"
        check_resp = requests.get(
            check_url,
            params={"name": norm_name},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=(5, 10),
        )
        if check_resp.ok:
            for item in check_resp.json().get("data", []):
                if item.get("name") == norm_name and item.get("language") == language:
                    existing_id = str(item.get("id"))
                    existing_status = item.get("status", "PENDING")
                    existing_cat = item.get("category", category)
                    if not isinstance(template.provider_data, dict):
                        template.provider_data = {}
                    template.provider_data.update({
                        "waba_id": waba_id,
                        "meta_template_id": existing_id,
                        "meta_template_name": norm_name,
                        "meta_status": existing_status,
                        "meta_category": existing_cat,
                        "submitted_at": timezone.now().isoformat(),
                    })
                    template.save(update_fields=["provider_data"])
                    logger.info(f"Adopted existing Meta template '{norm_name}' (ID: {existing_id}) for template {template.id}")
                    return template
    except Exception as check_exc:
        logger.debug(f"Pre-check for existing Meta template skipped: {check_exc}")

    # 3. Process Body Text and Variables
    raw_body = metadata.get("body") or template.body or ""
    clean_body = re.sub(r"<br\s*/?>", "\n", raw_body, flags=re.I)
    clean_body = re.sub(r"</p>", "\n\n", clean_body, flags=re.I)
    clean_body = re.sub(r"<[^>]+>", "", clean_body).strip()

    if not clean_body:
        raise ValueError("Template message body cannot be empty.")

    # Convert named variables like {{first_name}} to Meta positional variables {{1}}, {{2}}
    # Meta strictly enforces sequential positional variables ({{1}}, {{2}}, ... without duplicates)
    # and requires 1:1 matching sample values in example.body_text
    var_counts = {}
    sample_values = []
    counter = [0]

    def replace_var(m):
        counter[0] += 1
        var_name = m.group(1).strip()
        var_counts[var_name] = var_counts.get(var_name, 0) + 1
        if var_counts[var_name] == 1:
            sample_values.append(f"Sample_{var_name}")
        else:
            sample_values.append(f"Sample_{var_name}_{var_counts[var_name]}")
        return f"{{{{{counter[0]}}}}}"

    clean_body = re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace_var, clean_body)

    # 4. Build Components
    components = []

    # Header
    header_data = metadata.get("header")
    if header_data and isinstance(header_data, dict):
        h_type = (header_data.get("type") or "NONE").upper()
        if h_type == "TEXT" and header_data.get("text", "").strip():
            components.append({
                "type": "HEADER",
                "format": "TEXT",
                "text": header_data["text"].strip()[:60],
            })
        elif h_type in ["IMAGE", "VIDEO", "DOCUMENT"]:
            header_handle = None
            if isinstance(template.provider_data, dict) and template.provider_data.get("header_handle"):
                header_handle = template.provider_data.get("header_handle")
            elif header_data.get("header_handle"):
                header_handle = header_data.get("header_handle")

            media_url = header_data.get("mediaUrl") or header_data.get("url")
            media_name = header_data.get("mediaName") or f"header_{template.id}.png"

            if not header_handle and media_url:
                app_id = getattr(settings, "META_APP_ID", "") or getattr(settings, "FACEBOOK_CLIENT_ID", "")
                if app_id and access_token:
                    try:
                        mime_type = "image/png"
                        if h_type == "VIDEO":
                            mime_type = "video/mp4"
                        elif h_type == "DOCUMENT":
                            mime_type = "application/pdf"
                        elif media_name.lower().endswith((".jpg", ".jpeg")):
                            mime_type = "image/jpeg"

                        header_handle = upload_media_to_meta_resumable(
                            media_url_or_bytes=media_url,
                            file_name=media_name,
                            file_type=mime_type,
                            access_token=access_token,
                            app_id=app_id,
                            api_version=version,
                            correlation_id=correlation_id,
                        )
                        if not isinstance(template.provider_data, dict):
                            template.provider_data = {}
                        template.provider_data["header_handle"] = header_handle
                        template.save(update_fields=["provider_data"])
                    except (WhatsAppServiceError, ValueError):
                        raise
                    except Exception as upload_err:
                        logger.warning(f"Could not auto-upload header media to Meta resumable API: {upload_err}")
                        raise MetaUploadError(f"Failed uploading sample media to Meta: {upload_err}", correlation_id=correlation_id) from upload_err

            if not header_handle:
                raise ValueError(
                    f"Template has an {h_type} header, but no valid sample media handle (header_handle) "
                    "could be generated or found. Meta requires a sample media handle for media headers."
                )

            components.append({
                "type": "HEADER",
                "format": h_type,
                "example": {
                    "header_handle": [header_handle],
                },
            })

    # Body
    body_component = {
        "type": "BODY",
        "text": clean_body,
    }
    if sample_values:
        body_component["example"] = {
            "body_text": [sample_values]
        }
    components.append(body_component)

    # Footer
    footer_text = metadata.get("footer", "").strip()
    if footer_text:
        components.append({
            "type": "FOOTER",
            "text": footer_text[:60],
        })

    # Buttons
    buttons_data = metadata.get("buttons", [])
    if buttons_data and isinstance(buttons_data, list):
        meta_buttons = []
        for btn in buttons_data[:10]:
            btn_type = (btn.get("type") or "QUICK_REPLY").upper()
            btn_text = (btn.get("text") or "Click Here")[:25]
            if (btn_type == "URL" or btn_type == "BOOK_DEMO") and btn.get("url"):
                meta_buttons.append({
                    "type": "URL",
                    "text": btn_text,
                    "url": btn["url"],
                })
            elif btn_type == "PHONE_NUMBER" and btn.get("phoneNumber"):
                raw_phone = str(btn.get("phoneNumber", "")).strip()
                cleaned_phone = re.sub(r"[^\d+]", "", raw_phone)
                if cleaned_phone and not cleaned_phone.startswith("+"):
                    cleaned_phone = f"+{cleaned_phone}"
                meta_buttons.append({
                    "type": "PHONE_NUMBER",
                    "text": btn_text,
                    "phone_number": cleaned_phone,
                })
            elif btn_type in ["QUICK_REPLY", "COUPON_CODE"]:
                meta_buttons.append({
                    "type": "QUICK_REPLY",
                    "text": btn_text,
                })

        if meta_buttons:
            components.append({
                "type": "BUTTONS",
                "buttons": meta_buttons,
            })

    # 5. Build and Send Payload
    payload = {
        "name": norm_name,
        "language": language,
        "category": category,
        "components": components,
    }

    url = f"https://graph.facebook.com/{version}/{waba_id}/message_templates"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=graph_api_timeout)
    except requests.Timeout as exc:
        if not isinstance(template.provider_data, dict):
            template.provider_data = {}
        template.provider_data["meta_status"] = "SUBMISSION_AMBIGUOUS"
        template.provider_data["submitted_at"] = timezone.now().isoformat()
        template.save(update_fields=["provider_data"])
        raise MetaNetworkError(
            f"Timeout waiting for Meta to confirm template creation: {exc}",
            is_timeout=True,
            is_ambiguous=True,
            correlation_id=correlation_id,
        ) from exc
    except requests.RequestException as exc:
        raise MetaNetworkError(
            f"Network error submitting WhatsApp Template to Meta: {exc}",
            is_timeout=False,
            is_ambiguous=False,
            correlation_id=correlation_id,
        ) from exc

    if not response.ok:
        err_json = {}
        try:
            err_json = response.json().get("error", {})
        except Exception:
            pass

        msg = err_json.get("message") or response.text
        subcode = err_json.get("error_subcode")
        user_title = err_json.get("error_user_title")
        user_msg = err_json.get("error_user_msg")
        details = ""
        if isinstance(err_json.get("error_data"), dict):
            details = err_json["error_data"].get("details", "")
        fbtrace_id = err_json.get("fbtrace_id")

        if not isinstance(template.provider_data, dict):
            template.provider_data = {}
        template.provider_data["meta_status"] = "REJECTED"
        template.provider_data["meta_rejection_reason"] = user_msg or msg
        template.save(update_fields=["provider_data"])

        parts = [msg]
        if subcode:
            parts.append(f"subcode: {subcode}")
        if user_title:
            parts.append(f"title: {user_title}")
        if user_msg:
            parts.append(f"user_msg: {user_msg}")
        if details:
            parts.append(f"details: {details}")
        if fbtrace_id:
            parts.append(f"fbtrace_id: {fbtrace_id}")
        err_detail = " | ".join(parts)

        if response.status_code < 500:
            raise MetaTemplateRejectionError(
                message=f"Meta template submission rejected: {err_detail}",
                subcode=subcode,
                user_title=user_title,
                user_msg=user_msg,
                details=details,
                fbtrace_id=fbtrace_id,
                correlation_id=correlation_id,
            )
        else:
            raise MetaUploadError(
                f"Meta template submission rejected: {err_detail}",
                correlation_id=correlation_id,
            )

    data = response.json()
    if not isinstance(template.provider_data, dict):
        template.provider_data = {}

    template.provider_data.update({
        "waba_id": waba_id,
        "meta_template_id": str(data.get("id", "")),
        "meta_template_name": norm_name,
        "meta_status": data.get("status", "PENDING"),
        "meta_category": data.get("category", category),
        "submitted_at": timezone.now().isoformat(),
    })
    template.save()

    return template


def sync_whatsapp_template_status(template, organization=None, connection=None, user=None, identity_id=None):
    """
    Synchronizes the approval status of a WhatsApp message template from Meta Cloud API.
    """
    import requests

    access_token, waba_id, org = resolve_whatsapp_credentials_and_waba(
        template=template,
        organization=organization,
        connection=connection,
        user=user,
        identity_id=identity_id,
    )

    if not isinstance(template.provider_data, dict) or not template.provider_data.get("meta_template_id"):
        raise ValueError("Template has not been submitted to Meta yet.")

    meta_template_id = template.provider_data["meta_template_id"]
    version = getattr(settings, "META_GRAPH_API_VERSION", "v19.0").lstrip("/")
    headers = {"Authorization": f"Bearer {access_token}"}

    # Query by template ID
    url = f"https://graph.facebook.com/{version}/{meta_template_id}"
    try:
        response = requests.get(url, headers=headers, timeout=15)
    except requests.RequestException as exc:
        raise RuntimeError(f"Network error syncing WhatsApp Template status from Meta: {exc}") from exc

    if not response.ok:
        try:
            err_data = response.json().get("error", {})
            err_msg = err_data.get("message") or response.text
        except Exception:
            err_msg = response.text
        raise RuntimeError(f"Meta template sync failed: {err_msg}")

    data = response.json()
    new_status = data.get("status")
    if new_status:
        if not isinstance(template.provider_data, dict):
            template.provider_data = {}
        template.provider_data["meta_status"] = new_status
        if "rejected_reason" in data:
            template.provider_data["meta_rejection_reason"] = data["rejected_reason"]
        elif "reason" in data:
            template.provider_data["meta_rejection_reason"] = data["reason"]

        template.save(update_fields=["provider_data", "updated_at"])

    return template

