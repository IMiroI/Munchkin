import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// DOOR CARDS — 84 total
// ---------------------------------------------------------------------------

// Monsters (40)
const monsters = [
  // Level 1 ×8
  { id: 'd-m-001', name: 'Potted Plant',         power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-002', name: 'Potted Plant',         power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-003', name: 'Potted Plant',         power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-004', name: 'Maul Rat',             power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-005', name: 'Maul Rat',             power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-006', name: 'Lame Goblin',          power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-007', name: 'Lame Goblin',          power: 1,  effectDescription: 'Level 1. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-008', name: 'Wannabe Vampire',      power: 2,  effectDescription: 'Level 2. Undead. Treasures: 1. Bad stuff: Lose a level.' },
  // Level 2-3 ×4
  { id: 'd-m-009', name: 'Wannabe Vampire',      power: 2,  effectDescription: 'Level 2. Undead. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-010', name: 'Large Angry Chicken',  power: 2,  effectDescription: 'Level 2. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-011', name: 'Large Angry Chicken',  power: 2,  effectDescription: 'Level 2. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-012', name: 'Snails of Caerbannog', power: 3,  effectDescription: 'Level 3. Treasures: 1. Bad stuff: Lose your footgear.' },
  // Level 4-5 ×11
  { id: 'd-m-013', name: 'Flying Frogs',         power: 4,  effectDescription: 'Level 4. Treasures: 1. Bad stuff: Lose a level per frog — there are 2 frogs.' },
  { id: 'd-m-014', name: 'Flying Frogs',         power: 4,  effectDescription: 'Level 4. Treasures: 1. Bad stuff: Lose a level per frog — there are 2 frogs.' },
  { id: 'd-m-015', name: 'Tequila Mockingbird',  power: 4,  effectDescription: 'Level 4. Treasures: 2. Bad stuff: Lose 2 levels.' },
  { id: 'd-m-016', name: 'Tequila Mockingbird',  power: 4,  effectDescription: 'Level 4. Treasures: 2. Bad stuff: Lose 2 levels.' },
  { id: 'd-m-017', name: 'Shrieking Geek',       power: 4,  effectDescription: 'Level 4. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-018', name: 'Shrieking Geek',       power: 4,  effectDescription: 'Level 4. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-019', name: 'Mutant Gerbils',       power: 4,  effectDescription: 'Level 4. Treasures: 1. Bad stuff: Lose a level.' },
  { id: 'd-m-020', name: 'Drooling Slime',       power: 5,  effectDescription: 'Level 5. Treasures: 2. Bad stuff: Lose your armor.' },
  { id: 'd-m-021', name: 'Drooling Slime',       power: 5,  effectDescription: 'Level 5. Treasures: 2. Bad stuff: Lose your armor.' },
  { id: 'd-m-022', name: 'Face Sucker',          power: 5,  effectDescription: 'Level 5. Treasures: 1. Bad stuff: Lose your headgear.' },
  { id: 'd-m-023', name: 'Amazon',               power: 6,  effectDescription: 'Level 6. Treasures: 2. Bad stuff: Change sex.' },
  // Level 6-8 ×12
  { id: 'd-m-024', name: 'Undead Horse',         power: 6,  effectDescription: 'Level 6. Undead. Treasures: 2. Bad stuff: Lose 2 levels.' },
  { id: 'd-m-025', name: 'Undead Horse',         power: 6,  effectDescription: 'Level 6. Undead. Treasures: 2. Bad stuff: Lose 2 levels.' },
  { id: 'd-m-026', name: 'Hippogriff',           power: 6,  effectDescription: 'Level 6. Treasures: 2. Bad stuff: Lose your biggest item.' },
  { id: 'd-m-027', name: 'Lawyer',               power: 6,  effectDescription: 'Level 6. Treasures: 2. Bad stuff: Lose a level per attorney in play (min 1).' },
  { id: 'd-m-028', name: 'Mr. Bones',            power: 8,  effectDescription: 'Level 8. Undead. Treasures: 2. Bad stuff: Lose 3 levels.' },
  { id: 'd-m-029', name: 'Stoned Golem',         power: 8,  effectDescription: 'Level 8. Treasures: 3. Bad stuff: Lose 3 levels.' },
  { id: 'd-m-030', name: 'Stoned Golem',         power: 8,  effectDescription: 'Level 8. Treasures: 3. Bad stuff: Lose 3 levels.' },
  { id: 'd-m-031', name: 'Gazebo',               power: 8,  effectDescription: 'Level 8. Treasures: 2. Bad stuff: Lose your armor and 2 levels.' },
  { id: 'd-m-032', name: 'Gelatinous Octahedron',power: 8,  effectDescription: 'Level 8. Treasures: 3. Bad stuff: Lose 2 levels and your armor.' },
  { id: 'd-m-033', name: 'Unspeakably Awful Indescribable Horror', power: 8, effectDescription: 'Level 8. Treasures: 3. Bad stuff: Lose 2 items.' },
  { id: 'd-m-034', name: 'Insurance Salesman',   power: 8,  effectDescription: 'Level 8. Treasures: 2. Bad stuff: Give half your items to the most powerful player.' },
  { id: 'd-m-035', name: 'Bigfoot',              power: 8,  effectDescription: 'Level 8. Treasures: 2. Bad stuff: Lose your footgear.' },
  // Level 10+ ×5
  { id: 'd-m-036', name: 'Net Troll',            power: 10, effectDescription: 'Level 10. Treasures: 3. Bad stuff: Lose your biggest item.' },
  { id: 'd-m-037', name: 'Net Troll',            power: 10, effectDescription: 'Level 10. Treasures: 3. Bad stuff: Lose your biggest item.' },
  { id: 'd-m-038', name: 'Wight Brothers',       power: 12, effectDescription: 'Level 12. Undead. Treasures: 3. Bad stuff: Lose 3 levels.' },
  { id: 'd-m-039', name: 'Wight Brothers',       power: 12, effectDescription: 'Level 12. Undead. Treasures: 3. Bad stuff: Lose 3 levels.' },
  { id: 'd-m-040', name: 'Plutonium Dragon',     power: 20, effectDescription: 'Level 20. Treasures: 5. Bad stuff: You die. Everyone else loses 3 levels.' },
].map(c => ({ ...c, type: 'Monster' }));

