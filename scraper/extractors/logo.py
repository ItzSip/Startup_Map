from urllib.parse import urljoin
from bs4 import BeautifulSoup

def extract(soup: BeautifulSoup, base_url: str) -> str | None:
    for selector in ('meta[property="og:image"]', 'link[rel~="icon"]'):
        node = soup.select_one(selector)
        value = node.get("content") if node and node.name == "meta" else node.get("href") if node else None
        if value:
            return urljoin(base_url, str(value))
    return None
