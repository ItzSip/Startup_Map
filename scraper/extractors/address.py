import json
from bs4 import BeautifulSoup

def extract(soup: BeautifulSoup) -> str | None:
    for node in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(node.string or "{}")
            items = payload if isinstance(payload, list) else [payload]
            for item in items:
                address = item.get("address") if isinstance(item, dict) else None
                if isinstance(address, str): return address[:300]
                if isinstance(address, dict):
                    return ", ".join(str(address.get(k)) for k in ("streetAddress", "addressLocality", "addressRegion", "postalCode") if address.get(k))[:300]
        except (ValueError, TypeError):
            continue
    return None