// Curses (20)
const curses = [
  { id: 'd-c-001', name: 'Curse! Lose a Level',        effectDescription: 'Immediately: Lose 1 level.' },
  { id: 'd-c-002', name: 'Curse! Lose a Level',        effectDescription: 'Immediately: Lose 1 level.' },
  { id: 'd-c-003', name: 'Curse! Lose a Level',        effectDescription: 'Immediately: Lose 1 level.' },
  { id: 'd-c-004', name: 'Curse! Lose a Level',        effectDescription: 'Immediately: Lose 1 level.' },
  { id: 'd-c-005', name: 'Curse! Change Sex',          effectDescription: 'Immediately: Change sex. Sex-restricted items may become unusable.' },
  { id: 'd-c-006', name: 'Curse! Change Sex',          effectDescription: 'Immediately: Change sex. Sex-restricted items may become unusable.' },
  { id: 'd-c-007', name: 'Curse! Change Sex',          effectDescription: 'Immediately: Change sex. Sex-restricted items may become unusable.' },
  { id: 'd-c-008', name: 'Curse! Lose Your Class',     effectDescription: 'Immediately: Discard your class card. You become classless.' },
  { id: 'd-c-009', name: 'Curse! Lose Your Class',     effectDescription: 'Immediately: Discard your class card. You become classless.' },
  { id: 'd-c-010', name: 'Curse! Lose Your Race',      effectDescription: 'Immediately: Discard your race card. You become human.' },
  { id: 'd-c-011', name: 'Curse! Lose Your Race',      effectDescription: 'Immediately: Discard your race card. You become human.' },
  { id: 'd-c-012', name: 'Curse! Lose Your Headgear',  effectDescription: 'Immediately: Discard your headgear item.' },
  { id: 'd-c-013', name: 'Curse! Lose Your Headgear',  effectDescription: 'Immediately: Discard your headgear item.' },
  { id: 'd-c-014', name: 'Curse! Lose Your Armor',     effectDescription: 'Immediately: Discard your armor item.' },
  { id: 'd-c-015', name: 'Curse! Lose Your Footgear',  effectDescription: 'Immediately: Discard your footgear item.' },
  { id: 'd-c-016', name: 'Curse! Duck of Doom',        effectDescription: 'Immediately: Discard your most powerful item.' },
  { id: 'd-c-017', name: 'Curse! Chicken on Your Head',effectDescription: 'Until you kill a monster: -1 in combat (one hand must hold the chicken).' },
  { id: 'd-c-018', name: 'Curse! Tax Collector',       effectDescription: 'Immediately: Give one item to the most powerful player (your choice; ties go left).' },
  { id: 'd-c-019', name: 'Curse! Malign Mirror',       effectDescription: 'Immediately: Apply a curse of any opponent\'s choice to yourself.' },
  { id: 'd-c-020', name: 'Curse! Truly Obnoxious Curse', effectDescription: 'Immediately: Lose 1 level AND discard your most powerful item.' },
].map(c => ({ ...c, type: 'DoorCurse', power: null as number | null }));

