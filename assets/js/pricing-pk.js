/**
 * Pakistan (PKR) client prices for the partner demo.
 * Reuses the add-on catalog from pricing.js and overrides only the amounts.
 * Amounts are the suggested client prices from the Pakistan partner price list
 * (CodeFounder_Pakistan_Partner_Pricing.xlsx, 11 Oct 2026). Update both together.
 */
const PKR_PRICES = {
  operations: { base: 4000, addons: { voice: 4700, dedicated: 14200, multilang: 1400, calendar: 1000 } },
  marketing:  { base: 5200, addons: { linkedin: 1400, whatsapp: 2700 } },
  bundle:     { base: 8400 },
  // Per-block prices for slider add-ons (extra 100 min, extra 5 posts, 5 emails).
  blocks:     { dedicated: 5900, posts: 2000, email: 2000 }
};

const PRICING_PK = (function () {
  const copy = JSON.parse(JSON.stringify(PRICING));
  ["operations", "marketing", "bundle"].forEach((key) => {
    copy[key].base = PKR_PRICES[key].base;
    (copy[key].addons || []).forEach((addon) => {
      const p = PKR_PRICES[key].addons || {};
      if (p[addon.id] !== undefined) addon.price = p[addon.id];
      if (addon.slider && PKR_PRICES.blocks[addon.id] !== undefined) {
        addon.slider.extraBlockPrice = PKR_PRICES.blocks[addon.id];
      }
    });
  });
  copy.marketing.subtitle = "Facebook, Instagram, WhatsApp and email — sized to how often you post.";
  copy.operations.addons.find((a) => a.id === "multilang").detail = "Answer calls and chat in Urdu, Roman Urdu and English.";
  return copy;
})();

function formatPKR(amount) {
  return "Rs " + Math.round(amount).toLocaleString("en-PK");
}
