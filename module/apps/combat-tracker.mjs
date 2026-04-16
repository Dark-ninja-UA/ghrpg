/**
 * combat-tracker.mjs
 * Enhances Foundry's native combat tracker with GHRPG planning phase controls.
 */

import { PlanningDialog } from "./planning-dialog.mjs";

const GHRPG_COMBAT_FLAG = "ghrpg";

export function registerCombatHooks() {

  /* ── Inject GM controls into combat tracker ─────────────────── */
  Hooks.on("renderCombatTracker", (app, html, data) => {
    if (!game.combat) return;

    // Remove any existing GHRPG controls to avoid duplicates
    const root = html[0] ?? html;
    root.querySelectorAll?.(".ghrpg-combat-controls").forEach(el => el.remove());

    const phase = game.combat.getFlag(GHRPG_COMBAT_FLAG, "phase") ?? "none";
    const isGM  = game.user.isGM;

    // Build control bar
    const controls = document.createElement("div");
    controls.className = "ghrpg-combat-controls";

    if (isGM) {
      if (phase === "none" || phase === "resolution") {
        const btn = _makeBtn("fas fa-hand-paper", "Start Planning", "ghrpg-start-planning", "#4a8a2a");
        controls.appendChild(btn);
      }
      if (phase === "planning") {
        const readyCount = _countReady();
        const totalCount = game.combat.combatants.filter(c => _isPlayerCombatant(c)).size ?? 0;
        const btn = _makeBtn("fas fa-eye", `Reveal (${readyCount}/${totalCount} ready)`, "ghrpg-reveal", "#886600");
        controls.appendChild(btn);
      }
      if (phase === "resolution") {
        const btn = _makeBtn("fas fa-forward", "End Round", "ghrpg-end-round", "#664488");
        controls.appendChild(btn);
      }
    }

    // Phase badge
    const badge = document.createElement("div");
    badge.className = `ghrpg-phase-badge phase-${phase}`;
    badge.textContent = { none: "No Combat", planning: "⏳ Planning Phase", resolution: "⚔ Resolution Phase" }[phase] ?? phase;
    controls.appendChild(badge);

    // Insert after tracker header
    const header = html[0]?.querySelector?.(".combat-tracker-header") ?? html.querySelector?.(".combat-tracker-header");
    if (header) header.after(controls);
    else (html[0] ?? html).prepend(controls);

    // Wire buttons
    controls.querySelector("#ghrpg-start-planning")?.addEventListener("click", startPlanning);
    controls.querySelector("#ghrpg-reveal")?.addEventListener("click", revealPlanning);
    controls.querySelector("#ghrpg-end-round")?.addEventListener("click", endRound);
  });

  /* ── Socket: open planning dialog on player clients ─────────── */
  game.socket.on("system.ghrpg", async (data) => {
    if (data.type === "openPlanning") {
      // Find the actor this player owns
      const myActor = game.actors.find(a =>
        a.isOwner && !game.user.isGM &&
        game.combat?.combatants.some(c => c.actorId === a.id)
      );
      if (!myActor) return;
      openPlanningDialogForActor(myActor);
    }

    if (data.type === "planningConfirmed") {
      // GM sees notification
      if (game.user.isGM) {
        const readyCount = _countReady();
        const total = [...(game.combat?.combatants ?? [])].filter(c => _isPlayerCombatant(c)).length;
        ui.notifications.info(`${data.actorName} is ready! (${readyCount}/${total})`);
        ui.combat?.render();
      }
    }

    if (data.type === "closePlanning") {
      // Close any open planning dialogs on player clients
      for (const app of Object.values(ui.windows ?? {})) {
        if (app instanceof PlanningDialog) app.close();
      }
    }
  });
}

/* ── GM opens planning phase ────────────────────────────────── */
async function startPlanning() {
  const combat = game.combat;
  if (!combat) return;

  await combat.setFlag(GHRPG_COMBAT_FLAG, "phase", "planning");

  // Clear previous planning data
  for (const c of combat.combatants) {
    await c.unsetFlag(GHRPG_COMBAT_FLAG, "planning");
    await c.update({ initiative: null });
  }

  // Open GM's own actor dialog if they have one
  const gmActor = _getGMOwnedCombatant();
  if (gmActor) openPlanningDialogForActor(gmActor);

  // Tell all players to open their dialog
  game.socket.emit("system.ghrpg", { type: "openPlanning" });

  ui.notifications.info("Planning phase started!");
  ui.combat?.render();
}

