/**
 * modifier-deck.mjs
 * Core Modifier Deck logic for Gloomhaven: The RPG
 *
 * The Modifier Deck drives all tests and attacks. Each card carries:
 *   attrMod  – added to an Attribute score when testing
 *   atkMod   – added to an attack value when attacking
 *
 * Starting distribution (20 cards):
 *  Null        × 1  (attrMod 0, atkMod null  – Critical Failure)
 *  Attr +1     × 2  (atkMod -2)
 *  Attr +2     × 3  (atkMod -1)
 *  Attr +3     × 4  (atkMod  0)
 *  Attr +4     × 4  (atkMod +1)
 *  Attr +5     × 3  (atkMod +1)
 *  Attr +6     × 2  (atkMod +2)
 *  Critical    × 1  (attrMod 6, atkMod critical – double damage)
 *
 * Note: exact attack modifier values for each card are marked [TBD] pending
 * confirmation of the icon-based values in the rulebook. Current values are
 * a reasonable interpolation consistent with the board game lineage.
 */

export const CARD_TYPE = {
  NORMAL:   "normal",
  NULL:     "null",
  CRITICAL: "critical",
  BLESS:    "bless",
  CURSE:    "curse"
};

/** The canonical 20-card base deck */
export const BASE_DECK_TEMPLATE = [
  // Null
  { id:"null",   type: CARD_TYPE.NULL,     attrMod: 0, atkMod: "null",     label:"MISS",       reshuffle: false },
  // Attr +1 (×2)
  { id:"a1_1",   type: CARD_TYPE.NORMAL,   attrMod: 1, atkMod: -2,         label:"+1 / −2",    reshuffle: false },
  { id:"a1_2",   type: CARD_TYPE.NORMAL,   attrMod: 1, atkMod: -2,         label:"+1 / −2",    reshuffle: false },
  // Attr +2 (×3)
  { id:"a2_1",   type: CARD_TYPE.NORMAL,   attrMod: 2, atkMod: -1,         label:"+2 / −1",    reshuffle: false },
  { id:"a2_2",   type: CARD_TYPE.NORMAL,   attrMod: 2, atkMod: -1,         label:"+2 / −1",    reshuffle: false },
  { id:"a2_3",   type: CARD_TYPE.NORMAL,   attrMod: 2, atkMod: -1,         label:"+2 / −1",    reshuffle: false },
  // Attr +3 (×4)
  { id:"a3_1",   type: CARD_TYPE.NORMAL,   attrMod: 3, atkMod:  0,         label:"+3 / ±0",    reshuffle: false },
  { id:"a3_2",   type: CARD_TYPE.NORMAL,   attrMod: 3, atkMod:  0,         label:"+3 / ±0",    reshuffle: false },
  { id:"a3_3",   type: CARD_TYPE.NORMAL,   attrMod: 3, atkMod:  0,         label:"+3 / ±0",    reshuffle: false },
  { id:"a3_4",   type: CARD_TYPE.NORMAL,   attrMod: 3, atkMod:  0,         label:"+3 / ±0",    reshuffle: false },
  // Attr +4 (×4)
  { id:"a4_1",   type: CARD_TYPE.NORMAL,   attrMod: 4, atkMod:  1,         label:"+4 / +1",    reshuffle: false },
  { id:"a4_2",   type: CARD_TYPE.NORMAL,   attrMod: 4, atkMod:  1,         label:"+4 / +1",    reshuffle: false },
  { id:"a4_3",   type: CARD_TYPE.NORMAL,   attrMod: 4, atkMod:  1,         label:"+4 / +1",    reshuffle: false },
  { id:"a4_4",   type: CARD_TYPE.NORMAL,   attrMod: 4, atkMod:  1,         label:"+4 / +1",    reshuffle: false },
  // Attr +5 (×3)
  { id:"a5_1",   type: CARD_TYPE.NORMAL,   attrMod: 5, atkMod:  1,         label:"+5 / +1",    reshuffle: false },
  { id:"a5_2",   type: CARD_TYPE.NORMAL,   attrMod: 5, atkMod:  2,         label:"+5 / +2",    reshuffle: false },
  { id:"a5_3",   type: CARD_TYPE.NORMAL,   attrMod: 5, atkMod:  2,         label:"+5 / +2",    reshuffle: false },
  // Attr +6 (×2)
  { id:"a6_1",   type: CARD_TYPE.NORMAL,   attrMod: 6, atkMod:  2,         label:"+6 / +2",    reshuffle: false },
  { id:"a6_2",   type: CARD_TYPE.NORMAL,   attrMod: 6, atkMod:  3,         label:"+6 / +3",    reshuffle: false },
  // Critical
  { id:"crit",   type: CARD_TYPE.CRITICAL, attrMod: 6, atkMod: "critical", label:"CRITICAL",   reshuffle: true  },
];

