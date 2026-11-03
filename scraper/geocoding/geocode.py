import os
import httpx

async def geocode(address: str | None) -> tuple[float, float] | None:
    """Uses an operator-configured HTTP endpoint; no public bulk endpoint is assumed."""
    endpoint, key = os.getenv("GEOCODING_ENDPOINT"), os.getenv("GEOCODING_API_KEY")
    if not address or not endpoint or not key: return None
    async with httpx.AsyncClient(timeout=15) as client:
        response=await client.get(endpoint,params={"q":address,"key":key,"limit":1})
        response.raise_for_status(); data=response.json()
        item=(data.get("features") or data.get("results") or [None])[0]
        if not item: return None
        coords=item.get("geometry",{}).get("coordinates") or [item.get("longitude"),item.get("latitude")]
        return (float(coords[1]),float(coords[0])) if coords[0] is not None else None
