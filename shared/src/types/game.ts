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
  /** Neighboring players take turns discarding one of the victim's equipped items */
  NeighborItemRemoval = 'NeighborItemRemoval',
  /** Player must choose which tied item to discard (curse with multiple items at max bonus) */
  CurseItemChoice = 'CurseItemChoice',
  /** Active player must discard one equipped item before the monster fight begins */
  PreCombatDiscard = 'PreCombatDiscard',
  /** Active player must discard equipped items totaling pendingGoldDiscardRequired gold pieces */
  BadStuffGoldDiscard = 'BadStuffGoldDiscard',
  /** Current player in pendingGoldMatchQueue must discard item(s) totaling ≥ pendingGoldMatchTarget */
  CurseGoldMatch = 'CurseGoldMatch',
  /** Player must choose their bad stuff: lose levels OR discard entire hand */
  BadStuffChoice = 'BadStuffChoice',
  /** Player must choose to lose N items from equipped OR N cards from hand (die roll result) */
  BadStuffDieRollLoss = 'BadStuffDieRollLoss',
  /** Priest player chooses to draw face-up cards from discard (paying hand cards) or draw from deck */
  PriestResurrection = 'PriestResurrection',
  Loot = 'Loot',
  Charity = 'Charity',
  EndTurn = 'EndTurn',
  /** Items from a dead player are available for other players to pick (highest level first) */
  BodyPillage = 'BodyPillage',
  /** Winner distributes combat treasures — helpers can receive some before they go to the hand */
  TreasureShare = 'TreasureShare',
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
  /** Additional monsters that joined the fight (via Monstre Errant) */
  additionalMonsters?: Card[];
  /** Player forced to be a helper (cannot refuse) via forcedHelper card */
  forcedHelperId?: string;
  /** When set, active player's level is capped at this value after winning this combat */
  combatLevelCap?: number;
  /** Player who played a chooseDiceAfterRoll card and gets to submit the chosen die value in ForcedFlee */
  pendingDiceChooserPlayerId?: string;
  /** Accumulated level loss to apply when flee is finalised (from fleeSuccessPenalty monsters) */
  pendingFleePenalty?: number;
  /** During NeighborItemRemoval: the victim whose items are being taken/discarded */
  neighborDiscardTarget?: string;
  /** During NeighborItemRemoval: player IDs (in order) who still need to choose an item */
  neighborDiscardQueue?: string[];
  /** During NeighborItemRemoval: if true, pickers may also pick from the victim's hand (not just equipped) */
  neighborPickIncludesHand?: boolean;
  /** During NeighborItemRemoval: if true, the picked item goes to the picker's hand instead of the discard pile */
  neighborPickGivesToPicker?: boolean;
  /** During NeighborItemRemoval: if true, pickers may only pick from victim's hand (not equipped) */
  neighborPickFromHandOnly?: boolean;
  /** During CurseItemChoice: IDs of tied items the active player must choose from to discard */
  pendingCurseItemChoices?: string[];
  /** During BadStuffChoice: level loss to apply if the player chooses levels over hand */
  pendingBadStuffLevels?: number;
  /** During BadStuffDieRollLoss: number of items/cards the player must discard */
  pendingDieRollLossCount?: number;
  /** During BadStuffGoldDiscard: total gold value the player must cover by discarding equipped items */
  pendingGoldDiscardRequired?: number;
  /** During CurseGoldMatch: gold value each queued player must match by discarding items */
  pendingGoldMatchTarget?: number;
  /** During CurseGoldMatch: player IDs still to resolve (first = current active) */
  pendingGoldMatchQueue?: string[];
  /** During PriestResurrection: number of treasure cards the priest may draw from discard (instead of deck) */
  pendingTreasureCount?: number;
  /** Total backstab penalty accumulated this combat (positive number, subtracted from player team total) */
  combatBackstabPenalty?: number;
  /** Log of backstabs this combat: [thiefId, victimId] pairs (for once-per-victim-per-thief enforcement) */
  backstabLog?: { thiefId: string; victimId: string }[];
  /** During BodyPillage: cards available for other players to pick (sorted by picker order) */
  bodyPillagingItems?: Card[];
  /** During BodyPillage: player IDs still to pick (first = current picker), highest level first */
  bodyPillagingQueue?: string[];
  /** During multi-monster flee: monsters still to flee after current bad-stuff resolution */
  pendingFleeMonsters?: Card[];
  /** During CurseItemChoice triggered by a manually played curse: the ID of the player being cursed */
  pendingCurseTarget?: string;
  /** Card drawn from the door deck face-up (non-monster, non-curse) — visible to all players */
  lastRevealedCard?: Card;
  /** During TreasureShare: treasure cards won in combat, pending distribution to winner + helpers */
  pendingShareTreasures?: Card[];
  /** During TreasureShare: IDs of helpers who may receive some of the pending treasure cards */
  pendingShareHelperIds?: string[];
  /** Set by FIGHT_MONSTER resolution: true = player won, false = monster won. Used for the combat-result animation. */
  lastCombatWon?: boolean;
}
