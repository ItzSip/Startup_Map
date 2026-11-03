import re
from urllib.parse import urlparse

def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold().replace("private limited", "").replace("pvt ltd", ""))

def normalize_url(value: str) -> str:
    value = value.strip()
    if not value.startswith(("http://", "https://")):
        value = "https://" + value
    parsed = urlparse(value)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}"

def domain(value: str) -> str:
    return urlparse(normalize_url(value)).netloc.removeprefix("www.").lower()
