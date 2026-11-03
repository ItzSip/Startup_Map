import type { Metadata } from "next";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  LogOut,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { AdminLogin } from "@/components/admin-login";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env";
import {
  createAdminClient,
  createClient,
  requireAdmin,
} from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import {
  assignAdvertisement,
  extendAdvertisement,
  reviewScrapedStartup,
  reviewStartupSubmission,
  setAdvertisementStatus,
  setPaymentStatus,
  signOut,
} from "./actions";
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  if (!hasPublicSupabaseEnv())
    return (
      <div className="shell pt-16">
        <div className="panel rounded-xl p-8">
          <h1 className="text-2xl font-semibold">
            Supabase configuration required
          </h1>
          <p className="mt-3 text-muted">
            Add the variables from .env.example, apply the migration, and create
            an admin user before using this dashboard.
          </p>
        </div>
      </div>
    );
  const auth = await createClient(),
    {
      data: { user },
    } = await auth.auth.getUser();
  if (!user)
    return (
      <div className="shell">
        <AdminLogin />
      </div>
    );
  const admin = await requireAdmin();
  if (!admin)
    return (
      <div className="shell pt-20">
        <div className="panel rounded-xl p-8">
          <ShieldAlert className="text-red-300" />
          <h1 className="mt-4 text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted">
            This authenticated account does not have the admin role.
          </p>
          <form action={signOut}>
            <button className="btn btn-secondary mt-6">Sign out</button>
          </form>
        </div>
      </div>
    );
  const db = createAdminClient(),
    now = new Date().toISOString();
  const [
    { count: total },
    { count: verified },
    { count: pending },
    { count: active },
    { count: payments },
    { count: expired },
    { data: requests },
    { data: submissions },
    { data: slots },
    { data: ads },
    { data: scraped },
  ] = await Promise.all([
    db.from("startups").select("id", { count: "exact", head: true }),
    db
      .from("startups")
      .select("id", { count: "exact", head: true })
      .eq("verified", true),
    db
      .from("startup_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gt("expires_at", now),
    db
      .from("advertisement_requests")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "pending_verification"),
    db
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .lt("expires_at", now),
    db
      .from("advertisement_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("startup_submissions")
      .select("*")
      .eq("status", "pending")
      .order("created_at"),
    db
      .from("advertisement_slots")
      .select("*")
      .eq("is_enabled", true)
      .order("slot_number"),
    db
      .from("advertisements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("pending_scraped_startups")
      .select("*")
      .eq("review_status", "pending")
      .order("created_at")
      .limit(30),
  ]);
  const verifiedRequests = (requests ?? []).filter(
      (x) => x.payment_status === "payment_verified",
    ),
    activeSlots = new Set(
      (ads ?? [])
        .filter((x) => x.status === "active" && x.expires_at > now)
        .map((x) => x.slot_id),
    ),
    cards = [
      { n: total, label: "Total", icon: <BarChart3 size={16} /> },
      { n: verified, label: "Verified", icon: <CheckCircle2 size={16} /> },
      { n: pending, label: "Submissions", icon: <Clock3 size={16} /> },
      { n: active, label: "Active ads", icon: <ImageIcon size={16} /> },
      {
        n: (slots?.length ?? 0) - activeSlots.size,
        label: "Open slots",
        icon: <MapPin size={16} />,
      },
      { n: payments, label: "Payments", icon: <Clock3 size={16} /> },
      { n: expired, label: "Expired", icon: <Clock3 size={16} /> },
    ];
  return (
    <div className="shell pt-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Private operations</p>
          <h1 className="mt-2 text-4xl font-semibold">Atlas administration</h1>
        </div>
        <div className="flex gap-2">
          <a href="/admin/startups" className="btn btn-secondary py-2 text-sm">
            Manage startups
          </a>
          <form action={signOut}>
            <button className="btn btn-secondary py-2 text-sm">
              <LogOut size={16} />
              Sign out
            </button>
          </form>
        </div>
      </div>
      <section className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {cards.map(({ n, label, icon }) => (
          <div className="panel rounded-lg p-4" key={label}>
            <span className="text-accent">{icon}</span>
            <p className="mt-3 text-2xl font-semibold">{n ?? 0}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>
      <Section title="Payment verification">
        <div className="grid gap-3">
          {(requests ?? []).map((r) => (
            <article
              className="rounded-lg border border-line bg-surface p-5"
              key={r.id}
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.company_name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {r.id} · {formatDate(r.created_at)}
                  </p>
                </div>
                <span className="text-xs text-accent">{r.payment_status}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted md:grid-cols-3">
                <p>
                  {r.company_email}
                  <br />
                  {r.contact_phone}
                </p>
                <p>
                  {r.package_type} · ₹{r.amount?.toLocaleString("en-IN")}
                  <br />
                  Ref: {r.transaction_reference}
                </p>
                <p>{r.verification_notes || "No verification notes"}</p>
              </div>
              {r.payment_screenshot_url && (
                <SignedProof path={r.payment_screenshot_url} />
              )}
              <form
                action={setPaymentStatus}
                className="mt-4 flex flex-wrap gap-2"
              >
                <input type="hidden" name="id" value={r.id} />
                <input
                  className="field max-w-xs py-2 text-sm"
                  name="notes"
                  placeholder="Verification notes"
                />
                <button
                  name="status"
                  value="payment_verified"
                  className="btn btn-primary py-2 text-xs"
                >
                  Approve payment
                </button>
                <button
                  name="status"
                  value="needs_information"
                  className="btn btn-secondary py-2 text-xs"
                >
                  Request info
                </button>
                <button
                  name="status"
                  value="rejected"
                  className="btn btn-secondary py-2 text-xs"
                >
                  Reject
                </button>
              </form>
            </article>
          ))}
        </div>
      </Section>
      <Section title="Advertisement slots">
        <form
          action={assignAdvertisement}
          className="panel mb-5 grid gap-3 rounded-lg p-4 md:grid-cols-[1fr_1fr_auto]"
        >
          <select name="request_id" className="field" required>
            <option value="">Payment-verified request</option>
            {verifiedRequests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.company_name} · {r.package_type}
              </option>
            ))}
          </select>
          <select name="slot_id" className="field" required>
            <option value="">Select slot</option>
            {(slots ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                Slot {s.slot_number} · {s.slot_name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">Assign advertisement</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {(slots ?? []).map((slot) => {
            const ad = (ads ?? []).find(
              (x) => x.slot_id === slot.id && x.status === "active",
            );
            return (
              <article className="panel rounded-lg p-5" key={slot.id}>
                <p className="text-xs text-accent">Slot {slot.slot_number}</p>
                <h3 className="mt-1 font-semibold">{slot.slot_name}</h3>
                {ad ? (
                  <>
                    <p className="mt-4 text-sm">{ad.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      Expires {formatDate(ad.expires_at)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={setAdvertisementStatus} className="flex gap-2">
                        <input type="hidden" name="id" value={ad.id} />
                        <button name="status" value="paused" className="btn btn-secondary py-2 text-xs">Pause</button>
                        <button name="status" value="removed" className="btn btn-secondary py-2 text-xs">Remove</button>
                      </form>
                      <form action={extendAdvertisement}>
                        <input type="hidden" name="id" value={ad.id} />
                        <button name="hours" value="24" className="btn btn-secondary py-2 text-xs">Extend 24h</button>
                      </form>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-muted">Available</p>
                )}
              </article>
            );
          })}
        </div>
      </Section>
      <Section title="Startup submissions">
        <ReviewList
          items={submissions ?? []}
          action={reviewStartupSubmission}
        />
      </Section>
      <Section title="Scraper review queue">
        <ReviewList items={scraped ?? []} action={reviewScrapedStartup} />
      </Section>
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="mb-5 text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
type ReviewItem = {
  id: string;
  name: string;
  industry: string | null;
  neighbourhood: string | null;
  website: string | null;
  description: string | null;
  source_url?: string | null;
};
function ReviewList({
  items,
  action,
}: {
  items: ReviewItem[];
  action: (form: FormData) => Promise<void>;
}) {
  if (!items.length)
    return (
      <div className="panel rounded-lg p-6 text-sm text-muted">
        Nothing is waiting for review.
      </div>
    );
  return (
    <div className="grid gap-3">
      {items.map((x) => (
        <article className="panel rounded-lg p-5" key={x.id}>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-semibold">{x.name}</h3>
              <p className="mt-1 text-xs text-accent">
                {x.industry} · {x.neighbourhood || "Unknown location"}
              </p>
            </div>
            {x.website && (
              <a
                href={x.website}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent"
              >
                Inspect website ↗
              </a>
            )}
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
            {x.description}
          </p>
          {x.source_url && (
            <p className="mt-2 text-xs text-muted">Source: {x.source_url}</p>
          )}
          <form action={action} className="mt-4 flex gap-2">
            <input type="hidden" name="id" value={x.id} />
            <button
              name="decision"
              value="approve"
              className="btn btn-primary py-2 text-xs"
            >
              Approve
            </button>
            <button
              name="decision"
              value="reject"
              className="btn btn-secondary py-2 text-xs"
            >
              Reject
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
async function SignedProof({ path }: { path: string }) {
  const db = createAdminClient(),
    { data } = await db.storage
      .from("payment-proofs")
      .createSignedUrl(path, 300);
  return data?.signedUrl ? (
    <a
      href={data.signedUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-block text-sm text-accent"
    >
      View private payment screenshot ↗
    </a>
  ) : (
    <p className="mt-3 text-xs text-red-300">Screenshot unavailable</p>
  );
}
