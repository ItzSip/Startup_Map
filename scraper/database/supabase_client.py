import os
from supabase import create_client
from utils.deduplication import fingerprint

def save_pending(records: list[dict]) -> tuple[int, int]:
    url,key=os.getenv("SUPABASE_URL"),os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    client=create_client(url,key); inserted=skipped=0
    existing=client.table("startups").select("name,website").execute().data or []
    existing += client.table("pending_scraped_startups").select("name,website").neq("review_status","rejected").execute().data or []
    keys={fingerprint(item) for item in existing}
    for record in records:
        if fingerprint(record) in keys: skipped+=1; continue
        client.table("pending_scraped_startups").insert(record).execute(); keys.add(fingerprint(record)); inserted+=1
    return inserted,skipped