export const BLESS_CARD  = { id:"bless",  type: CARD_TYPE.BLESS,  attrMod: 6, atkMod: "critical", label:"BLESS",  reshuffle: false };
export const CURSE_CARD  = { id:"curse",  type: CARD_TYPE.CURSE,  attrMod: 0, atkMod: "null",     label:"CURSE",  reshuffle: false };

/**
 * Card effects schema:
 *   effects: [{ type, value?, optional }]
 *
 * Effect types: "poison", "muddle", "wound", "stun", "immobilize",
 *               "pierce", "push", "pull", "heal", "strengthen", "curse", "bless"
 * optional: true  → player may choose to apply after seeing result
 * optional: false → automatically applied on hit
 *
 * Example card with effects:
 * { id:"...", type:"normal", attrMod:3, atkMod:1, label:"+3/+1",
 *   effects:[{ type:"poison", optional:false }, { type:"heal", value:1, optional:true }] }
 *
 * Perks modify the base deck composition.
 * Each perk: { id, label, add: [...cards], remove: [...cardIds] }
 * Cards added by perks are tagged with perkId so they can be surgically removed on deselect.
 */
export const PERK_DEFINITIONS = {
  // ── Placeholder perks (class-specific perks added per-class later) ──
  "remove_null_x2": {
    id: "remove_null_x2",
    label: "Remove two +1/−2 cards",
    remove: ["a1_1","a1_2"],
    add: []
  },
  "remove_null_x1": {
    id: "remove_null_x1",
    label: "Remove one +1/−2 card",
    remove: ["a1_1"],
    add: []
  },
  "add_bless_x2": {
    id: "add_bless_x2",
    label: "Add two BLESS cards",
    remove: [],
    add: [
      { ...BLESS_CARD, id: "perk_add_bless_x2_0", perkId: "add_bless_x2" },
      { ...BLESS_CARD, id: "perk_add_bless_x2_1", perkId: "add_bless_x2" }
    ]
  },
  "add_critical": {
    id: "add_critical",
    label: "Add one CRITICAL card",
    remove: [],
    add: [{ ...BASE_DECK_TEMPLATE.find(c => c.type === CARD_TYPE.CRITICAL), id: "perk_add_critical_0", perkId: "add_critical" }]
  },
  "replace_two_3_with_4": {
    id: "replace_two_3_with_4",
    label: "Replace two +3/±0 cards with +4/+1 cards",
    remove: ["a3_1","a3_2"],
    add: [
      { id:"perk_replace_two_3_with_4_0", type: CARD_TYPE.NORMAL, attrMod: 4, atkMod: 1, label:"+4 / +1", reshuffle: false, perkId: "replace_two_3_with_4" },
      { id:"perk_replace_two_3_with_4_1", type: CARD_TYPE.NORMAL, attrMod: 4, atkMod: 1, label:"+4 / +1", reshuffle: false, perkId: "replace_two_3_with_4" }
    ]
  },
  "add_two_5": {
    id: "add_two_5",
    label: "Add two +5/+2 cards",
    remove: [],
    add: [
      { id:"perk_add_two_5_0", type: CARD_TYPE.NORMAL, attrMod: 5, atkMod: 2, label:"+5 / +2", reshuffle: false, perkId: "add_two_5" },
      { id:"perk_add_two_5_1", type: CARD_TYPE.NORMAL, attrMod: 5, atkMod: 2, label:"+5 / +2", reshuffle: false, perkId: "add_two_5" }
    ]
  },
  // ── Example effect cards (schema demonstration) ──
  "add_poison_card": {
    id: "add_poison_card",
    label: "Add one +2/+0 POISON card",
    remove: [],
    add: [
      { id:"perk_add_poison_card_0", type: CARD_TYPE.NORMAL, attrMod: 2, atkMod: 0,
        label:"+2 / ±0", reshuffle: false, perkId: "add_poison_card",
        effects: [{ type: "poison", optional: false }] }
    ]
  },
  "add_wound_card": {
    id: "add_wound_card",
    label: "Add one +2/+0 WOUND card",
    remove: [],
    add: [
      { id:"perk_add_wound_card_0", type: CARD_TYPE.NORMAL, attrMod: 2, atkMod: 0,
        label:"+2 / ±0", reshuffle: false, perkId: "add_wound_card",
        effects: [{ type: "wound", optional: false }] }
    ]
  },
  "add_muddle_card": {
    id: "add_muddle_card",
    label: "Add one +3/+1 MUDDLE card",
    remove: [],
    add: [
      { id:"perk_add_muddle_card_0", type: CARD_TYPE.NORMAL, attrMod: 3, atkMod: 1,
        label:"+3 / +1", reshuffle: false, perkId: "add_muddle_card",
        effects: [{ type: "muddle", optional: false }] }
    ]
  },
  "add_stun_card": {
    id: "add_stun_card",
    label: "Add one +1/+0 STUN card",
    remove: [],
    add: [
      { id:"perk_add_stun_card_0", type: CARD_TYPE.NORMAL, attrMod: 1, atkMod: 0,
        label:"+1 / ±0", reshuffle: false, perkId: "add_stun_card",
        effects: [{ type: "stun", optional: false }] }
    ]
  },
  "add_pierce3_card": {
    id: "add_pierce3_card",
    label: "Add one +2/+0 PIERCE 3 card",
    remove: [],
    add: [
      { id:"perk_add_pierce3_card_0", type: CARD_TYPE.NORMAL, attrMod: 2, atkMod: 0,
        label:"+2 / ±0", reshuffle: false, perkId: "add_pierce3_card",
        effects: [{ type: "pierce", value: 3, optional: false }] }
    ]
  },
  "add_heal2_card": {
    id: "add_heal2_card",
    label: "Add one +1/+1 HEAL 2 (optional) card",
    remove: [],
    add: [
      { id:"perk_add_heal2_card_0", type: CARD_TYPE.NORMAL, attrMod: 1, atkMod: 1,
        label:"+1 / +1", reshuffle: false, perkId: "add_heal2_card",
        effects: [{ type: "heal", value: 2, optional: true }] }
    ]
  },
};

