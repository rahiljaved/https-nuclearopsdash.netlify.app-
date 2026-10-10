/**
 * FinMan demo dashboard.
 *
 * Every number on the page is calculated here with plain, auditable code.
 * In production the same calculations run server-side on the client's synced
 * QuickBooks data, and the AI only writes the plain-language summary from the
 * computed results (it never does the math itself).
 *
 * All data below is SAMPLE data for a fictional business. Amounts are CAD.
 */
(function () {

  // ---------------------------------------------------------------------------
  // Sample data (shaped like what we pull from the QuickBooks Online API)
  // ---------------------------------------------------------------------------

  const AS_OF = new Date(2026, 9, 10); // Oct 10, 2026
  const CASH_ON_HAND = 11900;

  // Monthly revenue, Apr 2025 -> Sep 2026 (Profit & Loss report)
  const REVENUE = [
    ["2025-04", 38200], ["2025-05", 41500], ["2025-06", 44800], ["2025-07", 47200],
    ["2025-08", 46100], ["2025-09", 42300], ["2025-10", 40100], ["2025-11", 39400],
    ["2025-12", 45600], ["2026-01", 34800], ["2026-02", 35900], ["2026-03", 39200],
    ["2026-04", 41100], ["2026-05", 44600], ["2026-06", 48300], ["2026-07", 50900],
    ["2026-08", 49800], ["2026-09", 45700]
  ];

  // Expenses by category, Apr 2026 -> Sep 2026 (last 6 months)
  // kind: "variable" scales with sales, "fixed" is steady, "monthly" is paid on the 1st, "lumpy" is irregular
  const EXPENSES = [
    { cat: "Food & beverage supplies", kind: "variable", m: [12900, 13800, 15000, 15800, 15600, 15900] },
    { cat: "Payroll",                  kind: "fixed",    m: [15200, 15600, 16400, 16900, 16800, 16500] },
    { cat: "Rent",                     kind: "monthly",  m: [5200, 5200, 5200, 5200, 5200, 5200] },
    { cat: "Delivery app fees",        kind: "variable", m: [1450, 1600, 1750, 1900, 2150, 2480] },
    { cat: "Utilities",                kind: "fixed",    m: [980, 940, 1050, 1180, 1160, 1020] },
    { cat: "Card processing fees",     kind: "variable", m: [820, 890, 960, 1010, 990, 920] },
    { cat: "Marketing",                kind: "fixed",    m: [600, 650, 700, 700, 650, 650] },
    { cat: "Software & subscriptions", kind: "fixed",    m: [410, 410, 445, 445, 520, 590] },
    { cat: "Repairs & maintenance",    kind: "lumpy",    m: [300, 0, 450, 200, 150, 1350] }
  ];

  // Open invoices (Accounts Receivable)
  const INVOICES = [
    { id: "INV-1042", customer: "Northwind Offices",  amount: 2350, due: "2026-08-28" },
    { id: "INV-1051", customer: "Lakeside Dental",    amount: 780,  due: "2026-09-12" },
    { id: "INV-1057", customer: "Brightpath School",  amount: 1640, due: "2026-09-30" },
    { id: "INV-1060", customer: "Harbour Law LLP",    amount: 920,  due: "2026-10-20" }
  ];

  // Known upcoming lump-sum obligations (bills + tax calendar)
  const OBLIGATIONS = [
    { label: "GST/HST remittance (Q3)",   amount: 4850, due: "2026-10-31" },
    { label: "Supplier invoice — Fraser Foods", amount: 3200, due: "2026-10-17" },
    { label: "Espresso machine service",  amount: 1100, due: "2026-11-24" }
  ];

  // Recurring vendor charges detected from bank/card transactions
  const SUBSCRIPTIONS = [
    { vendor: "Square POS",              group: "Point of sale",  now: 89, before: 89 },
    { vendor: "QuickBooks Online",       group: "Accounting",     now: 85, before: 85 },
    { vendor: "7shifts",                 group: "Scheduling",     now: 70, before: 70 },
    { vendor: "Loyalty app",             group: "Loyalty",        now: 69, before: 49 },
    { vendor: "Security camera cloud",   group: "Security",       now: 46, before: 46 },
    { vendor: "Mailchimp",               group: "Email",          now: 45, before: 35 },
    { vendor: "Wix",                     group: "Website",        now: 36, before: 36 },
    { vendor: "Spotify Business",        group: "Music",          now: 35, before: 35 },
    { vendor: "Squarespace",             group: "Website",        now: 33, before: 0 },
    { vendor: "Google Workspace",        group: "Email & docs",   now: 28, before: 28 },
    { vendor: "Zoom",                    group: "Meetings",       now: 22, before: 22 },
    { vendor: "Canva",                   group: "Design",         now: 17, before: 17 },
    { vendor: "Adobe Express",           group: "Design",         now: 15, before: 0 }
  ];

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const WEEKS_PER_MONTH = 52 / 12;
  const DAY = 86400000;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr) => sum(arr) / arr.length;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((b - a) / DAY);
  const money = (n) => (n < 0 ? "−$" : "$") + Math.round(Math.abs(n)).toLocaleString("en-CA");
  const moneyK = (n) => n === 0 ? "$0" : (n < 0 ? "−$" : "$") + (Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100000 || Math.abs(n) % 1000 === 0 ? 0 : 1) + "K";
  const pct = (n, digits = 1) => (n * 100).toFixed(digits) + "%";
  const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return MONTH_NAMES[m - 1] + " '" + String(y).slice(2); };
  const monthLong = (key) => { const [y, m] = key.split("-").map(Number); return MONTH_NAMES[m - 1] + " " + y; };
  const addMonths = (key, n) => {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  };
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------

  const revenueMap = new Map(REVENUE);
  const lastSixRevenue = REVENUE.slice(-6).map((r) => r[1]);
  const prevYearSixRevenue = REVENUE.slice(0, 6).map((r) => r[1]);
  const monthlyExpenseTotals = lastSixRevenue.map((_, i) => sum(EXPENSES.map((e) => e.m[i])));

  // Profitability: last 3 months vs the 3 months before
  const rev3 = sum(lastSixRevenue.slice(3));
  const revPrev3 = sum(lastSixRevenue.slice(0, 3));
  const exp3 = sum(monthlyExpenseTotals.slice(3));
  const expPrev3 = sum(monthlyExpenseTotals.slice(0, 3));
  const netMargin3 = (rev3 - exp3) / rev3;
  const netMarginPrev3 = (revPrev3 - expPrev3) / revPrev3;
  const lastMonthProfit = lastSixRevenue[5] - monthlyExpenseTotals[5];

  // Cash cushion: how many weeks of average spending the bank balance covers
  const weeklySpend = avg(monthlyExpenseTotals.slice(3)) / WEEKS_PER_MONTH;
  const cushionWeeks = CASH_ON_HAND / weeklySpend;

  // Receivables
  const invoices = INVOICES.map((inv) => {
    const daysLate = daysBetween(parseDate(inv.due), AS_OF);
    // Collection likelihood by age (tunable per client from their payment history)
    let likelihood = 0.95;
    if (daysLate > 60) likelihood = 0.4;
    else if (daysLate > 30) likelihood = 0.65;
    else if (daysLate > 0) likelihood = 0.85;
    return { ...inv, daysLate, likelihood };
  }).sort((a, b) => b.daysLate - a.daysLate);
  const totalAR = sum(invoices.map((i) => i.amount));
  const overdueAR = sum(invoices.filter((i) => i.daysLate > 0).map((i) => i.amount));

  // Spending markers: share of revenue now (last 3 mo) vs before (prior 3 mo).
  // Comparing as a % of sales separates "we sold more" from "it got more expensive".
  const markers = EXPENSES.map((e) => {
    const now = sum(e.m.slice(3));
    const before = sum(e.m.slice(0, 3));
    const shareNow = now / rev3;
    const shareBefore = before / revPrev3;
    const change = before > 0 ? (now - before) / before : 0;
    // Extra monthly cost vs. if the category had held its earlier share of sales
    const monthlyImpact = (shareNow - shareBefore) * (rev3 / 3);
    const lastMonth = e.m[5];
    const sixMonthAvg = avg(e.m.slice(0, 5));
    const spike = e.kind === "lumpy" && lastMonth > sixMonthAvg * 3 && lastMonth > 500;
    let status = "good";
    if (spike) status = "warning";
    else if (shareNow - shareBefore > 0.004 && (change > 0.15 || (shareNow - shareBefore) * (rev3 / 3) > 250)) status = "serious";
    else if (shareNow - shareBefore > 0.002) status = "warning";
    return { ...e, now: now / 3, before: before / 3, shareNow, shareBefore, change, monthlyImpact, spike, lastMonth, sixMonthAvg, status };
  }).sort((a, b) => b.monthlyImpact - a.monthlyImpact);

  // Subscriptions: price increases, newly added, overlapping tools
  const groupCounts = SUBSCRIPTIONS.reduce((m, s) => m.set(s.group, (m.get(s.group) || 0) + 1), new Map());
  const subs = SUBSCRIPTIONS.map((s) => {
    const flags = [];
    if (s.before === 0) flags.push("New");
    else if (s.now > s.before) flags.push("Price up " + pct((s.now - s.before) / s.before, 0));
    if (groupCounts.get(s.group) > 1) flags.push("Overlaps another " + s.group.toLowerCase() + " tool");
    return { ...s, flags };
  });
  const subsTotal = sum(subs.map((s) => s.now));
  const overlapSavings = [...groupCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([g]) => Math.min(...subs.filter((s) => s.group === g).map((s) => s.now)));
  const potentialSubSavings = sum(overlapSavings);

  // 12-month revenue forecast: same month last year x recent year-over-year growth.
  // Growth = last 6 months vs the same 6 months a year earlier.
  const yoyGrowth = sum(lastSixRevenue) / sum(prevYearSixRevenue);
  const lastKey = REVENUE[REVENUE.length - 1][0];
  const revenueForecast = [];
  for (let h = 1; h <= 12; h++) {
    const key = addMonths(lastKey, h);
    // Use the actual from 12 months back; if that is itself a forecast, use it.
    const base = revenueMap.get(addMonths(key, -12)) ??
      revenueForecast.find((f) => f.key === addMonths(key, -12)).value / yoyGrowth;
    const value = base * yoyGrowth;
    const spread = 0.05 + 0.006 * h; // uncertainty widens further out
    revenueForecast.push({ key, value, low: value * (1 - spread), high: value * (1 + spread) });
  }
  const forecast12 = sum(revenueForecast.map((f) => f.value));
  const trailing12 = sum(REVENUE.slice(-12).map((r) => r[1]));

  // 13-week cash projection
  const variableShare = sum(markers.filter((m) => m.kind === "variable").map((m) => m.shareNow));
  const fixedWeekly = sum(markers.filter((m) => m.kind === "fixed").map((m) => m.now)) / WEEKS_PER_MONTH;
  const lumpyWeekly = avg(EXPENSES.find((e) => e.kind === "lumpy").m.slice(0, 5)) / WEEKS_PER_MONTH; // excludes last month's one-off
  const rentMonthly = EXPENSES.find((e) => e.kind === "monthly").m[5];
  const forecastByMonth = new Map(revenueForecast.map((f) => [f.key, f.value]));

  const cashWeeks = [];
  let balance = CASH_ON_HAND;
  for (let w = 0; w < 13; w++) {
    const start = new Date(AS_OF.getTime() + w * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    const key = start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, "0");
    const weeklySales = (forecastByMonth.get(key) || revenueForecast[0].value) / WEEKS_PER_MONTH;
    let inflow = weeklySales;
    let outflow = weeklySales * variableShare + fixedWeekly + lumpyWeekly;
    const events = [];

    // Expected collections: overdue invoices land in week 2 at their likelihood,
    // not-yet-due invoices land the week after their due date.
    invoices.forEach((inv) => {
      const due = parseDate(inv.due);
      const arrives = inv.daysLate > 0 ? new Date(AS_OF.getTime() + 7 * DAY) : new Date(due.getTime() + 7 * DAY);
      if (arrives >= start && arrives < end) {
        inflow += inv.amount * inv.likelihood;
        events.push("+" + money(inv.amount * inv.likelihood) + " expected from " + inv.customer);
      }
    });
    // Rent on the 1st
    for (let d = new Date(start); d < end; d = new Date(d.getTime() + DAY)) {
      if (d.getDate() === 1) { outflow += rentMonthly; events.push("−" + money(rentMonthly) + " rent"); }
    }
    OBLIGATIONS.forEach((o) => {
      const due = parseDate(o.due);
      if (due >= start && due < end) { outflow += o.amount; events.push("−" + money(o.amount) + " " + o.label); }
    });

    balance += inflow - outflow;
    cashWeeks.push({ start, inflow, outflow, balance, events });
  }
  const lowWeek = cashWeeks.reduce((lo, w) => (w.balance < lo.balance ? w : lo), cashWeeks[0]);
  const safetyFloor = Math.round(weeklySpend * 1.0 / 500) * 500; // one week of spending

  // Health score (0-100), each part explained on the page
  const scoreParts = [
    { label: "Cash cushion", max: 30, value: 30 * clamp(cushionWeeks / 6, 0, 1), note: cushionWeeks.toFixed(1) + " weeks of spending in the bank (target: 6+)" },
    { label: "Profit margin", max: 30, value: 30 * clamp(netMargin3 / 0.12, 0, 1), note: pct(netMargin3) + " net margin, last 3 months (target: 12%+)" },
    { label: "Getting paid", max: 20, value: 20 * (1 - overdueAR / Math.max(totalAR, 1)), note: pct(overdueAR / totalAR, 0) + " of receivables are overdue" },
    { label: "Cost control", max: 20, value: 20 * clamp(1 - Math.max(0, (exp3 / expPrev3) - (rev3 / revPrev3)) / 0.08, 0, 1), note: "Costs grew " + pct(exp3 / expPrev3 - 1) + " vs sales " + pct(rev3 / revPrev3 - 1) }
  ];
  const healthScore = Math.round(sum(scoreParts.map((p) => p.value)));
  const healthStatus = healthScore >= 75 ? "good" : healthScore >= 55 ? "warning" : healthScore >= 40 ? "serious" : "critical";
  const healthLabel = { good: "Healthy", warning: "Needs attention", serious: "At risk", critical: "Critical" }[healthStatus];

  // ---------------------------------------------------------------------------
  // Recommendations ("What to improve") — rule-based, each with a $ impact
  // ---------------------------------------------------------------------------

  const recs = [];
  markers.filter((m) => m.status === "serious").forEach((m) => {
    recs.push({
      impact: m.monthlyImpact,
      title: m.cat + " rose from " + pct(m.shareBefore) + " to " + pct(m.shareNow) + " of sales",
      body: "Getting back to " + pct(m.shareBefore) + " would keep about " + money(m.monthlyImpact) + "/month. " +
        (m.cat.startsWith("Food") ? "Re-quote your top 3 suppliers and check portion costs on best sellers." :
         m.cat.startsWith("Delivery") ? "Nudge regulars to order direct (pickup discount) instead of through delivery apps." :
         "Review what changed in this category.")
    });
  });
  if (overdueAR > 0) {
    const expected = sum(invoices.filter((i) => i.daysLate > 0).map((i) => i.amount));
    recs.push({
      impact: expected,
      title: money(expected) + " in overdue invoices",
      body: invoices.filter((i) => i.daysLate > 0).map((i) => i.customer + " (" + i.daysLate + " days)").join(", ") +
        ". Send reminders this week. Northwind is past 30 days, so call them."
    });
  }
  if (potentialSubSavings > 0) {
    recs.push({
      impact: potentialSubSavings,
      title: "Overlapping subscriptions: " + money(potentialSubSavings) + "/month",
      body: "You pay for two website builders (Wix + Squarespace) and two design tools (Canva + Adobe Express). Cancel one of each."
    });
  }
  const spike = markers.find((m) => m.spike);
  if (spike) {
    recs.push({
      impact: 0,
      title: spike.cat + " spiked to " + money(spike.lastMonth) + " in September",
      body: "Treated as a one-off and left out of the forecast. If it repeats, budget about " + money(spike.lastMonth / 12) + "/month for upkeep."
    });
  }
  if (lowWeek.balance < safetyFloor) {
    recs.push({
      impact: 0,
      title: "Cash dips to " + money(lowWeek.balance) + " the week of " + MONTH_NAMES[lowWeek.start.getMonth()] + " " + lowWeek.start.getDate(),
      body: "That is below one week of spending (" + money(safetyFloor) + "). Collect the overdue invoices before then and hold non-urgent purchases that week."
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderTiles() {
    const tiles = document.getElementById("fm-tiles");
    const items = [
      { label: "Health score", value: healthScore + "/100", sub: healthLabel, status: healthStatus },
      { label: "Cash on hand", value: money(CASH_ON_HAND), sub: cushionWeeks.toFixed(1) + " weeks of spending" },
      { label: "Net margin (3 mo)", value: pct(netMargin3), sub: "was " + pct(netMarginPrev3) + " the 3 months before", status: netMargin3 < netMarginPrev3 ? "warning" : "good" },
      { label: "Overdue invoices", value: money(overdueAR), sub: "of " + money(totalAR) + " owed to you", status: overdueAR > 0 ? "serious" : "good" },
      { label: "Lowest cash, next 13 wks", value: money(lowWeek.balance), sub: "week of " + MONTH_NAMES[lowWeek.start.getMonth()] + " " + lowWeek.start.getDate(), status: lowWeek.balance < safetyFloor ? "serious" : "good" },
      { label: "Revenue, next 12 mo", value: moneyK(forecast12), sub: (forecast12 >= trailing12 ? "+" : "") + pct(forecast12 / trailing12 - 1) + " vs last 12 months" }
    ];
    items.forEach((t) => {
      const card = el("div", "fm-tile");
      card.appendChild(el("span", "fm-tile-label", t.label));
      card.appendChild(el("strong", "fm-tile-value", t.value));
      const sub = el("span", "fm-tile-sub");
      if (t.status) {
        const chip = el("span", "fm-status fm-status-" + t.status);
        chip.appendChild(el("span", "fm-status-icon", { good: "✓", warning: "!", serious: "!", critical: "×" }[t.status]));
        sub.appendChild(chip);
      }
      sub.appendChild(document.createTextNode(t.sub));
      card.appendChild(sub);
      tiles.appendChild(card);
    });

    const parts = document.getElementById("fm-score-parts");
    scoreParts.forEach((p) => {
      const row = el("div", "fm-score-row");
      const head = el("div", "fm-score-head");
      head.appendChild(el("span", "", p.label));
      head.appendChild(el("strong", "", Math.round(p.value) + " / " + p.max));
      row.appendChild(head);
      const bar = el("div", "fm-meter");
      const fill = el("div", "fm-meter-fill");
      fill.style.width = (p.value / p.max * 100) + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span", "fm-score-note", p.note));
      parts.appendChild(row);
    });
  }

  function renderSummary() {
    const drivers = markers.filter((m) => m.status === "serious").map((m) => m.cat.toLowerCase());
    const lowDate = MONTH_NAMES[lowWeek.start.getMonth()] + " " + lowWeek.start.getDate();
    const lowEvents = lowWeek.events.filter((e) => e.startsWith("−")).map((e) => e.replace(/^−\$[\d,]+ /, "")).join(" and ");
    const parts = [
      "September brought in " + money(lastSixRevenue[5]) + " in sales but only " + money(lastMonthProfit) + " in profit.",
      "Margins " + (netMargin3 < netMarginPrev3 ? "have slipped" : "have moved") + " from " + pct(netMarginPrev3) + " to " + pct(netMargin3) +
        " over the last quarter" + (drivers.length ? ", mostly because " + drivers.join(" and ") + " grew faster than sales." : "."),
      "You have " + money(CASH_ON_HAND) + " in the bank, about " + cushionWeeks.toFixed(1) + " weeks of spending.",
      "Cash is projected to bottom out near " + money(lowWeek.balance) + " the week of " + lowDate +
        (lowEvents ? ", when " + lowEvents + " " + (lowWeek.events.filter((e) => e.startsWith("−")).length > 1 ? "are" : "is") + " due" : "") +
        (lowWeek.balance < safetyFloor ? ", which is below your one-week safety floor." : "."),
      overdueAR > 0 ? money(overdueAR) + " in invoices is overdue; collecting it in full is the fastest way to build a cushion." : "",
      "Sales are tracking " + pct(yoyGrowth - 1) + " above last year, so the next 12 months point to about " + moneyK(forecast12) + " in revenue if the trend holds."
    ];
    const text = parts.filter(Boolean).join(" ");
    document.getElementById("fm-summary-text").textContent = text;

    const list = document.getElementById("fm-recs");
    recs.forEach((r, i) => {
      const li = el("li", "fm-rec");
      li.appendChild(el("span", "fm-rec-num", String(i + 1)));
      const body = el("div");
      body.appendChild(el("strong", "", r.title));
      body.appendChild(el("p", "", r.body));
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  // Generic single-series line chart with optional forecast segment + band.
  function lineChart(opts) {
    const { mount, points, splitIndex, band, refLine, yFormat, xLabel, tooltipRows, ariaLabel } = opts;
    const W = 720, H = 280, m = { t: 16, r: 16, b: 32, l: 56 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const allY = points.map((p) => p.y).concat(band ? band.flatMap((b) => [b.low, b.high]) : []).concat(refLine ? [refLine.y] : []);
    let yMin = Math.min(0, ...allY), yMax = Math.max(...allY);
    const step = niceStep((yMax - yMin) / 4);
    yMin = Math.floor(yMin / step) * step; yMax = Math.ceil(yMax / step) * step;
    const x = (i) => m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "fm-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", ariaLabel);
    const add = (tag, attrs, parent = svg) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      parent.appendChild(n);
      return n;
    };

    // Grid + y-axis labels
    for (let v = yMin; v <= yMax + 1e-6; v += step) {
      add("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? "fm-axis" : "fm-grid" });
      const t = add("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end", class: "fm-tick" });
      t.textContent = yFormat(v);
    }
    // X labels (thin out to ~7)
    const every = Math.ceil(points.length / 7);
    points.forEach((p, i) => {
      if (i % every !== 0 && i !== points.length - 1) return;
      const t = add("text", { x: x(i), y: H - 10, "text-anchor": "middle", class: "fm-tick" });
      t.textContent = xLabel(p, i);
    });

    // Forecast band
    if (band) {
      const pts = band.map((b) => x(b.i) + "," + y(b.high)).concat(band.slice().reverse().map((b) => x(b.i) + "," + y(b.low)));
      add("polygon", { points: pts.join(" "), class: "fm-band" });
    }
    // Reference line (e.g. safety floor)
    if (refLine) {
      add("line", { x1: m.l, x2: W - m.r, y1: y(refLine.y), y2: y(refLine.y), class: "fm-ref" });
      const t = add("text", { x: W - m.r, y: y(refLine.y) - 6, "text-anchor": "end", class: "fm-ref-label" });
      t.textContent = refLine.label;
    }
    // Actual line, then forecast line (same series, forecast dashed + lighter)
    const path = (from, to) => points.slice(from, to + 1).map((p, k) => (k ? "L" : "M") + x(from + k) + " " + y(p.y)).join(" ");
    const split = splitIndex ?? points.length - 1;
    if (split > 0) add("path", { d: path(0, split), class: "fm-line" });
    if (split < points.length - 1) add("path", { d: path(split, points.length - 1), class: "fm-line fm-line-forecast" });
    // End-point markers with direct labels
    [split, points.length - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0).forEach((i) => {
      add("circle", { cx: x(i), cy: y(points[i].y), r: 4.5, class: "fm-dot" });
    });

    // Hover layer: crosshair + tooltip
    const cross = add("line", { x1: 0, x2: 0, y1: m.t, y2: m.t + ih, class: "fm-cross", visibility: "hidden" });
    const hoverDot = add("circle", { r: 5, class: "fm-dot", visibility: "hidden" });
    const hit = add("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent", tabindex: 0 });
    const wrap = el("div", "fm-chart-wrap");
    const tip = el("div", "fm-tip");
    tip.hidden = true;
    wrap.appendChild(svg);
    wrap.appendChild(tip);
    mount.appendChild(wrap);

    function show(i) {
      const px = x(i), py = y(points[i].y);
      cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
      hoverDot.setAttribute("cx", px); hoverDot.setAttribute("cy", py); hoverDot.setAttribute("visibility", "visible");
      tip.replaceChildren();
      tooltipRows(points[i], i).forEach(([label, value], k) => {
        const row = el("div", k === 0 ? "fm-tip-title" : "fm-tip-row");
        if (k === 0) { row.textContent = label; }
        else { row.appendChild(el("strong", "", value)); row.appendChild(el("span", "", label)); }
        tip.appendChild(row);
      });
      tip.hidden = false;
      const rect = svg.getBoundingClientRect();
      const scale = rect.width / W;
      const left = px * scale;
      tip.style.left = Math.min(Math.max(left, 80), rect.width - 80) + "px";
      tip.style.top = Math.max(py * scale - 12, 0) + "px";
    }
    function hide() {
      cross.setAttribute("visibility", "hidden"); hoverDot.setAttribute("visibility", "hidden"); tip.hidden = true;
    }
    let focusIdx = points.length - 1;
    hit.addEventListener("pointermove", (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = (ev.clientX - rect.left) * (W / rect.width);
      focusIdx = clamp(Math.round(((sx - m.l) / iw) * (points.length - 1)), 0, points.length - 1);
      show(focusIdx);
    });
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("focus", () => show(focusIdx));
    hit.addEventListener("blur", hide);
    hit.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight") focusIdx = Math.min(points.length - 1, focusIdx + 1);
      else if (ev.key === "ArrowLeft") focusIdx = Math.max(0, focusIdx - 1);
      else return;
      ev.preventDefault();
      show(focusIdx);
    });
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function renderRevenueChart() {
    const actual = REVENUE.map(([key, v]) => ({ key, y: v, kind: "Actual" }));
    const fc = revenueForecast.map((f) => ({ key: f.key, y: f.value, low: f.low, high: f.high, kind: "Forecast" }));
    const points = actual.concat(fc);
    const split = actual.length - 1;
    const band = [{ i: split, low: actual[split].y, high: actual[split].y }]
      .concat(fc.map((f, k) => ({ i: split + 1 + k, low: f.low, high: f.high })));
    lineChart({
      mount: document.getElementById("fm-revenue-chart"),
      points, splitIndex: split, band,
      yFormat: (v) => moneyK(v),
      xLabel: (p) => monthLabel(p.key),
      ariaLabel: "Monthly revenue, actual Apr 2025 to Sep 2026 and forecast to Sep 2027",
      tooltipRows: (p) => p.kind === "Actual"
        ? [[monthLong(p.key) + " · Actual"], ["Revenue", money(p.y)]]
        : [[monthLong(p.key) + " · Forecast"], ["Expected revenue", money(p.y)], ["Likely range", moneyK(p.low) + " – " + moneyK(p.high)]]
    });
    document.getElementById("fm-revenue-note").textContent =
      "Forecast = same month last year × " + yoyGrowth.toFixed(3) + " (your growth over the last 6 months vs a year earlier). " +
      "The shaded range widens further out.";
  }

  function renderCashChart() {
    const points = [{ y: CASH_ON_HAND, label: "Today", events: [] }].concat(cashWeeks.map((w) => ({
      y: w.balance, label: "Week of " + MONTH_NAMES[w.start.getMonth()] + " " + w.start.getDate(), w
    })));
    lineChart({
      mount: document.getElementById("fm-cash-chart"),
      points, splitIndex: 0,
      refLine: { y: safetyFloor, label: "Safety floor: 1 week of spending (" + moneyK(safetyFloor) + ")" },
      yFormat: (v) => moneyK(v),
      xLabel: (p, i) => i === 0 ? "Today" : MONTH_NAMES[p.w.start.getMonth()] + " " + p.w.start.getDate(),
      ariaLabel: "Projected cash balance for the next 13 weeks",
      tooltipRows: (p) => {
        if (!p.w) return [["Today"], ["Cash on hand", money(p.y)]];
        const rows = [[p.label], ["Ending balance", money(p.y)], ["Money in", money(p.w.inflow)], ["Money out", money(p.w.outflow)]];
        p.w.events.forEach((e) => rows.push(["", e]));
        return rows;
      }
    });

    // Table view of the same projection
    const tbody = document.querySelector("#fm-cash-table tbody");
    cashWeeks.forEach((w) => {
      const tr = el("tr");
      [MONTH_NAMES[w.start.getMonth()] + " " + w.start.getDate(), money(w.inflow), money(w.outflow), money(w.balance), w.events.join("; ") || "—"]
        .forEach((v, k) => tr.appendChild(el("td", k > 0 && k < 4 ? "num" : "", v)));
      tbody.appendChild(tr);
    });
  }

  function renderMarkers() {
    const tbody = document.querySelector("#fm-markers tbody");
    markers.forEach((mk) => {
      const tr = el("tr");
      tr.appendChild(el("td", "", mk.cat));
      tr.appendChild(el("td", "num", money(mk.now)));
      tr.appendChild(el("td", "num", (mk.change >= 0 ? "+" : "") + pct(mk.change, 0)));
      tr.appendChild(el("td", "num", pct(mk.shareBefore) + " → " + pct(mk.shareNow)));
      const td = el("td");
      const chip = el("span", "fm-status fm-status-" + mk.status);
      chip.appendChild(el("span", "fm-status-icon", mk.status === "good" ? "✓" : "!"));
      chip.appendChild(document.createTextNode(
        mk.spike ? "One-off spike" :
        mk.status === "serious" ? "Outpacing sales" :
        mk.status === "warning" ? "Watch" : "In line"));
      td.appendChild(chip);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }

  function renderReceivables() {
    const tbody = document.querySelector("#fm-ar tbody");
    invoices.forEach((inv) => {
      const tr = el("tr");
      tr.appendChild(el("td", "", inv.customer));
      tr.appendChild(el("td", "", inv.id));
      tr.appendChild(el("td", "num", money(inv.amount)));
      const status = inv.daysLate > 30 ? "critical" : inv.daysLate > 0 ? "serious" : "good";
      const td = el("td");
      const chip = el("span", "fm-status fm-status-" + status);
      chip.appendChild(el("span", "fm-status-icon", status === "good" ? "✓" : "!"));
      chip.appendChild(document.createTextNode(inv.daysLate > 0 ? inv.daysLate + " days late" : "Due in " + (-inv.daysLate) + " days"));
      td.appendChild(chip);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }

  function renderSubscriptions() {
    const tbody = document.querySelector("#fm-subs tbody");
    subs.forEach((s) => {
      const tr = el("tr");
      tr.appendChild(el("td", "", s.vendor));
      tr.appendChild(el("td", "num", money(s.now)));
      const td = el("td");
      if (s.flags.length === 0) td.appendChild(el("span", "fm-muted", "—"));
      s.flags.forEach((f) => {
        const chip = el("span", "fm-status fm-status-warning");
        chip.appendChild(el("span", "fm-status-icon", "!"));
        chip.appendChild(document.createTextNode(f));
        td.appendChild(chip);
      });
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    document.getElementById("fm-subs-total").textContent =
      money(subsTotal) + "/month across " + subs.length + " tools · about " + money(potentialSubSavings) + "/month in overlaps";
  }

  renderTiles();
  renderSummary();
  renderRevenueChart();
  renderCashChart();
  renderMarkers();
  renderReceivables();
  renderSubscriptions();
})();
