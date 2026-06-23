import type { Card, Player } from '@munchkin/shared';
import { playerRace, playerClass } from '@munchkin/shared';
import type { CombatResult, LevelChange } from './types.js';
import { DeckManager } from './DeckManager.js';

function equipmentBonus(player: Player): number {
  const race = playerRace(player);
  const cls = playerClass(player);
  return player.equipped.reduce((sum, c) => {
    if (c.requiredClass != null && c.requiredClass !== cls) return sum;
    if (c.forbiddenClass != null && c.forbiddenClass === cls) return sum;
    if (c.requiredRace != null && c.requiredRace !== race) return sum;
    if (c.requiredNoRace && race != null) return sum;
    const base = c.power ?? 0;
    const raceBonus = c.racePowerBonus?.[race] ?? 0;
    return sum + base + raceBonus;
  }, 0);
}

/** Warrior class: +1 per level above 5, minimum 0. */
function classBonus(player: Player): number {
  return playerClass(player) === 'warrior' ? Math.max(0, player.level - 5) : 0;
}

function helperBonus(helpers: Player[]): number {
  return helpers.reduce((sum, h) => sum + h.level, 0);
}

function bonusItemsTotal(items: Card[]): number {
  return items.reduce((sum, c) => sum + (c.power ?? 0), 0);
}

/** Treasures earned on victory — uses card data when available, otherwise derived from power. */
function treasureCount(monster: Card): number {
  if (monster.treasuresOnKill != null) return monster.treasuresOnKill;
  const p = monster.power ?? 0;
  if (p >= 15) return 3;
  if (p >= 8)  return 2;
  return 1;
}

/** Level loss on bad stuff — uses card data when available, otherwise derived from power. -99 signals death. */
function badStuffLevelLoss(monster: Card): LevelChange {
  if (monster.badStuffLevel != null) return monster.badStuffLevel as LevelChange;
  const p = monster.power ?? 0;
  if (p >= 18) return -99;
  if (p >= 10) return -3;
  if (p >= 6)  return -2;
  return -1;
}

export const CombatResolver = {
  resolveCombat(
    player: Player,
    monster: Card,
    helpers: Player[],
    bonusItems: Card[],
    treasureDeck: Card[],
  ): CombatResult & { newTreasureDeck: Card[] } {
    const baseStrength = player.level + equipmentBonus(player) + classBonus(player);
    const hasDoubler = bonusItems.some(c => c.doublesPlayerStrength);
    const multiplier = hasDoubler && helpers.length === 0 ? 2 : 1;
    const regularBonusItems = bonusItems.filter(c => !c.doublesPlayerStrength);
    const playerTotal =
      baseStrength * multiplier +
      helperBonus(helpers) +
      bonusItemsTotal(regularBonusItems);

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

  badStuffLevelLoss,
} as const;
