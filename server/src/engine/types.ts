import type { Card } from '@munchkin/shared';

/** Positive = gain levels, negative = lose levels. -99 signals death (level reset + lose all items). */
export type LevelChange = number;

export interface CombatResult {
  winner: 'player' | 'monster';
  playerGains?: Card[];
  playerLoses?: LevelChange;
}

export type GameAction =
  | { type: 'KICK_DOOR' }
  | { type: 'LOOT_ROOM' }
  | { type: 'LOOK_FOR_TROUBLE'; monsterId: string }
  | { type: 'FIGHT_MONSTER'; helperIds: string[]; bonusCardIds: string[] }
  | { type: 'RUN_AWAY'; dieRoll: number }
  | { type: 'PLAY_CARD'; cardId: string; targetId?: string; replaceEquippedIds?: string[]; searchDiscardCardId?: string; combatBeneficiary?: 'player' | 'monster' }
  | { type: 'DONATE_CARD'; cardId: string; targetPlayerId: string }
  | { type: 'PASS_LOOT' }
  | { type: 'END_TURN' }
  | { type: 'RESOLVE_CURSE' }
  | { type: 'RESOLVE_FLEE' }
  | { type: 'RESOLVE_FLEE_SUCCESS' };
