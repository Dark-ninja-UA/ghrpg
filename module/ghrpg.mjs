/**
 * ghrpg.mjs
 * Main entry point for Gloomhaven: The Roleplaying Game system.
 * Foundry VTT v13 (Build 351+)
 */

import { GHRPGActor }          from "./documents/actor.mjs";
import { GHRPGItem }           from "./documents/item.mjs";
import { GHRPGCharacterSheet } from "./sheets/character-sheet.mjs";
import { GHRPGNPCSheet }       from "./sheets/npc-sheet.mjs";
import { GHRPGItemSheet }      from "./sheets/item-sheet.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";
import { buildDeck }            from "./helpers/modifier-deck.mjs";
import { ElementTracker }       from "./apps/element-tracker.mjs";

/* ─────────────────────────────────────────
   Hooks.once("init")
   Register everything before world loads.
───────────────────────────────────────── */
Hooks.once("init", () => {
  console.log("GHRPG | Initialising Gloomhaven: The Roleplaying Game system");

  // ── Custom document classes ──────────────────────────────────
  CONFIG.Actor.documentClass = GHRPGActor;
  CONFIG.Item.documentClass  = GHRPGItem;

  // ── Actor sheet registrations ────────────────────────────────
  Actors.registerSheet("ghrpg", GHRPGCharacterSheet, {
    types:   ["character"],
    makeDefault: true,
    label:   "Character Sheet"
  });
  Actors.registerSheet("ghrpg", GHRPGNPCSheet, {
    types:   ["npc"],
    makeDefault: true,
    label:   "NPC Sheet"
  });

  // ── Item sheet registration ──────────────────────────────────
  Items.registerSheet("ghrpg", GHRPGItemSheet, {
    makeDefault: true,
    label: "Item Sheet"
  });

  // ── Handlebars helpers ────────────────────────────────────────
  registerHandlebarsHelpers();

  // ── Element Tracker world setting ────────────────────────────
  ElementTracker.registerSettings();

  // ── Pre-load templates ────────────────────────────────────────
  const templates = [
    "systems/ghrpg/templates/actors/parts/header.hbs",
    "systems/ghrpg/templates/actors/parts/stats.hbs",
    "systems/ghrpg/templates/actors/parts/skills.hbs",
    "systems/ghrpg/templates/actors/parts/talents.hbs",
    "systems/ghrpg/templates/actors/parts/inventory.hbs",
    "systems/ghrpg/templates/actors/parts/deck.hbs",
    "systems/ghrpg/templates/actors/parts/biography.hbs",
    "systems/ghrpg/templates/actors/npc-sheet.hbs",
    "systems/ghrpg/templates/items/item-sheet.hbs",
    "systems/ghrpg/templates/apps/element-tracker.hbs",
  ];
  loadTemplates(templates);

  console.log("GHRPG | System initialised.");
});

/* ─────────────────────────────────────────
   Hooks.once("ready")
   Post-init, world ready.
───────────────────────────────────────── */
Hooks.once("ready", () => {
  console.log("GHRPG | World ready.");
});

/* ─────────────────────────────────────────
   Auto-initialise Modifier Deck for new characters
───────────────────────────────────────── */
Hooks.on("createActor", async (actor) => {
  if (actor.type !== "character" && actor.type !== "npc") return;
  // Initialise the modifier deck if it's empty
  const deck = actor.system.modifierDeck?.deck ?? [];
  if (deck.length === 0) {
    await actor.initializeModifierDeck();
  }
});

/* ─────────────────────────────────────────
   Expose a simple API on the game object
   for macros and other modules to use.
───────────────────────────────────────── */
Hooks.once("ready", () => {
  // Create singleton tracker instance
  const tracker = new ElementTracker();

  game.ghrpg = {
    elementTracker: tracker,

    /** Open the shared Element Tracker window */
    openElementTracker: () => tracker.render({ force: true }),

    /** Roll an attribute test for the selected token's actor */
    rollAttribute: async (attrKey, options = {}) => {
      const actor = canvas.tokens.controlled?.[0]?.actor
                 ?? game.user.character;
      if (!actor) return ui.notifications.warn("No actor selected.");
      return actor.rollAttributeTest(attrKey, options);
    },

    /** Roll an attack for the selected token's actor */
    rollAttack: async (baseAttack, options = {}) => {
      const actor = canvas.tokens.controlled?.[0]?.actor
                 ?? game.user.character;
      if (!actor) return ui.notifications.warn("No actor selected.");
      return actor.rollAttack(baseAttack, options);
    },

    /** Draw a card for the selected token's actor */
    drawCard: async (mode = "normal") => {
      const actor = canvas.tokens.controlled?.[0]?.actor
                 ?? game.user.character;
      if (!actor) return ui.notifications.warn("No actor selected.");
      return actor.drawModifierCard(mode);
    },

    /** Decay world elements one step */
    decayElements: async () => ElementTracker.decayAll(),

    /** Quick Breath for all controlled actors */
    quickBreath: async () => {
      for (const token of canvas.tokens.controlled) {
        await token.actor?.quickBreath();
      }
    },

    /** Full Rest for all controlled actors */
    fullRest: async () => {
      for (const token of canvas.tokens.controlled) {
        await token.actor?.fullRest();
      }
    },

    buildDeck,
  };
});

/* ─────────────────────────────────────────
   Useful macro examples in chat on first run
   (optional, remove if undesired)
───────────────────────────────────────── */
Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  if (game.settings.storage?.get?.("ghrpg", "welcomeShown")) return;

  // Could show a welcome journal or notification here if desired
});

/* ─────────────────────────────────────────
   Scene Controls — Element Tracker button
───────────────────────────────────────── */
Hooks.on("getSceneControlButtons", (controls) => {
  // v13: controls is an object keyed by group name
  const tokens = controls.tokens ?? controls.token;
  if (tokens?.tools) {
    tokens.tools["ghrpg-elements"] = {
      name:    "ghrpg-elements",
      title:   "Element Tracker",
      icon:    "fas fa-fire",
      button:  true,
      onClick: () => game.ghrpg?.openElementTracker(),
      visible: true,
    };
  }
});
