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
  /** Monster level OR equipment combat bonus */
  power?: number;
  effect?: string;

  // Monster-specific
  /** Exact treasure count on kill (overrides power-based heuristic) */
  treasuresOnKill?: number;
  /** Level loss on bad stuff — -99 signals death (overrides power-based heuristic) */
  badStuffLevel?: number;
  /** Textual bad-stuff description for display */
  badStuff?: string;

  // Treasure-specific
  /** Bonus added to flee roll */
  fleeBonus?: number;
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
