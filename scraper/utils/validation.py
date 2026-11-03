from urllib.parse import urlparse

def valid_record(record: dict) -> bool:
    website = record.get("website", "")
    return bool(record.get("name") and record.get("source_url") and urlparse(website).scheme in {"http", "https"})
