import type { Card, Player } from '@munchkin/shared';
import type { CombatResult, LevelChange } from './types.js';
import { DeckManager } from './DeckManager.js';

function equipmentBonus(player: Player): number {
  return player.equipped.reduce((sum, c) => sum + (c.power ?? 0), 0);
}

function helperBonus(helpers: Player[]): number {
  return helpers.reduce((sum, h) => sum + h.level, 0);
}

function bonusItemsTotal(items: Card[]): number {
  return items.reduce((sum, c) => sum + (c.power ?? 0), 0);
}

/** Treasures earned on victory, derived from monster power. */
function treasureCount(monster: Card): number {
  const p = monster.power ?? 0;
  if (p >= 15) return 3;
  if (p >= 8)  return 2;
  return 1;
}

/** Levels lost on bad stuff, derived from monster power. -99 signals death (lose all). */
function badStuffLevelLoss(monster: Card): LevelChange {
  const p = monster.power ?? 0;
  if (p >= 18) return -99;
  if (p >= 10) return -3;
  if (p >= 6)  return -2;
  return -1;
}

export const CombatResolver = {
  /**
   * Resolves a combat encounter and returns the outcome with updated treasure deck.
   * Pure: no mutation, randomness confined to DeckManager.draw.
   *
   * @param player    - The active player fighting
   * @param monster   - The monster card being fought
   * @param helpers   - Other players lending their level to the fight
   * @param bonusItems - Cards played from hand for their power bonus
   * @param treasureDeck - Current treasure deck (consumed on player victory)
   */
  resolveCombat(
    player: Player,
    monster: Card,
    helpers: Player[],
    bonusItems: Card[],
    treasureDeck: Card[],
  ): CombatResult & { newTreasureDeck: Card[] } {
    const playerTotal =
      player.level +
      equipmentBonus(player) +
      helperBonus(helpers) +
      bonusItemsTotal(bonusItems);

    const monsterPower = monster.power ?? 0;

    if (playerTotal > monsterPower) {
      const count = treasureCount(monster);
      const { cards: playerGains, newDeck: newTreasureDeck } = DeckManager.draw(
        treasureDeck,
        Math.min(count, treasureDeck.length),
      );
      return { winner: 'player', playerGains, newTreasureDeck };
    }

    return {
      winner: 'monster',
      playerLoses: badStuffLevelLoss(monster),
      newTreasureDeck: treasureDeck,
    };
  },

  /** Exported so TurnManager can apply bad stuff consistently (e.g. failed Run Away). */
  badStuffLevelLoss,
} as const;
