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
}

/** Returns the player's active race id, defaulting to 'human' when no Race card is equipped. */
export function playerRace(player: Player): string {
  return player.equipped.find(c => c.type === CardType.Race)?.raceId ?? 'human';
}

/** Returns the player's active class id, or undefined when no Class card is equipped. */
export function playerClass(player: Player): string | undefined {
  return player.equipped.find(c => c.type === CardType.Class)?.classId;
}

/** Returns all active class ids (0–2 when Super Munchkin is equipped). */
export function playerClasses(player: Player): string[] {
  return player.equipped.filter(c => c.type === CardType.Class && c.classId != null).map(c => c.classId!);
}
