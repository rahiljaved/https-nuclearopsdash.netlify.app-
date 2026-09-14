(function () {
  const overlay = document.getElementById("wizard-overlay");
  const titleEl = document.getElementById("wizard-title");
  const subtitleEl = document.getElementById("wizard-subtitle");
  const bodyEl = document.getElementById("wizard-body");
  const totalEl = document.getElementById("wizard-total-amount");
  const ctaBtn = document.getElementById("wizard-cta");
  const closeBtn = document.getElementById("wizard-close");

  let currentPlanKey = null;
  let currentPlan = null;
  // state keyed by "sourceKey.addonId" -> { checked, sliderValue, addon }
  let state = {};

  function planAddonEntries(planKey) {
    const plan = PRICING[planKey];
    if (plan.addons) {
      return plan.addons.map((addon) => ({ source: planKey, addon }));
    }
    if (plan.groups) {
      const entries = [];
      plan.groups.forEach((group) => {
        PRICING[group.source].addons.forEach((addon) => {
          entries.push({ source: group.source, addon });
        });
      });
      return entries;
    }
    return [];
  }

  function stateKey(source, addonId) {
    return source + "." + addonId;
  }

  function buildIncludesBlock(plan) {
    const box = document.createElement("div");
    box.className = "wizard-included";
    plan.includes.forEach((line) => {
      const row = document.createElement("div");
      row.textContent = "✓ " + line;
      box.appendChild(row);
    });
    return box;
  }

  function buildAddonRow(source, addon) {
    const key = stateKey(source, addon.id);
    state[key] = state[key] || { checked: false, sliderValue: addon.slider ? addon.slider.includedAtBase : undefined, addon };

    const row = document.createElement("div");
    row.className = "addon-row-wrap";

    const mainRow = document.createElement("div");
    mainRow.className = "addon-row";

    const labelWrap = document.createElement("div");
    labelWrap.className = "addon-label";
    const strong = document.createElement("strong");
    strong.textContent = addon.label;
    const span = document.createElement("span");
    span.textContent = addon.detail || "";
    labelWrap.appendChild(strong);
    labelWrap.appendChild(span);

    mainRow.appendChild(labelWrap);

    const rightWrap = document.createElement("div");
    rightWrap.style.display = "flex";
    rightWrap.style.alignItems = "center";
    rightWrap.style.gap = "12px";

    let priceTag = null;
    if (addon.type !== "slider") {
      priceTag = document.createElement("span");
      priceTag.className = "addon-price";
      priceTag.textContent = "+$" + addon.price + "/mo";
      rightWrap.appendChild(priceTag);
    }

    let subBlock = null;

    if (addon.type === "toggle" || addon.type === "toggle-slider") {
      const label = document.createElement("label");
      label.className = "switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = state[key].checked;
      const track = document.createElement("span");
      track.className = "slider-track";
      label.appendChild(input);
      label.appendChild(track);
      rightWrap.appendChild(label);

      input.addEventListener("change", () => {
        state[key].checked = input.checked;
        if (subBlock) subBlock.hidden = !input.checked;
        updateTotal();
      });
    }

    mainRow.appendChild(rightWrap);
    row.appendChild(mainRow);

    if (addon.type === "toggle-slider" || addon.type === "slider") {
      subBlock = document.createElement("div");
      subBlock.className = "addon-sub" + (addon.type === "slider" ? "" : "");
      if (addon.type === "toggle-slider") {
        subBlock.hidden = !state[key].checked;
      }

      const s = addon.slider;
      const head = document.createElement("div");
      head.className = "slider-block-head";
      const headLabel = document.createElement("span");
      headLabel.textContent = "Included: " + s.includedAtBase + " " + s.unitLabel;
      const headValue = document.createElement("strong");
      headValue.textContent = state[key].sliderValue + " " + s.unitLabel;
      head.appendChild(headLabel);
      head.appendChild(headValue);

      const range = document.createElement("input");
      range.type = "range";
      range.min = s.min;
      range.max = s.max;
      range.step = s.step;
      range.value = state[key].sliderValue;

      range.addEventListener("input", () => {
        state[key].sliderValue = Number(range.value);
        headValue.textContent = range.value + " " + s.unitLabel;
        updateTotal();
      });

      const sliderBlock = document.createElement("div");
      sliderBlock.className = "slider-block";
      sliderBlock.appendChild(head);
      sliderBlock.appendChild(range);
      subBlock.appendChild(sliderBlock);
      row.appendChild(subBlock);
    }

    return row;
  }

  function updateTotal() {
    let total = currentPlan.base;
    Object.values(state).forEach((s) => {
      total += computeAddonCost(s.addon, s);
    });
    totalEl.textContent = formatCAD(total);
    return total;
  }

  function renderWizard(planKey) {
    currentPlanKey = planKey;
    currentPlan = PRICING[planKey];
    state = {};

    titleEl.textContent = "Configure your " + currentPlan.label + " plan";
    subtitleEl.textContent = currentPlan.subtitle;

    bodyEl.innerHTML = "";

    const includesTitle = document.createElement("p");
    includesTitle.className = "wizard-section-title";
    includesTitle.textContent = "Included in the base plan (CAD $" + currentPlan.base + "/mo)";
    bodyEl.appendChild(includesTitle);
    bodyEl.appendChild(buildIncludesBlock(currentPlan));

    if (currentPlan.groups) {
      currentPlan.groups.forEach((group) => {
        const groupTitle = document.createElement("p");
        groupTitle.className = "wizard-section-title";
        groupTitle.textContent = group.title;
        bodyEl.appendChild(groupTitle);
        PRICING[group.source].addons.forEach((addon) => {
          bodyEl.appendChild(buildAddonRow(group.source, addon));
        });
      });
    } else {
      const addonsTitle = document.createElement("p");
      addonsTitle.className = "wizard-section-title";
      addonsTitle.textContent = "Add only what you need";
      bodyEl.appendChild(addonsTitle);
      currentPlan.addons.forEach((addon) => {
        bodyEl.appendChild(buildAddonRow(planKey, addon));
      });
    }

    updateTotal();
  }

  function openWizard(planKey) {
    renderWizard(planKey);
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeWizard() {
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  function buildSummaryText() {
    const lines = [];
    lines.push(currentPlan.label + " plan (base CAD $" + currentPlan.base + "/mo)");
    Object.values(state).forEach((s) => {
      const cost = computeAddonCost(s.addon, s);
      if (cost <= 0 && s.addon.type !== "slider") return;
      if (s.addon.type === "toggle" && s.checked) {
        lines.push("+ " + s.addon.label + " (+$" + cost + "/mo)");
      } else if (s.addon.type === "toggle-slider" && s.checked) {
        lines.push("+ " + s.addon.label + " — " + s.sliderValue + " " + s.addon.slider.unitLabel + " (+$" + cost + "/mo)");
      } else if (s.addon.type === "slider" && s.sliderValue > s.addon.slider.includedAtBase) {
        lines.push("+ " + s.addon.label + " — " + s.sliderValue + " " + s.addon.slider.unitLabel + " (+$" + cost + "/mo)");
      }
    });
    lines.push("Estimated total: " + totalEl.textContent);
    return lines.join("\n");
  }

  document.querySelectorAll("[data-open-wizard]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openWizard(btn.getAttribute("data-open-wizard"));
    });
  });

  closeBtn.addEventListener("click", closeWizard);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWizard();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeWizard();
  });

  ctaBtn.addEventListener("click", () => {
    const messageField = document.getElementById("cf-message");
    if (messageField) {
      messageField.value = buildSummaryText();
    }
    closeWizard();
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
    if (messageField) {
      messageField.focus();
    }
  });
})();
