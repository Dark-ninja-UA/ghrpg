/**
 * ghrpg.mjs
 * Main entry point for Gloomhaven: The Roleplaying Game system.
 * Foundry VTT v13 (Build 351+)
 */

import { GHRPGActor }          from "./documents/actor.mjs";
import { GHRPGItem, DEFAULT_ICONS } from "./documents/item.mjs";
import { GHRPGCharacterSheet } from "./sheets/character-sheet.mjs";
import { GHRPGNPCSheet }       from "./sheets/npc-sheet.mjs";
import { GHRPGItemSheet }      from "./sheets/item-sheet.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";
import { buildDeck }            from "./helpers/modifier-deck.mjs";
import { ElementTracker }       from "./apps/element-tracker.mjs";
import { GMDeckApp }            from "./apps/gm-deck.mjs";
import { PerkEditorDialog }     from "./apps/perk-editor.mjs";
import { registerCombatHooks }   from "./apps/combat-tracker.mjs";

/* ─────────────────────────────────────────
   Hooks.once("init")
   Register everything before world loads.
───────────────────────────────────────── */
Hooks.once("init", () => {
  console.log("GHRPG | Initialising Gloomhaven: The Roleplaying Game system");

  // ── Register conditions as Foundry status effects ───────────
  const GHRPG_CONDITIONS = [
    "invisible","regenerate","safeguard","strengthen","ward",
    "immobilize","muddle","pacify","poison","stun","wound"
  ];
  // Build localized name map (falls back to capitalized key before game.i18n ready)
  const conditionLabel = key => {
    const map = {
      invisible:"Invisible", regenerate:"Regenerate", safeguard:"Safeguard",
      strengthen:"Strengthen", ward:"Ward", immobilize:"Immobilize",
      muddle:"Muddle", pacify:"Pacify", poison:"Poison", stun:"Stun", wound:"Wound"
    };
    return map[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
  };
  CONFIG.statusEffects = [
    ...GHRPG_CONDITIONS.map(key => ({
      id:   key,
      name: conditionLabel(key),
      img:  `systems/ghrpg/icons/conditions/${key}.png`,
    })),
    // Keep Foundry's dead/defeated for token use
    { id: "dead",     name: "Dead",     img: "icons/svg/skull.svg" },
    { id: "defeated", name: "Defeated", img: "icons/svg/downgrade.svg" },
  ];

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
  GMDeckApp.registerSettings();

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
    "systems/ghrpg/templates/apps/gm-deck.hbs",
    "systems/ghrpg/templates/apps/perk-editor.hbs",
    "systems/ghrpg/templates/apps/planning-dialog.hbs",
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
  registerCombatHooks();
  const gmDeck  = new GMDeckApp();

  game.ghrpg = {
    elementTracker: tracker,
    gmDeck:         gmDeck,

    /** Open the shared Element Tracker window */
    openElementTracker: () => tracker.render({ force: true }),
    openGMDeck:         () => gmDeck.render({ force: true }),

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
   Token status effect → actor condition sync (two-way)
───────────────────────────────────────── */
Hooks.on("createActiveEffect", (effect, options, userId) => {
  if (userId !== game.userId) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  // Skip effects we created ourselves via toggleCondition (they have our flag)
  if (effect.flags?.ghrpg?.fromSheet) return;
  // Get condition key from statuses Set
  const condKey = effect.statuses instanceof Set
    ? [...effect.statuses][0]
    : (Array.isArray(effect.statuses) ? effect.statuses[0] : null);
  if (!condKey || !actor.system.conditions?.[condKey]) return;
  if (!actor.system.conditions[condKey].active) {
    actor.update({ [`system.conditions.${condKey}.active`]: true });
  }
});

Hooks.on("deleteActiveEffect", (effect, options, userId) => {
  if (userId !== game.userId) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  // Skip effects we deleted ourselves via toggleCondition
  if (effect.flags?.ghrpg?.fromSheet) return;
  const condKey = effect.statuses instanceof Set
    ? [...effect.statuses][0]
    : (Array.isArray(effect.statuses) ? effect.statuses[0] : null);
  if (!condKey || !actor.system.conditions?.[condKey]) return;
  if (actor.system.conditions[condKey].active) {
    actor.update({ [`system.conditions.${condKey}.active`]: false });
  }
});

/* ─────────────────────────────────────────
   Default icons per item type
───────────────────────────────────────── */
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (item.img && item.img !== Item.DEFAULT_ICON) return;
  const icon = DEFAULT_ICONS[item.type];
  if (icon) item.updateSource({ img: icon });
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
    tokens.tools["ghrpg-gm-deck"] = {
      name:    "ghrpg-gm-deck",
      title:   "GM Modifier Deck",
      icon:    "fas fa-skull",
      button:  true,
      onClick: () => game.ghrpg?.openGMDeck(),
      visible: game.user.isGM,
    };
    tokens.tools["ghrpg-planning"] = {
      name:    "ghrpg-planning",
      title:   "Reopen Planning Dialog",
      icon:    "fas fa-hand-paper",
      button:  true,
      visible: !game.user.isGM,
      onClick: () => {
        const { openPlanningDialogForActor } = game.ghrpg?._combatTracker ?? {};
        const combat = game.combat;
        if (!combat || combat.getFlag("ghrpg","phase") !== "planning") {
          ui.notifications.warn("No planning phase active.");
          return;
        }
        const myActor = game.actors.find(a =>
          a.isOwner && a.hasPlayerOwner &&
          combat.combatants.some(c => c.actorId === a.id)
        );
        if (myActor) {
          // Import and open
          import("./apps/planning-dialog.mjs").then(({ PlanningDialog }) => {
            // Close existing
            for (const app of Object.values(ui.windows ?? {})) {
              if (app instanceof PlanningDialog && app.actor?.id === myActor.id) app.close();
            }
            new PlanningDialog(myActor).render(true);
          });
        } else {
          ui.notifications.warn("You are not a combatant in the current encounter.");
        }
      },
    };
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
