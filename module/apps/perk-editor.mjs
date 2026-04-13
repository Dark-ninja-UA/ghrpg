/**
 * perk-editor.mjs
 * Dialog for creating/editing a perk definition on a Class item.
 * Opens as a floating ApplicationV2 window.
 */

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// Base deck card options for removal selection
export const BASE_DECK_REMOVABLE = [
  { id: "null_1",   label: "+1 / −2 (Null) #1" },
  { id: "null_2",   label: "+1 / −2 (Null) #2" },
  { id: "a1_1",     label: "+2 / −1 #1" },
  { id: "a1_2",     label: "+2 / −1 #2" },
  { id: "a2_1",     label: "+3 / ±0 #1" },
  { id: "a2_2",     label: "+3 / ±0 #2" },
  { id: "a2_3",     label: "+3 / ±0 #3" },
  { id: "a3_1",     label: "+4 / +1 #1" },
  { id: "a3_2",     label: "+4 / +1 #2" },
  { id: "a4_1",     label: "+5 / +2 #1" },
  { id: "a4_2",     label: "+5 / +2 #2" },
  { id: "crit_1",   label: "Critical #1" },
  { id: "crit_2",   label: "Critical #2" },
];

export const EFFECT_TYPES = [
  "poison","wound","muddle","stun","immobilize",
  "pierce","push","pull","heal","strengthen","curse","bless","invisible"
];

export class PerkEditorDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(classItem, perkData = null, perkIndex = -1, options = {}) {
    super(options);
    this.classItem  = classItem;
    this.perkData   = perkData ? foundry.utils.deepClone(perkData) : PerkEditorDialog.emptyPerk();
    this.perkIndex  = perkIndex; // -1 = new perk
  }

  static emptyPerk() {
    return {
      id:      foundry.utils.randomID(),
      label:   "",
      maxTimes: 1,
      removeCards: [],
      addCards: []
    };
  }

  static emptyCard() {
    return { atkMod: 0, attrMod: 0, effects: [], flavor: "" };
  }

  static DEFAULT_OPTIONS = {
    id:      "ghrpg-perk-editor",
    classes: ["ghrpg", "perk-editor-dialog"],
    position: { width: 520, height: "auto", top: 100, left: 200 },
    window: { title: "Edit Perk", resizable: true, minimizable: false },
    actions: {
      addCard:        PerkEditorDialog._onAddCard,
      removeCard:     PerkEditorDialog._onRemoveCard,
      addEffect:      PerkEditorDialog._onAddEffect,
      removeEffect:   PerkEditorDialog._onRemoveEffect,
      savePerk:       PerkEditorDialog._onSavePerk,
      cancel:         PerkEditorDialog._onCancel,
    }
  };

  static PARTS = {
    dialog: { template: "systems/ghrpg/templates/apps/perk-editor.hbs", scrollable: [".perk-editor-body"] }
  };

  get title() {
    return this.perkIndex === -1 ? "Add Perk" : "Edit Perk";
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      perk:          this.perkData,
      baseDeckCards: BASE_DECK_REMOVABLE,
      effectTypes:   EFFECT_TYPES,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Live-update perkData from inputs without saving to item
    this.element.querySelectorAll("[data-perk-field]").forEach(input => {
      input.addEventListener("change", () => this._onFieldChange(input));
      input.addEventListener("input",  () => this._onFieldChange(input));
    });
  }

  _onFieldChange(input) {
    const field = input.dataset.perkField;
    const val   = input.type === "number" ? Number(input.value)
                : input.type === "checkbox" ? input.checked
                : input.value;

    // Handle nested paths like "addCards.0.atkMod" or "addCards.0.effects.0.type"
    const parts = field.split(".");
    let obj = this.perkData;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = val;
  }

  /* ── Card management ────────────────────────────────────────── */

  static _onAddCard(event, target) {
    this.perkData.addCards.push(PerkEditorDialog.emptyCard());
    this.render();
  }

  static _onRemoveCard(event, target) {
    const idx = Number(target.dataset.cardIndex);
    this.perkData.addCards.splice(idx, 1);
    this.render();
  }

  static _onAddEffect(event, target) {
    const cardIdx = Number(target.dataset.cardIndex);
    this.perkData.addCards[cardIdx].effects.push({ type: "poison", value: null, optional: false });
    this.render();
  }

  static _onRemoveEffect(event, target) {
    const cardIdx   = Number(target.dataset.cardIndex);
    const effectIdx = Number(target.dataset.effectIndex);
    this.perkData.addCards[cardIdx].effects.splice(effectIdx, 1);
    this.render();
  }

  /* ── Save / Cancel ──────────────────────────────────────────── */

  static async _onSavePerk(event, target) {
    // Collect all current input values before saving
    this._collectAllInputs();

    if (!this.perkData.label.trim()) {
      ui.notifications.warn("Perk must have a label.");
      return;
    }

    const perks = foundry.utils.deepClone(this.classItem.system.perks ?? []);
    if (this.perkIndex === -1) {
      perks.push(this.perkData);
    } else {
      perks[this.perkIndex] = this.perkData;
    }

    await this.classItem.update({ "system.perks": perks });
    ui.notifications.info(`Perk "${this.perkData.label}" saved.`);
    this.close();
  }

  static _onCancel(event, target) {
    this.close();
  }

  _collectAllInputs() {
    this.element.querySelectorAll("[data-perk-field]").forEach(input => {
      const field = input.dataset.perkField;
      const val   = input.type === "number"   ? Number(input.value)
                  : input.type === "checkbox"  ? input.checked
                  : input.value;
      const parts = field.split(".");
      let obj = this.perkData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) return;
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = val;
    });

    // Collect removeCards checkboxes
    this.perkData.removeCards = [];
    this.element.querySelectorAll("[data-remove-card]:checked").forEach(cb => {
      this.perkData.removeCards.push(cb.dataset.removeCard);
    });
  }
}
