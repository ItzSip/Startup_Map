from .normalization import domain, normalize_name

def fingerprint(record: dict) -> tuple[str, str]:
    return normalize_name(record.get("name", "")), domain(record["website"]) if record.get("website") else ""

def deduplicate(records: list[dict]) -> list[dict]:
    seen_names, seen_domains, output = set(), set(), []
    for record in records:
        name, website_domain = fingerprint(record)
        if name in seen_names or (website_domain and website_domain in seen_domains):
            continue
        seen_names.add(name)
        if website_domain:
            seen_domains.add(website_domain)
        output.append(record)
    return output
