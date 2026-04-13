import { PerkEditorDialog } from "../apps/perk-editor.mjs";
/**
 * item-sheet.mjs — GHRPGItemSheet, Foundry v13
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class GHRPGItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["ghrpg", "sheet", "item"],
    position: { width: 520, height: 560 },
    window: { resizable: true },
    form:   { submitOnChange: true, closeOnSubmit: false },
    actions: {
      unlinkSkill:  GHRPGItemSheet._onUnlinkSkill,
      unlinkTalent: GHRPGItemSheet._onUnlinkTalent,
    }
  };

  static PARTS = {
    sheet: { template: "systems/ghrpg/templates/items/item-sheet.hbs", scrollable: [""] }
  };

  get title() {
    const typeLabel = game.i18n.localize(`GHRPG.ItemTypes.${this.item.type}`) || this.item.type;
    return `${this.item.name} (${typeLabel})`;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;
    el.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", () => this._saveField(input));
    });

    // Wire perk buttons manually (class items)
    if (this.item.type === "class") {
      el.querySelector("[data-action='addPerk']")?.addEventListener("click", () => {
        new PerkEditorDialog(this.item, null, -1).render(true);
      });
      el.querySelectorAll("[data-action='editPerk']").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx  = Number(btn.dataset.perkIndex);
          const perk = this.item.system.perks?.[idx];
          if (perk) new PerkEditorDialog(this.item, perk, idx).render(true);
        });
      });
      el.querySelectorAll("[data-action='deletePerk']").forEach(btn => {
        btn.addEventListener("click", async () => {
          const idx   = Number(btn.dataset.perkIndex);
          const perks = foundry.utils.deepClone(this.item.system.perks ?? []);
          const perk  = perks[idx];
          if (!perk) return;
          const ok = await Dialog.confirm({
            title:   "Delete Perk",
            content: `<p>Delete "<strong>${perk.label}</strong>"?</p>`,
          });
          if (!ok) return;
          perks.splice(idx, 1);
          await this.item.update({ "system.perks": perks });
        });
      });
    }

    // Drop zones for ancestry and class skill/talent linking
    if (this.item.type === "ancestry" || this.item.type === "class") {
      el.querySelectorAll(".ancestry-link-drop").forEach(zone => {
        zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
        zone.addEventListener("drop", e => {
          zone.classList.remove("drag-over");
          this._onDropLink(e, zone.dataset.dropType);
        });
      });
    }
  }

  async _onDropLink(event, dropType) {
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data.type !== "Item") return;

    const dropped = await fromUuid(data.uuid);
    if (!dropped) return;

    const expectedType = dropType; // "skill" or "talent"
    if (dropped.type !== expectedType) {
      ui.notifications.warn(`Expected a ${expectedType} item.`);
      return;
    }

    const field   = dropType === "skill" ? "system.skillIds" : "system.talentIds";
    const current = dropType === "skill"
      ? (this.item.system.skillIds ?? [])
      : (this.item.system.talentIds ?? []);

    if (current.includes(dropped.id)) {
      ui.notifications.info(`${dropped.name} is already linked.`);
      return;
    }

    await this.item.update({ [field]: [...current, dropped.id] });
  }

  static async _onUnlinkSkill(event, target) {
    const id      = target.dataset.itemId;
    const current = this.item.system.skillIds ?? [];
    await this.item.update({ "system.skillIds": current.filter(x => x !== id) });
  }

  static async _onUnlinkTalent(event, target) {
    const id      = target.dataset.itemId;
    const current = this.item.system.talentIds ?? [];
    await this.item.update({ "system.talentIds": current.filter(x => x !== id) });
  }

  async _saveField(input) {
    const name = input.name;
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

    // Resolve linked skill/talent items for ancestry and class sheets
    let linkedSkills  = [];
    let linkedTalents = [];
    if (item.type === "ancestry" || item.type === "class") {
      const allItems = game.items ?? [];
      linkedSkills  = (system.skillIds  ?? []).map(id => allItems.get(id)).filter(Boolean);
      linkedTalents = (system.talentIds ?? []).map(id => allItems.get(id)).filter(Boolean);
    }

    return {
      ...context,
      item, system,
      categoryOptions: { occupation:"Occupation", origin:"Origin", social:"Social" },
      slotOptions:     { head:"Head", body:"Body", feet:"Feet", hand:"Hand", small:"Small" },
      rarityOptions:   { common:"Common", uncommon:"Uncommon", rare:"Rare", masterwork:"Masterwork", legendary:"Legendary" },
      sourceOptions:   { class:"Class Skill", ancestry:"Ancestry Skill", other:"Other" },
      isOwned:         !!item.parent,
      isSkill:         item.type === "skill",
      isTalent:        item.type === "talent",
      isBackground:    item.type === "background",
      isEquipment:     item.type === "equipment",
      isAncestry:      item.type === "ancestry",
      isClass:         item.type === "class",
      linkedSkills,
      linkedTalents,
      startingAttributes: item.type === "class" ? system.startingAttributes : null,
    };
  }
}
