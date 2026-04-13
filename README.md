# Gloomhaven: The Roleplaying Game — Foundry VTT System

An unofficial Foundry VTT v13 system for **Gloomhaven: The Roleplaying Game** by Cephalofair Games.

> ⚠️ This is an unofficial fan system. All game content (rules, lore, card values) is © Cephalofair Games, LLC. This system contains no copyrighted game content — it is a rules engine only.

---

## Installation

### Via Manifest URL (recommended)

1. Open Foundry VTT → **Setup → Game Systems → Install System**
2. Paste into the **Manifest URL** field:
   ```
   https://raw.githubusercontent.com/Dark-ninja-UA/ghrpg/main/system.json
   ```
3. Click **Install**
4. When updates are available, click **Update** next to the system in the Game Systems list

### Manual (local Foundry)

1. Download the latest `ghrpg.zip` from [Releases](https://github.com/Dark-ninja-UA/ghrpg/releases/latest)
2. Extract the zip
3. Copy the extracted `ghrpg` folder into your Foundry `Data/systems/` directory
4. Restart Foundry — the system will appear in the Game Systems list

> **Note:** Do not mix manifest URL installation and manual installation for the same system. Use one method consistently.

---

## System Philosophy

This system is a **rules engine only** — no game content is pre-loaded. After installing you manually create Ancestries, Classes, Skills, Talents, and Perks from the book. This keeps the system legally clean and fully customizable.

---

## Features (v0.2.x)

### Character Sheet
- **6 tabs:** Stats, Skills, Talents, Inventory, Deck, Biography
- **Attributes:** Cunning, Finesse, Grit, Intuition, Logic, Understanding (0–7)
- **HP bar** with live update
- **Conditions** tracked with toggle buttons — positive: Invisible, Regenerate, Safeguard, Strengthen, Ward; negative: Curse, Immobilize, Muddle, Pacify, Poison, Stun, Wound
- **Gold** field
- **Quick Breath:** recover all expended non-lost skills
- **Full Rest:** recover all skills including lost, reshuffle modifier deck, restore HP to max

### Ancestry & Class System
- Create **Ancestry** and **Class** items manually from the book
- Ancestry items: description, traits, drag-drop to link skills and talents
- Class items: description, starting attribute bonuses (per attribute), drag-drop to link skills and talents, perk list
- Selecting ancestry/class on a character **automatically copies** linked skills/talents onto the sheet
- Switching ancestry/class removes previously synced items; manually-added items are never touched
- Skills tagged as **Ancestry (A)**, **Class (C)**, or **Other (O)**

### Skills & Talents
- Prepared skill slots split: **2 Ancestry + 4 Class/Other** per day — limits enforced with warnings
- Skills can be flagged **Not expended on use** for at-will abilities
- Using a skill posts its card to chat, then marks it expended (unless flagged)
- Talents are never expended

### Modifier Deck (per character)
Correct 20-card base distribution per the rulebook:

| Count | Attr | Atk |
|-------|------|-----|
| ×1 | Null | ⊘ (Miss) |
| ×1 | 1 | −2 |
| ×1 | 1 | −1 |
| ×3 | 2 | −1 |
| ×1 | 3 | −1 |
| ×3 | 3 | ±0 |
| ×3 | 4 | ±0 |
| ×1 | 4 | +1 |
| ×3 | 5 | +1 |
| ×1 | 6 | +1 |
| ×1 | 6 | +2 |
| ×1 | Critical | ×2 |

- **Draw modes:** Normal, Advantage (draw 2, take better), Disadvantage (draw 2, take worse)
- **Bless / Curse** injection (0–6 each), tracked separately from conditions
- **Auto-reshuffle** on Null or Critical draw
- **Add / Remove individual cards** from the draw pile; removed defaults can be restored
- **Custom cards** with attack mod, attribute mod, effects, and flavor text
- **Card effects:** Poison, Wound, Muddle, Stun, Immobilize, Pierce, Push, Pull, Heal, Strengthen, Curse, Bless, Invisible — each auto-applied or optional
- **Last Drawn** card shown as physical card visual (attack value in center circle, attribute mod in gold hex badge, character portrait)
- **Discard pile** with newest-first scrollable list

### Perk System
- Perks defined per **Class item** via the perk editor dialog
- Each perk has: label, max times takeable, cards to remove from base deck, cards to add (with effects and flavor text)
- Character sheet **Deck tab** shows the full class perk list with checkboxes (one checkbox per allowed use)
- Perk points = `(level − 1) + bonus perks` — bonus perks field editable on the sheet
- Selecting a perk surgically modifies the deck immediately — no reshuffle triggered
- Deselecting removes the perk's cards immediately

### Attribute Tests & Attack Rolls
- Click any attribute on the Stats tab → dialog for Target Number, bonus, and draw mode
- Chat output shows the drawn card as a physical card visual
- Card effects displayed as color-coded pills on the card
- Attack rolls use the same visual with damage breakdown

### GM Modifier Deck
- Standalone floating window, **GM only** (skull icon in scene controls sidebar)
- Full deck mechanics: Normal/Advantage/Disadvantage, Bless/Curse, Reshuffle/Initialize
- Posts to chat labeled "Game Master"
- State stored world-wide, persists across sessions

### Element Tracker
- Shared world-level floating window (fire icon in scene controls sidebar)
- All 6 elements: Air, Dark, Earth, Fire, Ice, Light
- States cycle: **Inert → Strong → Waning → Inert**
- Decay moves each element one step back toward Inert
- GM can cycle individual elements; **Decay All** and **Reset All** buttons available
- Players can view the tracker (read-only)
- Single tracker shared across all scenes

---

## Attributes

| Abbr | Full Name |
|------|-----------|
| CU | Cunning |
| FI | Finesse |
| GR | Grit |
| IN | Intuition |
| LO | Logic |
| UN | Understanding |

---

## Item Types

| Type | Purpose |
|------|---------|
| Skill | Class or ancestry skill — initiative, primary/secondary actions, level, source type |
| Talent | Always-available ability — passive flag, upgrade level, not expended on use option |
| Ancestry | Traits description, linked ancestry skills and talents |
| Class | Starting attribute bonuses, linked class skills and talents, perk definitions |
| Background | Occupation/Origin/Social backgrounds with bonus values |
| Equipment | Gear with slot, rarity, uses, consumable and alchemic flags |

---

## Scene Controls (Left Sidebar)

| Icon | Tool | Visible To |
|------|------|------------|
| `fa-skull` | GM Modifier Deck | GM only |
| `fa-fire` | Element Tracker | Everyone |

---

## Compatibility

| Foundry Version | Status |
|----------------|--------|
| v13 (Build 351+) | ✅ Verified |
| v14 | ⚠️ Untested — likely requires minor updates |

---

## Roadmap

- [ ] Per-class perk data from rulebook
- [ ] Level-up skill filtering by class and level
- [ ] Enemy stat blocks / NPC bestiary
- [ ] Battle planning phase UI
- [ ] Faction reputation tracker
- [ ] Company sheet

---

## License

System code: **MIT**  
Gloomhaven: The Roleplaying Game: **© Cephalofair Games, LLC** — all rights reserved
