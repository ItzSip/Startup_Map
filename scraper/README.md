# Startup collection pipeline

This conservative review pipeline collects public company-level information. It does not bypass logins, CAPTCHAs, paywalls, robots rules, or anti-bot controls, and it never publishes directly to the public directory.

## Setup

```powershell
cd scraper
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Set `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. For geocoding, configure `GEOCODING_ENDPOINT` and `GEOCODING_API_KEY` for a provider whose terms suit your expected volume. The pipeline deliberately does not default to the public Nominatim endpoint.

## Run

Create `urls.txt` with one approved public company website per line, then:

```powershell
python main.py --source websites --input urls.txt --limit 25 --dry-run --export preview.json
python main.py --source all --input urls.txt --limit 25
```

Every stored record enters `pending_scraped_startups` with `review_status=pending`. Review, edit, and approve it in `/admin`; existing verified records are never overwritten by this collector.

## Controlled CSV import

CSV imports use the same manual review queue. Required columns are `name`, `website`, `industry`, and `source_url`. Optional columns are `description`, `address`, `neighbourhood`, `latitude`, `longitude`, `location_confirmed`, and `logo_url`.

Run validation first:

```powershell
python csv_import.py startups.csv
```

The validator rejects malformed URLs or coordinate pairs, detects duplicate company names and website domains, and flags missing, unconfirmed, or out-of-area locations. A row is only marked `location_verified` when it has valid Bangalore coordinates and `location_confirmed=true`.

After reviewing the report, enqueue valid rows:

```powershell
python csv_import.py startups.csv --commit
```

`--commit` requires the server-only `SUPABASE_SERVICE_ROLE_KEY`. Imported rows are always inserted as `pending`; the importer never creates or verifies a public startup record.
