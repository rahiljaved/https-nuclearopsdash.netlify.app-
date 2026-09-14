/**
 * Pricing configuration for CodeFounder's two-track agent model:
 * Operations Agent, Marketing Agent, Bundle (both), and Custom (sales-assisted).
 * All amounts are CAD, billed monthly.
 */
const PRICING = {

  operations: {
    label: "Operations Agent",
    subtitle: "Calls, bookings and website chat — pick only what you need.",
    base: 19,
    includes: [
      "Website chat widget",
      "Live client dashboard",
      "AI answers to visitor questions"
    ],
    addons: [
      {
        id: "voice",
        label: "Voice Agent (call pickup)",
        detail: "Shared line answers inbound calls, up to 100 min/mo pooled.",
        price: 10,
        type: "toggle"
      },
      {
        id: "dedicated",
        label: "Dedicated Business Number",
        detail: "Your own phone number, included minutes, scalable by volume.",
        price: 20,
        type: "toggle-slider",
        slider: {
          min: 200,
          max: 2000,
          step: 100,
          includedAtBase: 200,
          extraBlockSize: 100,
          extraBlockPrice: 5,
          unitLabel: "min/mo"
        }
      },
      {
        id: "multilang",
        label: "Multi-language Support",
        detail: "Handle calls and chat in additional languages.",
        price: 10,
        type: "toggle"
      },
      {
        id: "calendar",
        label: "Calendar Booking",
        detail: "Let the agent book, reschedule and confirm appointments.",
        price: 10,
        type: "toggle"
      }
    ]
  },

  marketing: {
    label: "Marketing Agent",
    subtitle: "Social media and email, sized to how often you post.",
    base: 29,
    includes: [
      "Facebook + Instagram posting",
      "5 posts / month",
      "Content calendar & approvals"
    ],
    addons: [
      {
        id: "linkedin",
        label: "LinkedIn Channel",
        detail: "Add LinkedIn to your posting schedule.",
        price: 10,
        type: "toggle"
      },
      {
        id: "whatsapp",
        label: "WhatsApp Business Channel",
        detail: "Broadcast updates and respond via WhatsApp.",
        price: 10,
        type: "toggle"
      },
      {
        id: "posts",
        label: "More Posts per Month",
        detail: "Base plan includes 5 posts/mo.",
        type: "slider",
        slider: {
          min: 5,
          max: 30,
          step: 5,
          includedAtBase: 5,
          extraBlockSize: 5,
          extraBlockPrice: 8,
          unitLabel: "posts/mo"
        }
      },
      {
        id: "email",
        label: "Email Marketing",
        detail: "Scheduled email campaigns to your list.",
        type: "slider",
        slider: {
          min: 0,
          max: 20,
          step: 5,
          includedAtBase: 0,
          extraBlockSize: 5,
          extraBlockPrice: 10,
          unitLabel: "emails/mo"
        }
      }
    ]
  },

  bundle: {
    label: "Bundle",
    subtitle: "Operations + Marketing in one configurator, one dashboard.",
    base: 49,
    includes: [
      "Everything in Operations base",
      "Everything in Marketing base",
      "One dashboard for both agents"
    ],
    // Bundle reuses the same add-on catalogs as Operations + Marketing.
    groups: [
      { title: "Operations add-ons", source: "operations" },
      { title: "Marketing add-ons", source: "marketing" }
    ]
  }
};

/**
 * Computes the price contribution of a single add-on given its current state.
 * state: { checked: bool, sliderValue: number }
 */
function computeAddonCost(addon, state) {
  if (!state) return 0;

  if (addon.type === "toggle") {
    return state.checked ? addon.price : 0;
  }

  if (addon.type === "toggle-slider") {
    if (!state.checked) return 0;
    const s = addon.slider;
    const value = state.sliderValue ?? s.includedAtBase;
    const extraUnits = Math.max(0, value - s.includedAtBase);
    const extraBlocks = Math.ceil(extraUnits / s.extraBlockSize);
    return addon.price + extraBlocks * s.extraBlockPrice;
  }

  if (addon.type === "slider") {
    const s = addon.slider;
    const value = state.sliderValue ?? s.includedAtBase;
    const extraUnits = Math.max(0, value - s.includedAtBase);
    const extraBlocks = Math.ceil(extraUnits / s.extraBlockSize);
    return extraBlocks * s.extraBlockPrice;
  }

  return 0;
}

function formatCAD(amount) {
  return "CAD $" + Math.round(amount) + "/mo";
}