// Classes (8)
const classes = [
  { id: 'd-cl-001', name: 'Warrior', effectDescription: '+1 per level above 5 in combat. May carry any weapon without restriction. May discard any number of cards to add +1 each (once per combat).' },
  { id: 'd-cl-002', name: 'Warrior', effectDescription: '+1 per level above 5 in combat. May carry any weapon without restriction. May discard any number of cards to add +1 each (once per combat).' },
  { id: 'd-cl-003', name: 'Wizard',  effectDescription: 'Can use any item. Once per combat, discard any number of cards to add +1 per card to your combat total.' },
  { id: 'd-cl-004', name: 'Wizard',  effectDescription: 'Can use any item. Once per combat, discard any number of cards to add +1 per card to your combat total.' },
  { id: 'd-cl-005', name: 'Cleric',  effectDescription: 'May turn undead: once per combat, discard a card to make one undead monster run away automatically.' },
  { id: 'd-cl-006', name: 'Cleric',  effectDescription: 'May turn undead: once per combat, discard a card to make one undead monster run away automatically.' },
  { id: 'd-cl-007', name: 'Thief',   effectDescription: 'Backstab: once per combat you are not in, subtract 2 from any one player\'s combat total (yours or theirs).' },
  { id: 'd-cl-008', name: 'Thief',   effectDescription: 'Backstab: once per combat you are not in, subtract 2 from any one player\'s combat total (yours or theirs).' },
].map(c => ({ ...c, type: 'Class', power: null as number | null }));

// Races (8)
const races = [
  { id: 'd-r-001', name: 'Elf',      effectDescription: 'Gain 1 level every time you help another player kill a monster (in addition to negotiated rewards).' },
  { id: 'd-r-002', name: 'Elf',      effectDescription: 'Gain 1 level every time you help another player kill a monster (in addition to negotiated rewards).' },
  { id: 'd-r-003', name: 'Dwarf',    effectDescription: 'No hand limit. May carry any number of Big items.' },
  { id: 'd-r-004', name: 'Dwarf',    effectDescription: 'No hand limit. May carry any number of Big items.' },
  { id: 'd-r-005', name: 'Halfling', effectDescription: 'Once per combat, discard a card to escape automatically without rolling.' },
  { id: 'd-r-006', name: 'Halfling', effectDescription: 'Once per combat, discard a card to escape automatically without rolling.' },
  { id: 'd-r-007', name: 'Human',    effectDescription: 'No special ability. Once per game, may ask for help without offering treasure.' },
  { id: 'd-r-008', name: 'Human',    effectDescription: 'No special ability. Once per game, may ask for help without offering treasure.' },
].map(c => ({ ...c, type: 'Race', power: null as number | null }));

