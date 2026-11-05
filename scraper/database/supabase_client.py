import os
from supabase import create_client
from utils.deduplication import fingerprint

def save_pending(records: list[dict]) -> tuple[int, int]:
    url,key=os.getenv("SUPABASE_URL"),os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    client=create_client(url,key); inserted=skipped=0
    existing=client.table("startups").select("name,website").execute().data or []
    existing += client.table("pending_scraped_startups").select("name,website").neq("review_status","rejected").execute().data or []
    existing_fingerprints=[fingerprint(item) for item in existing]
    names={name for name,_ in existing_fingerprints}
    domains={website for _,website in existing_fingerprints if website}
    for record in records:
        name,website=fingerprint(record)
        if name in names or (website and website in domains): skipped+=1; continue
        client.table("pending_scraped_startups").insert(record).execute()
        names.add(name)
        if website: domains.add(website)
        inserted+=1
    return inserted,skipped
