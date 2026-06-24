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
  | { type: 'PLAY_CARD'; cardId: string; targetId?: string; targetPlayerId?: string; replaceEquippedIds?: string[]; searchDiscardCardId?: string; combatBeneficiary?: 'player' | 'monster'; faceUp?: boolean; replacementCardId?: string }
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
  /** Toggle Sang-mêlé mode between dual-race and single-race-super */
  | { type: 'SET_SANG_MELE_MODE'; mode: 'dual' | 'super' }
  /** Wizard class ability: discard entire hand (min 3) to charm one monster — get treasure, no level */
  | { type: 'WIZARD_CHARM'; targetMonsterId: string }
  /** Bad stuff with a player choice: lose levels or discard entire hand */
  | { type: 'CHOOSE_BAD_STUFF'; choice: 'levels' | 'hand' }
  /** Player chooses to avoid an avoidable monster — no fight, no treasure, no level */
  | { type: 'AVOID_MONSTER' }
  /** Thief backstab: discard a card to give a player in combat -2 (once per victim per combat) */
  | { type: 'THIEF_BACKSTAB'; targetPlayerId: string; discardCardId: string }
  /** Thief pickpocket: discard a card to attempt stealing a small item (die 4+ = success, else -1 level) */
  | { type: 'THIEF_PICKPOCKET'; targetPlayerId: string; targetItemId: string; discardCardId: string }
  /** Priest Turning: during FIGHT_MONSTER, discard up to 3 cards for +3 each (undead only) */
  // (wizardDiscardIds is part of RUN_AWAY; priestTurningIds is part of FIGHT_MONSTER)
  /** Priest Resurrection: take N cards from discardTreasure, pay N from hand; draw remaining from deck */
  | { type: 'PRIEST_RESURRECT'; fromDiscardIds: string[]; payCardIds: string[] }
  /** Skip Priest Resurrection: draw all pendingTreasureCount cards from deck */
  | { type: 'SKIP_RESURRECTION' }
  /** Priest claims a monster's treasure without fighting (monster must have priestCanClaimTreasure) */
  | { type: 'PRIEST_CLAIM_TREASURE' }
  /** Pre-combat: active player discards one equipped item (when monster has requiresPreCombatDiscard) */
  | { type: 'DISCARD_PRE_COMBAT_ITEM'; cardId: string }
  /** Bad stuff gold discard: player selects equipped items totaling ≥ pendingGoldDiscardRequired gold */
  | { type: 'DISCARD_ITEMS_FOR_GOLD'; cardIds: string[] }
  /** Curse gold match: current player in pendingGoldMatchQueue discards item(s) totaling ≥ pendingGoldMatchTarget */
  | { type: 'MATCH_GOLD_VALUE'; cardIds: string[] }
  /** Thief swaps treasures with Huissier: discard N equipped/hand treasures, draw N face-down from deck */
  | { type: 'THIEF_SWAP_TREASURES'; discardCardIds: string[] }
  /** Bad stuff die roll loss: player chooses source (equipped or hand) and which card IDs to discard */
  | { type: 'RESOLVE_DIE_ROLL_LOSS'; source: 'equipped' | 'hand'; cardIds: string[] }
  /** Bribe a monster to avoid combat: discard one equipped item worth ≥ monster.bribeToAvoidGoldValue */
  | { type: 'BRIBE_MONSTER'; discardItemId: string };
