# Recruiting Pipeline Dashboard

A mobile-first dashboard for a recruiting agency that staffs smart home sales teams. It reads a messy Google Sheet of leads, cleans it with explicit, tested rules, and shows weekly pipeline numbers that match the client's own **Weekly Stats** tab exactly.

**What's on the page:** KPI cards (total leads, hire rate, ad spend, cost per lead, cost per hire), a stacked bar chart and table of leads by stage week by week, and a data-quality panel that shows how raw rows became clean leads.

Stack: Next.js 15 (App Router) · TypeScript strict · Tailwind 4 · Google Sheets API (service account) · zod · Vitest.

## Quick start

```bash
npm install
npm run dev            # no credentials needed: falls back to demo data
```

To use the real sheet, copy `.env.example` to `.env.local` and fill it in. Then share the sheet with the service account email as **Viewer**.

| Command | What it does |
|---|---|
| `npm test` | Vitest: dates, dedupe, test rows, week bucketing, metrics |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run inspect:sheet` | Prints each tab's headers, sample rows, and the sheet timezone |
| `npm run reconcile` | Diffs computed weekly counts against the Weekly Stats tab. Exits 1 on any difference |

## Architecture

```
Google Sheet ──► Source adapter ──► Cleaning pipeline ──► Metrics ──► Page (Server Component)
                 lib/data/sheets    lib/clean              lib/metrics  app/page.tsx
                 (server-only)      map → tests → dates     weeks.ts     only aggregates reach
                                    → validate → dedupe     registry.ts  the browser
```

- **`lib/data/types.ts`**: the `DataSource` interface. Pages depend on this interface, never on Google.
- **`lib/data/sheets/`**: `client.ts` does one `batchGet` for all tabs, with backoff on 429/5xx. `mapping.ts` matches columns by header name, so column order can change. `adapter.ts` caches the raw read for 60s (tag `sheet`).
- **`lib/data/mock/`**: deterministic fixture data with every kind of mess the real sheet has. It runs through the same pipeline.
- **`lib/clean/`**: one module per rule. Bad rows are counted and explained, never thrown.
- **`lib/metrics/weeks.ts`**: the only place week boundaries are defined. **`registry.ts`** holds KPI definitions, reusable on any page.
- **`config/app.config.ts`**: all business rules in one file: timezone, week start, stage order, test-row patterns, dedupe options.

### Counting rules (match Weekly Stats)

| Rule | Implementation |
|---|---|
| Week | Monday–Sunday, `America/New_York`. A lead belongs to the week of its Created Date. Bucketing uses the New York calendar date, so a Sunday 11:30 pm lead stays in that week even though it's Monday in UTC. |
| Stage | Counted by **current** stage, matched case- and whitespace-insensitively. |
| Test rows | Name or email matches *test / asdf / delete me / @example.com*. Removed **before** dedupe, so a real lead is never lost to an earlier test row. |
| Duplicates | Same email (trimmed, lowercased) **or** same phone digits (US `+1` stripped). The earliest record is kept unchanged; later duplicates are dropped. |
| Dates | Real date cells (serials), `M/D/YYYY`, `MM/DD/YY`, `YYYY-MM-DD`, `YYYY-MM-DD HH:mm`, interpreted as New York wall-clock time. |
| Rejected | Unparseable date or unknown stage. Shown in the data-quality panel with row number and reason. |
| Hire rate | Hired ÷ all clean leads (Disqualified included). |
| Cost per lead / hire | Ad spend ÷ leads (or Hired) **from weeks that have an ad spend row**. A week with leads but no spend row is left out, and the card says which weeks (e.g. "Excludes week of 9/28 (spend not entered)"). A $0 row counts as entered. Total ad spend = sum of entered weeks. |

## Security approach

- **Credentials stay on the server.** Every module that touches credentials imports `server-only`, so the build fails if one is pulled into client code. Env vars never use `NEXT_PUBLIC_`.
- **Least privilege.** The service account uses the `spreadsheets.readonly` scope and is shared on one sheet as Viewer.
- **Only aggregates reach the browser.** The page is a Server Component. The client receives weekly counts and totals, never names, emails, or phones. The one client component (the chart) receives numbers only.
- **No secrets in git.** `.env*` is ignored except the empty `.env.example`, and service-account JSON patterns are ignored too.
- **Public by design.** This demo has no login, so reviewers can open it directly, and it is read-only. The production build adds the master/viewer login (jose-signed httpOnly cookies, `middleware.ts` gate, role checks in every mutation route) before any write-back is added.

**Key rotation:** create a new key for the service account in Google Cloud and update `GOOGLE_SA_PRIVATE_KEY` in Vercel (Production and Preview). Redeploy, then delete the old key.

## Swapping to GoHighLevel

The page never imports Google code; it calls `getDataSource()`. To switch:

1. Add `lib/data/ghl/adapter.ts` implementing `DataSource`:
   - Fetch contacts and opportunities from the GHL API (server-only, `GHL_API_KEY` env var).
   - Map each contact to a `RawLead`: the opportunity's pipeline stage → `stage`, `dateAdded` → `createdDate`, custom fields → quiz score and result, attribution → `source`.
   - Return `cleanLeads(rows)`, so the same test-row, dedupe, and date rules still apply.
   - Pull ad spend from wherever it moves to (GHL custom object, ad platform API, or keep the Sheet tab).
2. Add a `case "ghl"` to `lib/data/index.ts`.
3. Set `DATA_SOURCE=ghl`. No page, metric, or component changes.
4. Run the reconcile script against the old Weekly Stats to prove the numbers didn't move.

## Environment variables

| Name | Purpose |
|---|---|
| `DATA_SOURCE` | `sheets` or `mock`. Defaults to `sheets` when `SHEET_ID` is set |
| `GOOGLE_SA_EMAIL` | Service account email |
| `GOOGLE_SA_PRIVATE_KEY` | PEM key on one line, with literal `\n` |
| `SHEET_ID` | Spreadsheet ID from the sheet URL |

The page is statically rendered and revalidated every 60s, so these must also be set for the **build** environment on Vercel.
