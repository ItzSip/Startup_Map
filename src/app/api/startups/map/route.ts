import { NextRequest, NextResponse } from "next/server";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Startup } from "@/lib/types";

const finite = (value: string | null, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export async function GET(request: NextRequest) {
  if (!hasPublicSupabaseEnv()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[map-api] Public Supabase environment variables are missing");
    }
    return NextResponse.json(
      { error: "Map data is not configured" },
      { status: 503 },
    );
  }

  const params = request.nextUrl.searchParams;
  const west = finite(params.get("west"), 77.3);
  const east = finite(params.get("east"), 77.9);
  const south = finite(params.get("south"), 12.7);
  const north = finite(params.get("north"), 13.2);
  const q = (params.get("q") ?? "").slice(0, 80).replace(/[%_,()]/g, "");
  const industry = (params.get("industry") ?? "").slice(0, 60);
  const neighbourhood = (params.get("neighbourhood") ?? "").slice(0, 60);

  if (west >= east || south >= north) {
    return NextResponse.json({ error: "Invalid map bounds" }, { status: 400 });
  }

  const supabase = await createClient();
  let query = supabase
    .from("startups")
    .select(
      "id,name,slug,description,website,logo_url,industry,address,neighbourhood,latitude,longitude,location_verified,verified",
    )
    .eq("verified", true)
    .eq("location_verified", true)
    .gte("longitude", west)
    .lte("longitude", east)
    .gte("latitude", south)
    .lte("latitude", north)
    .limit(500);

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,description.ilike.%${q}%,industry.ilike.%${q}%,neighbourhood.ilike.%${q}%`,
    );
  }
  if (industry) query = query.eq("industry", industry);
  if (neighbourhood) query = query.eq("neighbourhood", neighbourhood);

  const now = new Date().toISOString();
  const [{ data, error }, { data: advertisements, error: advertisementError }] =
    await Promise.all([
      query,
      supabase
        .from("advertisements")
        .select("startup_id")
        .eq("status", "active")
        .lte("starts_at", now)
        .gt("expires_at", now),
    ]);

  if (error) {
    console.error("[map-api] Supabase startup query failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "Unable to load map data" }, { status: 503 });
  }
  if (advertisementError && process.env.NODE_ENV === "development") {
    console.warn("[map-api] Featured startup query failed", {
      code: advertisementError.code,
      message: advertisementError.message,
    });
  }

  const startups = (data ?? []) as Startup[];
  const featured = new Set((advertisements ?? []).map((item) => item.startup_id));
  const features = startups
    .filter((startup) => startup.latitude != null && startup.longitude != null)
    .map((startup) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [startup.longitude!, startup.latitude!],
      },
      properties: { id: startup.id, featured: featured.has(startup.id) },
    }));

  const body = {
    startups,
    features,
    ...(process.env.NODE_ENV === "development"
      ? {
          diagnostics: {
            bounds: { west, south, east, north },
            filters: { q, industry, neighbourhood },
            resultCount: features.length,
          },
        }
      : {}),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "X-Atlas-Result-Count": String(features.length),
    },
  });
}
