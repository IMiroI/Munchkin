import type { Card } from './card';
import type { Player } from './player';

export enum GamePhase {
  KickDown = 'KickDown',
  MonsterFight = 'MonsterFight',
  Loot = 'Loot',
  Charity = 'Charity',
  EndTurn = 'EndTurn',
}

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  doorDeck: Card[];
  treasureDeck: Card[];
  discardDoor: Card[];
  discardTreasure: Card[];
  currentPlayerId: string;
  currentMonster?: Card;
}
