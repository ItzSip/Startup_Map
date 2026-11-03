from bs4 import BeautifulSoup

def extract(soup: BeautifulSoup, fallback: str) -> str:
    og = soup.select_one('meta[property="og:site_name"]')
    if og and og.get("content"):
        return str(og["content"]).strip()
    if soup.title and soup.title.string:
        return soup.title.string.split("|")[0].split("—")[0].strip()
    return fallback