/**
 * Surgically apply a single perk to an existing deck state (no reshuffle).
 * Returns updated { deck, discard } — caller saves to actor.
 */
export function applyPerkToDeck(deckState, perkId) {
  const perk = PERK_DEFINITIONS[perkId];
  if (!perk) return deckState;

  let deck    = [...(deckState.deck    ?? [])];
  let discard = [...(deckState.discard ?? [])];

  // Remove base cards (search both draw pile and discard)
  for (const removeId of perk.remove) {
    const di = deck.findIndex(c => c.id === removeId);
    if (di !== -1) { deck.splice(di, 1); continue; }
    const dsi = discard.findIndex(c => c.id === removeId);
    if (dsi !== -1) discard.splice(dsi, 1);
  }

  // Add new cards (tagged with perkId) to draw pile only
  for (const card of perk.add) {
    deck.push({ ...card, perkId });
  }

  return { ...deckState, deck, discard };
}

/**
 * Surgically remove a single perk's cards from an existing deck state (no reshuffle).
 * Re-adds any removed base cards back to draw pile.
 */
export function removePerkFromDeck(deckState, perkId) {
  const perk = PERK_DEFINITIONS[perkId];
  if (!perk) return deckState;

  let deck    = [...(deckState.deck    ?? [])];
  let discard = [...(deckState.discard ?? [])];

  // Remove all cards tagged with this perkId (from both piles)
  deck    = deck.filter(c => c.perkId !== perkId);
  discard = discard.filter(c => c.perkId !== perkId);

  // Restore removed base cards to draw pile (they may have been removed by this perk)
  for (const baseId of perk.remove) {
    const baseCard = BASE_DECK_TEMPLATE.find(c => c.id === baseId);
    if (!baseCard) continue;
    // Only restore if not already present (another perk might also reference it)
    const alreadyInDeck = deck.some(c => c.id === baseId) || discard.some(c => c.id === baseId);
    if (!alreadyInDeck) deck.push({ ...baseCard });
  }

  return { ...deckState, deck, discard };
}

