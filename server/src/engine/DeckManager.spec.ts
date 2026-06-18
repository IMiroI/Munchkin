import { describe, it, expect } from 'vitest';
import { CardType } from '@munchkin/shared';
import { DeckManager } from './DeckManager.js';

describe('DeckManager', () => {
  describe('initDecks', () => {
    it('returns a door deck of 95 cards and a treasure deck of 73 cards', () => {
      const { doorDeck, treasureDeck } = DeckManager.initDecks();
      expect(doorDeck).toHaveLength(95);
      expect(treasureDeck).toHaveLength(73);
    });

    it('door deck contains 38 monsters, 19 curses, 12 classes, 9 races, 5 boosters, 12 specials', () => {
      const { doorDeck } = DeckManager.initDecks();
      expect(doorDeck.filter(c => c.type === CardType.Monster)).toHaveLength(38);
      expect(doorDeck.filter(c => c.type === CardType.DoorCurse)).toHaveLength(19);
      expect(doorDeck.filter(c => c.type === CardType.Class)).toHaveLength(12);
      expect(doorDeck.filter(c => c.type === CardType.Race)).toHaveLength(9);
      expect(doorDeck.filter(c => c.type === CardType.MonsterBooster)).toHaveLength(5);
      expect(doorDeck.filter(c => c.type === CardType.Special)).toHaveLength(12);
    });

    it('classes contain 3 Warriors, 3 Wizards, 3 Clerics, 3 Thieves', () => {
      const { doorDeck } = DeckManager.initDecks();
      const classes = doorDeck.filter(c => c.type === CardType.Class);
      expect(classes.filter(c => c.classId === 'warrior')).toHaveLength(3);
      expect(classes.filter(c => c.classId === 'wizard')).toHaveLength(3);
      expect(classes.filter(c => c.classId === 'cleric')).toHaveLength(3);
      expect(classes.filter(c => c.classId === 'thief')).toHaveLength(3);
    });

    it('races contain 3 Elves, 3 Halfelins, 3 Dwarves', () => {
      const { doorDeck } = DeckManager.initDecks();
      const races = doorDeck.filter(c => c.type === CardType.Race);
      expect(races.filter(c => c.raceId === 'elf')).toHaveLength(3);
      expect(races.filter(c => c.raceId === 'halfling')).toHaveLength(3);
      expect(races.filter(c => c.raceId === 'dwarf')).toHaveLength(3);
    });

    it('treasure deck contains 73 Treasure-type cards', () => {
      const { treasureDeck } = DeckManager.initDecks();
      expect(treasureDeck.filter(c => c.type === CardType.Treasure)).toHaveLength(73);
    });

    it('treasure deck contains 11 level-up cards', () => {
      const { treasureDeck } = DeckManager.initDecks();
      expect(treasureDeck.filter(c => c.levelUp != null)).toHaveLength(11);
    });

    it('treasure deck contains 2 Anneaux de Souhait', () => {
      const { treasureDeck } = DeckManager.initDecks();
      expect(treasureDeck.filter(c => c.name === 'Anneau de Souhait')).toHaveLength(2);
    });

    it('shuffles the deck (two calls produce different orders most of the time)', () => {
      const a = DeckManager.initDecks().doorDeck.map(c => c.id).join(',');
      const b = DeckManager.initDecks().doorDeck.map(c => c.id).join(',');
      expect(a === b).toBe(false);
    });
  });

  describe('draw', () => {
    it('draws n cards from the front of the deck', () => {
      const { doorDeck } = DeckManager.initDecks();
      const firstId = doorDeck[0]!.id;
      const { cards, newDeck } = DeckManager.draw(doorDeck, 1);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.id).toBe(firstId);
      expect(newDeck).toHaveLength(94);
    });

    it('drawing 0 cards returns empty array and full deck', () => {
      const { doorDeck } = DeckManager.initDecks();
      const { cards, newDeck } = DeckManager.draw(doorDeck, 0);
      expect(cards).toHaveLength(0);
      expect(newDeck).toHaveLength(95);
    });

    it('drawing more than deck size clamps to deck length', () => {
      const { cards, newDeck } = DeckManager.draw([{ id: 'd-001', name: 'X', type: CardType.Monster, power: 1 }], 5);
      expect(cards).toHaveLength(1);
      expect(newDeck).toHaveLength(0);
    });
  });

  describe('reshuffle', () => {
    it('returns all cards from discard', () => {
      const { doorDeck } = DeckManager.initDecks();
      const reshuffled = DeckManager.reshuffle(doorDeck);
      expect(reshuffled).toHaveLength(95);
    });

    it('preserves card identity after reshuffle', () => {
      const { doorDeck } = DeckManager.initDecks();
      const ids = doorDeck.map(c => c.id).sort();
      const reshuffled = DeckManager.reshuffle(doorDeck).map(c => c.id).sort();
      expect(reshuffled).toEqual(ids);
    });
  });
});
