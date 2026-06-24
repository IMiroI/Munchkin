import type { Card, Player } from '@munchkin/shared';
import { playerRace, playerRaces, playerClass, playerClasses } from '@munchkin/shared';
import type { CombatResult, LevelChange } from './types.js';
import { DeckManager } from './DeckManager.js';

function equipmentBonus(player: Player): number {
  const race = playerRace(player);
  const races = playerRaces(player);
  const classes = playerClasses(player);
  const isSuperMunchkin = player.equipped.some(c => c.isSuperMunchkin);
  const isSangMeleSuperMode = player.sangMeleMode === 'super' && player.equipped.some(c => c.isSangMele);
  const bypassedIds = new Set(
    player.equipped
      .filter(c => c.bypassesItemRestrictions && c.attachedToItemId != null)
      .map(c => c.attachedToItemId!),
  );
  return player.equipped.reduce((sum, c) => {
    if (c.bypassesItemRestrictions) return sum;
    const bypassed = bypassedIds.has(c.id);
    if (!bypassed) {
      if (c.requiredClass != null && !classes.includes(c.requiredClass)) return sum;
      if (!isSuperMunchkin && c.forbiddenClass != null && classes.includes(c.forbiddenClass)) return sum;
      if (c.requiredRace != null && !races.includes(c.requiredRace)) return sum;
      if (!isSangMeleSuperMode && c.forbiddenRace != null && races.includes(c.forbiddenRace)) return sum;
      if (c.requiredNoRace && race !== 'human') return sum;
    }
    const base = c.power ?? 0;
    const raceBonus = races.reduce((rb, r) => rb + (c.racePowerBonus?.[r] ?? 0), 0);
    return sum + base + raceBonus;
  }, 0);
}

/** Warrior class: +1 per level above 5, minimum 0. */
function classBonus(player: Player): number {
  return playerClasses(player).includes('warrior') ? Math.max(0, player.level - 5) : 0;
}

function helperBonus(helpers: Player[]): number {
  return helpers.reduce((sum, h) => sum + h.level, 0);
}

function bonusItemsTotal(items: Card[]): number {
  return items.reduce((sum, c) => sum + (c.power ?? 0), 0);
}

function allyRaceBonus(items: Card[], player: Player, helpers: Player[]): number {
  const participants = [player, ...helpers];
  return items.reduce((sum, c) => {
    if (!c.bonusPerAllyRace) return sum;
    return sum + Object.entries(c.bonusPerAllyRace).reduce((s, [race, bonus]) => {
      const count = participants.filter(p => playerRace(p) === race).length;
      return s + (bonus ?? 0) * count;
    }, 0);
  }, 0);
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
    rawLevelOnly = false,
    extraPlayerPower = 0,
    skipTreasureDraw = false,
    rawEquipOnly = false,
  ): CombatResult & { newTreasureDeck: Card[] } {
    const baseStrength = rawLevelOnly
      ? player.level
      : rawEquipOnly
        ? equipmentBonus(player) + classBonus(player)
        : player.level + equipmentBonus(player) + classBonus(player);
    const hasDoubler = !rawLevelOnly && bonusItems.some(c => c.doublesPlayerStrength);
    const multiplier = hasDoubler && helpers.length === 0 ? 2 : 1;
    const regularBonusItems = rawLevelOnly ? [] : bonusItems.filter(c => !c.doublesPlayerStrength);
    const playerTotal =
      baseStrength * multiplier +
      helperBonus(helpers) +
      bonusItemsTotal(regularBonusItems) +
      allyRaceBonus(regularBonusItems, player, helpers) +
      extraPlayerPower;

    // Sang-mêlé in super mode: monster gets no race-based bonus
    const isSangMeleSuperMode = player.sangMeleMode === 'super' &&
      player.equipped.some(c => c.isSangMele);
    const monsterRaceBonus = isSangMeleSuperMode ? 0 :
      playerRaces(player).reduce((sum, race) => sum + (monster.powerBonusVsRace?.[race] ?? 0), 0);
    // Super Munchkin in super mode: monster gets no class-based bonus
    const isSuperMode = player.superMunchkinMode === 'super' &&
      player.equipped.some(c => c.isSuperMunchkin);
    const monsterClassBonus = isSuperMode ? 0 :
      playerClasses(player).reduce((sum, cls) => sum + (monster.powerBonusVsClass?.[cls] ?? 0), 0);
    const monsterPower = (monster.power ?? 0) + monsterRaceBonus + monsterClassBonus;

    const hasTiebreaker = player.equipped.some(c => c.classWarriorTiebreaker);
    if (playerTotal > monsterPower || (hasTiebreaker && playerTotal === monsterPower)) {
      if (skipTreasureDraw) {
        return { winner: 'player', playerGains: [], newTreasureDeck: treasureDeck };
      }
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
  treasureCount,
} as const;
