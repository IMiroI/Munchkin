import type { Card } from './card';
import { CardType } from './card';

export interface Player {
  id: string;
  name: string;
  level: number;
  combatPower: number;
  hand: Card[];
  equipped: Card[];
}

/** Returns the player's active race id, defaulting to 'human' when no Race card is equipped. */
export function playerRace(player: Player): string {
  return player.equipped.find(c => c.type === CardType.Race)?.raceId ?? 'human';
}

/** Returns the player's active class id, or undefined when no Class card is equipped. */
export function playerClass(player: Player): string | undefined {
  return player.equipped.find(c => c.type === CardType.Class)?.classId;
}
