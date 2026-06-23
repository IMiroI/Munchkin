export enum CardType {
  Monster = 'Monster',
  Treasure = 'Treasure',
  DoorCurse = 'DoorCurse',
  Class = 'Class',
  Race = 'Race',
  MonsterBooster = 'MonsterBooster',
  Special = 'Special',
}

export type CurseEffect =
  | 'lose-level'
  | 'lose-class'
  | 'lose-race'
  | 'duck-of-doom'
  | 'lose-big-item'
  | 'lose-small-item'
  | 'lose-two-cards'
  | 'generic';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  image?: string;
  /** Monster level OR equipment combat bonus */
  power?: number;
  effect?: string;

  // Monster-specific
  /** Exact treasure count on kill (overrides power-based heuristic) */
  treasuresOnKill?: number;
  /** Levels gained by the active player on kill (defaults to 1) */
  levelsOnKill?: number;
  /** Level loss on bad stuff — -99 signals death (overrides power-based heuristic) */
  badStuffLevel?: number;
  /** Textual bad-stuff description for display */
  badStuff?: string;

  // Treasure-specific
  /** Additional power bonus keyed by race id (e.g. { elf: 3 }) — stacks with `power` */
  racePowerBonus?: Partial<Record<string, number>>;
  /** If set, only players of this class can equip/use this item */
  requiredClass?: 'warrior' | 'wizard' | 'cleric' | 'thief';
  /** If set, players of this class cannot equip/use this item */
  forbiddenClass?: 'warrior' | 'wizard' | 'cleric' | 'thief';
  /** If set, only players of this race can equip/use this item */
  requiredRace?: 'elf' | 'dwarf' | 'halfling';
  /** If true, only players with no race (human) can equip/use this item */
  requiredNoRace?: boolean;
  /** When played as a bonus item with no helpers, doubles the player's base combat strength (level + equipment + class bonus) */
  doublesPlayerStrength?: boolean;
  /** Number of hands required to equip this item (1 or 2). Players have 2 hands total. */
  handUsage?: 1 | 2;
  /** Equipment slot — only one item per slot allowed; equipping replaces the existing one */
  equipSlot?: 'headgear' | 'armor' | 'footwear';
  /** When played, the active player gains 1 level and the target player (action.targetId) loses 1 level */
  stealLevel?: boolean;
  /** When played during CurseReaction phase, cancels the pending curse */
  cancelsCurse?: boolean;
  /** When equipped, door curses drawn via KICK_DOOR are automatically discarded with no effect */
  immuneToDoorCurse?: boolean;
  /** When played during FleeSuccessReaction by any player, forces the fleeing player to re-roll */
  rerollFlee?: boolean;
  /** When played during FleeReaction phase (after a failed flee roll), makes the player escape automatically */
  autoFlee?: boolean;
  /** When discarded during MonsterFight or FleeReaction, auto-flee if monster power is ≤ this value */
  autoFleeThreshold?: number;
  /** When played during MonsterFight or FleeReaction, banishes the current monster: player gets its treasures but no level */
  banishMonster?: boolean;
  /** Cannot be played by the player who is at (or tied for) the highest level among all players */
  blockedIfLeading?: boolean;
  /** When played during MonsterFight, forces action.targetId (higher-level player) to help; active player gains no level on win */
  forcedHelper?: boolean;
  /** When equipped, grants the player one extra big-item slot (normally limited to 1) */
  extraBigItemSlot?: boolean;
  /** When equipped and discarded during combat, auto-flees any monster; action.targetId = big item to sacrifice */
  discardForAutoFlee?: boolean;
  /** Can only be played during Loot or Charity phase (i.e. after a combat), by any player */
  afterCombatOnly?: boolean;
  /** When played, lets the player take any card from a discard pile (specified via action.searchDiscardCardId) */
  searchDiscard?: boolean;
  /** When played during MonsterFight, transfers the combat to a target player (action.targetId) */
  transferCombat?: boolean;
  /** Bonus added to flee roll */
  fleeBonus?: number;
  /** When equipped, player draws this many treasure cards on successful flee */
  fleeDrawsTreasure?: number;
  /** Counts toward the 1-big-item-per-player limit */
  isBigItem?: boolean;
  /** Discarded on use (potions, one-shot items) */
  isOneShot?: boolean;
  /** Levels gained when this card is played (level-up cards) */
  levelUp?: number;
  /** Gold value for selling (informational) */
  goldValue?: number;

  // Semantic tags — used by engine instead of hard-coded card IDs
  classId?: 'warrior' | 'wizard' | 'cleric' | 'thief';
  raceId?: 'elf' | 'dwarf' | 'halfling';
  curseEffect?: CurseEffect;
}
