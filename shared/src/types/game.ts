import type { Card } from './card';
import type { Player } from './player';

export enum GamePhase {
  KickDown = 'KickDown',
  MonsterFight = 'MonsterFight',
  CurseReaction = 'CurseReaction',
  FleeReaction = 'FleeReaction',
  /** Successful flee window — any player may play rerollFlee cards before the flee is finalised */
  FleeSuccessReaction = 'FleeSuccessReaction',
  /** Forced re-roll — active player must RUN_AWAY again (triggered by rerollFlee card) */
  ForcedFlee = 'ForcedFlee',
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
  /** Curse drawn from door deck, waiting for player reaction before being applied */
  pendingCurse?: Card;
  /** One-shot bonus cards played during MonsterFight phase, applied when FIGHT_MONSTER resolves */
  combatBonusCards?: Card[];
  /** One-shot bonus cards played for the monster's side during MonsterFight phase */
  combatMonsterBonusCards?: Card[];
  /** Set when a combat-transfer card is played — restored as currentPlayerId after combat, goes to Loot */
  transferOriginalPlayerId?: string;
  /** Player forced to be a helper (cannot refuse) via forcedHelper card */
  forcedHelperId?: string;
  /** When set, active player's level is capped at this value after winning this combat */
  combatLevelCap?: number;
}
