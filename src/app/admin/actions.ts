"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AD_PACKAGES, type PackageType } from "@/lib/constants";
import {
  createAdminClient,
  createClient,
  requireAdmin,
} from "@/lib/supabase/server";
async function context() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  return { admin, db: createAdminClient() };
}
async function audit(
  db: ReturnType<typeof createAdminClient>,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  await db
    .from("admin_audit_logs")
    .insert({
      admin_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
}
export async function setPaymentStatus(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id")),
    status = String(form.get("status")),
    notes = String(form.get("notes") ?? "");
  if (!["payment_verified", "rejected", "needs_information"].includes(status))
    throw new Error("Invalid status");
  const { error } = await db
    .from("advertisement_requests")
    .update({ payment_status: status, verification_notes: notes || null })
    .eq("id", id);
  if (error) throw error;
  await audit(db, admin.id, `payment_${status}`, "advertisement_request", id, {
    notes,
  });
  revalidatePath("/admin");
}
export async function assignAdvertisement(form: FormData) {
  const { admin, db } = await context(),
    requestId = String(form.get("request_id")),
    slotId = String(form.get("slot_id"));
  const { data: req } = await db
    .from("advertisement_requests")
    .select("*")
    .eq("id", requestId)
    .eq("payment_status", "payment_verified")
    .single();
  if (!req) throw new Error("Request is not payment verified");
  const pkg = AD_PACKAGES[req.package_type as PackageType];
  if (!pkg) throw new Error("Invalid package");
  const starts = new Date(),
    expires = new Date(starts.getTime() + pkg.durationHours * 3600000);
  await db
    .from("advertisements")
    .update({ status: "replaced" })
    .eq("slot_id", slotId)
    .eq("status", "active");
  const { data: ad, error } = await db
    .from("advertisements")
    .insert({
      request_id: req.id,
      slot_id: slotId,
      title: req.company_name,
      description: req.description,
      image_url: req.promotional_image_url || req.logo_url,
      website_url: req.company_website,
      starts_at: starts.toISOString(),
      expires_at: expires.toISOString(),
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw error;
  await audit(db, admin.id, "advertisement_assigned", "advertisement", ad.id, {
    request_id: requestId,
    slot_id: slotId,
  });
  revalidatePath("/admin");
  revalidatePath("/");
}
export async function setAdvertisementStatus(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id")),
    status = String(form.get("status"));
  if (!["active", "paused", "removed"].includes(status))
    throw new Error("Invalid status");
  await db.from("advertisements").update({ status }).eq("id", id);
  await audit(db, admin.id, `advertisement_${status}`, "advertisement", id);
  revalidatePath("/admin");
  revalidatePath("/");
}
export async function extendAdvertisement(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id")),
    hours = Number(form.get("hours"));
  if (![24, 168].includes(hours)) throw new Error("Invalid extension");
  const { data: ad } = await db
    .from("advertisements")
    .select("expires_at")
    .eq("id", id)
    .single();
  if (!ad) throw new Error("Advertisement not found");
  const base = Math.max(Date.now(), new Date(ad.expires_at).getTime()),
    expiresAt = new Date(base + hours * 3600000).toISOString();
  await db
    .from("advertisements")
    .update({ expires_at: expiresAt, status: "active" })
    .eq("id", id);
  await audit(db, admin.id, "advertisement_extended", "advertisement", id, {
    hours,
    expires_at: expiresAt,
  });
  revalidatePath("/admin");
  revalidatePath("/");
}
export async function saveStartup(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id") ?? ""),
    name = String(form.get("name") ?? "").trim(),
    website = String(form.get("website") ?? "").trim(),
    description = String(form.get("description") ?? "").trim(),
    industry = String(form.get("industry") ?? "Other"),
    address = String(form.get("address") ?? "").trim(),
    neighbourhood = String(form.get("neighbourhood") ?? "Other"),
    logoUrl = String(form.get("logo_url") ?? "").trim(),
    latRaw = String(form.get("latitude") ?? ""),
    lngRaw = String(form.get("longitude") ?? "");
  if (name.length < 2 || !/^https?:\/\//.test(website))
    throw new Error("Valid name and website are required");
  const latitude = latRaw === "" ? null : Number(latRaw),
    longitude = lngRaw === "" ? null : Number(lngRaw);
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null &&
      (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude === null ||
        longitude < -180 ||
        longitude > 180))
  )
    throw new Error("Invalid coordinates");
  const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    payload = {
      name,
      slug,
      website,
      description: description || null,
      industry,
      address: address || null,
      neighbourhood,
      logo_url: logoUrl || null,
      latitude,
      longitude,
      location_verified: latitude !== null,
      verified: form.get("verified") === "on",
    };
  let entityId = id;
  if (id) {
    const { error } = await db.from("startups").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from("startups")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    entityId = data.id;
  }
  await audit(
    db,
    admin.id,
    id ? "startup_updated" : "startup_created",
    "startup",
    entityId,
  );
  revalidatePath("/admin");
  revalidatePath("/startups");
  revalidatePath(`/startups/${slug}`);
}
export async function deleteStartup(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id"));
  const { error } = await db.from("startups").delete().eq("id", id);
  if (error) throw error;
  await audit(db, admin.id, "startup_deleted", "startup", id);
  revalidatePath("/admin");
  revalidatePath("/startups");
}
export async function reviewStartupSubmission(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id")),
    decision = String(form.get("decision"));
  const { data: s } = await db
    .from("startup_submissions")
    .select("*")
    .eq("id", id)
    .single();
  if (!s) throw new Error("Submission not found");
  if (decision === "approve") {
    const slug = s.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    await db
      .from("startups")
      .upsert(
        {
          name: s.name,
          slug,
          website: s.website,
          description: s.description,
          industry: s.industry,
          address: s.address,
          neighbourhood: s.neighbourhood,
          logo_url: s.logo_url,
          verified: true,
          location_verified: false,
        },
        { onConflict: "slug" },
      );
    await db
      .from("startup_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
      })
      .eq("id", id);
  } else
    await db
      .from("startup_submissions")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
      })
      .eq("id", id);
  await audit(
    db,
    admin.id,
    `startup_submission_${decision}`,
    "startup_submission",
    id,
  );
  revalidatePath("/admin");
  revalidatePath("/startups");
}
export async function reviewScrapedStartup(form: FormData) {
  const { admin, db } = await context(),
    id = String(form.get("id")),
    decision = String(form.get("decision"));
  const { data: s } = await db
    .from("pending_scraped_startups")
    .select("*")
    .eq("id", id)
    .single();
  if (!s) throw new Error("Record not found");
  if (decision === "approve") {
    const slug = s.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    await db
      .from("startups")
      .upsert(
        {
          name: s.name,
          slug,
          website: s.website,
          description: s.description,
          industry: s.industry,
          address: s.address,
          neighbourhood: s.neighbourhood,
          latitude: s.latitude,
          longitude: s.longitude,
          location_verified: s.location_verified,
          logo_url: s.logo_url,
          source_url: s.source_url,
          verified: true,
        },
        { onConflict: "slug" },
      );
  }
  await db
    .from("pending_scraped_startups")
    .update({ review_status: decision === "approve" ? "approved" : "rejected" })
    .eq("id", id);
  await audit(
    db,
    admin.id,
    `scraped_startup_${decision}`,
    "pending_scraped_startup",
    id,
  );
  revalidatePath("/admin");
  revalidatePath("/startups");
}
export async function signOut() {
  const s = await createClient();
  await s.auth.signOut();
  redirect("/admin");
}