/**
 * Build a full deck array from a list of selected perk IDs.
 * Returns a shuffled array of card objects.
 */
export function buildDeck(selectedPerkIds = []) {
  let cards = [...BASE_DECK_TEMPLATE].map(c => ({ ...c }));

  for (const perkId of selectedPerkIds) {
    const perk = PERK_DEFINITIONS[perkId];
    if (!perk) continue;
    // Remove cards by id
    for (const removeId of perk.remove) {
      const idx = cards.findIndex(c => c.id === removeId);
      if (idx !== -1) cards.splice(idx, 1);
    }
    // Add new cards
    for (const addCard of perk.add) {
      cards.push({ ...addCard });
    }
  }

  return shuffleArray(cards);
}

/** Fisher-Yates shuffle (returns new array) */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw N cards from a deck state.
 * Returns { drawn: Card[], newDeck: Card[], newDiscard: Card[] }
 * Automatically reshuffles discard into deck if needed.
 */
export function drawCards(deckState, count = 1) {
  let deck    = [...(deckState.deck    ?? [])];
  let discard = [...(deckState.discard ?? [])];
  const drawn = [];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      // Reshuffle discard back into deck (keep Bless/Curse out if needed)
      deck    = shuffleArray(discard);
      discard = [];
    }
    if (deck.length === 0) break;
    const card = deck.pop();
    drawn.push(card);
  }

  return { drawn, newDeck: deck, newDiscard: discard };
}

/**
 * After a round ends, move any Critical or Null cards that triggered
 * a reshuffle back into the deck (rules: Critical triggers reshuffle).
 * Also decay elements (handled separately).
 */
export function endOfRoundMaintenance(deckState) {
  const needsReshuffle = deckState.discard.some(c => c.reshuffle);
  if (!needsReshuffle) return deckState;

  const deck    = shuffleArray([...deckState.deck, ...deckState.discard]);
  const discard = [];
  return { ...deckState, deck, discard };
}

/**
 * Add a Bless card to the deck (shuffle it in). Max 6.
 */
export function addBless(deckState) {
  const count = (deckState.blessCount ?? 0);
  if (count >= 6) return deckState;
  const newCard = { ...BLESS_CARD, id: `bless_${Date.now()}_${Math.random()}` };
  const deck = shuffleArray([...deckState.deck, newCard]);
  return { ...deckState, deck, blessCount: count + 1 };
}

/**
 * Add a Curse card to the deck (shuffle it in). Max 6.
 */
export function addCurse(deckState) {
  const count = (deckState.curseCount ?? 0);
  if (count >= 6) return deckState;
  const newCard = { ...CURSE_CARD, id: `curse_${Date.now()}_${Math.random()}` };
  const deck = shuffleArray([...deckState.deck, newCard]);
  return { ...deckState, deck, curseCount: count + 1 };
}

/**
 * Return results for advantage/disadvantage draw.
 * mode: "advantage" | "disadvantage" | "normal"
 */
export function resolveDrawMode(cards, mode) {
  if (cards.length === 0) return null;
  if (cards.length === 1 || mode === "normal") return cards[0];

  const [a, b] = cards;
  if (mode === "advantage") {
    // Higher attribute mod wins; Critical beats all, Null loses to all
    return compareCards(a, b) >= 0 ? a : b;
  } else { // disadvantage
    return compareCards(a, b) <= 0 ? a : b;
  }
}

/** Returns positive if a is better, negative if b is better, 0 if tied */
function compareCards(a, b) {
  const rankA = cardRank(a);
  const rankB = cardRank(b);
  return rankA - rankB;
}

function cardRank(card) {
  if (card.type === CARD_TYPE.CRITICAL || card.type === CARD_TYPE.BLESS) return 999;
  if (card.type === CARD_TYPE.NULL     || card.type === CARD_TYPE.CURSE)  return -999;
  return card.attrMod;
}

/**
 * Format an attack modifier for display.
 */
export function formatAtkMod(atkMod) {
  if (atkMod === "null")     return "MISS";
  if (atkMod === "critical") return "×2";
  if (atkMod > 0) return `+${atkMod}`;
  return String(atkMod);
}

/**
 * Format an attribute modifier for display.
 */
export function formatAttrMod(attrMod) {
  if (attrMod === 0 && true) return "—";
  if (attrMod > 0) return `+${attrMod}`;
  return String(attrMod);
}
