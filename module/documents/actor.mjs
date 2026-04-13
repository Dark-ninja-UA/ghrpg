/**
 * actor.mjs
 * The GHRPGActor document class, extending the base Actor.
 * Handles modifier deck management, attribute tests, and attack rolls.
 */

import {
  buildDeck, applyPerkToDeck, removePerkFromDeck, drawCards, shuffleArray,
  addBless, addCurse, resolveDrawMode,
  formatAtkMod, formatAttrMod,
  endOfRoundMaintenance, CARD_TYPE
} from "../helpers/modifier-deck.mjs";

export class GHRPGActor extends Actor {

  /** ----------------------------------------
   *  Data Preparation
   * ----------------------------------------*/

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    const system = this.system;
    if (this.type === "character") {
      this._prepareCharacterData(system);
    } else if (this.type === "npc") {
      this._prepareNPCData(system);
    }
  }

  _prepareCharacterData(system) {
    // Clamp HP
    system.hp.value = Math.clamp(system.hp.value, 0, system.hp.max);

    // Total attribute scores (base value, will be modified by bonuses)
    for (const [key, attr] of Object.entries(system.attributes)) {
      attr.total = Math.clamp(attr.value, 0, 7);
    }

    // Initialise modifier deck on first load if empty
    if (!system.modifierDeck?.deck?.length && !system.modifierDeck?.discard?.length) {
      // Will be initialised properly by GHRPGActor.initializeModifierDeck
    }
  }

  _prepareNPCData(system) {
    system.hp.value = Math.clamp(system.hp.value, 0, system.hp.max);
    // Build empty attribute totals for NPCs too
    for (const [key, attr] of Object.entries(system.attributes ?? {})) {
      attr.total = Math.clamp(attr.value, 0, 7);
    }
  }

  /** ----------------------------------------
   *  Modifier Deck Operations
   * ----------------------------------------*/

  /**
   * Initialise (or reset) the modifier deck from scratch,
   * applying current perks.
   */
  async initializeModifierDeck() {
    const perks           = this.system.perks ?? [];
    const md              = this.system.modifierDeck ?? {};
    const removedDefaults = md.removedDefaults ?? [];

    // Build base deck then strip permanently-removed default cards
    let deck = buildDeck(perks);
    for (const removed of removedDefaults) {
      deck = deck.filter(c => c.id !== removed.id);
    }

    // Preserve any bless/curse/custom already in draw or discard
    const allCards    = [...(md.deck ?? []), ...(md.discard ?? [])];
    const blessCards  = allCards.filter(c => c.type === CARD_TYPE.BLESS);
    const curseCards  = allCards.filter(c => c.type === CARD_TYPE.CURSE);
    const customCards = allCards.filter(c => c.custom === true);

    deck = shuffleArray([...deck, ...blessCards, ...curseCards, ...customCards]);

    await this.update({
      "system.modifierDeck.deck":            deck,
      "system.modifierDeck.discard":         [],
      "system.modifierDeck.blessCount":      blessCards.length,
      "system.modifierDeck.curseCount":      curseCards.length,
      "system.modifierDeck.removedDefaults": removedDefaults,
    });
    return deck;
  }

  /**
   * Draw a card (or 2 for advantage/disadvantage).
   * mode: "normal" | "advantage" | "disadvantage"
   * Returns the resolved card.
   */
  async drawModifierCard(mode = "normal") {
    const deckState = this.system.modifierDeck ?? { deck: [], discard: [] };
    const needTwo   = mode !== "normal";

    // If deck is completely empty, initialise it first (preserving custom/bless/curse)
    let workingState = { ...deckState };
    if (!workingState.deck?.length && !workingState.discard?.length) {
      await this.initializeModifierDeck();
      workingState = { ...(this.system.modifierDeck ?? {}) };
    }

    const { drawn, newDeck, newDiscard } = drawCards(workingState, needTwo ? 2 : 1);
    if (!drawn.length) return null;

    // Resolve the final card based on mode
    const resolved = resolveDrawMode(drawn, mode);

    // Move drawn cards to discard, EXCEPT Bless/Curse which return to supply
    const toDiscard = [...newDiscard];
    for (const card of drawn) {
      if (card.type === CARD_TYPE.BLESS || card.type === CARD_TYPE.CURSE) {
        // Return to supply (don't add to discard)
      } else {
        toDiscard.push(card);
      }
    }

    // Update bless/curse counts if a bless/curse was drawn
    let blessCount = workingState.blessCount ?? 0;
    let curseCount = workingState.curseCount ?? 0;
    for (const card of drawn) {
      if (card.type === CARD_TYPE.BLESS) blessCount = Math.max(0, blessCount - 1);
      if (card.type === CARD_TYPE.CURSE) curseCount = Math.max(0, curseCount - 1);
    }

    // Check if reshuffle is needed (critical or null drawn)
    let finalDeck    = newDeck;
    let finalDiscard = toDiscard;
    const needsReshuffle = drawn.some(c => c.reshuffle) ||
                           resolved.type === CARD_TYPE.NULL ||
                           resolved.type === CARD_TYPE.CRITICAL;

    if (needsReshuffle) {
      finalDeck    = shuffleArray([...finalDeck, ...finalDiscard]);
      finalDiscard = [];
    }

    await this.update({
      "system.modifierDeck.deck":       finalDeck,
      "system.modifierDeck.discard":    finalDiscard,
      "system.modifierDeck.blessCount": blessCount,
      "system.modifierDeck.curseCount": curseCount,
      "system.modifierDeck.lastDrawn":  {
        applied:  { ...resolved, effects: resolved.effects ?? [] },
        allDrawn: drawn.map(c => ({ ...c, effects: c.effects ?? [] })),
        mode:     mode
      }
    });

    return { resolved, drawn, mode };
  }

  /** Force a full reshuffle of the deck (e.g., on Full Rest) */
  async reshuffleModifierDeck() {
    const md       = this.system.modifierDeck ?? {};
    const perks    = this.system.perks ?? [];

    // Start from a fresh base deck (respecting removedDefaults)
    let deck = buildDeck(perks);

    // Re-apply any permanently removed default cards
    const removedDefaults = md.removedDefaults ?? [];
    for (const removed of removedDefaults) {
      deck = deck.filter(c => c.id !== removed.id);
    }

    // Collect all bless/curse/custom cards from both draw pile and discard
    const allCards = [...(md.deck ?? []), ...(md.discard ?? [])];
    const blessCards  = allCards.filter(c => c.type === CARD_TYPE.BLESS);
    const curseCards  = allCards.filter(c => c.type === CARD_TYPE.CURSE);
    const customCards = allCards.filter(c => c.custom === true);

    // Merge them back in and shuffle
    deck = shuffleArray([...deck, ...blessCards, ...curseCards, ...customCards]);

    await this.update({
      "system.modifierDeck.deck":       deck,
      "system.modifierDeck.discard":    [],
      "system.modifierDeck.blessCount": blessCards.length,
      "system.modifierDeck.curseCount": curseCards.length,
    });
    ui.notifications.info(`${this.name}'s Modifier Deck reshuffled!`);
  }

  /** Surgically apply a perk's cards to the deck (no reshuffle). */
  async applyPerk(perkId) {
    const md       = this.system.modifierDeck ?? { deck:[], discard:[] };
    const newState = applyPerkToDeck(md, perkId);
    await this.update({
      "system.modifierDeck.deck":    newState.deck,
      "system.modifierDeck.discard": newState.discard,
    });
  }

  /** Surgically remove a perk's cards from the deck (no reshuffle). */
  async removePerk(perkId) {
    const md       = this.system.modifierDeck ?? { deck:[], discard:[] };
    const newState = removePerkFromDeck(md, perkId);
    await this.update({
      "system.modifierDeck.deck":    newState.deck,
      "system.modifierDeck.discard": newState.discard,
    });
  }

  /** Add a Bless card to the deck */
  async addBlessCard() {
    const newState = addBless(this.system.modifierDeck ?? { deck:[], discard:[] });
    await this.update({ "system.modifierDeck": newState });
  }

  /** Remove a Bless card from the deck (decrease count) */
  async removeBlessCard() {
    const md = this.system.modifierDeck ?? { deck:[], discard:[] };
    const count = md.blessCount ?? 0;
    if (count <= 0) return;
    const deck = [...(md.deck ?? [])];
    const idx  = deck.findIndex(c => c.type === CARD_TYPE.BLESS);
    if (idx !== -1) deck.splice(idx, 1);
    await this.update({ "system.modifierDeck.deck": deck, "system.modifierDeck.blessCount": count - 1 });
  }

  /** Add a Curse card to the deck */
  async addCurseCard() {
    const newState = addCurse(this.system.modifierDeck ?? { deck:[], discard:[] });
    await this.update({ "system.modifierDeck": newState });
  }

  /** Remove a Curse card from the deck */
  async removeCurseCard() {
    const md = this.system.modifierDeck ?? { deck:[], discard:[] };
    const count = md.curseCount ?? 0;
    if (count <= 0) return;
    const deck = [...(md.deck ?? [])];
    const idx  = deck.findIndex(c => c.type === CARD_TYPE.CURSE);
    if (idx !== -1) deck.splice(idx, 1);
    await this.update({ "system.modifierDeck.deck": deck, "system.modifierDeck.curseCount": count - 1 });
  }

  /** Remove a card from the draw pile by id. Tracks removed default cards. */
  async removeCardFromDeck(cardId) {
    const md = this.system.modifierDeck ?? { deck:[], discard:[] };
    const deck = [...(md.deck ?? [])];
    const idx  = deck.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = deck[idx];
    deck.splice(idx, 1);
    // Track if this was a default card (ids without _p suffix are base deck)
    const removedDefaults = [...(md.removedDefaults ?? [])];
    const isDefault = !cardId.includes("_p") && !cardId.startsWith("bless") && !cardId.startsWith("curse") && !cardId.startsWith("custom");
    if (isDefault && !removedDefaults.find(c => c.id === cardId)) {
      removedDefaults.push(card);
    }
    await this.update({ "system.modifierDeck.deck": deck, "system.modifierDeck.removedDefaults": removedDefaults });
  }

  /** Restore a previously removed default card back into the deck. */
  async restoreDefaultCard(cardId) {
    const md = this.system.modifierDeck ?? { deck:[], discard:[] };
    const removedDefaults = [...(md.removedDefaults ?? [])];
    const idx  = removedDefaults.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = removedDefaults[idx];
    removedDefaults.splice(idx, 1);
    const deck = shuffleArray([...(md.deck ?? []), card]);
    await this.update({ "system.modifierDeck.deck": deck, "system.modifierDeck.removedDefaults": removedDefaults });
  }

  /** Add a custom card to the deck. */
  async addCustomCardToDeck(atkMod, attrMod, effects = []) {
    const md   = this.system.modifierDeck ?? { deck:[], discard:[] };
    const atkN = Number(atkMod);
    const atrN = Number(attrMod);
    const card = {
      id:       `custom_${Date.now()}`,
      type:     CARD_TYPE.NORMAL,
      attrMod:  atrN,
      atkMod:   atkN,
      label:    `${atkN >= 0 ? "+" : ""}${atkN} / ${atrN >= 0 ? "+" : ""}${atrN}`,
      reshuffle: false,
      custom:   true,
      ...(effects.length ? { effects } : {})
    };
    const deck = shuffleArray([...(md.deck ?? []), card]);
    await this.update({ "system.modifierDeck.deck": deck });
  }

  /** ----------------------------------------
   *  Attribute Test Roll
   * ----------------------------------------*/

  /**
   * Perform an Attribute test.
   * @param {string} attrKey   - e.g. "cunning", "finesse"
   * @param {object} options   - { mode, bonus, tn, label, skillItem }
   */
  async rollAttributeTest(attrKey, options = {}) {
    const {
      mode    = "normal",
      bonus   = 0,
      tn      = null,
      label   = null,
    } = options;

    const attrLabel = game.i18n.localize(`GHRPG.Attributes.${attrKey}`) || attrKey;
    const baseScore = this.system.attributes?.[attrKey]?.value ?? 0;

    // Draw the card
    const drawResult = await this.drawModifierCard(mode);
    if (!drawResult) {
      ui.notifications.warn("Modifier Deck is empty and could not be rebuilt.");
      return;
    }

    const { resolved, drawn } = drawResult;
    const attrMod  = resolved.attrMod ?? 0;
    const total    = baseScore + attrMod + Number(bonus);

    // Build chat content
    let content = await this._buildAttributeTestChatContent({
      attrKey, attrLabel, baseScore, attrMod, bonus: Number(bonus),
      total, tn, resolved, drawn, mode
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      sound:   CONFIG.sounds.dice
    });

    return { total, resolved, drawn };
  }

  /** ----------------------------------------
   *  Attack Roll
   * ----------------------------------------*/

  /**
   * Perform an attack roll.
   * @param {number} baseAttack  - base attack value from skill/talent
   * @param {object} options     - { mode, bonus, label, skillItem }
   */
  async rollAttack(baseAttack, options = {}) {
    const {
      mode   = "normal",
      bonus  = 0,
      label  = "Attack"
    } = options;

    const drawResult = await this.drawModifierCard(mode);
    if (!drawResult) return;

    const { resolved, drawn } = drawResult;
    const atkMod = resolved.atkMod;
    let finalDamage;

    if (atkMod === "null") {
      finalDamage = 0;
    } else if (atkMod === "critical") {
      finalDamage = (baseAttack + Number(bonus)) * 2;
    } else {
      finalDamage = Math.max(0, baseAttack + Number(atkMod) + Number(bonus));
    }

    let content = await this._buildAttackChatContent({
      label, baseAttack, atkMod, bonus: Number(bonus),
      finalDamage, resolved, drawn, mode
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      sound:   CONFIG.sounds.dice
    });

    return { finalDamage, resolved };
  }

  /** ----------------------------------------
   *  Chat Message Builders
   * ----------------------------------------*/

  /** Build effect pills HTML from a card's effects array */
  _buildEffectPills(effects = []) {
    if (!effects.length) return { auto: "", optional: "" };
    const icons = { poison:"fa-skull-crossbones", muddle:"fa-cloud", wound:"fa-droplet",
                    stun:"fa-star", immobilize:"fa-lock", pierce:"fa-crosshairs",
                    push:"fa-arrow-up", pull:"fa-arrow-down", heal:"fa-heart",
                    strengthen:"fa-shield", curse:"fa-bolt", bless:"fa-person" };
    const pill = e => {
      const icon = icons[e.type] ?? "fa-sparkles";
      const val  = e.value != null ? ` ${e.value}` : "";
      const opt  = e.optional ? ` <span class="effect-opt-tag">opt</span>` : "";
      return `<span class="chat-effect effect-${e.type}"><i class="fas ${icon}"></i> ${e.type.charAt(0).toUpperCase()+e.type.slice(1)}${val}${opt}</span>`;
    };
    const auto     = effects.filter(e => !e.optional).map(pill).join(" ");
    const optional = effects.filter(e =>  e.optional).map(pill).join(" ");
    return { auto, optional };
  }

  /** Build effects block HTML (rows to embed in card or below it) */
  _buildEffectsBlock(effects = [], cardType = "normal") {
    if (!effects.length || cardType === "null" || cardType === "curse") return "";
    const { auto, optional } = this._buildEffectPills(effects);
    const autoRow     = auto     ? `<div class="chat-effects-row auto-effects">${auto}</div>` : "";
    const optionalRow = optional ? `<div class="chat-effects-row optional-effects"><span class="effects-label">Optional:</span> ${optional}</div>` : "";
    return autoRow + optionalRow;
  }

  async _buildAttributeTestChatContent({ attrKey, attrLabel, baseScore, attrMod, bonus, total, tn, resolved, drawn, mode }) {
    const cardType   = resolved.type;
    const atkModStr  = formatAtkMod(resolved.atkMod);

    // Mode badge
    const modeBadge = mode !== "normal"
      ? `<div class="chat-mode-badge ${mode === "advantage" ? "mode-adv" : "mode-dis"}">${mode === "advantage" ? '<i class="fas fa-angles-up"></i> Advantage' : '<i class="fas fa-angles-down"></i> Disadvantage'}</div>`
      : "";

    // Advantage/disadvantage comparison row
    let drawnRow = "";
    if (drawn.length > 1) {
      drawnRow = `<div class="chat-drawn-row">` + drawn.map(c => {
        const applied = c.id === resolved.id;
        const atkStr  = formatAtkMod(c.atkMod);
        const inner   = c.type === "normal"
          ? `<span class="cdr-atk">${atkStr}</span><span class="cdr-attr">${c.attrMod >= 0 ? "+" : ""}${c.attrMod}</span>`
          : `<span class="cdr-special">${c.label}</span>`;
        return `<div class="cdr-card ${applied ? "cdr-applied" : "cdr-discarded"} chat-card-${c.type}">${inner}<span class="cdr-marker">${applied ? "✓" : "✗"}</span></div>`;
      }).join("") + `</div>`;
    }

    // Main card visual
    let circleInner, hexBadge = "";
    if (cardType === "normal") {
      circleInner = `<span class="chat-atk-val">${atkModStr}</span>`;
      hexBadge    = `<div class="chat-hex"><span class="chat-attr-val">${attrMod >= 0 ? "+" : ""}${attrMod}</span></div>`;
    } else if (cardType === "null") {
      circleInner = `<span class="chat-atk-val">✕</span>`;
    } else if (cardType === "critical") {
      circleInner = `<span class="chat-atk-val">×2</span>`;
    } else if (cardType === "bless") {
      circleInner = `<span class="chat-atk-val"><i class="fas fa-person"></i></span>`;
    } else if (cardType === "curse") {
      circleInner = `<span class="chat-atk-val"><i class="fas fa-bolt"></i></span>`;
    }

    const effectsBlock = this._buildEffectsBlock(resolved.effects ?? [], cardType);

    const cardVisual = `
<div class="chat-mod-card chat-card-${cardType}">
  <div class="chat-card-circle chat-circle-${cardType}">${circleInner}</div>
  <div class="chat-card-footer">
    <div class="chat-card-portrait"><img src="${this.img}" /></div>
    ${hexBadge}
  </div>
  ${effectsBlock ? `<div class="chat-card-effects">${effectsBlock}</div>` : ""}
</div>`;

    // Special notes
    const specialNote = {
      bless:    `<div class="roll-special bless"><i class="fas fa-person"></i> BLESS — Auto-success</div>`,
      curse:    `<div class="roll-special curse"><i class="fas fa-bolt"></i> CURSE — Critical Failure</div>`,
      null:     `<div class="roll-special null">✕ MISS — Critical Failure!</div>`,
      critical: `<div class="roll-special critical">★ CRITICAL SUCCESS!</div>`,
    }[cardType] ?? "";

    // Breakdown line
    const attrModStr = attrMod >= 0 ? `+${attrMod}` : `${attrMod}`;
    const bonusStr   = bonus !== 0 ? ` + Bonus ${bonus >= 0 ? "+" : ""}${bonus}` : "";
    const breakdown  = cardType === "normal"
      ? `<div class="roll-breakdown"><span>${attrLabel} ${baseScore}</span><span> + Card ${attrModStr}</span>${bonusStr ? `<span>${bonusStr}</span>` : ""}<span> = </span><strong class="roll-total">${total}</strong></div>`
      : "";

    const tnLine = tn != null
      ? `<div class="roll-tn">${total >= tn ? "✓ <strong>SUCCESS</strong>" : "✗ <strong>FAILURE</strong>"} vs TN ${tn} (rolled ${total})</div>`
      : "";

    return `
<div class="ghrpg chat-roll">
  <h3 class="roll-title">${attrLabel} Test</h3>
  ${modeBadge}${drawnRow}${cardVisual}${specialNote}${breakdown}${tnLine}
</div>`.trim();
  }

  async _buildAttackChatContent({ label, baseAttack, atkMod, bonus, finalDamage, resolved, drawn, mode }) {
    const cardType  = resolved.type;
    const atkModStr = formatAtkMod(atkMod);

    // Mode badge
    const modeBadge = mode !== "normal"
      ? `<div class="chat-mode-badge ${mode === "advantage" ? "mode-adv" : "mode-dis"}">${mode === "advantage" ? '<i class="fas fa-angles-up"></i> Advantage' : '<i class="fas fa-angles-down"></i> Disadvantage'}</div>`
      : "";

    // Adv/disadv comparison row
    let drawnRow = "";
    if (drawn.length > 1) {
      drawnRow = `<div class="chat-drawn-row">` + drawn.map(c => {
        const applied = c.id === resolved.id;
        const aStr    = formatAtkMod(c.atkMod);
        const inner   = c.type === "normal"
          ? `<span class="cdr-atk">${aStr}</span><span class="cdr-attr">${c.attrMod >= 0 ? "+" : ""}${c.attrMod}</span>`
          : `<span class="cdr-special">${c.label}</span>`;
        return `<div class="cdr-card ${applied ? "cdr-applied" : "cdr-discarded"} chat-card-${c.type}">${inner}<span class="cdr-marker">${applied ? "✓" : "✗"}</span></div>`;
      }).join("") + `</div>`;
    }

    // Main card visual
    let circleInner, hexBadge = "";
    if (cardType === "normal") {
      circleInner = `<span class="chat-atk-val">${atkModStr}</span>`;
      hexBadge    = `<div class="chat-hex"><span class="chat-attr-val">${resolved.attrMod >= 0 ? "+" : ""}${resolved.attrMod}</span></div>`;
    } else if (cardType === "null") {
      circleInner = `<span class="chat-atk-val">✕</span>`;
    } else if (cardType === "critical") {
      circleInner = `<span class="chat-atk-val">×2</span>`;
    } else if (cardType === "bless") {
      circleInner = `<span class="chat-atk-val"><i class="fas fa-person"></i></span>`;
    } else if (cardType === "curse") {
      circleInner = `<span class="chat-atk-val"><i class="fas fa-bolt"></i></span>`;
    }

    const cardVisual = `
<div class="chat-mod-card chat-card-${cardType}">
  <div class="chat-card-circle chat-circle-${cardType}">${circleInner}</div>
  <div class="chat-card-footer">
    <div class="chat-card-portrait"><img src="${this.img}" /></div>
    ${hexBadge}
  </div>
  ${effectsBlock ? `<div class="chat-card-effects">${effectsBlock}</div>` : ""}
</div>`;

    // Special type note
    const specialNote = {
      bless:    `<div class="roll-special bless"><i class="fas fa-person"></i> BLESS — Critical (×2)!</div>`,
      curse:    `<div class="roll-special curse"><i class="fas fa-bolt"></i> CURSE — MISS!</div>`,
      null:     `<div class="roll-special null">✕ MISS — No damage!</div>`,
      critical: `<div class="roll-special critical">★ CRITICAL — Double damage!</div>`,
    }[cardType] ?? "";

    const effectsBlock = this._buildEffectsBlock(resolved.effects ?? [], cardType);

    // Breakdown
    const breakdown = cardType === "normal" || cardType === "critical"
      ? `<div class="roll-breakdown">
          <span>Attack ${baseAttack}</span>
          <span> ${atkMod === "critical" ? "× 2" : atkMod === "null" ? "MISS" : `${Number(atkMod) >= 0 ? "+" : ""}${atkMod}`}</span>
          ${bonus !== 0 ? `<span> + Bonus ${bonus >= 0 ? "+" : ""}${bonus}</span>` : ""}
          <span> = </span>
          <strong class="roll-total damage-value">${finalDamage} dmg</strong>
        </div>`
      : "";

    return `
<div class="ghrpg chat-roll">
  <h3 class="roll-title">${label}</h3>
  ${modeBadge}${drawnRow}${cardVisual}${specialNote}${breakdown}
</div>`.trim();
  }

  _cardCssClass(card) {
    const map = {
      null:     "card-null",
      critical: "card-critical",
      bless:    "card-bless",
      curse:    "card-curse",
      normal:   "card-normal"
    };
    return map[card.type] ?? "card-normal";
  }

  /** ----------------------------------------
   *  Quick Breath / Full Rest
   * ----------------------------------------*/

  /** ----------------------------------------
   *  Ancestry / Class Sync
   * ----------------------------------------*/

  /**
   * Sync skills and talents from a source item (ancestry or class) onto this actor.
   * Called when system.ancestry or system.class changes.
   *
   * @param {string} field        - "ancestry" or "class"
   * @param {string} oldSourceId  - previous item id (or "")
   * @param {string} newSourceId  - new item id (or "")
   */
  async syncSourceItems(field, oldSourceId, newSourceId) {
    // 1. Remove items tagged with the old source
    if (oldSourceId) {
      const toRemove = this.items.filter(i =>
        (i.type === "skill" || i.type === "talent") &&
        i.system.sourceId === oldSourceId
      );
      if (toRemove.length) {
        await this.deleteEmbeddedDocuments("Item", toRemove.map(i => i.id));
      }
    }

    // 2. Add items from the new source
    if (newSourceId) {
      const sourceItem = game.items.get(newSourceId);
      if (!sourceItem) return;

      const skillIds  = sourceItem.system.skillIds  ?? [];
      const talentIds = sourceItem.system.talentIds ?? [];
      const allIds    = [...skillIds, ...talentIds];

      const toCreate = [];
      for (const id of allIds) {
        const worldItem = game.items.get(id);
        if (!worldItem) continue;

        // Skip if name already exists on this actor
        const exists = this.items.some(i => i.name === worldItem.name);
        if (exists) continue;

        const data = worldItem.toObject();
        data.system.sourceId = newSourceId;
        toCreate.push(data);
      }

      if (toCreate.length) {
        await this.createEmbeddedDocuments("Item", toCreate);
      }

      ui.notifications.info(
        `${this.name}: synced ${toCreate.length} item(s) from ${sourceItem.name}.`
      );
    }
  }

  /** Quick Breath: recover expended (non-lost) skills */
  async quickBreath() {
    const items = this.items.filter(i => i.type === "skill" && i.system.expended && !i.system.lost);
    const updates = items.map(i => ({ _id: i.id, "system.expended": false }));
    if (updates.length) await this.updateEmbeddedDocuments("Item", updates);
    ui.notifications.info(`${this.name} takes a Quick Breath — ${updates.length} skill(s) recovered.`);
  }

  /** Full Rest: recover ALL skills including lost, reshuffle deck, set HP to max */
  async fullRest() {
    // Recover all skills
    const skills = this.items.filter(i => i.type === "skill");
    const updates = skills.map(i => ({ _id: i.id, "system.expended": false, "system.lost": false }));
    if (updates.length) await this.updateEmbeddedDocuments("Item", updates);

    // Reshuffle deck
    await this.reshuffleModifierDeck();

    // Set HP to max
    await this.update({ "system.hp.value": this.system.hp.max });

    ui.notifications.info(`${this.name} takes a Full Rest — fully recovered!`);
  }

  /** ----------------------------------------
   *  Element Management
   * ----------------------------------------*/

  async setElementState(element, state) {
    const validStates = ["inert", "waning", "strong"];
    if (!validStates.includes(state)) return;
    await this.update({ [`system.elements.${element}`]: state });
  }

  async cycleElement(element) {
    const states = ["inert", "waning", "strong"];
    const current = this.system.elements?.[element] ?? "inert";
    const idx   = states.indexOf(current);
    const next  = states[(idx + 1) % states.length];
    await this.setElementState(element, next);
  }

  /** Decay all elements at end of round (strong→waning, waning→inert) */
  async decayElements() {
    const updates = {};
    for (const [el, state] of Object.entries(this.system.elements ?? {})) {
      if      (state === "strong") updates[`system.elements.${el}`] = "waning";
      else if (state === "waning") updates[`system.elements.${el}`] = "inert";
    }
    if (Object.keys(updates).length) await this.update(updates);
  }

  /** ----------------------------------------
   *  Condition Management
   * ----------------------------------------*/

  async toggleCondition(conditionKey) {
    const current = this.system.conditions?.[conditionKey]?.active ?? false;
    await this.update({ [`system.conditions.${conditionKey}.active`]: !current });
  }
}
