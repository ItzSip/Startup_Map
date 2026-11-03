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

Apply [the initial migration](supabase/migrations/202611030001_initial_atlas.sql) with the Supabase CLI or SQL editor. The migration creates tables, four ad slots, indexes, constraints, RLS policies, and the `public-assets` and private `payment-proofs` buckets.

Create the first admin user in Supabase Auth, then set trusted app metadata from a secure server or the dashboard:

```json
{ "role": "admin" }
```

Authorization intentionally reads `app_metadata`, not user-editable metadata. Refresh the user session after changing the role.

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

A live deployment is not created by this repository alone: Vercel and Supabase project access, credentials, UPI details, QR asset, and the WhatsApp number must be supplied by the owner.

## Scraper

See [scraper/README.md](scraper/README.md). It only collects public company-level information and cannot publish records without an explicit admin review.
