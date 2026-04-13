/**
 * npc-sheet.mjs — GHRPGNPCSheet, Foundry v13
 * Fixed: private #methods → regular static, class resolved at runtime not top-level
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class GHRPGNPCSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["ghrpg", "sheet", "actor", "npc"],
    position: { width: 560, height: 500 },
    window: { resizable: true },
    form:   { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttribute:   GHRPGNPCSheet._onRollAttribute,
      drawCard:        GHRPGNPCSheet._onDrawCard,
      reshuffleDeck:   GHRPGNPCSheet._onReshuffleDeck,
      toggleCondition: GHRPGNPCSheet._onToggleCondition,
    }
  };

  static PARTS = {
    sheet: { template: "systems/ghrpg/templates/actors/npc-sheet.hbs", scrollable: [""] },
  };

  get title() { return this.actor.name ?? "NPC"; }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("input[name], select[name], textarea[name]").forEach(input => {
      input.addEventListener("change", () => this._saveField(input));
    });
  }

  async _saveField(input) {
    const name = input.name;
    if (!name) return;
    let value;
    if (input.type === "checkbox") value = input.checked;
    else if (input.type === "number") value = input.value === "" ? null : Number(input.value);
    else value = input.value;
    await this.actor.update({ [name]: value });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.actor;
    const system  = actor.system;

    const ATTR_KEYS = ["cunning","finesse","grit","intuition","logic","understanding"];
    const attributes = ATTR_KEYS.map(key => ({
      key,
      label: game.i18n.localize(`GHRPG.Attributes.${key}`) || key,
      abbr:  game.i18n.localize(`GHRPG.AttributeAbbr.${key}`) || key.slice(0,2).toUpperCase(),
      value: system.attributes?.[key]?.value ?? 0
    }));

    const negativeKeys = ["immobilize","muddle","pacify","poison","stun","wound"];
    const conditions = negativeKeys.map(key => ({
      key,
      label:  game.i18n.localize(`GHRPG.Conditions.Negative.${key}`) || key,
      active: system.conditions?.[key]?.active ?? false
    }));

    const deck    = system.modifierDeck?.deck    ?? [];
    const discard = system.modifierDeck?.discard ?? [];

    return {
      ...context,
      actor, system,
      attributes, conditions,
      deckCount:    deck.length,
      discardCount: discard.length,
      topDiscard:   discard.length ? discard[discard.length - 1] : null,
      hpPct:        Math.round((system.hp.value / (system.hp.max || 1)) * 100),
      isOwner:      actor.isOwner,
    };
  }

  static async _onRollAttribute(event, target) {
    const attrKey = target.dataset.attribute;
    if (!attrKey) return;
    await this.actor.rollAttributeTest(attrKey, { mode: "normal" });
  }

  static async _onDrawCard(event, target) {
    await this.actor.drawModifierCard("normal");
    this.render();
  }

  static async _onReshuffleDeck(event, target) {
    await this.actor.reshuffleModifierDeck();
    this.render();
  }

  static async _onToggleCondition(event, target) {
    const key = target.dataset.condition;
    if (!key) return;
    await this.actor.toggleCondition(key);
    this.render();
  }
}
