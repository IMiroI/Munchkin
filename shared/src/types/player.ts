import type { Card } from './card';

export interface Player {
  id: string;
  name: string;
  level: number;
  combatPower: number;
  hand: Card[];
  equipped: Card[];
}
