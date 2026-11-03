import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { INDUSTRIES, NEIGHBOURHOODS } from "@/lib/constants";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { deleteStartup, saveStartup } from "../actions";
export const metadata: Metadata = {
  title: "Manage Startups",
  robots: { index: false, follow: false },
};
export default async function ManageStartups() {
  if (!(await requireAdmin())) redirect("/admin");
  const db = createAdminClient(),
    { data: startups } = await db
      .from("startups")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
  return (
    <div className="shell pt-12">
      <Link href="/admin" className="text-sm text-muted hover:text-white">
        Back to dashboard
      </Link>
      <div className="mt-5">
        <p className="eyebrow">Directory operations</p>
        <h1 className="mt-2 text-4xl font-semibold">Manage startups</h1>
        <p className="mt-2 text-muted">
          Create curated records manually, edit coordinates and verification, or
          remove incorrect records.
        </p>
      </div>
      <section className="mt-9">
        <h2 className="mb-4 text-xl font-semibold">Add startup</h2>
        <StartupForm />
      </section>
      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Recent records</h2>
        <div className="grid gap-4">
          {(startups ?? []).map((s) => (
            <details className="panel rounded-xl p-5" key={s.id}>
              <summary className="cursor-pointer font-semibold">
                {s.name}{" "}
                <span className="ml-2 text-xs font-normal text-muted">
                  {s.verified ? "verified" : "hidden"} ·{" "}
                  {s.neighbourhood || "No location"}
                </span>
              </summary>
              <div className="mt-5">
                <StartupForm startup={s} />
                <form action={deleteStartup} className="mt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn border border-red-400/30 bg-red-400/10 py-2 text-sm text-red-200">
                    Delete incorrect record
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
type RecordData = {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  industry: string;
  address: string | null;
  neighbourhood: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
};
function StartupForm({ startup }: { startup?: RecordData }) {
  return (
    <form action={saveStartup} className="panel grid gap-4 rounded-xl p-5">
      {startup && <input type="hidden" name="id" value={startup.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="name"
          label="Company name"
          value={startup?.name}
          required
        />
        <Field
          name="website"
          label="Website"
          type="url"
          value={startup?.website}
          required
        />
        <label className="text-sm">
          Industry
          <select
            className="field mt-2"
            name="industry"
            defaultValue={startup?.industry ?? "Other"}
          >
            {INDUSTRIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Neighbourhood
          <select
            className="field mt-2"
            name="neighbourhood"
            defaultValue={startup?.neighbourhood ?? "Other"}
          >
            {NEIGHBOURHOODS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Field name="address" label="Address" value={startup?.address} />
        <Field
          name="logo_url"
          label="Logo URL"
          type="url"
          value={startup?.logo_url}
        />
        <Field
          name="latitude"
          label="Latitude"
          type="number"
          step="any"
          value={startup?.latitude}
        />
        <Field
          name="longitude"
          label="Longitude"
          type="number"
          step="any"
          value={startup?.longitude}
        />
      </div>
      <label className="text-sm">
        Description
        <textarea
          className="field mt-2 min-h-24"
          name="description"
          defaultValue={startup?.description ?? ""}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="verified"
          defaultChecked={startup?.verified}
        />
        Publish as verified
      </label>
      <button className="btn btn-primary w-fit">
        {startup ? "Save changes" : "Create startup"}
      </button>
    </form>
  );
}
function Field({
  name,
  label,
  type = "text",
  value,
  required,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number | null;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        className="field mt-2"
        name={name}
        type={type}
        step={step}
        defaultValue={value ?? ""}
        required={required}
      />
    </label>
  );
}
