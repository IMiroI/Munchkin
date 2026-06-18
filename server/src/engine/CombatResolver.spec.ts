import { describe, it, expect } from 'vitest';
import { CardType } from '@munchkin/shared';
import type { Player, Card } from '@munchkin/shared';
import { CombatResolver } from './CombatResolver.js';

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  name: 'Alice',
  level: 3,
  combatPower: 3,
  hand: [],
  equipped: [],
  ...overrides,
});

const makeMonster = (power: number): Card => ({
  id: `m-${power}`,
  name: `Monster ${power}`,
  type: CardType.Monster,
  power,
});

// Warrior card uses classId semantic tag (no hard-coded ID check in engine)
const WARRIOR: Card = { id: 'd-022', name: 'Guerrier', type: CardType.Class, classId: 'warrior' };
const EQUIPMENT: Card = { id: 't-016', name: 'Bottes', type: CardType.Treasure, power: 2 };

describe('CombatResolver', () => {
  describe('resolveCombat', () => {
    it('player wins when total > monster power', () => {
      const player = makePlayer({ level: 5, combatPower: 5 });
      const monster = makeMonster(4);
      const { winner } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(winner).toBe('player');
    });

    it('monster wins when total <= monster power (ties go to monster)', () => {
      const player = makePlayer({ level: 4, combatPower: 4 });
      const monster = makeMonster(4);
      const { winner } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(winner).toBe('monster');
    });

    it('player gains treasures from the treasure deck on victory', () => {
      const player = makePlayer({ level: 10, combatPower: 10 });
      // Monster with explicit treasuresOnKill: 1
      const monster: Card = { id: 'd-001', name: '3872 Orques', type: CardType.Monster, power: 1, treasuresOnKill: 1 };
      const treasureDeck = [
        { id: 't-001', name: 'A', type: CardType.Treasure, power: 1 },
        { id: 't-002', name: 'B', type: CardType.Treasure, power: 2 },
      ];
      const { playerGains, newTreasureDeck } = CombatResolver.resolveCombat(player, monster, [], [], treasureDeck);
      expect(playerGains).toHaveLength(1);
      expect(newTreasureDeck).toHaveLength(1);
    });

    it('high-power monster gives 3 treasures (power-based fallback)', () => {
      const player = makePlayer({ level: 20, combatPower: 20 });
      const monster = makeMonster(15); // no treasuresOnKill → power-based → 3
      const treasureDeck = Array.from({ length: 5 }, (_, i) => ({
        id: `t-${i}`,
        name: `T${i}`,
        type: CardType.Treasure as const,
        power: 1,
      }));
      const { playerGains } = CombatResolver.resolveCombat(player, monster, [], [], treasureDeck);
      expect(playerGains).toHaveLength(3);
    });

    it('card-level treasuresOnKill overrides power-based count', () => {
      const player = makePlayer({ level: 20 });
      const monster: Card = { id: 'd-010', name: 'Dragon de Plutonium', type: CardType.Monster, power: 20, treasuresOnKill: 5 };
      const treasureDeck = Array.from({ length: 6 }, (_, i) => ({
        id: `t-${i}`, name: `T${i}`, type: CardType.Treasure as const, power: 1,
      }));
      // We provide enough health for the player to win with a helper
      const playerStrong = makePlayer({ level: 21 });
      const { playerGains } = CombatResolver.resolveCombat(playerStrong, monster, [], [], treasureDeck);
      expect(playerGains).toHaveLength(5);
    });

    it('equipment bonus adds to player total', () => {
      const player = makePlayer({ level: 3, combatPower: 5, equipped: [EQUIPMENT] });
      const monster = makeMonster(4);
      // level 3 + equipment 2 = 5 > 4 → win
      const { winner } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(winner).toBe('player');
    });

    it('helper levels add to total', () => {
      const player = makePlayer({ level: 2, combatPower: 2 });
      const helper = makePlayer({ id: 'p2', level: 3, combatPower: 3 });
      const monster = makeMonster(4);
      // 2 + 3 = 5 > 4 → win
      const { winner } = CombatResolver.resolveCombat(player, monster, [helper], [], []);
      expect(winner).toBe('player');
    });

    it('bonus items add to total', () => {
      const player = makePlayer({ level: 2 });
      const bonus: Card = { id: 't-013', name: 'Potion', type: CardType.Treasure, power: 2, isOneShot: true };
      const monster = makeMonster(3);
      // 2 + 2 = 4 > 3 → win
      const { winner } = CombatResolver.resolveCombat(player, monster, [], [bonus], []);
      expect(winner).toBe('player');
    });

    it('Warrior class (classId) adds level-5 bonus above level 5', () => {
      const player = makePlayer({ level: 7, equipped: [WARRIOR] });
      const monster = makeMonster(9);
      // level 7 + warrior bonus (7-5=2) = 9 → tie → monster wins
      const { winner: tieWinner } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(tieWinner).toBe('monster');

      const strongPlayer = makePlayer({ level: 7, equipped: [WARRIOR] });
      const weakMonster = makeMonster(8);
      // 7 + 2 = 9 > 8 → win
      const { winner } = CombatResolver.resolveCombat(strongPlayer, weakMonster, [], [], []);
      expect(winner).toBe('player');
    });

    it('Warrior at level 5 gives no bonus', () => {
      const player = makePlayer({ level: 5, equipped: [WARRIOR] });
      const monster = makeMonster(5);
      // 5 + 0 = 5 → tie → monster wins
      const { winner } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(winner).toBe('monster');
    });

    it('player loses correct levels on monster win (power-based fallback)', () => {
      const player = makePlayer({ level: 5 });
      const monster = makeMonster(6); // power 6-9 → lose 2
      const { playerLoses } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(playerLoses).toBe(-2);
    });

    it('card-level badStuffLevel overrides power-based loss', () => {
      const player = makePlayer({ level: 5 });
      const monster: Card = {
        id: 'd-005', name: 'Belvédère Sauvage', type: CardType.Monster,
        power: 8, badStuffLevel: -3,
      };
      const { playerLoses } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(playerLoses).toBe(-3);
    });

    it('very powerful monster causes death (-99) via power-based fallback', () => {
      const player = makePlayer({ level: 5 });
      const monster = makeMonster(18);
      const { playerLoses } = CombatResolver.resolveCombat(player, monster, [], [], []);
      expect(playerLoses).toBe(-99);
    });
  });

  describe('badStuffLevelLoss', () => {
    it('returns card badStuffLevel when present', () => {
      const monster: Card = { id: 'd-005', name: 'Belvédère', type: CardType.Monster, power: 8, badStuffLevel: -3 };
      expect(CombatResolver.badStuffLevelLoss(monster)).toBe(-3);
    });
    it('returns -1 for weak monsters (power < 6, no explicit badStuffLevel)', () => {
      expect(CombatResolver.badStuffLevelLoss(makeMonster(1))).toBe(-1);
      expect(CombatResolver.badStuffLevelLoss(makeMonster(5))).toBe(-1);
    });
    it('returns -2 for medium monsters (6–9)', () => {
      expect(CombatResolver.badStuffLevelLoss(makeMonster(6))).toBe(-2);
      expect(CombatResolver.badStuffLevelLoss(makeMonster(9))).toBe(-2);
    });
    it('returns -3 for strong monsters (10–17)', () => {
      expect(CombatResolver.badStuffLevelLoss(makeMonster(10))).toBe(-3);
      expect(CombatResolver.badStuffLevelLoss(makeMonster(17))).toBe(-3);
    });
    it('returns -99 (death) for very strong monsters (18+)', () => {
      expect(CombatResolver.badStuffLevelLoss(makeMonster(18))).toBe(-99);
      expect(CombatResolver.badStuffLevelLoss(makeMonster(20))).toBe(-99);
    });
  });
});
