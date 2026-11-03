from bs4 import BeautifulSoup

def extract(soup: BeautifulSoup) -> str | None:
    for selector in ('meta[name="description"]', 'meta[property="og:description"]'):
        node = soup.select_one(selector)
        if node and node.get("content"):
            return str(node["content"]).strip()[:1200]
    return None
