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

### Manual

Download the latest `ghrpg.zip` from [Releases](https://github.com/Dark-ninja-UA/ghrpg/releases/latest) and unzip into your `Data/systems/` folder.

---

## System Philosophy

This system is designed around **manual content entry**. Installing the system gives you a complete rules engine — sheets, dice, the modifier deck — but no pre-loaded game content. You fill in ancestries, classes, skills, and perks yourself from the book.

A companion **content module** (`ghrpg-content`) will be available separately and will provide all book content as Foundry compendiums, allowing instant setup without manual entry.

---

## Features (v0.2.x)

### Character Sheet
- **6 tabs:** Stats, Skills, Talents, Inventory, Deck, Biography
- **Attributes:** Cunning, Finesse, Grit, Intuition, Logic, Understanding (0–7)
- **HP bar** with live update as you type
- **Conditions:** all 13 conditions tracked with toggle buttons (Bless, Invisible, Regenerate, Safeguard, Strengthen, Ward, Curse, Immobilize, Muddle, Pacify, Poison, Stun, Wound)
- **Backgrounds, Equipment, Inventory** management

### Ancestry & Class System
- Create **Ancestry** items and **Class** items manually from the book
- Each has a drag-drop interface to link skills and talents
- Selecting ancestry/class on a character automatically copies linked skills/talents onto the sheet
- Changing or clearing ancestry/class removes previously synced items (manually-added items are never touched)
- **Starting Attribute Bonuses** per class
- Skills tagged as Ancestry (A), Class (C), or Other (O) for prepared slot tracking

### Skills & Talents
- Skill preparation split: **2 Ancestry slots + 4 Class/Other slots** per day
- Prepared slot limits enforced with warnings
- Skills can be marked **Not expended on use** (at-will abilities)
- Use skill → posts card to chat → marks expended (unless toggled off)
- **Quick Breath:** recover expended non-lost skills
- **Full Rest:** recover all skills including lost, reshuffle deck, restore HP to max

### Modifier Deck (per character)
Corrected 20-card base distribution per the rulebook:

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
- **Bless / Curse** injection (0–6 each)
- **Auto-reshuffle** on Null or Critical draw
- **Add/Remove individual cards** — track removed default cards and restore them
- **Custom cards** with attack mod, attribute mod, effects, and flavor text
- **Card effects:** Poison, Wound, Muddle, Stun, Immobilize, Pierce, Push, Pull, Heal, Strengthen, Curse, Bless, Invisible — each auto or optional
- **Last Drawn** card shown as physical card visual with portrait, attack circle, and attribute hex badge
- **Discard pile** with newest-first scrollable list

### Perk System
- Perks defined per class (manually entered on the Class item sheet)
- Perk editor dialog: label, max times takeable, cards to remove from base deck, cards to add (with effects and flavor text)
- Character sheet Deck tab shows the full class perk list with checkboxes (one per allowed use)
- Perk points = `(level − 1) + bonus perks` (bonus perks field editable on sheet)
- Selecting a perk immediately and surgically modifies the deck — no reshuffle
- Deselecting removes the perk's cards immediately

### Attribute Tests & Attack Rolls
- Click any attribute on the Stats tab → dialog for Target Number, bonus, and draw mode
- Chat output shows a physical card visual (attack mod in center circle, attribute mod in gold hex badge, character portrait)
- Card effects displayed as color-coded pills on the card
- Attack rolls use the same visual with damage breakdown

### GM Modifier Deck
- Standalone floating window, GM-only (💀 skull icon in scene controls)
- Same deck mechanics as player decks — Normal/Advantage/Disadvantage draw, Bless/Curse, Reshuffle/Initialize
- Posts to chat labeled "Game Master"
- State stored as a world setting, persists across sessions

### Element Tracker
- Shared world-level floating window (🔥 fire icon in scene controls)
- All 6 elements: Air, Dark, Earth, Fire, Ice, Light
- States: Inert → Strong → Waning → Inert
- GM can cycle elements; **Decay All** and **Reset All** buttons
- Players see the tracker (view only)

### NPC Sheet
- HP, Move, Attack, Attribute scores, Conditions
- Own modifier deck

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
| Skill | Class or ancestry skill card — initiative, primary/secondary actions, level, source |
| Talent | Always-available ability — passive flag, upgrade level |
| Ancestry | Defines ancestry traits, links ancestry skills/talents |
| Class | Defines starting attribute bonuses, links class skills/talents, holds perk list |
| Background | Occupation/Origin/Social backgrounds with bonus values |
| Equipment | Gear with slot, rarity, uses, consumable/alchemic flags |

---

## Scene Controls (Sidebar)

| Icon | Tool | Who |
|------|------|-----|
| 💀 | GM Modifier Deck | GM only |
| 🔥 | Element Tracker | Everyone |

---

## Content Module

The `ghrpg-content` module (separate repo: `Dark-ninja-UA/ghrpg-content`) will provide:
- All 8 ancestries with skills and talents
- All 16 classes with skills, talents, and perks
- Equipment and item compendiums
- Monster stat blocks
- Rulebook reference journals

When installed and activated, it offers to auto-import everything into your world on first run, or you can use the compendiums manually.

---

## Compatibility

| Foundry Version | Status |
|----------------|--------|
| v13 (Build 351+) | ✅ Verified |
| v14 | ⚠️ Untested — likely requires minor updates |

---

## Roadmap / Known Planned Features

- Per-class perk data from rulebook (via content module)
- Enemy bestiary and stat blocks
- Battle planning phase UI
- Faction reputation tracker
- Company sheet
- Level-up skill filtering by class and level

---

## License

System code: **MIT**
Gloomhaven: The Roleplaying Game content: **© Cephalofair Games, LLC** — all rights reserved
