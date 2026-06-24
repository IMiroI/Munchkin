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
  /** Player must choose their bad stuff: lose levels OR discard entire hand */
  BadStuffChoice = 'BadStuffChoice',
  /** Priest player chooses to draw face-up cards from discard (paying hand cards) or draw from deck */
  PriestResurrection = 'PriestResurrection',
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
  /** During NeighborItemRemoval: the victim whose equipped items are being discarded */
  neighborDiscardTarget?: string;
  /** During NeighborItemRemoval: player IDs (in order) who still need to choose an item to discard */
  neighborDiscardQueue?: string[];
  /** During CurseItemChoice: IDs of tied items the active player must choose from to discard */
  pendingCurseItemChoices?: string[];
  /** During BadStuffChoice: level loss to apply if the player chooses levels over hand */
  pendingBadStuffLevels?: number;
  /** During PriestResurrection: number of treasure cards the priest may draw from discard (instead of deck) */
  pendingTreasureCount?: number;
}
