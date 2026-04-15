/**
 * gm-deck.mjs
 * Standalone GM Modifier Deck — world-level floating window.
 * State stored in world Setting "ghrpg.gmDeck".
 * Accessible from scene controls sidebar.
 */

import {
  buildDeck, drawCards, shuffleArray,
  addBless, addCurse, resolveDrawMode,
  formatAtkMod, endOfRoundMaintenance,
  CARD_TYPE, BLESS_CARD, CURSE_CARD
} from "../helpers/modifier-deck.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const SETTING_KEY = "gmDeck";

export class GMDeckApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ghrpg-gm-deck",
    classes: ["ghrpg", "gm-deck-app"],
    position: { width: 400, height: 600, top: 80, left: 160 },
    window: {
      title:       "GHRPG.GMDeck.Title",
      resizable:   true,
      minimizable: true,
    },
    actions: {
      drawCard:      GMDeckApp._onDrawCard,
      reshuffleDeck: GMDeckApp._onReshuffleDeck,
      initializeDeck:GMDeckApp._onInitializeDeck,
      addBless:      GMDeckApp._onAddBless,
      removeBless:   GMDeckApp._onRemoveBless,
      addCurse:      GMDeckApp._onAddCurse,
      removeCurse:   GMDeckApp._onRemoveCurse,
      toggleSection: GMDeckApp._onToggleSection,
    }
  };

  static PARTS = {
    deck: { template: "systems/ghrpg/templates/apps/gm-deck.hbs", scrollable: [".gm-deck-body"] }
  };

  /* ── World Setting ──────────────────────────────────────────── */

  static registerSettings() {
    game.settings.register("ghrpg", SETTING_KEY, {
      name:    "GM Modifier Deck",
      scope:   "world",
      config:  false,
      type:    Object,
      default: { deck:[], discard:[], blessCount:0, curseCount:0, lastDrawn:null },
      onChange: () => {
        const app = game.ghrpg?.gmDeck;
        if (app?.rendered) app.render();
      }
    });
  }

  static getState() {
    return game.settings.get("ghrpg", SETTING_KEY) ?? { deck:[], discard:[], blessCount:0, curseCount:0, lastDrawn:null };
  }

  static async setState(updates) {
    const current = GMDeckApp.getState();
    await game.settings.set("ghrpg", SETTING_KEY, { ...current, ...updates });
  }

  /* ── Initialise / Reshuffle ─────────────────────────────────── */

  static async initializeDeck() {
    const fresh = buildDeck([]);
    await GMDeckApp.setState({ deck: fresh, discard: [], blessCount: 0, curseCount: 0, lastDrawn: null });
  }

  static async reshuffleDeck() {
    const state = GMDeckApp.getState();
    const deck    = [...(state.deck    ?? [])];
    const discard = [...(state.discard ?? [])];

    // Collect special cards to preserve
    const blessCards  = [...deck, ...discard].filter(c => c.type === CARD_TYPE.BLESS);
    const curseCards  = [...deck, ...discard].filter(c => c.type === CARD_TYPE.CURSE);
    const customCards = [...deck, ...discard].filter(c => c.custom);

    // Rebuild base
    let fresh = buildDeck([]);
    // Strip removed defaults (track by removedDefaults like actor deck)
    const removedDefaults = state.removedDefaults ?? [];
    fresh = fresh.filter(c => !removedDefaults.find(r => r.id === c.id));

    // Re-add specials
    const combined = shuffleArray([...fresh, ...blessCards, ...curseCards, ...customCards]);
    await GMDeckApp.setState({ deck: combined, discard: [], lastDrawn: state.lastDrawn });
  }

  /* ── Draw ───────────────────────────────────────────────────── */

  static async draw(mode = "normal") {
    const state = GMDeckApp.getState();
    let workingState = { deck: [...(state.deck ?? [])], discard: [...(state.discard ?? [])] };

    if (workingState.deck.length === 0) {
      await GMDeckApp.initializeDeck();
      workingState = GMDeckApp.getState();
    }

    const needTwo = mode !== "normal";
    const { drawn, newDeck, newDiscard } = drawCards(workingState, needTwo ? 2 : 1);
    const resolved = resolveDrawMode(drawn, mode);

    // Auto-reshuffle trigger
    let finalDeck    = newDeck;
    let finalDiscard = newDiscard;
    const maintained = endOfRoundMaintenance({ deck: finalDeck, discard: finalDiscard });
    if (resolved.type === CARD_TYPE.NULL || resolved.type === CARD_TYPE.CRITICAL) {
      finalDeck    = maintained.deck;
      finalDiscard = maintained.discard;
    }

    const blessCount = (state.blessCount ?? 0) - (resolved.type === CARD_TYPE.BLESS ? 1 : 0);
    const curseCount = (state.curseCount ?? 0) - (resolved.type === CARD_TYPE.CURSE ? 1 : 0);

    await GMDeckApp.setState({
      deck:       finalDeck,
      discard:    finalDiscard,
      blessCount: Math.max(0, blessCount),
      curseCount: Math.max(0, curseCount),
      lastDrawn: {
        applied:  { ...resolved, effects: resolved.effects ?? [] },
        allDrawn: drawn.map(c => ({ ...c, effects: c.effects ?? [] })),
        mode,
      }
    });

    // Post to chat
    await GMDeckApp._postToChat(resolved, drawn, mode);

    return { resolved, drawn };
  }

  static async _postToChat(resolved, drawn, mode) {
    const cardType  = resolved.type;
    const atkModStr = formatAtkMod(resolved.atkMod);

    const modeBadge = mode !== "normal"
      ? `<div class="chat-mode-badge ${mode === "advantage" ? "mode-adv" : "mode-dis"}">${mode === "advantage" ? '<i class="fas fa-angles-up"></i> Advantage' : '<i class="fas fa-angles-down"></i> Disadvantage'}</div>`
      : "";

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

    let circleInner = "", hexBadge = "";
    if (cardType === "normal") {
      circleInner = `<span class="chat-atk-val">${atkModStr}</span>`;
      hexBadge    = `<div class="chat-hex"><span class="chat-attr-val">${resolved.attrMod >= 0 ? "+" : ""}${resolved.attrMod}</span></div>`;
    } else if (cardType === "null")     { circleInner = `<span class="chat-atk-val">✕</span>`; }
    else if (cardType === "critical")   { circleInner = `<span class="chat-atk-val">×2</span>`; }
    else if (cardType === "bless")      { circleInner = `<span class="chat-atk-val"><i class="fas fa-person"></i></span>`; }
    else if (cardType === "curse")      { circleInner = `<span class="chat-atk-val"><i class="fas fa-bolt"></i></span>`; }

    const cardVisual = `
<div class="chat-mod-card chat-card-${cardType}">
  <div class="chat-card-circle chat-circle-${cardType}">${circleInner}</div>
  <div class="chat-card-footer">
    <div class="chat-card-portrait" style="background:#2a1a1a; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center">
      <i class="fas fa-skull" style="font-size:12px; color:#886644;"></i>
    </div>
    ${hexBadge}
  </div>
</div>`;

    const specialNote = {
      bless:    `<div class="roll-special bless"><i class="fas fa-person"></i> BLESS — Critical (×2)!</div>`,
      curse:    `<div class="roll-special curse"><i class="fas fa-bolt"></i> CURSE — MISS!</div>`,
      null:     `<div class="roll-special null">✕ MISS — No damage!</div>`,
      critical: `<div class="roll-special critical">★ CRITICAL — Double damage!</div>`,
    }[cardType] ?? "";

    const breakdown = (cardType === "normal" || cardType === "critical")
      ? `<div class="roll-breakdown"><span>Atk mod: ${atkModStr}</span> / <span>Attr mod: ${resolved.attrMod >= 0 ? "+" : ""}${resolved.attrMod}</span></div>`
      : "";

    const content = `
<div class="ghrpg chat-roll">
  <h3 class="roll-title"><i class="fas fa-skull"></i> GM Deck Draw</h3>
  ${modeBadge}${drawnRow}${cardVisual}${specialNote}${breakdown}
</div>`.trim();

    await ChatMessage.create({ content, speaker: { alias: game.i18n.localize("GHRPG.GMDeck.ChatName") } });
  }

  /* ── Action Handlers ────────────────────────────────────────── */

  static async _onDrawCard(event, target) {
    const mode = target.dataset.mode ?? "normal";
    await GMDeckApp.draw(mode);
  }

  static async _onReshuffleDeck(event, target) {
    await GMDeckApp.reshuffleDeck();
    this.render();
  }

  static async _onInitializeDeck(event, target) {
    await Dialog.confirm({
      title:   "Initialize GM Deck",
      content: "<p>Reset the GM deck to the default 20 cards? This will remove all bless/curse/custom cards.</p>",
      yes:     async () => { await GMDeckApp.initializeDeck(); this.render(); },
    });
  }

  static async _onAddBless(event, target) {
    const state    = GMDeckApp.getState();
    const count    = state.blessCount ?? 0;
    if (count >= 6) return;
    const newState = addBless(state);
    await GMDeckApp.setState(newState);
  }

  static async _onRemoveBless(event, target) {
    const state = GMDeckApp.getState();
    const count = state.blessCount ?? 0;
    if (count <= 0) return;
    const deck  = [...(state.deck ?? [])];
    const idx   = deck.findIndex(c => c.type === CARD_TYPE.BLESS);
    if (idx !== -1) deck.splice(idx, 1);
    await GMDeckApp.setState({ deck, blessCount: count - 1 });
  }

  static async _onAddCurse(event, target) {
    const state    = GMDeckApp.getState();
    const count    = state.curseCount ?? 0;
    if (count >= 6) return;
    const newState = addCurse(state);
    await GMDeckApp.setState(newState);
  }

  static async _onRemoveCurse(event, target) {
    const state = GMDeckApp.getState();
    const count = state.curseCount ?? 0;
    if (count <= 0) return;
    const deck  = [...(state.deck ?? [])];
    const idx   = deck.findIndex(c => c.type === CARD_TYPE.CURSE);
    if (idx !== -1) deck.splice(idx, 1);
    await GMDeckApp.setState({ deck, curseCount: count - 1 });
  }

  static _onToggleSection(event, target) {
    const section = target.closest(".collapsible-section");
    if (!section) return;
    const body      = section.querySelector(".collapsible-body");
    const icon      = section.querySelector(".collapse-icon");
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

  /* ── Context ────────────────────────────────────────────────── */

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    const state    = GMDeckApp.getState();
    const deck     = state.deck     ?? [];
    const discard  = state.discard  ?? [];
    const lastDrawn = state.lastDrawn ?? null;

    const blessCount = state.blessCount ?? 0;
    const curseCount = state.curseCount ?? 0;

    const discardList = [...discard].reverse().slice(0, 30).map(c => ({
      ...c,
      atkModDisplay: formatAtkMod(c.atkMod)
    }));

    return {
      ...context,
      deck, discard, lastDrawn,
      deckCount:   deck.length,
      discardCount: discard.length,
      blessCount, curseCount,
      blessAtMax: blessCount >= 6,
      curseAtMax: curseCount >= 6,
      discardList,
      isGM: game.user.isGM,
      CARD_TYPE,
    };
  }
}
