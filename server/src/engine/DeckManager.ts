import { CardType } from '@munchkin/shared';
import type { Card } from '@munchkin/shared';

function shuffle<T>(arr: readonly T[]): T[] {
  const deck = [...arr];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

const DOOR_CARDS: readonly Card[] = [
  // Monsters
  { id: 'd-001', name: 'Potted Plant',          type: CardType.Monster,   power: 1  },
  { id: 'd-002', name: 'Large Angry Chicken',   type: CardType.Monster,   power: 2  },
  { id: 'd-003', name: 'Snails of Caerbannog',  type: CardType.Monster,   power: 3  },
  { id: 'd-004', name: 'Tequila Mockingbird',   type: CardType.Monster,   power: 4  },
  { id: 'd-005', name: 'Undead Horse',           type: CardType.Monster,   power: 6  },
  { id: 'd-006', name: 'Gazebo',                 type: CardType.Monster,   power: 8  },
  { id: 'd-007', name: 'Wight Brothers',         type: CardType.Monster,   power: 12 },
  { id: 'd-008', name: 'Plutonium Dragon',       type: CardType.Monster,   power: 20 },
  { id: 'd-009', name: 'Net Troll',              type: CardType.Monster,   power: 10 },
  { id: 'd-010', name: 'Shrieking Geek',         type: CardType.Monster,   power: 4  },
  { id: 'd-011', name: 'Maul Rat',               type: CardType.Monster,   power: 1  },
  { id: 'd-012', name: 'Lame Goblin',            type: CardType.Monster,   power: 1  },
  // Curses
  { id: 'd-013', name: 'Curse! Lose a Level',    type: CardType.DoorCurse, effect: 'Lose 1 level immediately' },
  { id: 'd-014', name: 'Curse! Lose Your Class', type: CardType.DoorCurse, effect: 'Discard your class card' },
  { id: 'd-015', name: 'Curse! Lose Your Race',  type: CardType.DoorCurse, effect: 'Discard your race card' },
  { id: 'd-016', name: 'Curse! Duck of Doom',    type: CardType.DoorCurse, effect: 'Discard your most powerful item' },
  // Classes
  { id: 'd-017', name: 'Warrior', type: CardType.Class, effect: '+1 per level above 5 in combat; can carry any weapon' },
  { id: 'd-018', name: 'Wizard',  type: CardType.Class, effect: 'May discard cards for +1 each in combat (once per combat)' },
  { id: 'd-019', name: 'Cleric',  type: CardType.Class, effect: 'May discard a card to turn undead monsters away' },
  { id: 'd-020', name: 'Thief',   type: CardType.Class, effect: 'May backstab: subtract 2 from one helper\'s total once per combat' },
  // Races
  { id: 'd-021', name: 'Elf',      type: CardType.Race, effect: 'Gain a level for each monster you help another player kill' },
  { id: 'd-022', name: 'Dwarf',    type: CardType.Race, effect: 'No hand limit; may carry any number of Big items' },
  { id: 'd-023', name: 'Halfling', type: CardType.Race, effect: 'Once per combat, may discard a card to escape automatically' },
  { id: 'd-024', name: 'Human',    type: CardType.Race, effect: 'No special ability' },
];

const TREASURE_CARDS: readonly Card[] = [
  // Equipment
  { id: 't-001', name: 'Boots of Butt-Kicking',         type: CardType.Treasure, power: 2 },
  { id: 't-002', name: 'Chainsaw of Bloody Dismemberment', type: CardType.Treasure, power: 3 },
  { id: 't-003', name: 'Singing and Dancing Sword',     type: CardType.Treasure, power: 3 },
  { id: 't-004', name: 'Helm of Courage',               type: CardType.Treasure, power: 1 },
  { id: 't-005', name: 'Mithril Armor',                 type: CardType.Treasure, power: 3 },
  { id: 't-006', name: 'Shield of Ubiquity',            type: CardType.Treasure, power: 2 },
  { id: 't-007', name: 'Sneaky Bastard Sword',          type: CardType.Treasure, power: 2 },
  { id: 't-008', name: 'Flaming Armor',                 type: CardType.Treasure, power: 2 },
  { id: 't-009', name: 'Rapier of Unfairness',          type: CardType.Treasure, power: 2 },
  { id: 't-010', name: 'Pointy Hat of Power',           type: CardType.Treasure, power: 1 },
  { id: 't-011', name: 'Leather Armor',                 type: CardType.Treasure, power: 1 },
  { id: 't-012', name: 'Horned Helmet',                 type: CardType.Treasure, power: 2 },
  // One-use combat items
  { id: 't-013', name: 'Potion of Idiotic Courage', type: CardType.Treasure, power: 2, effect: 'Use in combat: +2 this fight only; discard after' },
  { id: 't-014', name: 'Magic Lamp',               type: CardType.Treasure, power: 3, effect: 'Use in combat: +3 this fight only; discard after' },
  { id: 't-015', name: 'Wand of Dowsing',          type: CardType.Treasure, power: 2, effect: 'Use in combat: +2 this fight only; discard after' },
  // Level-up cards
  { id: 't-016', name: 'Go Up a Level', type: CardType.Treasure, effect: 'Gain 1 level immediately (max level 9 outside combat)' },
  { id: 't-017', name: 'Go Up a Level', type: CardType.Treasure, effect: 'Gain 1 level immediately (max level 9 outside combat)' },
  { id: 't-018', name: 'Hireling',      type: CardType.Treasure, effect: 'Discard to carry 1 extra Big item or count as a half-helper' },
];

export const DeckManager = {
  initDecks(): { doorDeck: Card[]; treasureDeck: Card[] } {
    return {
      doorDeck: shuffle(DOOR_CARDS),
      treasureDeck: shuffle(TREASURE_CARDS),
    };
  },

  draw(deck: Card[], n: number): { cards: Card[]; newDeck: Card[] } {
    const cards = deck.slice(0, n);
    const newDeck = deck.slice(n);
    return { cards, newDeck };
  },

  reshuffle(discard: Card[]): Card[] {
    return shuffle(discard);
  },
} as const;
