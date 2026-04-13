/**
 * item-sheet.mjs — GHRPGItemSheet, Foundry v13
 * Fixed: extends resolved at class body parse time (not top-level destructure)
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class GHRPGItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["ghrpg", "sheet", "item"],
    position: { width: 520, height: 480 },
    window: { resizable: true },
    form:   { submitOnChange: true, closeOnSubmit: false },
    actions: {}
  };

  static PARTS = {
    sheet: { template: "systems/ghrpg/templates/items/item-sheet.hbs" }
  };

  get title() {
    const typeLabel = game.i18n.localize(`GHRPG.ItemTypes.${this.item.type}`) || this.item.type;
    return `${this.item.name} (${typeLabel})`;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Auto-save all form inputs on change (Foundry v13 ApplicationV2 doesn't do this automatically)
    const el = this.element;
    el.querySelectorAll("input, select, textarea").forEach(input => {
      const evt = (input.tagName === "SELECT" || input.type === "checkbox") ? "change" : "change";
      input.addEventListener(evt, () => this._saveField(input));
    });
  }

  async _saveField(input) {
    const name  = input.name;
    if (!name) return;
    let value;
    if (input.type === "checkbox") value = input.checked;
    else if (input.type === "number") value = input.value === "" ? null : Number(input.value);
    else value = input.value;
    await this.item.update({ [name]: value });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.item;
    const system  = item.system;

    return {
      ...context,
      item, system,
      categoryOptions: { occupation:"Occupation", origin:"Origin", social:"Social" },
      slotOptions:     { head:"Head", body:"Body", feet:"Feet", hand:"Hand", small:"Small" },
      rarityOptions:   { common:"Common", uncommon:"Uncommon", rare:"Rare", masterwork:"Masterwork", legendary:"Legendary" },
      sourceOptions:   { class:"Class Skill", ancestry:"Ancestry Skill" },
      isOwned:         !!item.parent,
      isSkill:         item.type === "skill",
      isTalent:        item.type === "talent",
      isBackground:    item.type === "background",
      isEquipment:     item.type === "equipment",
    };
  }
}
