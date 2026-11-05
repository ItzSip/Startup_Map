"""Validate a CSV and place accepted rows in the manual review queue."""

import argparse
import csv
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

from utils.deduplication import deduplicate
from utils.normalization import normalize_url


BANGALORE_BOUNDS = {
    "south": 12.65,
    "north": 13.25,
    "west": 77.30,
    "east": 78.10,
}
TRUE_VALUES = {"1", "true", "yes", "y"}


def required(row: dict[str, str], field: str) -> str:
    value = (row.get(field) or "").strip()
    if not value:
        raise ValueError(f"missing {field}")
    return value


def web_url(value: str, field: str) -> str:
    normalized = normalize_url(value)
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"invalid {field}")
    return normalized


def coordinates(row: dict[str, str]) -> tuple[float | None, float | None, bool, list[str]]:
    latitude_raw = (row.get("latitude") or "").strip()
    longitude_raw = (row.get("longitude") or "").strip()
    if bool(latitude_raw) != bool(longitude_raw):
        raise ValueError("latitude and longitude must be supplied together")
    if not latitude_raw:
        return None, None, False, ["location has no coordinates"]

    try:
        latitude, longitude = float(latitude_raw), float(longitude_raw)
    except ValueError as error:
        raise ValueError("coordinates must be numbers") from error
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("coordinates are outside valid latitude/longitude ranges")

    in_bangalore = (
        BANGALORE_BOUNDS["south"] <= latitude <= BANGALORE_BOUNDS["north"]
        and BANGALORE_BOUNDS["west"] <= longitude <= BANGALORE_BOUNDS["east"]
    )
    explicitly_confirmed = (row.get("location_confirmed") or "").strip().lower() in TRUE_VALUES
    warnings: list[str] = []
    if not in_bangalore:
        warnings.append("coordinates fall outside the Bangalore validation envelope")
    if not explicitly_confirmed:
        warnings.append("location_confirmed is not true")
    return latitude, longitude, in_bangalore and explicitly_confirmed, warnings


def validate_row(row: dict[str, str]) -> tuple[dict, list[str]]:
    name = required(row, "name")
    industry = required(row, "industry")
    website = web_url(required(row, "website"), "website")
    source_url = web_url(required(row, "source_url"), "source_url")
    latitude, longitude, location_verified, warnings = coordinates(row)
    return {
        "name": name,
        "website": website,
        "description": (row.get("description") or "").strip() or None,
        "industry": industry,
        "address": (row.get("address") or "").strip() or None,
        "neighbourhood": (row.get("neighbourhood") or "").strip() or None,
        "latitude": latitude,
        "longitude": longitude,
        "location_verified": location_verified,
        "logo_url": web_url(row["logo_url"], "logo_url") if (row.get("logo_url") or "").strip() else None,
        "source_url": source_url,
        "review_status": "pending",
    }, warnings


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate startup CSV rows and enqueue them for manual review",
    )
    parser.add_argument("csv_file", type=Path)
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Insert valid rows into pending_scraped_startups (default is a dry run)",
    )
    args = parser.parse_args()

    accepted: list[dict] = []
    rejected: list[tuple[int, str]] = []
    uncertain: list[tuple[int, list[str]]] = []
    with args.csv_file.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, start=2):
            try:
                record, warnings = validate_row(row)
                accepted.append(record)
                if warnings:
                    uncertain.append((row_number, warnings))
            except (KeyError, ValueError) as error:
                rejected.append((row_number, str(error)))

    unique = deduplicate(accepted)
    duplicate_count = len(accepted) - len(unique)
    print(
        f"validated={len(accepted)} rejected={len(rejected)} "
        f"csv_duplicates={duplicate_count} uncertain_locations={len(uncertain)}",
    )
    for row_number, reason in rejected:
        print(f"REJECT row {row_number}: {reason}")
    for row_number, warnings in uncertain:
        print(f"REVIEW row {row_number}: {'; '.join(warnings)}")

    if not args.commit:
        print("Dry run only. Re-run with --commit to add valid rows to the review queue.")
        return

    from database.supabase_client import save_pending

    inserted, database_duplicates = save_pending(unique)
    print(
        f"queued={inserted} database_duplicates={database_duplicates}; "
        "all inserted rows remain pending and unverified",
    )


if __name__ == "__main__":
    load_dotenv()
    main()
