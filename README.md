# Situational Awareness Portfolio Tracker

A free-to-host research dashboard for the publicly disclosed SEC filings of **Situational Awareness LP** (CIK `0002045724`). It imports official EDGAR submissions, parses 13F information tables, compares report-period quantities, and presents current and historical disclosures without implying that positions remain held today.

## Architecture

- **Next.js App Router + TypeScript + Tailwind CSS**: server-rendered dashboard, portfolio, filing history, changes, and protected revalidation route.
- **Supabase PostgreSQL**: filing state, positions, quantity-change ledger, ticker mappings, RLS, and transactional ingestion functions.
- **Python**: SEC submissions/index retrieval, XML discovery and parsing, historical import, and polling.
- **GitHub Actions**: polling every 30 minutes plus manual runs.
- **Vercel**: frontend hosting and tag/path revalidation after successful ingestion.

The browser never receives the Supabase service-role key. All database reads occur in Server Components. RLS is enabled with no `anon` or `authenticated` policies, intentionally making these tables server-only in this MVP.

## Local Setup

Prerequisites: Node.js 20+, Python 3.11+, a Supabase project, and a descriptive SEC User-Agent containing a contact address.

```bash
git clone <repository-url>
cd situational-awareness-portfolio-tracker
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. The application intentionally shows empty states until official filings are imported. `.env` and `.env.local` are ignored by Git.

## Supabase Setup

1. Create a free Supabase project.
2. Open the SQL Editor and run [`supabase/migrations/20260712000000_initial_schema.sql`](supabase/migrations/20260712000000_initial_schema.sql), or use the CLI:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

3. Copy the Project URL and `service_role` key from Supabase project settings into the server and job environments.

The migration creates `managers`, `filings`, `positions`, `position_changes`, and `ticker_mappings`, seeds only the manager identity, enables RLS, and grants ingestion RPCs only to `service_role`. `process_13f_filing` is one PostgreSQL transaction: it upserts the accession, replaces its positions, computes changes, and only then marks the filing processed.

## Environment Variables

| Variable | Used by | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Next.js, Python | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js server, Python | Privileged server-only key; never use `NEXT_PUBLIC_` |
| `SEC_USER_AGENT` | Python | Identifying product and contact, e.g. `SA Tracker ops@example.com` |
| `REVALIDATION_URL` | Python | Deployed `/api/revalidate` URL |
| `REVALIDATION_SECRET` | Next.js, Python | Long random bearer secret |

Generate a revalidation secret with `openssl rand -hex 32`.

## Import and Polling

Preview the complete available 13F history without database writes or filing downloads:

```bash
source .venv/bin/activate
python -m scripts.import_history --dry-run
```

Import all available 13Fs oldest to newest:

```bash
python -m scripts.import_history
```

Run one incremental poll, including timeline discovery for tracked Schedule 13D/13G forms:

```bash
python -m scripts.poll_sec
```

Both jobs are safe to rerun. Processed accessions are skipped, accession numbers are unique, and a reprocessed filing replaces its position/change rows transactionally. Failed work remains in `filings` with a bounded error message.

## GitHub Actions

The workflow is [`.github/workflows/poll-sec.yml`](.github/workflows/poll-sec.yml). Add these repository secrets under **Settings > Secrets and variables > Actions**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SEC_USER_AGENT`
- `REVALIDATION_URL`
- `REVALIDATION_SECRET`

The workflow uses a concurrency group to prevent overlapping pollers. Trigger the first run manually from the Actions tab after secrets are configured. GitHub schedules are best-effort and may run later than the exact cron minute.

## Vercel Deployment

1. Import the repository into Vercel with the Next.js preset.
2. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `REVALIDATION_SECRET` to Production, Preview, and Development as appropriate.
3. Deploy.
4. Set the GitHub `REVALIDATION_URL` secret to `https://<your-domain>/api/revalidate` and use the same `REVALIDATION_SECRET` in both systems.
5. Run the historical import locally or manually trigger the Action.

The route requires `Authorization: Bearer <REVALIDATION_SECRET>` and invalidates Dashboard, Portfolio, Filings, and Changes cache tags and paths.

## SEC Fair Access

The client uses only official `data.sec.gov` submissions and `sec.gov/Archives` resources. It requires an identifying User-Agent, spaces requests to remain below SEC request-rate guidance, and retries transient errors with exponential backoff. Do not run several importers concurrently. See the SEC's current fair-access policy before increasing poll frequency or request volume.

For each filing, ingestion builds the archive directory from the numeric CIK and accession number, downloads `index.json`, and examines XML candidates for an information table. It does not guess a filename or use an LLM. XML parsing disables unsafe entities and matches elements by local name to tolerate namespaces. Standard 13F `value` fields are converted from thousands of dollars; explicit `unit` or `scale` metadata takes precedence.

## Development and Verification

```bash
.venv/bin/pytest -q
npm run lint
npm run typecheck
npm run build
```

The tests cover representative and namespace-varied 13F XML, units, malformed/incomplete documents, comparison classifications, new/exited positions, option-key separation, accession idempotency, and SEC archive paths.

## Current Limitations

- Schedule 13D/13G forms appear in the filing timeline as `needs_review`; beneficial ownership details are not parsed yet.
- Tickers are optional manual mappings. CUSIP is the durable join key; the application does not fabricate mappings or fetch market prices.
- Amendments are retained and parsed, but the first version does not automatically mark an earlier filing `superseded` or reconstruct amendment-specific restatement semantics.
- Comparison selects the latest earlier processed report period. Same-period amendment lineage needs a dedicated policy in a later release.
- The dashboard reflects disclosed market value at the historical report date, not current valuation.
- No notifications are sent in the MVP; reruns therefore cannot duplicate notifications.

## Troubleshooting

- **Empty dashboard**: apply the migration, verify server environment variables, then run `python -m scripts.import_history`.
- **SEC 403/429**: ensure `SEC_USER_AGENT` identifies the application and contact, stop parallel jobs, and wait before retrying.
- **`No 13F information-table XML found`**: inspect the filing's stored `index.json`; the filing remains `failed` for diagnosis.
- **Revalidation returns 401**: make the Vercel and job `REVALIDATION_SECRET` values identical and confirm the URL includes `/api/revalidate`.
- **Supabase permission error**: ingestion and server rendering require the service-role key. Never place it in client code or expose it as a public variable.
- **Build succeeds but production is empty**: check Vercel server environment scope and redeploy after adding variables.