// Other door cards (8)
const otherDoor = [
  { id: 'd-o-001', name: 'Wandering Monster',   type: 'DoorCurse', power: null as number | null, effectDescription: 'Play during another player\'s combat to add one monster from your hand. Treasures and bad stuff apply independently.' },
  { id: 'd-o-002', name: 'Wandering Monster',   type: 'DoorCurse', power: null, effectDescription: 'Play during another player\'s combat to add one monster from your hand. Treasures and bad stuff apply independently.' },
  { id: 'd-o-003', name: 'Wandering Monster',   type: 'DoorCurse', power: null, effectDescription: 'Play during another player\'s combat to add one monster from your hand. Treasures and bad stuff apply independently.' },
  { id: 'd-o-004', name: 'Wandering Monster',   type: 'DoorCurse', power: null, effectDescription: 'Play during another player\'s combat to add one monster from your hand. Treasures and bad stuff apply independently.' },
  { id: 'd-o-005', name: 'Divine Intervention', type: 'DoorCurse', power: null, effectDescription: 'Cleric only. Play in combat vs an undead monster to win instantly. Collect all treasures normally.' },
  { id: 'd-o-006', name: 'Divine Intervention', type: 'DoorCurse', power: null, effectDescription: 'Cleric only. Play in combat vs an undead monster to win instantly. Collect all treasures normally.' },
  { id: 'd-o-007', name: 'Illusion',            type: 'DoorCurse', power: null, effectDescription: 'Play when you must fight a monster. It was imaginary — it runs away. No combat, no treasures, no bad stuff.' },
  { id: 'd-o-008', name: 'Illusion',            type: 'DoorCurse', power: null, effectDescription: 'Play when you must fight a monster. It was imaginary — it runs away. No combat, no treasures, no bad stuff.' },
];

// ---------------------------------------------------------------------------
// TREASURE CARDS — 84 total
// ---------------------------------------------------------------------------

