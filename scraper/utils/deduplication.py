from .normalization import domain, normalize_name

def fingerprint(record: dict) -> tuple[str, str]:
    return normalize_name(record.get("name", "")), domain(record["website"]) if record.get("website") else ""

def deduplicate(records: list[dict]) -> list[dict]:
    seen, output = set(), []
    for record in records:
        key = fingerprint(record)
        if key in seen:
            continue
        seen.add(key)
        output.append(record)
    return output
