export interface ActionLogEntry {
  playerName: string;
  description: string;
  timestamp: number;
}

/** Actions the client sends to the server. The server adds any randomness (e.g. die rolls). */
export type ClientGameAction =
  | { type: 'KICK_DOOR' }
  | { type: 'LOOT_ROOM' }
  | { type: 'LOOK_FOR_TROUBLE'; monsterId: string }
  | { type: 'FIGHT_MONSTER'; helperIds: string[]; bonusCardIds: string[]; priestTurningIds?: string[]; warriorBerserkerIds?: string[] }
  | { type: 'RUN_AWAY'; wizardDiscardIds?: string[] }
  | { type: 'PLAY_CARD'; cardId: string; targetId?: string; replaceEquippedIds?: string[]; searchDiscardCardId?: string; combatBeneficiary?: 'player' | 'monster'; faceUp?: boolean }
  | { type: 'DONATE_CARD'; cardId: string; targetPlayerId: string }
  | { type: 'PASS_LOOT' }
  | { type: 'END_TURN' }
  | { type: 'RESOLVE_CURSE' }
  | { type: 'RESOLVE_FLEE' }
  | { type: 'RESOLVE_FLEE_SUCCESS' }
  | { type: 'CHOOSE_VICTIM_ITEM'; targetItemId: string }
  /** Halfling race ability: discard a card from hand to retry a failed flee roll */
  | { type: 'RETRY_FLEE'; discardedCardId: string }
  /** Sell items (from equipped or hand) for levels outside of combat. doubleCardId: one item sold at double value (halfling only) */
  | { type: 'SELL_ITEMS'; cardIds: string[]; doubleCardId?: string }
  /** Active player picks which tied item to lose (CurseItemChoice phase) */
  | { type: 'CHOOSE_CURSE_ITEM'; cardId: string }
  /** Active player discards a tagged item (wand/staff/lance) to auto-flee a monster that allows it */
  | { type: 'DISCARD_ITEM_TO_FLEE'; cardId: string }
  /** Toggle Super Munchkin mode between dual-class and single-class-super */
  | { type: 'SET_SUPER_MUNCHKIN_MODE'; mode: 'dual' | 'super' }
  /** Wizard class ability: discard entire hand (min 3) to charm one monster — get treasure, no level */
  | { type: 'WIZARD_CHARM'; targetMonsterId: string }
  /** Bad stuff with a player choice: lose levels or discard entire hand */
  | { type: 'CHOOSE_BAD_STUFF'; choice: 'levels' | 'hand' }
  /** Player chooses to avoid an avoidable monster — no fight, no treasure, no level */
  | { type: 'AVOID_MONSTER' }
  /** Priest Turning: during FIGHT_MONSTER, discard up to 3 cards for +3 each (undead only) */
  // (wizardDiscardIds is part of RUN_AWAY; priestTurningIds is part of FIGHT_MONSTER)
  /** Priest Resurrection: take N cards from discardTreasure, pay N from hand; draw remaining from deck */
  | { type: 'PRIEST_RESURRECT'; fromDiscardIds: string[]; payCardIds: string[] }
  /** Skip Priest Resurrection: draw all pendingTreasureCount cards from deck */
  | { type: 'SKIP_RESURRECTION' };
