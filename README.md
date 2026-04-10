# Gloomhaven: The Roleplaying Game — Foundry VTT System

An unofficial Foundry VTT v13 system for **Gloomhaven: The Roleplaying Game** by Cephalofair Games (December 2025 draft).

> ⚠️ This is an unofficial fan system. The rulebook is © 2025 Cephalofair Games, LLC.

## Installation

### Via Manifest URL (recommended)

1. Open Foundry VTT → **Setup → Game Systems → Install System**
2. Paste this URL into the **Manifest URL** field at the bottom:
   ```
   https://raw.githubusercontent.com/Dark-ninja-UA/ghrpg/main/system.json
   ```
3. Click **Install**

### Manual

Download the latest `ghrpg.zip` from [Releases](https://github.com/Dark-ninja-UA/ghrpg/releases/latest) and unzip it into your `Data/systems/` folder.

## Features (v0.1.0)

- **Character Sheet** with 6 tabs: Stats, Skills, Talents, Inventory, Modifier Deck, Biography
- **Modifier Deck** — full 20-card virtual deck per actor, auto-initialised on character creation
  - Null (Critical Failure) and Critical (double damage/auto-success)
  - Bless and Curse card injection (up to 6 each)
  - Advantage (draw 2, take better) and Disadvantage (draw 2, take worse)
  - Perks permanently modify deck composition
  - Auto-reshuffle on Critical/Null draw
- **Attribute Tests** — click any attribute → dialog for TN, bonus, mode → draws card → full breakdown in chat
- **Attack Rolls** — base attack + card modifier with chat output
- **Skill management** — prepare 4 class + 2 ancestry skills per day, use/expend/recover, Lost skills, post skill cards to chat
- **Condition tracker** — all 13 conditions (Bless, Invisible, Strengthen, Ward, Curse, Immobilize, Muddle, Poison, Stun, Wound, etc.)
- **Element tracker** — all 6 elements (Air, Dark, Earth, Fire, Ice, Light) cycling Inert → Waning → Strong
- **Quick Breath / Full Rest** — automated skill recovery and deck reshuffling
- **NPC Sheet** with GM Modifier Deck support
- **Item sheets** for Skills, Talents, Backgrounds, and Equipment

## Attributes

| Abbr | Attribute     |
|------|---------------|
| CU   | Cunning       |
| FI   | Finesse       |
| GR   | Grit          |
| IN   | Intuition     |
| LO   | Logic         |
| UN   | Understanding |

## Classes

Berserker, Bladeswarm, Bruiser, Cragheart, Doomstalker, Elementalist, Mindthief, Plagueherald, Quartermaster, Sawbones, Silent Knife, Soothsinger, Spellweaver, Sunkeeper, Tinkerer, Wildfury

## Ancestries

Harrower, Human, Inox, Orchid, Quatryl, Savvas, Valrath, Vermling

## Compatibility

| Foundry Version | Status  |
|-----------------|---------|
| v13 (Build 351) | ✅ Verified |

## Roadmap

- [ ] Compendium packs (all 16 classes' Skills and Talents pre-loaded)
- [ ] Modifier deck card visualisation
- [ ] Enemy stat blocks / Bestiary
- [ ] Element decay automation (end-of-round hook)
- [ ] Faction reputation tracker
- [ ] Company sheet

## License

System code: MIT  
Gloomhaven game content: © 2025 Cephalofair Games, LLC — all rights reserved