const treasures = [
  // --- Headgear (7) ---
  { id: 't-h-001', name: 'Horned Helmet',           power: 2,   effectDescription: '+2 in combat. Slot: Headgear. Big item.' },
  { id: 't-h-002', name: 'Helm of Courage',         power: 1,   effectDescription: '+1 in combat. Slot: Headgear.' },
  { id: 't-h-003', name: 'Pointy Hat of Power',     power: 1,   effectDescription: '+1 in combat (+2 for Wizard). Slot: Headgear.' },
  { id: 't-h-004', name: 'Pointy Hat of Power',     power: 1,   effectDescription: '+1 in combat (+2 for Wizard). Slot: Headgear.' },
  { id: 't-h-005', name: 'Crown of Brilliance',     power: 3,   effectDescription: '+3 in combat. Slot: Headgear. Big item.' },
  { id: 't-h-006', name: 'Spiked Helm',             power: 2,   effectDescription: '+2 in combat. Slot: Headgear.' },
  { id: 't-h-007', name: 'Tiara of Keeping Hair Tidy', power: 1, effectDescription: '+1 in combat. Slot: Headgear. Female only.' },

  // --- Armor / Body (12) ---
  { id: 't-b-001', name: 'Leather Armor',           power: 1,   effectDescription: '+1 in combat. Slot: Armor.' },
  { id: 't-b-002', name: 'Leather Armor',           power: 1,   effectDescription: '+1 in combat. Slot: Armor.' },
  { id: 't-b-003', name: 'Flaming Armor',           power: 2,   effectDescription: '+2 in combat. Slot: Armor. Big item.' },
  { id: 't-b-004', name: 'Flaming Armor',           power: 2,   effectDescription: '+2 in combat. Slot: Armor. Big item.' },
  { id: 't-b-005', name: 'Mithril Armor',           power: 3,   effectDescription: '+3 in combat. Slot: Armor. Big item.' },
  { id: 't-b-006', name: 'Chainmail Bikini',        power: 2,   effectDescription: '+2 in combat (+3 vs male monsters). Slot: Armor. Female only.' },
  { id: 't-b-007', name: 'Kneepads of Allure',      power: 3,   effectDescription: '+3 in combat. Slot: Armor. Big item. When you ask for help, target must accept (unless it would kill them).' },
  { id: 't-b-008', name: 'Shield of Ubiquity',      power: 2,   effectDescription: '+2 in combat. Slot: Shield (1 hand). Big item.' },
  { id: 't-b-009', name: 'Shield of Ubiquity',      power: 2,   effectDescription: '+2 in combat. Slot: Shield (1 hand). Big item.' },
  { id: 't-b-010', name: 'Buckler of Swashing',     power: 1,   effectDescription: '+1 in combat. Slot: Shield (1 hand).' },
  { id: 't-b-011', name: 'Pantyhose of Giant Strength', power: 3, effectDescription: '+3 in combat. Slot: Armor. Any gender.' },
  { id: 't-b-012', name: 'Tonto\'s Trusty Steed',  power: 2,   effectDescription: '+2 in combat. Slot: Steed. Big item. Run Away on a roll of 3+.' },

  // --- Footgear (6) ---
  { id: 't-f-001', name: 'Boots of Butt-Kicking',  power: 2,   effectDescription: '+2 in combat. Slot: Footgear.' },
  { id: 't-f-002', name: 'Boots of Butt-Kicking',  power: 2,   effectDescription: '+2 in combat. Slot: Footgear.' },
  { id: 't-f-003', name: 'Sandals of Protection',  power: 1,   effectDescription: '+1 in combat. Slot: Footgear.' },
  { id: 't-f-004', name: 'Sandals of Protection',  power: 1,   effectDescription: '+1 in combat. Slot: Footgear.' },
  { id: 't-f-005', name: 'Sneakers of Sneakiness', power: 2,   effectDescription: '+2 in combat (+3 for Thief). Slot: Footgear.' },
  { id: 't-f-006', name: 'Seven-League Boots',      power: 3,   effectDescription: '+3 in combat. Slot: Footgear. Big item. Run Away automatically on a roll of 2+.' },

  // --- 1-hand weapons (15) ---
  { id: 't-w-001', name: 'Broad Sword',             power: 2,   effectDescription: '+2 in combat. Slot: 1 hand.' },
  { id: 't-w-002', name: 'Broad Sword',             power: 2,   effectDescription: '+2 in combat. Slot: 1 hand.' },
  { id: 't-w-003', name: 'Rapier of Unfairness',   power: 2,   effectDescription: '+2 in combat. Slot: 1 hand. Once per combat, subtract 2 from any one other player\'s total.' },
  { id: 't-w-004', name: 'Dagger of Treachery',    power: 1,   effectDescription: '+1 in combat. Slot: 1 hand. May backstab in other players\' combats.' },
  { id: 't-w-005', name: 'Dagger of Treachery',    power: 1,   effectDescription: '+1 in combat. Slot: 1 hand. May backstab in other players\' combats.' },
  { id: 't-w-006', name: 'Singing and Dancing Sword', power: 3, effectDescription: '+3 in combat. Slot: 1 hand.' },
  { id: 't-w-007', name: 'Singing and Dancing Sword', power: 3, effectDescription: '+3 in combat. Slot: 1 hand.' },
  { id: 't-w-008', name: 'Flaming Sword',          power: 2,   effectDescription: '+2 in combat (+3 vs undead). Slot: 1 hand.' },
  { id: 't-w-009', name: 'Flaming Sword',          power: 2,   effectDescription: '+2 in combat (+3 vs undead). Slot: 1 hand.' },
  { id: 't-w-010', name: 'Sword of Slaying Everything Except Squid', power: 3, effectDescription: '+3 in combat (+5 vs non-squid monsters). Slot: 1 hand.' },
  { id: 't-w-011', name: 'Vorpal Blade',           power: 3,   effectDescription: '+3 in combat. Slot: 1 hand. On a combat roll of 6, kill the monster outright.' },
  { id: 't-w-012', name: 'Warhammer',              power: 2,   effectDescription: '+2 in combat. Slot: 1 hand.' },
  { id: 't-w-013', name: 'Mace of Sharpness',      power: 2,   effectDescription: '+2 in combat (+3 for Warrior). Slot: 1 hand.' },
  { id: 't-w-014', name: 'Rat on a Stick',         power: 1,   effectDescription: '+1 in combat (+3 vs rats). Slot: 1 hand.' },
  { id: 't-w-015', name: 'Wand of Dowsing',        power: 2,   effectDescription: '+2 in combat. Slot: 1 hand. Wizard only.' },

  // --- 2-hand weapons (6) ---
  { id: 't-2h-001', name: 'Chainsaw of Bloody Dismemberment', power: 3, effectDescription: '+3 in combat. Slot: 2 hands. Big item.' },
  { id: 't-2h-002', name: 'Staff of Napalm',       power: 4,   effectDescription: '+4 in combat. Slot: 2 hands. Big item. Wizard only.' },
  { id: 't-2h-003', name: 'Huge Rock',              power: 3,   effectDescription: '+3 in combat. Slot: 2 hands. Big item.' },
  { id: 't-2h-004', name: 'Bow with Flaming Arrows', power: 3, effectDescription: '+3 in combat. Slot: 2 hands. Big item.' },
  { id: 't-2h-005', name: 'Scepter of Skull-Thumping', power: 2, effectDescription: '+2 in combat. Slot: 2 hands. Cleric only.' },
  { id: 't-2h-006', name: 'Draining Sword',        power: 2,   effectDescription: '+2 in combat. Slot: 2 hands. All players in the combat must discard 1 card.' },

  // --- One-shot items / Potions (12) ---
  { id: 't-p-001', name: 'Potion of Idiotic Courage', power: 2, effectDescription: 'Discard in combat: +2 this fight only.' },
  { id: 't-p-002', name: 'Potion of Idiotic Courage', power: 2, effectDescription: 'Discard in combat: +2 this fight only.' },
  { id: 't-p-003', name: 'Potion of Idiotic Courage', power: 2, effectDescription: 'Discard in combat: +2 this fight only.' },
  { id: 't-p-004', name: 'Magic Lamp',             power: 3,   effectDescription: 'Discard in combat: +3 this fight only.' },
  { id: 't-p-005', name: 'Magic Lamp',             power: 3,   effectDescription: 'Discard in combat: +3 this fight only.' },
  { id: 't-p-006', name: 'Invisibility Potion',    power: null as number | null, effectDescription: 'Discard when Running Away: escape automatically, no roll needed.' },
  { id: 't-p-007', name: 'Invisibility Potion',    power: null, effectDescription: 'Discard when Running Away: escape automatically, no roll needed.' },
  { id: 't-p-008', name: 'Magic Missile',          power: 3,   effectDescription: 'Discard in combat: +3 this fight only.' },
  { id: 't-p-009', name: 'Friendship Potion',      power: null, effectDescription: 'Discard to force one player to help you in combat at no cost; they gain no treasure.' },
  { id: 't-p-010', name: 'Instant Wall',           power: null, effectDescription: 'Discard during combat: you automatically escape, no roll needed.' },
  { id: 't-p-011', name: 'Transferral Potion',     power: null, effectDescription: 'Discard to move any ongoing curse from yourself to another player.' },
  { id: 't-p-012', name: 'Pollymorph Potion',      power: null, effectDescription: 'Discard to turn one monster into a Level 1 Potted Plant for this combat only.' },

  // --- Go Up a Level (10) ---
  { id: 't-l-001', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-002', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-003', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-004', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-005', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-006', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-007', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-008', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-009', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },
  { id: 't-l-010', name: 'Go Up a Level', power: null, effectDescription: 'Gain 1 level immediately. Cannot be used to reach level 10.' },

  // --- Miscellaneous (10) ---
  { id: 't-misc-001', name: 'Hireling',              power: null, effectDescription: 'Discard to: (a) carry 1 extra Big item, or (b) add +1 as a half-helper in any combat.' },
  { id: 't-misc-002', name: 'Hireling',              power: null, effectDescription: 'Discard to: (a) carry 1 extra Big item, or (b) add +1 as a half-helper in any combat.' },
  { id: 't-misc-003', name: 'Hireling',              power: null, effectDescription: 'Discard to: (a) carry 1 extra Big item, or (b) add +1 as a half-helper in any combat.' },
  { id: 't-misc-004', name: 'Hireling',              power: null, effectDescription: 'Discard to: (a) carry 1 extra Big item, or (b) add +1 as a half-helper in any combat.' },
  { id: 't-misc-005', name: 'Cheat!',                power: null, effectDescription: 'Play alongside any item to ignore all restrictions on that item while you hold Cheat!.' },
  { id: 't-misc-006', name: 'Cheat!',                power: null, effectDescription: 'Play alongside any item to ignore all restrictions on that item while you hold Cheat!.' },
  { id: 't-misc-007', name: 'Cheat!',                power: null, effectDescription: 'Play alongside any item to ignore all restrictions on that item while you hold Cheat!.' },
  { id: 't-misc-008', name: 'Cheat!',                power: null, effectDescription: 'Play alongside any item to ignore all restrictions on that item while you hold Cheat!.' },
  { id: 't-misc-009', name: 'Wishing Ring',          power: null, effectDescription: 'Discard to negate any one curse that just affected you.' },
  { id: 't-misc-010', name: 'Loaded Die',            power: null, effectDescription: 'Discard to reroll any one die in the game (yours or another player\'s).' },

  // --- Extra (6, to reach 84) ---
  { id: 't-x-001', name: 'Really Impressive Title',  power: 1,   effectDescription: '+1 in combat. Title: cannot be lost or stolen.' },
  { id: 't-x-002', name: 'Really Impressive Title',  power: 1,   effectDescription: '+1 in combat. Title: cannot be lost or stolen.' },
  { id: 't-x-003', name: 'Bribe',                    power: null, effectDescription: 'Discard in place of treasure: a helper assists you without receiving any treasure reward.' },
  { id: 't-x-004', name: 'Bribe',                    power: null, effectDescription: 'Discard in place of treasure: a helper assists you without receiving any treasure reward.' },
  { id: 't-x-005', name: 'Plunder',                  power: null, effectDescription: 'After winning a combat: draw 1 extra treasure card.' },
  { id: 't-x-006', name: 'Plunder',                  power: null, effectDescription: 'After winning a combat: draw 1 extra treasure card.' },
].map(c => ({ ...c, type: 'Treasure' }));

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const doorCards = [
    ...monsters,
    ...curses,
    ...classes,
    ...races,
    ...otherDoor,
  ];

  const allCards = [...doorCards, ...treasures];

  // Sanity check
  if (allCards.length !== 168) {
    throw new Error(`Expected 168 cards, got ${allCards.length}. Check the seed data.`);
  }

  console.log(`Seeding ${allCards.length} cards…`);

  await prisma.card.createMany({
    data: allCards,
    skipDuplicates: true,
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
