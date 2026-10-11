/**
 * CodeFounder Pakistan sales demo.
 * Walks a prospect through plan selection, the PKR feature wizard, sign-up,
 * payment and setup, then shows a sample client dashboard that only contains
 * the features they picked. Everything runs in the browser with sample data;
 * the login is a demo gate for the sales team, not real authentication.
 */
(function () {
  const DEMO_EMAIL = "demo@codefounder.pk";
  const DEMO_PASS = "Demo2026";
  const STORE_KEY = "cf-pk-demo-v1";
  const STEPS = ["plan", "configure", "details", "payment", "setup", "dashboard"];

  // ---------- Sample businesses ----------
  const BUSINESS_TYPES = {
    clinic: {
      label: "Clinic / doctor",
      sample: { business: "Al-Shifa Family Clinic", owner: "Dr. Ayesha Khan", hours: "Mon–Sat, 10am–9pm", website: "facebook.com/alshifaclinic" },
      services: [["General consultation", 1500], ["Child specialist", 2500], ["Lab test package", 3500]],
      bookingWord: "appointment",
      posts: ["Dengue season: 5 signs you should see a doctor", "Free BP check every Friday this month", "Meet our new child specialist", "Lab tests now with home sample collection", "Ramzan timings for the clinic"]
    },
    salon: {
      label: "Salon / beauty",
      sample: { business: "Glamour Beauty Salon", owner: "Sana Malik", hours: "Daily, 11am–8pm", website: "instagram.com/glamoursalon" },
      services: [["Haircut & styling", 2000], ["Facial", 3500], ["Bridal makeup", 45000]],
      bookingWord: "appointment",
      posts: ["Wedding season bridal packages now open", "Before & after: keratin treatment", "Weekday facial offer — 20% off", "Meet our senior stylist", "Eid booking slots filling fast"]
    },
    restaurant: {
      label: "Restaurant / café",
      sample: { business: "Karachi Grill House", owner: "Imran Qureshi", hours: "Daily, 12pm–1am", website: "facebook.com/karachigrillhouse" },
      services: [["BBQ platter (4 persons)", 4800], ["Family deal", 3200], ["Home delivery", 150]],
      bookingWord: "table",
      posts: ["Weekend BBQ night — live music", "New family deal for 4", "Behind the grill with our head chef", "Free delivery above Rs 2,000", "Iftar buffet booking open"]
    },
    shop: {
      label: "Retail shop",
      sample: { business: "Hamid Electronics", owner: "Hamid Raza", hours: "Mon–Sat, 11am–10pm", website: "facebook.com/hamidelectronics" },
      services: [["Phone repair", 1500], ["Accessories", 500], ["Home delivery (city)", 250]],
      bookingWord: "visit",
      posts: ["New arrivals this week", "Installment plans now available", "Customer review of the month", "11.11 sale — up to 30% off", "How to spot a fake charger"]
    }
  };

  const URDU = {
    greet: (b) => `السلام علیکم! میں ${b} کا اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
    hours: (h) => `ہمارے اوقات: ${h}`,
    price: (s) => `ہماری قیمتیں: ${s}`,
    bookYes: (slot) => `ضرور! آپ کا وقت ${slot} پر بک کر دیا گیا ہے۔ تصدیق کا پیغام واٹس ایپ پر آ جائے گا۔`,
    bookNo: (p) => `بکنگ کے لیے براہ کرم ہمیں ${p} پر کال کریں۔`,
    location: (c) => `ہم ${c} میں ہیں۔ لوکیشن واٹس ایپ پر بھیج دی جائے گی۔`,
    fallback: () => "شکریہ! میں آپ کا سوال ٹیم تک پہنچا دیتا ہوں، وہ جلد رابطہ کریں گے۔"
  };

  const ROMAN = {
    greet: (b) => `Assalam o Alaikum! Main ${b} ka assistant hoon. Main aap ki kya madad kar sakta hoon?`,
    hours: (h) => `Hamari timings: ${h}`,
    price: (s) => `Hamari qeematein: ${s}`,
    bookYes: (slot) => `Zaroor! Aap ka waqt ${slot} par book ho gaya hai. Confirmation WhatsApp par aa jaye gi.`,
    bookNo: (p) => `Booking ke liye please humein ${p} par call karein.`,
    location: (c) => `Hum ${c} mein hain. Location WhatsApp par bhej di jaye gi.`,
    fallback: () => "Shukriya! Main aap ka sawal team tak pohncha deta hoon, woh jald rabta karein ge."
  };
  const ROMAN_WORDS = /\b(hai|hain|kya|kahan|kitn\w*|kab|aap|ap|mujhe|chahiye|karna|krna|batao|bataein|timing)\b/;

  // ---------- State ----------
  const fresh = () => ({
    loggedIn: false, step: "plan", planKey: null, addons: {}, details: null,
    pay: "JazzCash", bookings: null, posts: null, chat: [], chatLang: "en", tab: "overview"
  });
  let S = load() || fresh();

  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* demo still works without storage */ }
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Pricing helpers ----------
  function addonEntries(planKey) {
    const plan = PRICING_PK[planKey];
    if (plan.addons) return plan.addons.map((addon) => ({ source: planKey, addon }));
    const out = [];
    plan.groups.forEach((g) => PRICING_PK[g.source].addons.forEach((addon) => out.push({ source: g.source, addon, group: g.title })));
    return out;
  }
  function addonState(source, addon) {
    const key = source + "." + addon.id;
    if (!S.addons[key]) S.addons[key] = { checked: false, sliderValue: addon.slider ? addon.slider.includedAtBase : undefined };
    return S.addons[key];
  }
  function lineItems() {
    if (!S.planKey) return [];
    const plan = PRICING_PK[S.planKey];
    const items = [{ label: plan.label + " — base plan", price: plan.base }];
    addonEntries(S.planKey).forEach(({ source, addon }) => {
      const st = addonState(source, addon);
      const cost = computeAddonCost(addon, st);
      if (cost <= 0) return;
      let label = addon.label;
      if (addon.slider) label += " — " + st.sliderValue + " " + addon.slider.unitLabel;
      items.push({ label, price: cost });
    });
    return items;
  }
  const total = () => lineItems().reduce((t, i) => t + i.price, 0);

  function has(id) {
    if (!S.planKey) return false;
    const entry = addonEntries(S.planKey).find((e) => e.addon.id === id);
    if (!entry) return false;
    const st = addonState(entry.source, entry.addon);
    if (entry.addon.type === "slider") return st.sliderValue > 0;
    return !!st.checked;
  }
  const hasOps = () => S.planKey === "operations" || S.planKey === "bundle";
  const hasMkt = () => S.planKey === "marketing" || S.planKey === "bundle";
  const hasVoice = () => has("voice") || has("dedicated");
  function sliderValue(id) {
    const entry = addonEntries(S.planKey).find((e) => e.addon.id === id);
    return entry ? addonState(entry.source, entry.addon).sliderValue : 0;
  }

  // ---------- Navigation ----------
  function go(step) {
    S.step = step; save(); render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function render() {
    const screen = S.loggedIn ? S.step : "login";
    $$(".screen").forEach((el) => { el.hidden = el.dataset.screen !== screen; });
    $("#steps").hidden = !S.loggedIn;
    $("#demo-reset").hidden = !S.loggedIn;
    $("#demo-logout").hidden = !S.loggedIn;
    const idx = STEPS.indexOf(screen);
    $$("#steps li").forEach((li, i) => {
      li.classList.toggle("done", i < idx);
      li.classList.toggle("active", i === idx);
    });
    $$("[data-total]").forEach((el) => { el.textContent = formatPKR(total()) + "/mo"; });
    const fn = { plan: renderPlans, configure: renderConfigure, details: renderDetails, payment: renderPayment, setup: renderSetup, dashboard: renderDashboard }[screen];
    if (fn) fn();
  }

  // ---------- Login ----------
  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = $("#login-email").value.trim().toLowerCase() === DEMO_EMAIL && $("#login-pass").value === DEMO_PASS;
    $("#login-error").hidden = ok;
    if (!ok) return;
    S.loggedIn = true; save(); render();
  });
  $("#demo-logout").addEventListener("click", () => { S.loggedIn = false; save(); render(); });
  $("#demo-reset").addEventListener("click", () => {
    if (!confirm("Restart the demo from plan selection? Sample data will be cleared.")) return;
    S = fresh(); S.loggedIn = true; save(); render();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-next]");
    if (btn) go(btn.dataset.next);
  });

  // ---------- 1. Plans ----------
  function renderPlans() {
    const grid = $("#plan-grid");
    grid.innerHTML = ["operations", "marketing", "bundle"].map((key) => {
      const p = PRICING_PK[key];
      const featured = key === "bundle";
      const tag = { operations: "Calls · Bookings · Website chat", marketing: "Social media · WhatsApp · Email", bundle: "Operations + Marketing" }[key];
      return `<article class="plan-card${featured ? " plan-card-featured" : ""}">
        ${featured ? '<div class="badge">Best value</div>' : ""}
        <div class="plan-card-top">
          <h3>${esc(p.label)}</h3>
          <p class="plan-tag">${tag}</p>
          <p class="plan-price"><span class="from">Starting at</span><span class="amount">${formatPKR(p.base)}</span><span class="period">/mo</span></p>
          <ul class="plan-includes">${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        </div>
        <div class="plan-card-bottom">
          <button class="btn btn-primary btn-block" data-plan="${key}">Choose ${esc(p.label)}</button>
        </div>
      </article>`;
    }).join("");
    $$("[data-plan]", grid).forEach((b) => b.addEventListener("click", () => {
      if (S.planKey !== b.dataset.plan) { S.planKey = b.dataset.plan; S.addons = {}; S.bookings = null; S.posts = null; S.chat = []; }
      go("configure");
    }));
  }

  // ---------- 2. Configure ----------
  function renderConfigure() {
    const plan = PRICING_PK[S.planKey];
    $("#cfg-title").textContent = "Build your " + plan.label + " plan";
    $("#cfg-subtitle").textContent = plan.subtitle;
    const body = $("#cfg-body");
    body.innerHTML = "";
    const inc = document.createElement("div");
    inc.innerHTML = `<p class="wizard-section-title">Included in the base plan (${formatPKR(plan.base)}/mo)</p>
      <div class="wizard-included">${plan.includes.map((i) => `<div>✓ ${esc(i)}</div>`).join("")}</div>`;
    body.appendChild(inc);
    let lastGroup = null;
    addonEntries(S.planKey).forEach(({ source, addon, group }) => {
      const title = group || "Add only what you need";
      if (title !== lastGroup) {
        const h = document.createElement("p");
        h.className = "wizard-section-title"; h.textContent = title;
        body.appendChild(h); lastGroup = title;
      }
      body.appendChild(addonRow(source, addon));
    });
    updateSummary();
  }

  function addonRow(source, addon) {
    const st = addonState(source, addon);
    const wrap = document.createElement("div");
    wrap.className = "addon-row-wrap";
    const price = addon.type === "slider"
      ? `<span class="addon-price">${formatPKR(addon.slider.extraBlockPrice)} / ${addon.slider.extraBlockSize}</span>`
      : `<span class="addon-price">+${formatPKR(addon.price)}/mo</span>`;
    const toggle = addon.type === "slider" ? "" : `<label class="switch"><input type="checkbox" ${st.checked ? "checked" : ""}><span class="slider-track"></span></label>`;
    wrap.innerHTML = `<div class="addon-row">
        <div class="addon-label"><strong>${esc(addon.label)}</strong><span>${esc(addon.detail || "")}</span></div>
        <div class="addon-right">${price}${toggle}</div>
      </div>`;
    const input = $("input[type=checkbox]", wrap);
    let sub = null;
    if (addon.slider) {
      const s = addon.slider;
      sub = document.createElement("div");
      sub.className = "addon-sub";
      sub.hidden = addon.type === "toggle-slider" && !st.checked;
      sub.innerHTML = `<div class="slider-block"><div class="slider-block-head"><span>Included: ${s.includedAtBase} ${s.unitLabel}</span><strong>${st.sliderValue} ${s.unitLabel}</strong></div>
        <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${st.sliderValue}" aria-label="${esc(addon.label)}"></div>`;
      const range = $("input[type=range]", sub);
      range.addEventListener("input", () => {
        st.sliderValue = Number(range.value);
        $("strong", sub).textContent = range.value + " " + s.unitLabel;
        updateSummary(); save();
      });
      wrap.appendChild(sub);
    }
    if (input) input.addEventListener("change", () => {
      st.checked = input.checked;
      if (sub) sub.hidden = !input.checked;
      updateSummary(); save();
    });
    return wrap;
  }

  function updateSummary() {
    $("#cfg-total").textContent = formatPKR(total()) + "/mo";
    $("#cfg-summary").innerHTML = lineItems().map((i) => `<li><span>${esc(i.label)}</span><strong>${formatPKR(i.price)}</strong></li>`).join("");
  }

  // ---------- 3. Details ----------
  function renderDetails() {
    const sel = $("#d-type");
    if (!sel.options.length) {
      sel.innerHTML = Object.entries(BUSINESS_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    }
    const d = S.details;
    if (d) {
      ["business", "owner", "phone", "hours", "website"].forEach((f) => { $("#d-" + f).value = d[f] || ""; });
      sel.value = d.type; $("#d-city").value = d.city;
    }
  }
  $("#d-fill").addEventListener("click", () => {
    const t = BUSINESS_TYPES[$("#d-type").value].sample;
    $("#d-business").value = t.business; $("#d-owner").value = t.owner; $("#d-hours").value = t.hours;
    $("#d-website").value = t.website; $("#d-phone").value = "0300 0000000";
  });
  $("#details-next").addEventListener("click", () => {
    const form = $("#details-form");
    if (!form.reportValidity()) return;
    S.details = {
      business: $("#d-business").value.trim(), owner: $("#d-owner").value.trim(), type: $("#d-type").value,
      city: $("#d-city").value, phone: $("#d-phone").value.trim(), hours: $("#d-hours").value.trim(), website: $("#d-website").value.trim()
    };
    S.bookings = null; S.posts = null; S.chat = [];
    go("payment");
  });

  // ---------- 4. Payment ----------
  function renderPayment() {
    const rows = lineItems().map((i) => `<tr><td>${esc(i.label)}</td><td>${formatPKR(i.price)}</td></tr>`).join("");
    $("#review-table").innerHTML = `<tbody>
      <tr class="muted"><td colspan="2">${esc(S.details.business)} · ${esc(S.details.city)}</td></tr>
      ${rows}<tr class="total"><td>Monthly total</td><td>${formatPKR(total())}</td></tr></tbody>`;
    $$("input[name=pay]").forEach((r) => { r.checked = r.value === S.pay; });
  }
  $("#pay-grid").addEventListener("change", (e) => { S.pay = e.target.value; save(); });
  $("#pay-btn").addEventListener("click", () => go("setup"));

  // ---------- 5. Setup ----------
  let setupTimer = null;
  function renderSetup() {
    const tasks = ["Business profile saved", "Agent trained on your services, prices and FAQs"];
    if (hasOps()) tasks.push("Website chat widget created");
    if (has("voice")) tasks.push("Voice agent connected to the shared line");
    if (has("dedicated")) tasks.push("Your business number reserved");
    if (has("calendar")) tasks.push("Booking calendar connected");
    if (has("multilang")) tasks.push("Urdu and English turned on");
    if (hasMkt()) tasks.push("Facebook and Instagram pages linked", "First posts drafted for your approval");
    if (has("linkedin")) tasks.push("LinkedIn page linked");
    if (has("whatsapp")) tasks.push("WhatsApp Business connected");
    if (has("email")) tasks.push("Email list imported");
    tasks.push("Dashboard ready");
    $("#setup-sub").textContent = `Paid by ${S.pay}. In real life setup takes 3–5 business days; here it takes a few seconds.`;
    const list = $("#setup-list");
    list.innerHTML = tasks.map((t) => `<li>${esc(t)}</li>`).join("");
    $("#setup-done").hidden = true;
    clearInterval(setupTimer);
    let i = 0;
    setupTimer = setInterval(() => {
      const li = list.children[i];
      if (!li) { clearInterval(setupTimer); $("#setup-done").hidden = false; return; }
      li.classList.add("done"); i++;
    }, 550);
  }
  $("#setup-done").addEventListener("click", () => { S.tab = "overview"; go("dashboard"); });

  // ---------- 6. Dashboard ----------
  function biz() { return BUSINESS_TYPES[S.details.type]; }
  function dayLabel(offset, time) {
    const d = new Date(); d.setDate(d.getDate() + offset);
    const day = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : offset === -1 ? "Yesterday"
      : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return day + (time ? ", " + time : "");
  }
  function seed() {
    const b = biz();
    if (!S.bookings) {
      S.bookings = [
        { who: "Bilal Ahmed", what: b.services[0][0], when: dayLabel(0, "5:30 pm"), via: "Phone call" },
        { who: "Fatima Noor", what: b.services[1][0], when: dayLabel(1, "12:00 pm"), via: "Website chat" },
        { who: "Usman Tariq", what: b.services[0][0], when: dayLabel(2, "7:00 pm"), via: "WhatsApp" }
      ];
    }
    if (!S.posts) {
      const channels = ["Facebook", "Instagram"].concat(has("linkedin") ? ["LinkedIn"] : []);
      const count = Math.max(5, sliderValue("posts") || 5);
      S.posts = Array.from({ length: Math.min(count, 8) }, (_, i) => ({
        title: b.posts[i % b.posts.length],
        channels,
        when: dayLabel(i * 3 - 3, "7:00 pm"),
        status: i === 0 ? "Published" : i < 3 ? "Awaiting approval" : "Scheduled"
      }));
    }
  }

  function tabsFor() {
    const t = [["overview", "Overview"]];
    if (hasOps()) t.push(["chat", "Website chat"]);
    if (hasVoice()) t.push(["calls", "Calls"]);
    if (has("calendar")) t.push(["bookings", "Bookings"]);
    if (hasMkt()) t.push(["content", "Content"]);
    if (has("whatsapp")) t.push(["whatsapp", "WhatsApp"]);
    if (has("email")) t.push(["email", "Email"]);
    t.push(["billing", "Billing"]);
    return t;
  }

  function renderDashboard() {
    seed(); save();
    const d = S.details;
    $("#dash-plan").textContent = PRICING_PK[S.planKey].label + " · " + d.city;
    $("#dash-title").textContent = d.business;
    $("#dash-sub").textContent = "Welcome, " + d.owner + ". Only the features you chose appear here.";
    const tabs = tabsFor();
    if (!tabs.some(([k]) => k === S.tab)) S.tab = "overview";
    $("#dash-tabs").innerHTML = tabs.map(([k, l]) => `<button type="button" class="${k === S.tab ? "active" : ""}" data-tab="${k}">${l}</button>`).join("");
    $$("#dash-tabs button").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; save(); renderDashboard(); }));
    const body = $("#dash-body");
    body.innerHTML = ({ overview, chat, calls, bookings, content, whatsapp, email, billing })[S.tab]();
    if (S.tab === "chat") wireChat();
    if (S.tab === "content") wireContent();
  }

  function tile(label, value, note) {
    return `<div class="tile"><p class="tile-label">${label}</p><p class="tile-value">${value}</p>${note ? `<p class="tile-note">${note}</p>` : ""}</div>`;
  }
  function meter(label, used, cap, unit) {
    const pct = Math.min(100, Math.round((used / cap) * 100));
    return `<div class="meter"><div class="meter-head"><span>${label}</span><span>${used} / ${cap} ${unit}</span></div><div class="meter-track"><span style="width:${pct}%"></span></div></div>`;
  }
  function dedicatedMinutes() { return has("dedicated") ? sliderValue("dedicated") : 0; }

  function overview() {
    const tiles = [];
    if (hasOps()) tiles.push(tile("Chats answered (7 days)", 84 + S.chat.filter((m) => m.from === "user").length, "92% without staff help"));
    if (hasVoice()) tiles.push(tile("Calls answered (7 days)", 37, "0 missed calls"));
    if (has("calendar")) tiles.push(tile("Bookings this week", S.bookings.length, "Confirmed on WhatsApp"));
    if (hasMkt()) tiles.push(tile("Posts published (month)", S.posts.filter((p) => p.status === "Published").length, `${S.posts.filter((p) => p.status === "Awaiting approval").length} waiting for your approval`));
    if (hasMkt()) tiles.push(tile("Social reach (month)", "12,480", "+18% vs last month"));
    if (has("whatsapp")) tiles.push(tile("WhatsApp messages", 214, "Read rate 89%"));
    const meters = [];
    if (has("voice")) meters.push(meter("Shared-line minutes", 38, 100, "min"));
    if (has("dedicated")) meters.push(meter("Business-number minutes", Math.round(dedicatedMinutes() * 0.3), dedicatedMinutes(), "min"));
    if (hasMkt()) meters.push(meter("Posts this month", S.posts.filter((p) => p.status !== "Awaiting approval").length, Math.max(5, sliderValue("posts")), "posts"));
    if (has("email")) meters.push(meter("Email campaigns", 1, sliderValue("email"), "emails"));
    const feed = [];
    if (hasVoice()) feed.push(["Call answered", "Customer asked about prices — summary sent to WhatsApp", "12 min ago"]);
    if (has("calendar")) feed.push(["New booking", S.bookings[S.bookings.length - 1].who + " — " + S.bookings[S.bookings.length - 1].when, "1 hr ago"]);
    if (hasOps()) feed.push(["Chat", "Visitor asked for location — map link shared", "2 hr ago"]);
    if (hasMkt()) feed.push(["Post published", S.posts[0].title, "Yesterday"]);
    return `<div class="tiles">${tiles.join("")}</div>
      ${meters.length ? `<div class="card"><p class="wizard-section-title">Usage this month</p>${meters.join("")}</div>` : ""}
      <div class="card"><p class="wizard-section-title">Latest activity</p>
        <ul class="feed">${feed.map(([a, b2, c]) => `<li><strong>${a}</strong><span>${esc(b2)}</span><em>${c}</em></li>`).join("")}</ul></div>`;
  }

  // ----- Chat simulator -----
  function chat() {
    const multi = has("multilang");
    const chips = ["What are your prices?", `Book an ${biz().bookingWord}`, "Where are you located?", "What are your timings?"];
    if (multi) chips.push("فیس کتنی ہے؟", "Aap kahan hain?");
    return `<div class="split">
      <div class="card chat-card">
        <div class="chat-top"><strong>${esc(S.details.business)}</strong><span>AI assistant · online</span>
          ${multi ? `<span class="lang-toggle"><button type="button" data-lang="en" class="${S.chatLang === "en" ? "active" : ""}">English</button><button type="button" data-lang="ur" class="${S.chatLang === "ur" ? "active" : ""}">اردو</button></span>` : ""}
        </div>
        <div class="chat-log" id="chat-log"></div>
        <div class="chip-row">${chips.map((c) => `<button type="button" class="chip" data-say="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        <form class="chat-form" id="chat-form"><input id="chat-input" placeholder="Type like a customer would…" autocomplete="off"><button class="btn btn-primary btn-small">Send</button></form>
      </div>
      <aside class="card">
        <p class="wizard-section-title">How to show this</p>
        <ol class="howto">
          <li>Ask the prospect to type a real customer question.</li>
          <li>Try booking: ${has("calendar") ? "the booking appears in the Bookings tab." : "without Calendar Booking the agent sends callers to the phone — a natural upsell."}</li>
          <li>${multi ? "Type in Urdu or switch to اردو — the agent replies in Urdu." : "Type in Urdu: without Multi-language the agent replies in English."}</li>
        </ol>
        <p class="wizard-section-title">Install on the website</p>
        <pre class="code">&lt;script src="…/codefounder-chat.js"
  data-business="${esc(S.details.business.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}"&gt;&lt;/script&gt;</pre>
        <p class="note">Sample snippet for the demo. The partner team installs the real one during setup.</p>
      </aside>
    </div>`;
  }

  function botReply(text) {
    const b = biz(); const d = S.details;
    const urduScript = /[؀-ۿ]/.test(text);
    const t = text.toLowerCase();
    const roman = has("multilang") && !urduScript && S.chatLang !== "ur" && ROMAN_WORDS.test(t);
    const urdu = has("multilang") && (urduScript || S.chatLang === "ur");
    const L = urdu ? URDU : roman ? ROMAN : null;
    const is = (re) => re.test(t);
    const services = b.services.map(([n, p]) => `${n} ${formatPKR(p)}`).join(" · ");
    const slot = dayLabel(1, "4:00 pm");
    let reply;
    if (is(/book|appointment|reserve|table|slot|بک|اپائنٹمنٹ|ٹیبل|وقت چاہیے/)) {
      if (has("calendar")) {
        S.bookings.push({ who: "Website visitor", what: b.services[0][0], when: slot, via: "Website chat" });
        reply = L ? L.bookYes(slot) : `Done! I've booked your ${b.bookingWord} for ${slot}. You'll get a WhatsApp confirmation shortly.`;
      } else {
        reply = L ? L.bookNo(d.phone) : `To book, please call us on ${d.phone}. Our team will confirm a time.`;
      }
    } else if (is(/price|cost|fee|rate|charges|kitn|قیمت|فیس|کتن|ریٹ/)) {
      reply = L ? L.price(services) : `Our prices: ${services}.`;
    } else if (is(/where|location|address|kahan|kidhar|کہاں|پتہ|لوکیشن/)) {
      reply = L ? L.location(d.city) : `We're in ${d.city}. I can send the map location on WhatsApp.`;
    } else if (is(/time|timing|open|hours|close|کب|اوقات|کھل|ٹائم/)) {
      reply = L ? L.hours(d.hours) : `We're open ${d.hours}.`;
    } else if (is(/^(hi|hello|salam|assalam|aoa)|السلام|سلام/)) {
      reply = L ? L.greet(d.business) : `Hello! I'm the assistant for ${d.business}. How can I help you today?`;
    } else {
      reply = L ? L.fallback() : "Thanks! I've passed your question to the team and they'll get back to you shortly.";
    }
    if (urduScript && !has("multilang")) reply += " (Urdu replies need the Multi-language add-on.)";
    return { text: reply, rtl: urdu };
  }

  function drawChat() {
    const log = $("#chat-log");
    if (!S.chat.length) {
      S.chat.push({ from: "bot", text: `Hello! I'm the assistant for ${S.details.business}. Ask me about prices, timings or bookings.` });
    }
    log.innerHTML = S.chat.map((m) => `<div class="msg ${m.from}${m.rtl ? " rtl" : ""}" ${m.rtl ? 'dir="rtl"' : ""}>${esc(m.text)}</div>`).join("");
    log.scrollTop = log.scrollHeight;
  }

  function say(text) {
    if (!text.trim()) return;
    S.chat.push({ from: "user", text, rtl: /[؀-ۿ]/.test(text) });
    drawChat();
    const log = $("#chat-log");
    const typing = document.createElement("div");
    typing.className = "msg bot typing"; typing.textContent = "typing…";
    log.appendChild(typing); log.scrollTop = log.scrollHeight;
    setTimeout(() => {
      const r = botReply(text);
      S.chat.push({ from: "bot", text: r.text, rtl: r.rtl });
      save(); drawChat();
    }, 700);
  }

  function wireChat() {
    drawChat();
    $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chat-input"); say(i.value); i.value = ""; });
    $$("[data-say]").forEach((c) => c.addEventListener("click", () => say(c.dataset.say)));
    $$("[data-lang]").forEach((b) => b.addEventListener("click", () => { S.chatLang = b.dataset.lang; save(); renderDashboard(); }));
  }

  // ----- Calls -----
  function calls() {
    const b = biz();
    const number = has("dedicated")
      ? `<div class="card"><p class="wizard-section-title">Your business number</p><p class="big-number">+92 42 0000 0000 <span class="pill">demo number</span></p><p class="note">${dedicatedMinutes()} minutes a month included. Customers call this number and the agent answers 24/7.</p></div>`
      : `<div class="card"><p class="wizard-section-title">Shared line</p><p class="note">Calls forward from your existing number to the CodeFounder shared line. 100 pooled minutes a month. Add a dedicated number to get your own line.</p></div>`;
    const rows = [
      ["Ali Hassan", "0321 •••• 482", dayLabel(0, "6:12 pm"), "2:41", `Asked about ${b.services[0][0].toLowerCase()} price`, "Info given"],
      ["Unknown", "0300 •••• 115", dayLabel(0, "3:05 pm"), "1:58", `Wanted a ${b.bookingWord} tomorrow`, has("calendar") ? "Booked" : "Callback requested"],
      ["Mehwish", "0333 •••• 907", dayLabel(-1, "8:47 pm"), "0:52", "Asked for opening hours", "Info given"],
      ["Kamran", "0345 •••• 233", dayLabel(-1, "11:20 am"), "3:30", "Complaint — wants manager to call", "Sent to owner on WhatsApp"]
    ];
    return number + `<div class="card"><p class="wizard-section-title">Recent calls${has("multilang") ? " · answered in Urdu or English" : ""}</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Caller</th><th>Number</th><th>When</th><th>Length</th><th>Summary</th><th>Outcome</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 5 ? ' class="ok"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  }

  // ----- Bookings -----
  function bookings() {
    return `<div class="card"><p class="wizard-section-title">Upcoming bookings</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Service</th><th>When</th><th>Booked via</th></tr></thead>
      <tbody>${S.bookings.map((x) => `<tr><td>${esc(x.who)}</td><td>${esc(x.what)}</td><td>${esc(x.when)}</td><td><span class="pill">${esc(x.via)}</span></td></tr>`).join("")}</tbody></table></div>
      <p class="note">Bookings made in the Website chat tab appear here instantly. Customers get WhatsApp reminders 2 hours before.</p></div>`;
  }

  // ----- Content -----
  function content() {
    return `<div class="post-grid">${S.posts.map((p, i) => `<article class="card post">
        <div class="post-img">${esc(p.title.split(" ").slice(0, 3).join(" "))}</div>
        <p class="post-title">${esc(p.title)}</p>
        <p class="note">${p.channels.map((c) => `<span class="pill">${c}</span>`).join(" ")} · ${esc(p.when)}</p>
        <p class="status s-${p.status.split(" ")[0].toLowerCase()}">${p.status}</p>
        ${p.status === "Awaiting approval" ? `<div class="post-actions"><button type="button" class="btn btn-primary btn-small" data-approve="${i}">Approve</button><button type="button" class="btn btn-outline btn-small" data-edit="${i}">Ask for changes</button></div>` : ""}
      </article>`).join("")}</div>`;
  }
  function wireContent() {
    $$("[data-approve]").forEach((b) => b.addEventListener("click", () => { S.posts[+b.dataset.approve].status = "Scheduled"; save(); renderDashboard(); }));
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => {
      const p = S.posts[+b.dataset.edit];
      p.title = p.title + " (revised)"; save(); renderDashboard();
    }));
  }

  // ----- WhatsApp -----
  function whatsapp() {
    const b = biz();
    const rows = [
      ["Weekend offer", "All customers (1,240)", dayLabel(-2, "6:00 pm"), "Delivered 1,198 · Read 1,061"],
      [b.posts[1], "Repeat customers (420)", dayLabel(-6, "7:30 pm"), "Delivered 415 · Read 377"],
      ["Booking reminders", "Automatic", "Every day", has("calendar") ? "Sent 2 hours before each booking" : "Needs Calendar Booking"]
    ];
    return `<div class="card"><p class="wizard-section-title">WhatsApp broadcasts and replies</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Message</th><th>Audience</th><th>Sent</th><th>Result</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="note">The agent also answers incoming WhatsApp questions using the same knowledge as the website chat.</p></div>`;
  }

  // ----- Email -----
  function email() {
    const n = sliderValue("email");
    const b = biz();
    const rows = Array.from({ length: Math.min(n, 4) }, (_, i) => [b.posts[(i + 2) % b.posts.length], dayLabel(i * 7 - 7, "10:00 am"), i === 0 ? "Sent · 41% opened" : "Scheduled"]);
    return `<div class="card"><p class="wizard-section-title">Email campaigns (${n} a month)</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Campaign</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  }

  // ----- Billing -----
  function billing() {
    const next = new Date(); next.setMonth(next.getMonth() + 1, 1);
    return `<div class="split"><div class="card"><p class="wizard-section-title">Your plan</p>
      <table class="review-table"><tbody>${lineItems().map((i) => `<tr><td>${esc(i.label)}</td><td>${formatPKR(i.price)}</td></tr>`).join("")}
      <tr class="total"><td>Monthly total</td><td>${formatPKR(total())}</td></tr></tbody></table></div>
      <aside class="card"><p class="wizard-section-title">Next invoice</p><p class="big-number">${formatPKR(total())}</p>
      <p class="note">Due ${next.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${esc(S.pay)}</p>
      <button type="button" class="btn btn-outline btn-block" data-next="configure">Change features</button></aside></div>`;
  }

  render();
})();
