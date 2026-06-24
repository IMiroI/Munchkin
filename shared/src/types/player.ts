import type { Card } from './card';
import { CardType } from './card';

export interface Player {
  id: string;
  name: string;
  level: number;
  combatPower: number;
  hand: Card[];
  equipped: Card[];
  /** 'dual' = both classes active with full advantages+disadvantages; 'super' = single class, no monster class penalties */
  superMunchkinMode?: 'dual' | 'super';
  /** 'dual' = both races active with full advantages+disadvantages; 'super' = single race, no monster race penalties */
  sangMeleMode?: 'dual' | 'super';
  /** Current gender of the player */
  gender: 'male' | 'female';
  /** True if the player has ever changed gender (via curse or card) */
  hasChangedGender?: boolean;
  /** One-time combat penalty applied to the player's next combat (cleared after use) */
  nextCombatPenalty?: number;
  /** Next combat: equipment bonuses are ignored except armor (cleared after the combat) */
  nextCombatNoItemBonus?: boolean;
}

/** Returns the player's active race id, defaulting to 'human' when no Race card is equipped. */
export function playerRace(player: Player): string {
  return player.equipped.find(c => c.type === CardType.Race)?.raceId ?? 'human';
}

/** Returns all active race ids (0–2 when Sang-mêlé is equipped). Falls back to ['human'] when no Race card is equipped. */
export function playerRaces(player: Player): string[] {
  const races = player.equipped.filter(c => c.type === CardType.Race && c.raceId != null).map(c => c.raceId!);
  return races.length > 0 ? races : ['human'];
}

/** Returns the player's active class id, or undefined when no Class card is equipped. */
export function playerClass(player: Player): string | undefined {
  return player.equipped.find(c => c.type === CardType.Class)?.classId;
}

/** Returns all active class ids (0–2 when Super Munchkin is equipped). */
export function playerClasses(player: Player): string[] {
  return player.equipped.filter(c => c.type === CardType.Class && c.classId != null).map(c => c.classId!);
}
