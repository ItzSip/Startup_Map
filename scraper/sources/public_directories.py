"""Adapter point for approved public directories.

Add a source only after reviewing its terms and robots.txt. It must return the
same record shape as company_websites.collect and must not bypass access controls.
"""
async def collect(limit: int = 50) -> list[dict]:
    return []
