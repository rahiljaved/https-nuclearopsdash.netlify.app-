# FinMan by CodeFounder: Product Spec (v0.1)

**One line:** FinMan is an AI finance manager for owner-run small businesses. It connects to QuickBooks and turns the books into cash flow indicators, spending alerts, revenue forecasts and a short monthly action plan, written in plain language.

**Distribution model:** a separate, **invite-only** CodeFounder product. It is sold to selected clients after a sales conversation and is not listed publicly.

- Web page: `/finman/` (marked `noindex`, not linked from the main site). Share the link directly with prospects.
- Mobile apps: distributed privately, not as public store listings (see [Mobile distribution](#mobile-distribution)).

---

## 1. Who it's for

| Segment | Why they buy |
|---|---|
| Owner-run businesses, ~$250K–$5M revenue (restaurants, clinics, retail, trades, agencies) | They have books but no CFO and don't read P&L reports. |
| Existing CodeFounder Operations/Marketing clients | They already trust us; FinMan links marketing spend to revenue. |
| Bookkeepers and accounting firms | One dashboard across all their clients; a channel to many businesses at once. |

**Positioning:** "The AI finance manager for Canadian small businesses and their bookkeepers." We do not compete with QuickBooks' own forecasting on features; we compete on plain-language advice, Canadian specifics (CAD, GST/HST, CRA remittance dates), multi-source data, and a done-with-you setup.

## 2. MVP features

1. **Health score (0–100).** Four transparent parts: cash cushion, profit margin, getting paid and cost control. Each part shows its formula input.
2. **Key indicators.** Cash on hand, weeks of spending covered, 3-month net margin and its trend, overdue receivables, lowest projected cash, and 12-month revenue forecast.
3. **Spending markers.** Each expense category compared **as a share of sales** (last 3 months vs prior 3), flagged when it is outpacing sales, with one-off spikes detected and excluded from forecasts.
4. **Receivables watch.** Invoices aged with a collection likelihood, plus a reminder action.
5. **Subscription audit.** Recurring charges with price increases, new charges and overlapping tools flagged.
6. **13-week cash projection.** Starts from the bank balance, adds expected sales and invoice collections, and subtracts fixed costs, rent, bills and tax remittances. It flags any week below a safety floor.
7. **12-month revenue forecast.** Seasonal baseline × recent growth, with a widening range.
8. **"What to improve" list.** Rule-based actions, each with an estimated $ impact.
9. **FinMan summary.** An AI-written paragraph explaining the numbers.
10. **Alerts.** Weekly brief plus instant alerts (cash dip, invoice 30+ days late, unusual spend) by push or email.
11. **Exports.** Excel and Power BI dataset.

The working demo of items 1–9 with sample data is at `finman/index.html`.

## 3. Core design rule: code does the math, AI does the words

All indicators, forecasts and $ impacts are computed by deterministic, versioned code. The AI (Claude API) receives **only the computed JSON** and writes the summary and wording of recommendations. This keeps every number exact, auditable and reproducible, and it is cheaper to run.

```
QuickBooks API ──sync──▶ Raw tables ──▶ Metrics engine (SQL/Python) ──▶ metrics JSON
                                                                    │
                                                         Claude API (summary + wording)
                                                                    │
                                     Web dashboard · Mobile app · Weekly email · Push alerts
```

## 4. Architecture

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | React Native + Expo | One codebase for iOS and Android |
| Web dashboard | Same Expo app (web target) or the existing static site pattern | |
| Auth and database | Supabase (Postgres, Row Level Security, Auth) | One `organization` per business; bookkeepers get access to many |
| Data sync | Supabase Edge Function + scheduled job (nightly + on demand) | QuickBooks Online Accounting API, OAuth 2.0, read-only scopes |
| Metrics engine | SQL views + Python service | Versioned formulas, unit-tested |
| Forecasting | Seasonal-naive × growth (v1), then statistical models (v2) | Backtested per client; show accuracy |
| AI | Claude API via server only | Never ship API keys in the app |
| Billing | Invoiced directly (Stripe) for invite-only clients | Avoids app-store billing; see below |
| Notifications | Expo push + transactional email | |

### Data model (first cut)

- `organizations` (id, name, currency, fiscal_year_start, province)
- `connections` (org_id, provider, realm_id, encrypted tokens, last_sync_at, status)
- `accounts`, `transactions`, `invoices`, `bills`, `customers`, `vendors`: raw mirrors of QuickBooks entities
- `monthly_pl` (org_id, month, category, amount): materialized view
- `metrics_snapshots` (org_id, as_of, metrics_json, formula_version)
- `forecasts` (org_id, as_of, horizon, kind, value, low, high)
- `insights` (org_id, as_of, type, title, body, impact_cad, status: open/done/dismissed)
- `members` (org_id, user_id, role: owner/staff/bookkeeper)

## 5. Mobile distribution

Because FinMan is sold only to specific clients, it doesn't need public store listings:

| Platform | Option | Notes |
|---|---|---|
| iOS | **Unlisted App Store app** | Passes normal App Review but is only findable by direct link. Best fit. |
| iOS | Apple Business Manager custom app | Only for clients that use Apple Business Manager; good for larger firms. |
| Android | **Managed Google Play private app** | Clients with Managed Google Play only. |
| Android | Closed testing track / direct link | Simplest for small clients. |

- **Billing:** clients sign up and pay outside the app (Stripe invoice). The app is a companion to an account the business already has, so we avoid in-app purchases. Confirm the current App Store rules for this account-based pattern at submission time.
- **Store fees:** Apple Developer USD $99/yr and Google Play USD $25 one-time.
- **Requirements:** privacy policy, in-app account deletion, and a data-use disclosure that covers AI processing.

## 6. Pricing (invite-only, quoted per client)

| Plan | Guide price (CAD) | Includes |
|---|---|---|
| FinMan Essentials | from $49/mo | Health score, indicators, monthly summary, 1 connection |
| FinMan Pro | from $99/mo | + 13-week cash projection, revenue forecast, alerts, all connections, Excel/Power BI export |
| FinMan for Bookkeepers | from $15/client/mo | Multi-client dashboard, white-label summaries |
| Setup | one-time from $199 | Chart-of-accounts cleanup and category mapping, first review call |

Every engagement starts with a free 30-minute financial health review that uses the demo dashboard on the client's own data.

## 7. Trust, security and compliance

- Read-only QuickBooks scopes, and clients can revoke access at any time.
- Encryption in transit (TLS) and at rest. OAuth tokens are encrypted separately.
- Supabase Row Level Security on every table, scoped to `org_id`.
- Client data is never used to train models. AI calls send computed metrics, not raw ledgers.
- PIPEDA-aligned privacy policy (Canada). Plan for SOC 2 once there are 50+ clients.
- Disclaimer: insights, not professional accounting, tax or investment advice.
- **Intuit:** production QuickBooks access requires passing Intuit's app assessment and joining its App Partner Program. Check current API usage tiers and fees before launch.

## 8. Roadmap

| Phase | Weeks | Deliverable |
|---|---|---|
| 0. Validate | 1–2 | Demo page (done) shown to 5–10 existing clients + 1 bookkeeper; collect 3 paid pilots |
| 1. Pilot (web) | 3–8 | QuickBooks sandbox → production connection, metrics engine, web dashboard, monthly AI summary email |
| 2. Mobile | 9–14 | Expo app: home brief, alerts, approvals; unlisted App Store + private Play distribution |
| 3. Expand | 15+ | Xero + Wave + Square connectors, bookkeeper multi-client view, Power BI template, CodeFounder Ops/Marketing data link |

## 9. Success metrics

- Pilot → paid conversion ≥ 60%
- Weekly active owners ≥ 70% (opened brief or app)
- Recommendations marked "done" ≥ 1 per client per month
- 13-week cash forecast error ≤ 10% at 4 weeks out (backtested)
- Net revenue retention ≥ 100% (upgrades to Pro or Bookkeeper)

## 10. Open questions

1. Final name check. Other unrelated apps are called "FinMan", so run a CIPO trademark search before the public brand is final.
2. Should FinMan accounts link to CodeFounder Operations/Marketing dashboards from day one, or in phase 3?
3. Is QuickBooks Desktop support needed for any pilot client? (It needs a different connector.)
