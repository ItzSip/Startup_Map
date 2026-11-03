import asyncio
from datetime import datetime, timezone
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from extractors import address, company_name, description, industry, logo
from utils.normalization import normalize_url

async def collect(urls: list[str], delay: float = 2.0) -> list[dict]:
    output=[]
    headers={"User-Agent":"BangaloreStartupAtlasBot/1.0 (+directory research; contact configured by operator)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=20) as client:
        for raw in urls:
            url=normalize_url(raw)
            try:
                response=await client.get(url)
                response.raise_for_status()
                if "text/html" not in response.headers.get("content-type", ""): continue
                soup=BeautifulSoup(response.text, "html.parser")
                desc=description.extract(soup)
                output.append({"name":company_name.extract(soup,urlparse(url).netloc),"website":str(response.url),"description":desc,"industry":industry.extract(f"{desc or ''} {soup.get_text(' ',strip=True)[:5000]}"),"address":address.extract(soup),"neighbourhood":None,"latitude":None,"longitude":None,"location_verified":False,"logo_url":logo.extract(soup,str(response.url)),"source_url":str(response.url),"collected_at":datetime.now(timezone.utc).isoformat()})
            except (httpx.HTTPError, ValueError) as error:
                print(f"WARN {url}: {error}")
            await asyncio.sleep(delay)
    return output
