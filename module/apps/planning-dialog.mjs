/**
 * planning-dialog.mjs
 * Per-player popup during the planning phase.
 * Shows prepared skills/talents, lets player pick 2 cards and set initiative.
 */

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class PlanningDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(actor, options = {}) {
    super(options);
    this.actor    = actor;
    this.selected = [null, null]; // [card0, card1] — item ids
    this.initiativeSlot = 0;     // which card (0 or 1) provides initiative
    this._confirmed = false;
  }

  static DEFAULT_OPTIONS = {
    id:      "ghrpg-planning-dialog",
    classes: ["ghrpg", "planning-dialog"],
    position: { width: 560, height: 620 },
    window: {
      title:       "Planning Phase — Choose Your Cards",
      resizable:   false,
      minimizable: false,
    },
    actions: {
      selectCard:     PlanningDialog._onSelectCard,
      setInitiative:  PlanningDialog._onSetInitiative,
      confirm:        PlanningDialog._onConfirm,
      change:         PlanningDialog._onChange,
    }
  };

  static PARTS = {
    dialog: { template: "systems/ghrpg/templates/apps/planning-dialog.hbs", scrollable: [".planning-card-list"] }
  };

  get title() { return `Planning Phase — ${this.actor.name}`; }

  /* ── Context ────────────────────────────────────────────────── */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.actor;

    // Available cards: prepared skills + all talents
    const preparedSkills = actor.items.filter(i =>
      i.type === "skill" && i.system.prepared && !i.system.expended
    ).sort((a, b) => (a.system.initiative ?? 99) - (b.system.initiative ?? 99));

    const talents = actor.items.filter(i => i.type === "talent" && !i.system.passive)
      .sort((a, b) => (a.system.initiative ?? 99) - (b.system.initiative ?? 99));

    const availableCards = [...preparedSkills, ...talents];

    // Enrich with selection state
    const cards = availableCards.map((item, idx) => ({
      id:          item.id,
      name:        item.name,
      img:         item.img,
      type:        item.type,
      initiative:  item.system.initiative ?? "—",
      primary:     item.system.primaryAction   || "—",
      secondary:   item.system.secondaryAction || "—",
      expended:    item.system.expended,
      lost:        item.system.lost,
      slot0:       this.selected[0] === item.id,
      slot1:       this.selected[1] === item.id,
      selected:    this.selected.includes(item.id),
    }));

    const card0 = this.selected[0] ? availableCards.find(i => i.id === this.selected[0]) : null;
    const card1 = this.selected[1] ? availableCards.find(i => i.id === this.selected[1]) : null;

    const initiative = this.initiativeSlot === 0
      ? (card0?.system.initiative ?? null)
      : (card1?.system.initiative ?? null);

    const canConfirm = this.selected[0] && this.selected[1];

    return {
      ...context,
      cards,
      card0, card1,
      initiativeSlot: this.initiativeSlot,
      initiative,
      canConfirm,
      confirmed: this._confirmed,
    };
  }

  /* ── Actions ────────────────────────────────────────────────── */

  static _onSelectCard(event, target) {
    if (this._confirmed) return;
    const itemId = target.dataset.itemId;
    const slot   = Number(target.dataset.slot); // 0 or 1

    // If clicking an already-selected card in another slot, swap
    const otherSlot = slot === 0 ? 1 : 0;
    if (this.selected[otherSlot] === itemId) {
      // swap
      const tmp = this.selected[0];
      this.selected[0] = this.selected[1];
      this.selected[1] = tmp;
    } else {
      this.selected[slot] = itemId;
      // If same card was in the other slot, clear it
      if (this.selected[otherSlot] === itemId) this.selected[otherSlot] = null;
    }
    this.render();
  }

  static _onSetInitiative(event, target) {
    if (this._confirmed) return;
    this.initiativeSlot = Number(target.dataset.slot);
    this.render();
  }

  static async _onConfirm(event, target) {
    if (!this.selected[0] || !this.selected[1]) return;
    this._confirmed = true;

    const card0 = this.actor.items.get(this.selected[0]);
    const card1 = this.actor.items.get(this.selected[1]);
    const initiative = this.initiativeSlot === 0
      ? (card0?.system.initiative ?? 99)
      : (card1?.system.initiative ?? 99);
    const tiebreaker  = this.initiativeSlot === 0
      ? (card1?.system.initiative ?? 99)
      : (card0?.system.initiative ?? 99);

    // Store selection in combat flags for this actor
    const combat = game.combat;
    if (!combat) return;
    const combatant = combat.combatants.find(c => c.actorId === this.actor.id);
    if (!combatant) return;

    await combatant.setFlag("ghrpg", "planning", {
      card0:       this.selected[0],
      card1:       this.selected[1],
      initiativeSlot: this.initiativeSlot,
      initiative,
      tiebreaker,
      confirmed:   true,
      actorName:   this.actor.name,
      actorImg:    this.actor.img,
    });

    // Update initiative in tracker
    await combatant.update({ initiative });

    ui.notifications.info(`${this.actor.name}: planning confirmed! Initiative ${initiative}`);
    this.render();

    // Notify GM that this player confirmed
    game.socket.emit("system.ghrpg", {
      type:        "planningConfirmed",
      actorId:     this.actor.id,
      actorName:   this.actor.name,
      combatantId: combatant.id,
    });
  }

  static async _onChange(event, target) {
    if (!this._confirmed) return;
    this._confirmed = false;

    const combat = game.combat;
    const combatant = combat?.combatants.find(c => c.actorId === this.actor.id);
    if (combatant) {
      await combatant.unsetFlag("ghrpg", "planning");
      await combatant.update({ initiative: null });
    }
    this.render();
  }

  /* ── Card click (from list) — assigns to first empty slot ───── */
  _onRender(context, options) {
    super._onRender(context, options);

    // Center on first render
    if (options.isFirstRender) {
      const w = 560, h = 620;
      this.setPosition({
        left: Math.max(0, (window.innerWidth  - w) / 2),
        top:  Math.max(0, (window.innerHeight - h) / 2),
        width: w, height: h,
      });
    }
    this.element.querySelectorAll(".plan-card-item").forEach(el => {
      el.addEventListener("click", () => {
        if (this._confirmed) return;
        const itemId = el.dataset.itemId;
        if (this.selected.includes(itemId)) {
          // deselect
          const idx = this.selected.indexOf(itemId);
          this.selected[idx] = null;
        } else if (!this.selected[0]) {
          this.selected[0] = itemId;
        } else if (!this.selected[1]) {
          this.selected[1] = itemId;
        } else {
          // replace slot 0
          this.selected[0] = itemId;
        }
        this.render();
      });
    });
  }
}
