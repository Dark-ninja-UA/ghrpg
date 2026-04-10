/**
 * item.mjs
 * GHRPGItem extends the base Item document.
 */

export class GHRPGItem extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    if (this.type === "skill")   this._prepareSkillData();
    if (this.type === "talent")  this._prepareTalentData();
  }

  _prepareSkillData() {
    // Nothing complex at this level; can be expanded later
  }

  _prepareTalentData() {
    // Nothing complex at this level
  }

  /** ----------------------------------------
   *  Roll / Use helpers
   * ----------------------------------------*/

  /**
   * Use this skill (expend it, trigger attack roll if applicable).
   * Called from the actor sheet or macro.
   */
  async useSkill(options = {}) {
    if (!this.parent) return;
    const system = this.system;

    if (system.expended) {
      ui.notifications.warn(`${this.name} is already expended.`);
      return;
    }

    // Post skill card to chat
    await this._postSkillCard();

    // Mark expended
    await this.update({ "system.expended": true });
  }

  /** Post a skill-use card to chat */
  async _postSkillCard() {
    const primary   = this.system.primaryAction   || "—";
    const secondary = this.system.secondaryAction || "—";
    const initiative = this.system.initiative ?? "?";

    const content = `
<div class="ghrpg chat-skill-card">
  <div class="skill-header">
    <span class="skill-initiative">Initiative: ${initiative}</span>
    <h3 class="skill-name">${this.name}</h3>
    ${this.system.lost ? `<span class="skill-lost-tag">LOST</span>` : ""}
  </div>
  <div class="skill-actions">
    <div class="skill-action primary">
      <span class="action-label">Primary</span>
      <div class="action-text">${primary}</div>
    </div>
    <div class="skill-action secondary">
      <span class="action-label">Secondary</span>
      <div class="action-text">${secondary}</div>
    </div>
  </div>
  ${this.system.description ? `<div class="skill-desc">${this.system.description}</div>` : ""}
</div>`.trim();

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.parent }),
      content
    });
  }

  /**
   * Use a talent (post to chat; talents are never expended).
   */
  async useTalent() {
    await this._postSkillCard();
  }
}
