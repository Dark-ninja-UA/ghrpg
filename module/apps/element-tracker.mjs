/**
 * element-tracker.mjs
 * Shared world-level Element Tracker for GHRPG.
 * Stores state in a world Setting so all connected clients see the same values.
 * GM can cycle states; players can view (and optionally interact, configurable).
 */

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const SETTING_KEY = "elementStates";

const ELEMENTS = [
  { key: "air",   label: "Air",   icon: "🌀", color: "#a0c8ff" },
  { key: "dark",  label: "Dark",  icon: "🌑", color: "#9966cc" },
  { key: "earth", label: "Earth", icon: "🪨", color: "#a0784a" },
  { key: "fire",  label: "Fire",  icon: "🔥", color: "#ff6030" },
  { key: "ice",   label: "Ice",   icon: "❄",  color: "#80d8ff" },
  { key: "light", label: "Light", icon: "☀",  color: "#ffe066" },
];

const STATES = ["inert", "strong", "waning"];

export class ElementTracker extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ghrpg-element-tracker",
    classes: ["ghrpg", "element-tracker"],
    position: { width: 340, height: "auto", top: 60, left: 120 },
    window: {
      title:     "GHRPG.ElementTracker.Title",
      resizable: false,
      minimizable: true,
    },
    actions: {
      cycleElement:  ElementTracker._onCycleElement,
      decayAll:      ElementTracker._onDecayAll,
      resetAll:      ElementTracker._onResetAll,
    }
  };

  static PARTS = {
    tracker: { template: "systems/ghrpg/templates/apps/element-tracker.hbs" }
  };

  /** Register the world setting that persists element states */
  static registerSettings() {
    game.settings.register("ghrpg", SETTING_KEY, {
      name:    "Element States",
      scope:   "world",
      config:  false,
      type:    Object,
      default: { air:"inert", dark:"inert", earth:"inert", fire:"inert", ice:"inert", light:"inert" },
      onChange: () => {
        // Re-render all open element tracker windows when state changes
        for (const app of Object.values(ui.windows ?? {})) {
          if (app instanceof ElementTracker) app.render();
        }
        // Also refresh via global instance if present
        game.ghrpg?.elementTracker?.render();
      }
    });
  }

  /** Get current element states from world setting */
  static getStates() {
    return game.settings.get("ghrpg", SETTING_KEY);
  }

  /** Set element states in world setting (GM only) */
  static async setStates(states) {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can change element states.");
      return;
    }
    await game.settings.set("ghrpg", SETTING_KEY, states);
  }

  /** Cycle a single element inert → strong → waning → inert */
  static async cycleElement(key) {
    const states  = { ...ElementTracker.getStates() };
    const current = states[key] ?? "inert";
    const idx     = STATES.indexOf(current);
    states[key]   = STATES[(idx + 1) % STATES.length];
    await ElementTracker.setStates(states);
  }

  /** Decay all elements one step (strong → waning → inert) */
  static async decayAll() {
    const decay = { inert: "inert", strong: "waning", waning: "inert" };
    const states = { ...ElementTracker.getStates() };
    for (const key of Object.keys(states)) {
      states[key] = decay[states[key] ?? "inert"] ?? "inert";
    }
    await ElementTracker.setStates(states);
  }

  /** Reset all elements to inert */
  static async resetAll() {
    const states = {};
    for (const { key } of ELEMENTS) states[key] = "inert";
    await ElementTracker.setStates(states);
  }

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    const states   = ElementTracker.getStates();
    const isGM     = game.user.isGM;
    const elements = ELEMENTS.map(el => ({
      ...el,
      state:      states[el.key] ?? "inert",
      stateLabel: (states[el.key] ?? "inert").charAt(0).toUpperCase() + (states[el.key] ?? "inert").slice(1),
      isStrong:   states[el.key] === "strong",
      isWaning:   states[el.key] === "waning",
    }));
    return { ...context, elements, isGM };
  }

  // ── Action handlers ──────────────────────────────────────────────

  static async _onCycleElement(event, target) {
    const key = target.closest("[data-element]")?.dataset.element;
    if (key) await ElementTracker.cycleElement(key);
  }

  static async _onDecayAll(event, target) {
    await ElementTracker.decayAll();
  }

  static async _onResetAll(event, target) {
    if (!await foundry.applications.api.DialogV2.confirm({
      window: { title: "Reset Elements" },
      content: "<p>Reset all elements to Inert?</p>",
    })) return;
    await ElementTracker.resetAll();
  }
}
