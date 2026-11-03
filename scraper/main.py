import argparse, asyncio, json, logging
from pathlib import Path
from dotenv import load_dotenv
from database.supabase_client import save_pending
from geocoding.geocode import geocode
from sources import company_websites, public_directories
from utils.deduplication import deduplicate
from utils.validation import valid_record

async def run(args):
    urls=[]
    if args.input: urls=[line.strip() for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]
    records=[]
    if args.source in {"websites","all"}: records += await company_websites.collect(urls[:args.limit],args.delay)
    if args.source in {"directories","all"}: records += await public_directories.collect(args.limit)
    records=deduplicate([r for r in records if valid_record(r)])[:args.limit]
    for record in records:
        point=await geocode(record.get("address"))
        if point: record["latitude"],record["longitude"],record["location_verified"]=*point,True
    if args.export: Path(args.export).write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding="utf-8")
    if not args.dry_run:
        inserted,skipped=save_pending(records); print(f"Collected {len(records)} · inserted {inserted} · duplicates skipped {skipped}")
    else: print(f"Collected {len(records)} valid records (dry run)")

if __name__=="__main__":
    load_dotenv(); logging.basicConfig(filename="scraper.log",level=logging.INFO)
    parser=argparse.ArgumentParser(description="Collect public company-level startup records for manual review")
    parser.add_argument("--source",choices=["websites","directories","all"],default="all");parser.add_argument("--input",help="Text file containing one company URL per line");parser.add_argument("--limit",type=int,default=50);parser.add_argument("--delay",type=float,default=2.0);parser.add_argument("--export",help="Optional JSON export path");parser.add_argument("--dry-run",action="store_true")
    asyncio.run(run(parser.parse_args()))
