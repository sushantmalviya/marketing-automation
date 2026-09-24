import json
import logging
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)


def perform_dns_txt_lookup(domain: str) -> list[str]:
    """
    Performs a DNS TXT query for the specified domain using DNS over HTTPS (DoH) providers.
    Returns a list of TXT record value strings found for the domain.
    """
    txt_records = []

    # Clean domain name
    domain = domain.strip().lower()
    if domain.startswith("http://") or domain.startswith("https://"):
        domain = urllib.parse.urlparse(domain).netloc
    if domain.startswith("www."):
        domain = domain[4:]

    # 1. Try Google DoH API
    try:
        url = f"https://dns.google/resolve?name={urllib.parse.quote(domain)}&type=TXT"
        req = urllib.request.Request(url, headers={"User-Agent": "AutoMarket-Verifier/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            answers = data.get("Answer", [])
            for ans in answers:
                if ans.get("type") == 16:  # TXT record type
                    val = ans.get("data", "").strip('"')
                    txt_records.append(val)
    except Exception as e:
        logger.warning(f"Google DoH lookup failed for {domain}: {e}")

    # 2. Try Cloudflare DoH API as fallback if empty
    if not txt_records:
        try:
            url = f"https://cloudflare-dns.com/dns-query?name={urllib.parse.quote(domain)}&type=TXT"
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/dns-json", "User-Agent": "AutoMarket-Verifier/1.0"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                answers = data.get("Answer", [])
                for ans in answers:
                    if ans.get("type") == 16:
                        val = ans.get("data", "").strip('"')
                        txt_records.append(val)
        except Exception as e:
            logger.warning(f"Cloudflare DoH lookup failed for {domain}: {e}")

    return txt_records


def verify_domain_dns(domain: str, expected_token: str) -> tuple[bool, str, list[str]]:
    """
    Verifies if the required verification token exists in the TXT records of domain.
    Returns (is_verified, message, found_txt_records).
    """
    txt_records = perform_dns_txt_lookup(domain)
    target_value = f"automarket-verify={expected_token}"

    for rec in txt_records:
        if expected_token in rec or target_value in rec:
            return True, "Domain ownership verified successfully.", txt_records

    if not txt_records:
        return False, f"No TXT records found for domain '{domain}'. Please ensure your DNS records have propagated.", []

    return False, f"TXT record 'automarket-verify={expected_token}' was not found. Found TXT records: {', '.join(txt_records[:3])}", txt_records