/* ── GM reveals ─────────────────────────────────────────────── */
async function revealPlanning() {
  const combat = game.combat;
  if (!combat) return;

  // Collect all confirmed selections
  const reveals = [];
  for (const combatant of combat.combatants) {
    const planning = combatant.getFlag(GHRPG_COMBAT_FLAG, "planning");
    if (!planning?.confirmed) continue;

    const actor = combatant.actor;
    if (!actor) continue;

    const card0 = actor.items.get(planning.card0);
    const card1 = actor.items.get(planning.card1);
    reveals.push({ combatant, planning, actor, card0, card1 });
  }

  // Sort by initiative (players first on tie, then tiebreaker)
  reveals.sort((a, b) => {
    const ia = a.planning.initiative ?? 99;
    const ib = b.planning.initiative ?? 99;
    if (ia !== ib) return ia - ib;
    // Tie: players before NPCs
    const aIsPlayer = _isPlayerCombatant(a.combatant);
    const bIsPlayer = _isPlayerCombatant(b.combatant);
    if (aIsPlayer !== bIsPlayer) return aIsPlayer ? -1 : 1;
    // Both players: use tiebreaker (second card initiative)
    return (a.planning.tiebreaker ?? 99) - (b.planning.tiebreaker ?? 99);
  });

  // Post to chat — simple one-line-per-player format
  let chatContent = `<div class="ghrpg chat-roll">
<h3 class="roll-title"><i class="fas fa-flag"></i> Round ${combat.round} — Initiative Order</h3>
<div class="reveal-list">`;

  for (let i = 0; i < reveals.length; i++) {
    const { planning, actor, card0, card1 } = reveals[i];
    const initCard  = planning.initiativeSlot === 0 ? card0 : card1;
    const otherCard = planning.initiativeSlot === 0 ? card1 : card0;
    chatContent += `<div class="reveal-row">
  <span class="reveal-rank">${i + 1}.</span>
  <strong class="reveal-name">${actor.name}</strong>
  <span class="reveal-init"><i class="fas fa-flag"></i> ${planning.initiative}</span>
  <span class="reveal-cards-text">${initCard?.name ?? '—'} &amp; ${otherCard?.name ?? '—'}</span>
</div>`;
  }

  chatContent += `</div></div>`;
  await ChatMessage.create({ content: chatContent });

  // Close planning dialogs
  game.socket.emit("system.ghrpg", { type: "closePlanning" });
  for (const app of Object.values(ui.windows ?? {})) {
    if (app instanceof PlanningDialog) app.close();
  }

  await combat.setFlag(GHRPG_COMBAT_FLAG, "phase", "resolution");

  // Start combat if not started
  if (!combat.started) await combat.startCombat();

  ui.combat?.render();
}

/* ── GM ends round ──────────────────────────────────────────── */
async function endRound() {
  const combat = game.combat;
  if (!combat) return;

  // Decay elements
  await game.ghrpg?.elementTracker?.constructor?.decayAll?.();
  // Also call via static method
  const { ElementTracker } = await import("./element-tracker.mjs");
  await ElementTracker.decayAll();

  await combat.setFlag(GHRPG_COMBAT_FLAG, "phase", "none");
  await combat.nextRound();

  ui.notifications.info(`Round ${combat.round} ended. Elements decayed.`);
  ui.combat?.render();
}

/* ── Open planning dialog for an actor ──────────────────────── */
export function openPlanningDialogForActor(actor) {
  // Close any existing dialog for this actor
  for (const app of Object.values(ui.windows ?? {})) {
    if (app instanceof PlanningDialog && app.actor?.id === actor.id) app.close();
  }
  const dialog = new PlanningDialog(actor);
  dialog.render(true);
}

/* ── Helpers ────────────────────────────────────────────────── */
function _makeBtn(icon, label, id, color) {
  const btn = document.createElement("button");
  btn.id        = id;
  btn.className = "ghrpg-combat-btn";
  btn.style.borderColor = color;
  btn.style.color       = color;
  btn.innerHTML = `<i class="${icon}"></i> ${label}`;
  return btn;
}

function _isPlayerCombatant(combatant) {
  return combatant.actor?.hasPlayerOwner ?? false;
}

function _countReady() {
  if (!game.combat) return 0;
  return [...game.combat.combatants].filter(c =>
    c.getFlag(GHRPG_COMBAT_FLAG, "planning")?.confirmed
  ).length;
}

function _getGMOwnedCombatant() {
  if (!game.combat) return null;
  for (const combatant of game.combat.combatants) {
    const actor = combatant.actor;
    if (actor && actor.isOwner && actor.hasPlayerOwner === false) return actor;
  }
  return null;
}
