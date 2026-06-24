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
  | { type: 'FIGHT_MONSTER'; helperIds: string[]; bonusCardIds: string[]; priestTurningIds?: string[]; warriorBerserkerIds?: string[] }
  | { type: 'RUN_AWAY'; dieRoll: number; wizardDiscardIds?: string[] }
  | { type: 'PLAY_CARD'; cardId: string; targetId?: string; targetPlayerId?: string; replaceEquippedIds?: string[]; searchDiscardCardId?: string; combatBeneficiary?: 'player' | 'monster'; faceUp?: boolean; replacementCardId?: string }
  | { type: 'DONATE_CARD'; cardId: string; targetPlayerId: string }
  | { type: 'PASS_LOOT' }
  | { type: 'END_TURN' }
  | { type: 'RESOLVE_CURSE' }
  | { type: 'RESOLVE_FLEE' }
  | { type: 'RESOLVE_FLEE_SUCCESS' }
  | { type: 'CHOOSE_VICTIM_ITEM'; targetItemId: string }
  | { type: 'RETRY_FLEE'; discardedCardId: string }
  | { type: 'SELL_ITEMS'; cardIds: string[]; doubleCardId?: string }
  | { type: 'CHOOSE_CURSE_ITEM'; cardId: string }
  | { type: 'DISCARD_ITEM_TO_FLEE'; cardId: string }
  | { type: 'SET_SUPER_MUNCHKIN_MODE'; mode: 'dual' | 'super' }
  | { type: 'SET_SANG_MELE_MODE'; mode: 'dual' | 'super' }
  | { type: 'WIZARD_CHARM'; targetMonsterId: string }
  | { type: 'CHOOSE_BAD_STUFF'; choice: 'levels' | 'hand' }
  | { type: 'AVOID_MONSTER' }
  | { type: 'THIEF_BACKSTAB'; targetPlayerId: string; discardCardId: string }
  | { type: 'THIEF_PICKPOCKET'; targetPlayerId: string; targetItemId: string; discardCardId: string; dieRoll: number }
  | { type: 'PRIEST_RESURRECT'; fromDiscardIds: string[]; payCardIds: string[] }
  | { type: 'SKIP_RESURRECTION' }
  | { type: 'RESOLVE_DIE_ROLL_LOSS'; source: 'equipped' | 'hand'; cardIds: string[] }
  | { type: 'PRIEST_CLAIM_TREASURE' }
  | { type: 'DISCARD_PRE_COMBAT_ITEM'; cardId: string }
  | { type: 'DISCARD_ITEMS_FOR_GOLD'; cardIds: string[] }
  | { type: 'MATCH_GOLD_VALUE'; cardIds: string[] }
  | { type: 'THIEF_SWAP_TREASURES'; discardCardIds: string[] }
  | { type: 'BRIBE_MONSTER'; discardItemId: string };
