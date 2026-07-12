# Situational Awareness Portfolio Tracker

A free-to-host research dashboard for the publicly disclosed SEC filings of **Situational Awareness LP** (CIK `0002045724`). It imports official EDGAR submissions, parses 13F information tables, compares report-period quantities, and presents current and historical disclosures without implying that positions remain held today.

## Architecture

- **Next.js App Router + TypeScript + Tailwind CSS**: server-rendered dashboard, portfolio, filing history, changes, and protected revalidation route.
- **Supabase PostgreSQL**: filing state, positions, quantity-change ledger, ticker mappings, RLS, and transactional ingestion functions.
- **Python**: SEC submissions/index retrieval, XML discovery and parsing, historical import, and polling.
- **GitHub Actions**: polling every 30 minutes plus manual runs.
- **Vercel**: frontend hosting and tag/path revalidation after successful ingestion.

The browser never receives the Supabase service-role key. All database reads occur in Server Components. RLS is enabled with no `anon` or `authenticated` policies, intentionally making these tables server-only in this MVP.

check it out: https://situational-awareness-portfolio-tra.vercel.app/
