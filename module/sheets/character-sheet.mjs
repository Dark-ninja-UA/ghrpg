/**
 * character-sheet.mjs
 * GHRPGCharacterSheet – Foundry v13 ActorSheetV2
 * Fixed: private #methods → regular static, lazy class resolution, tab handling
 */

import { buildDeck, PERK_DEFINITIONS } from "../helpers/modifier-deck.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class GHRPGCharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["ghrpg", "sheet", "actor", "character"],
    position: { width: 820, height: 740 },
    window: { resizable: true },
    form:   { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttribute:   GHRPGCharacterSheet._onRollAttribute,
      drawCard:        GHRPGCharacterSheet._onDrawCard,
      reshuffleDeck:   GHRPGCharacterSheet._onReshuffleDeck,
      useSkill:        GHRPGCharacterSheet._onUseSkill,
      useTalent:       GHRPGCharacterSheet._onUseTalent,
      togglePrepared:  GHRPGCharacterSheet._onTogglePrepared,
      recoverSkill:    GHRPGCharacterSheet._onRecoverSkill,
      quickBreath:     GHRPGCharacterSheet._onQuickBreath,
      fullRest:        GHRPGCharacterSheet._onFullRest,
      toggleCondition: GHRPGCharacterSheet._onToggleCondition,
      cycleElement:    GHRPGCharacterSheet._onCycleElement,
      createItem:      GHRPGCharacterSheet._onCreateItem,
      editItem:        GHRPGCharacterSheet._onEditItem,
      deleteItem:      GHRPGCharacterSheet._onDeleteItem,
      togglePerk:      GHRPGCharacterSheet._onTogglePerk,
      initializeDeck:  GHRPGCharacterSheet._onInitializeDeck,
      rollAttack:      GHRPGCharacterSheet._onRollAttack,
      toggleSection:      GHRPGCharacterSheet._onToggleSection,
      addBless:           GHRPGCharacterSheet._onAddBless,
      removeBless:        GHRPGCharacterSheet._onRemoveBless,
      addCurse:           GHRPGCharacterSheet._onAddCurse,
      removeCurse:        GHRPGCharacterSheet._onRemoveCurse,
      removeCard:         GHRPGCharacterSheet._onRemoveCard,
      restoreCard:        GHRPGCharacterSheet._onRestoreCard,
      addCustomCard:      GHRPGCharacterSheet._onAddCustomCard,
      editImage:          GHRPGCharacterSheet._onEditImage,
      configureToken:     GHRPGCharacterSheet._onConfigureToken,
    }
  };

  static PARTS = {
    header:    { template: "systems/ghrpg/templates/actors/parts/header.hbs" },
    stats:     { template: "systems/ghrpg/templates/actors/parts/stats.hbs",     scrollable: [""] },
    skills:    { template: "systems/ghrpg/templates/actors/parts/skills.hbs",    scrollable: [".items-list"] },
    talents:   { template: "systems/ghrpg/templates/actors/parts/talents.hbs",   scrollable: [".items-list"] },
    inventory: { template: "systems/ghrpg/templates/actors/parts/inventory.hbs", scrollable: [".items-list"] },
    deck:      { template: "systems/ghrpg/templates/actors/parts/deck.hbs",      scrollable: [""] },
    biography: { template: "systems/ghrpg/templates/actors/parts/biography.hbs", scrollable: [""] },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "stats",     group: "sheet", icon: "fas fa-chart-bar",   label: "Stats" },
        { id: "skills",    group: "sheet", icon: "fas fa-scroll",      label: "Skills" },
        { id: "talents",   group: "sheet", icon: "fas fa-star",        label: "Talents" },
        { id: "inventory", group: "sheet", icon: "fas fa-backpack",    label: "Inventory" },
        { id: "deck",      group: "sheet", icon: "fas fa-layer-group", label: "Deck" },
        { id: "biography", group: "sheet", icon: "fas fa-book-open",   label: "Bio" },
      ],
      initial: "stats",
      labelAttr: "label",
      contentSelector: ".tab-content"
    }
  };

  tabGroups = { sheet: "stats" };

  get title() { return this.actor.name ?? "Character"; }

  _onRender(context, options) {
    super._onRender(context, options);
    this.changeTab(this.tabGroups.sheet ?? "stats", "sheet", { force: true });
    // Auto-save all direct form inputs on change
    this.element.querySelectorAll("input[name], select[name], textarea[name]").forEach(input => {
      input.addEventListener("change", () => this._saveField(input));
    });
    // HP bar live update
    const hpValueInput = this.element.querySelector("[name='system.hp.value']");
    const hpMaxInput   = this.element.querySelector("[name='system.hp.max']");
    const hpBar        = this.element.querySelector(".hp-bar");
    const updateHpBar  = () => {
      if (!hpBar) return;
      const val = Math.max(0, Number(hpValueInput?.value ?? 0));
      const max = Math.max(1, Number(hpMaxInput?.value  ?? 1));
      const pct = Math.min(100, Math.max(0, (val / max) * 100));
      hpBar.style.width = pct + "%";
    };
    hpValueInput?.addEventListener("input",  updateHpBar);
    hpValueInput?.addEventListener("change", updateHpBar);
    hpMaxInput?.addEventListener("input",    updateHpBar);
    hpMaxInput?.addEventListener("change",   updateHpBar);
    updateHpBar();
    // Show/hide effect value row based on selected effect type
    const effectTypeSelect = this.element.querySelector("[name='customEffectType']");
    if (effectTypeSelect) {
      const toggleValueRow = () => {
        const valueRow = effectTypeSelect.closest(".custom-card-form")?.querySelector(".custom-effect-value-row");
        if (!valueRow) return;
        const needsValue = ["pierce","push","pull","heal"].includes(effectTypeSelect.value);
        valueRow.style.display = needsValue ? "" : "none";
      };
      effectTypeSelect.addEventListener("change", toggleValueRow);
      toggleValueRow();
    }
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

    const positiveKeys = ["bless","invisible","regenerate","safeguard","strengthen","ward"];
    const negativeKeys = ["curse","immobilize","muddle","pacify","poison","stun","wound"];
    const conditions = {
      positive: positiveKeys.map(key => ({
        key,
        label:  game.i18n.localize(`GHRPG.Conditions.Positive.${key}`) || key,
        active: system.conditions?.[key]?.active ?? false,
        count:  system.conditions?.[key]?.count  ?? null
      })),
      negative: negativeKeys.map(key => ({
        key,
        label:  game.i18n.localize(`GHRPG.Conditions.Negative.${key}`) || key,
        active: system.conditions?.[key]?.active ?? false
      }))
    };

    const ELEMENT_KEYS = ["air","dark","earth","fire","ice","light"];
    const elements = ELEMENT_KEYS.map(key => ({
      key,
      label: game.i18n.localize(`GHRPG.Elements.${key}`) || key,
      state: system.elements?.[key] ?? "inert"
    }));

    const deck       = system.modifierDeck?.deck    ?? [];
    const discard    = system.modifierDeck?.discard ?? [];
    const topDiscard = discard.length ? discard[discard.length - 1] : null;
    const lastDrawn  = system.modifierDeck?.lastDrawn ?? null;

    // Group deck cards by label for the composition view
    const compMap = new Map();
    for (const card of deck) {
      const key = card.label;
      if (compMap.has(key)) compMap.get(key).count++;
      else compMap.set(key, { ...card, count: 1 });
    }
    const deckComposition = [...compMap.values()].sort((a, b) => {
      if (a.type === "null") return -1;
      if (b.type === "null") return 1;
      if (a.type === "critical") return 1;
      if (b.type === "critical") return -1;
      return (a.attrMod ?? 0) - (b.attrMod ?? 0);
    });

    // Individual card list for removal — each card with origin tag
    const deckRemoveList = [...deck].map(card => ({
      ...card,
      isDefault: !card.custom && card.type !== "bless" && card.type !== "curse",
      isAdded:   card.custom || card.type === "bless" || card.type === "curse",
    })).sort((a, b) => {
      if (a.type === "null") return -1;
      if (b.type === "null") return 1;
      if (a.type === "critical") return 1;
      if (b.type === "critical") return -1;
      return (a.attrMod ?? 0) - (b.attrMod ?? 0);
    });

    // Discard pile ordered newest-first for display
    const discardList = [...discard].reverse();

    const removedDefaults = system.modifierDeck?.removedDefaults ?? [];

    const allPerks      = Object.values(PERK_DEFINITIONS);
    const selectedPerks = system.perks ?? [];

    const skills      = actor.items.filter(i => i.type === "skill")
                                   .sort((a,b) => (a.system.initiative??99)-(b.system.initiative??99));
    const preparedSkillCount = skills.filter(s => s.system.prepared).length;
    const talents     = actor.items.filter(i => i.type === "talent")
                                   .sort((a,b) => (a.system.initiative??99)-(b.system.initiative??99));
    const backgrounds = actor.items.filter(i => i.type === "background");
    const equipment   = actor.items.filter(i => i.type === "equipment");

    // Build ancestry options dynamically from world Ancestry items
    const ancestryItems = game.items.filter(i => i.type === "ancestry").sort((a,b) => a.name.localeCompare(b.name));
    const ancestryOptions = { "": "— Select Ancestry —" };
    for (const a of ancestryItems) ancestryOptions[a.id] = a.name;

    // Resolve selected ancestry item for skills tab
    const selectedAncestry = system.ancestry ? game.items.get(system.ancestry) : null;
    const ancestrySkillIds  = selectedAncestry?.system?.skillIds  ?? [];
    const ancestryTalentIds = selectedAncestry?.system?.talentIds ?? [];
    const classOptions    = ["","berserker","bladeswarm","bruiser","cragheart","doomstalker","elementalist",
                             "mindthief","plagueherald","quartermaster","sawbones","silentknife",
                             "soothsinger","spellweaver","sunkeeper","tinkerer","wildfury"];
    const factionOptions  = ["","keepers","guild","freebooters","shields","sect","university","robins"];

    const activeTab = this.tabGroups.sheet ?? "stats";
    const tabs = GHRPGCharacterSheet.TABS.sheet.tabs.map(t => ({
      ...t,
      cssClass: t.id === activeTab ? "active" : "",
      active: t.id === activeTab
    }));

    return {
      ...context,
      actor, system,
      attributes, conditions, elements,
      deckCount:    deck.length,
      discardCount: discard.length,
      topDiscard,
      lastDrawn,
      deckComposition,
      deckRemoveList,
      discardList,
      removedDefaults,
      allPerks, selectedPerks,
      skills, talents, backgrounds, equipment, preparedSkillCount,
      activeTab,
      tabs,
      ancestryOptions, classOptions, factionOptions,
      selectedAncestry, ancestrySkillIds, ancestryTalentIds,
      isOwner: actor.isOwner,
      isGM:    game.user.isGM,
      hpPct:   Math.round((system.hp.value / (system.hp.max || 1)) * 100),
    };
  }

  async _preparePartContext(partId, context) {
    context = await super._preparePartContext(partId, context);
    context.partId    = `${this.id}-${partId}`;
    context.activeTab = this.tabGroups.sheet ?? "stats";
    context.tab       = { active: context.activeTab === partId };
    return context;
  }

  // Tab click handling
  _onClickAction(event, target) {
    const tabLink = target.closest("[data-tab][data-group]");
    if (tabLink) {
      event.preventDefault();
      const tab = tabLink.dataset.tab;
      const group = tabLink.dataset.group ?? "sheet";
      this.changeTab(tab, group);
      return;
    }
    return super._onClickAction(event, target);
  }

  // ── Action handlers ──────────────────────────────────────────────

  static async _onRollAttribute(event, target) {
    const attrKey = target.dataset.attribute;
    if (!attrKey) return;
    const result = await GHRPGCharacterSheet._showRollDialog({
      title:     (game.i18n.localize(`GHRPG.Attributes.${attrKey}`) || attrKey) + " Test",
      baseValue: this.actor.system.attributes?.[attrKey]?.value ?? 0,
      showTN: true, showAttack: false
    });
    if (!result) return;
    await this.actor.rollAttributeTest(attrKey, result);
  }

  static async _onDrawCard(event, target) {
    const mode = target.dataset.mode ?? "normal";
    await this.actor.drawModifierCard(mode);
    this.render();
  }

  static async _onReshuffleDeck(event, target) {
    await this.actor.reshuffleModifierDeck();
    this.render();
  }

  static async _onInitializeDeck(event, target) {
    await this.actor.initializeModifierDeck();
    this.render();
  }

  static async _onUseSkill(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    await item.useSkill();
    this.render();
  }

  static async _onUseTalent(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) await item.useTalent();
  }

  static async _onTogglePrepared(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    await item.update({ "system.prepared": !item.system.prepared });
    this.render();
  }

  static async _onRecoverSkill(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    await item.update({ "system.expended": false, "system.lost": false });
    this.render();
  }

  static async _onQuickBreath(event, target) {
    await this.actor.quickBreath();
    this.render();
  }

  static async _onFullRest(event, target) {
    await this.actor.fullRest();
    this.render();
  }

  static async _onToggleCondition(event, target) {
    const key = target.dataset.condition;
    if (key) { await this.actor.toggleCondition(key); this.render(); }
  }

  static async _onCycleElement(event, target) {
    const el = target.dataset.element;
    if (el) { await this.actor.cycleElement(el); this.render(); }
  }

  static async _onCreateItem(event, target) {
    const type = target.dataset.type ?? "skill";
    const item = await Item.create({ name: `New ${type}`, type }, { parent: this.actor });
    item?.sheet?.render(true);
  }

  static async _onEditItem(event, target) {
    this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet?.render(true);
  }

  static async _onDeleteItem(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    if (!await Dialog.confirm({ title:"Delete Item", content:`<p>Delete <strong>${item.name}</strong>?</p>` })) return;
    await item.delete();
  }

  static async _onTogglePerk(event, target) {
    const perkId = target.dataset.perkId;
    if (!perkId) return;
    const perks  = [...(this.actor.system.perks ?? [])];
    const idx    = perks.indexOf(perkId);
    const adding = idx < 0;
    if (adding) perks.push(perkId); else perks.splice(idx, 1);
    await this.actor.update({ "system.perks": perks });
    if (adding) await this.actor.applyPerk(perkId);
    else        await this.actor.removePerk(perkId);
    this.render();
  }

  static async _onRollAttack(event, target) {
    const item       = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const baseAttack = Number(target.dataset.attack ?? 0);
    const result = await GHRPGCharacterSheet._showRollDialog({
      title: item?.name ?? "Attack", baseValue: baseAttack, showTN: false, showAttack: true
    });
    if (!result) return;
    await this.actor.rollAttack(result.attack ?? baseAttack, { mode: result.mode, bonus: result.bonus, label: item?.name ?? "Attack" });
  }

  static async _onEditImage(event, target) {
    // Use Foundry v13 FilePicker (fp.browse is async in v13)
    const current = this.actor.img ?? "";
    const fp = new FilePicker({
      type:     "image",
      current:  current,
      callback: async src => {
        await this.actor.update({ img: src });
        this.render();
      },
      top:  this.position.top  + 40,
      left: this.position.left + 10,
    });
    await fp.browse(current);
    fp.render(true);
  }

  static _onConfigureToken(event, target) {
    const tokenDoc = this.actor.prototypeToken;
    new CONFIG.Token.prototypeSheetClass(tokenDoc, { actor: this.actor }).render(true);
  }

  static _onToggleSection(event, target) {
    const section = target.closest(".collapsible-section");
    if (!section) return;
    const body = section.querySelector(".collapsible-body");
    const icon = section.querySelector(".collapse-icon");
    const collapsed = section.dataset.collapsed === "true";
    if (collapsed) {
      body.style.display = "";
      icon.classList.replace("fa-chevron-right", "fa-chevron-down");
      section.dataset.collapsed = "false";
    } else {
      body.style.display = "none";
      icon.classList.replace("fa-chevron-down", "fa-chevron-right");
      section.dataset.collapsed = "true";
    }
  }

  static async _onAddBless()    { await this.actor.addBlessCard();    this.render(); }
  static async _onRemoveBless() { await this.actor.removeBlessCard(); this.render(); }
  static async _onAddCurse()    { await this.actor.addCurseCard();    this.render(); }
  static async _onRemoveCurse() { await this.actor.removeCurseCard(); this.render(); }

  static async _onRemoveCard(event, target) {
    const cardId = target.dataset.cardId;
    if (!cardId) return;
    await this.actor.removeCardFromDeck(cardId);
    this.render();
  }

  static async _onRestoreCard(event, target) {
    const cardId = target.dataset.cardId;
    if (!cardId) return;
    await this.actor.restoreDefaultCard(cardId);
    this.render();
  }

  static async _onAddCustomCard(event, target) {
    const section = target.closest(".add-custom-card");
    if (!section) return;
    const atkInput    = section.querySelector("[name='customAtk']");
    const attrInput   = section.querySelector("[name='customAttr']");
    const effectType  = section.querySelector("[name='customEffectType']")?.value ?? "";
    const effectVal   = section.querySelector("[name='customEffectValue']")?.value;
    const effectOpt   = section.querySelector("[name='customEffectOptional']")?.checked ?? false;
    const atk  = Number(atkInput?.value  ?? 0);
    const attr = Number(attrInput?.value ?? 0);
    const effects = effectType
      ? [{ type: effectType, ...(effectVal !== "" ? { value: Number(effectVal) } : {}), optional: effectOpt }]
      : [];
    await this.actor.addCustomCardToDeck(atk, attr, effects);
    // Reset form
    if (atkInput)  atkInput.value  = "0";
    if (attrInput) attrInput.value = "0";
    const typeSelect = section.querySelector("[name='customEffectType']");
    if (typeSelect) typeSelect.value = "";
    const valInput = section.querySelector("[name='customEffectValue']");
    if (valInput) { valInput.value = ""; valInput.closest(".custom-effect-value-row").style.display = "none"; }
    const optCheck = section.querySelector("[name='customEffectOptional']");
    if (optCheck) optCheck.checked = false;
    this.render();
  }

  // ── Roll dialog ─────────────────────────────────────────────────

  static _showRollDialog({ title, baseValue, showTN, showAttack }) {
    return new Promise(resolve => {
      new Dialog({
        title,
        content: `<form style="display:flex;flex-direction:column;gap:8px;padding:8px">
          ${showAttack
            ? `<div><label style="font-size:11px;color:#888;display:block">Base Attack</label><input type="number" name="attack" value="${baseValue}" style="padding:4px 8px;width:100%"/></div>`
            : `<div style="font-size:13px;color:#c8922a">Base score: <strong>${baseValue}</strong></div>`}
          <div><label style="font-size:11px;color:#888;display:block">Bonus</label><input type="number" name="bonus" value="0" style="padding:4px 8px;width:100%"/></div>
          ${showTN ? `<div><label style="font-size:11px;color:#888;display:block">Target Number (TN)</label><input type="number" name="tn" placeholder="leave blank to skip" style="padding:4px 8px;width:100%"/></div>` : ""}
          <div><label style="font-size:11px;color:#888;display:block">Mode</label><select name="mode" style="padding:4px 8px;width:100%"><option value="normal">Normal</option><option value="advantage">Advantage ⬆</option><option value="disadvantage">Disadvantage ⬇</option></select></div>
        </form>`,
        buttons: {
          roll:   { icon:'<i class="fas fa-dice"></i>', label:"Roll", callback: html => {
            const f = html[0].querySelector("form");
            resolve({ mode: f.mode.value, bonus: Number(f.bonus.value??0), tn: f.tn?(f.tn.value?Number(f.tn.value):null):null, attack: f.attack?Number(f.attack.value):baseValue });
          }},
          cancel: { label:"Cancel", callback: () => resolve(null) }
        },
        default: "roll", close: () => resolve(null)
      }).render(true);
    });
  }
}
