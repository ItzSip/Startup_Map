# Bangalore Startup Atlas

A production-oriented Next.js 16 MVP for discovering verified Bangalore startups on a MapLibre map, reviewing community and scraper submissions, and selling four manually approved advertising placements through UPI.

## Included

- App Router, TypeScript, Tailwind CSS, MapLibre clustering, viewport queries, responsive dark design
- Database-backed counts, filtered/paginated directory, profile metadata, sitemap, robots rules, structured data
- Community startup submissions that remain private until admin approval
- UPI advertising requests with validated uploads, private payment proofs, public creative assets, unique submission IDs, and an honest WhatsApp handoff
- Supabase Auth admin gate, database RLS, private signed screenshots, payment verification separate from ad publication, four manual slots, audit logs
- Modular Python collector with rate limiting, retries through `httpx`, deduplication, optional configured geocoder, export, dry-run, and a mandatory review queue

## Local setup

Requirements: Node.js 20.9+ and a Supabase project.

```powershell
npm install
Copy-Item .env.example .env.local
```

Fill `.env.local`. Never expose `SUPABASE_SERVICE_ROLE_KEY` or commit `.env.local`.

Apply [the initial migration](supabase/migrations/202611030001_initial_atlas.sql) with the Supabase CLI or SQL editor. The migration creates tables, four ad slots, indexes, constraints, RLS policies, and the public `startup-assets` and private `payment-proofs` buckets. If the initial migration was applied before the bucket rename, apply [the compatibility migration](supabase/migrations/202611040001_startup_assets_bucket.sql) once as well.

Create the first admin user in Supabase Auth, then set trusted app metadata from a secure server or the dashboard:

```json
{ "role": "admin" }
```

Authorization intentionally reads `app_metadata`, not user-editable metadata. Refresh the user session after changing the role.

In the Supabase Dashboard, create the user under **Authentication → Users**, open the user, and set the raw app metadata to the JSON above. Do not put the role in user metadata. Sign out and back in after saving, then confirm a non-admin account receives a forbidden response from admin actions.

```powershell
npm run dev
```

No production data is fabricated. [supabase/seed.sql](supabase/seed.sql) contains one clearly fictional development-only marker and must not be run in production.

## Production checks

```powershell
npm run typecheck
npm run lint
npm run build
```

Before release, test public queries, submissions, allowed/blocked upload types, private screenshot access, admin sign-in, payment approval, separate slot assignment, pause/remove, expiration, mobile map gestures, and empty/error states against a staging Supabase project.

## Vercel deployment

1. Import this repository in Vercel and select Next.js.
2. Configure every variable from `.env.example` for the appropriate environments. Keep the service-role key server-only.
3. Apply the Supabase migration before promoting the application.
4. Deploy a preview, execute the checks above and the end-to-end admin/payment flow, then promote the tested production build.
5. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin and rebuild so canonical metadata and sitemap URLs are correct.

## Production environment checklist

- Set every variable from `.env.example` in Vercel Production; use the final HTTPS origin for `NEXT_PUBLIC_SITE_URL`.
- Use the Supabase publishable key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use the Supabase secret key only for `SUPABASE_SERVICE_ROLE_KEY`; never expose it as `NEXT_PUBLIC_*`.
- Set `NEXT_PUBLIC_UPI_ID`, `NEXT_PUBLIC_UPI_NAME`, and `NEXT_PUBLIC_UPI_QR_URL` to the production payee and an HTTPS QR image URL.
- Set `ADMIN_WHATSAPP_NUMBER` in international format without a leading `+`.
- Apply each database migration once, verify both bucket access modes, then run the end-to-end payment/admin tests before promoting production.
- Do not run `supabase/seed.sql` in production.

A live deployment is not created by this repository alone: Vercel and Supabase project access, credentials, UPI details, QR asset, and the WhatsApp number must be supplied by the owner.

## Scraper

See [scraper/README.md](scraper/README.md). It only collects public company-level information and cannot publish records without an explicit admin review.
