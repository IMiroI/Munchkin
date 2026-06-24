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
  | 'lose-headgear'
  | 'lose-highest-bonus-item'
  | 'persistent-equip'
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
  /** Extra power this monster gains when fighting a player of the given race (e.g. { elf: 5 }) */
  powerBonusVsRace?: Partial<Record<string, number>>;
  /** Extra power this monster gains when fighting a player of the given class (e.g. { warrior: 6 }) */
  powerBonusVsClass?: Partial<Record<string, number>>;
  /** Player must fight this monster alone — helpers are not allowed */
  noHelpers?: boolean;
  /** On bad stuff, the previous and next players each discard one of the victim's equipped items */
  badStuffNeighborsDiscard?: boolean;
  /** Undead monster — can be played from any player's hand into the active combat without d-059 */
  isUndead?: boolean;
  /** Level loss applied even on successful flee from this monster */
  fleeSuccessPenalty?: number;
  /** Flee bonus granted to the active player when fighting this monster */
  monsterFleeBonus?: number;
  /** On bad stuff, active player loses all equipped big items */
  badStuffLoseAllBigItems?: boolean;
  /** Combat against this monster ignores all equipment, class bonuses, and one-shot bonus cards — only raw level counts */
  rawLevelOnly?: boolean;
  /** Penalty added to die rolls when this card is in player.equipped (negative value = worse rolls) */
  dieRollPenalty?: number;
  /** When equipped: removed whenever the player's headgear slot is cleared by a curse or bad stuff */
  removedWithHeadgear?: boolean;
  /** On bad stuff, player's level is set to the current minimum level among all players */
  badStuffSetToMinLevel?: boolean;
  /** Player may choose to avoid this monster entirely (no fight, no treasure, no level) */
  avoidable?: boolean;
  /** When avoidable, halfling players cannot use the avoid option and must fight */
  halflingMustFight?: boolean;
  /** On bad stuff, active player chooses between losing badStuffLevel levels OR discarding their entire hand */
  badStuffChoiceLevelsOrHand?: boolean;
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
  /** When used as a combat bonus item, gives N power per ally (player+helpers) of each race */
  bonusPerAllyRace?: Partial<Record<string, number>>;
  /** When played during MonsterFight, adds a monster from hand (action.targetId) to the combat */
  addMonsterFromHand?: boolean;
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
  /** When played, immediately draws this many treasure cards (face-down → hand; face-up → equipped if possible) */
  drawTreasuresOnPlay?: number;
  /** When played during CurseReaction phase, cancels the pending curse */
  cancelsCurse?: boolean;
  /** When equipped, door curses drawn via KICK_DOOR are automatically discarded with no effect */
  immuneToDoorCurse?: boolean;
  /** When played during FleeSuccessReaction by any player, forces the fleeing player to re-roll */
  rerollFlee?: boolean;
  /** When played after any die roll (FleeReaction), the original roller re-submits with a chosen result */
  chooseDiceAfterRoll?: boolean;
  /** When played during FleeReaction phase (after a failed flee roll), makes the player escape automatically */
  autoFlee?: boolean;
  /** When discarded during MonsterFight or FleeReaction, auto-flee if monster power is ≤ this value */
  autoFleeThreshold?: number;
  /** When played during MonsterFight or FleeReaction, banishes the current monster: player gets its treasures but no level */
  banishMonster?: boolean;
  /** Monster IDs that this card instantly kills (player wins combat normally: treasures + level) */
  instantKillMonsters?: string[];
  /** Banishes the current monster (no level, no treasures), player gets to open/loot the room again (KickDown) */
  banishAndLoot?: boolean;
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

  /** Semantic category tags for items (e.g. ['wand'], ['staff'], ['lance']) — used by monster escape mechanics */
  itemTags?: string[];
  /** Monster field: during MonsterFight/FleeReaction, active player may discard any item with one of these tags to auto-flee */
  autoFleeByItemTag?: string[];

  /** Super Munchkin (d-085): allows a 2nd Class card; single-class super mode negates monster class penalties */
  isSuperMunchkin?: boolean;

  /** Marks this item as the Loyal Servant (t-035) — used by requiresLoyalServantInPlay checks */
  isLoyalServant?: boolean;
  /** This card can only be played if any player has an isLoyalServant card equipped */
  requiresLoyalServantInPlay?: boolean;
  /** When played, the isLoyalServant card is removed from whoever has it and discarded */
  discardLoyalServantOnPlay?: boolean;

  /** When placed (equipped) on another item, bypasses that item's class/race restrictions */
  bypassesItemRestrictions?: boolean;
  /** ID of the item this card is attached to (set dynamically when played) */
  attachedToItemId?: string;

  // Class ability flags (on Class cards)
  /** Class ability: during combat, may discard up to 3 cards for +1 each */
  classBerserkerRage?: boolean;
  /** Class ability: ties in combat count as player victories */
  classWarriorTiebreaker?: boolean;
  /** Class ability: after submitting a flee roll, may discard up to 3 cards for +1 each to that roll */
  classFleeBoostByDiscard?: boolean;
  /** Class ability: during MonsterFight, may discard entire hand (min 3) to charm one monster (get treasure, no level) */
  classCharmMonster?: boolean;
  /** Class ability: when winning combat, may draw face-up cards from the appropriate discard pile instead of the deck (pay 1 hand card per card taken) */
  classResurrection?: boolean;
  /** Class ability: during combat vs an Undead monster, may discard up to 3 cards for +3 combat bonus each */
  classTurning?: boolean;

  // Race ability flags (on Race cards)
  /** Race ability: when this player helps kill a monster, they gain 1 level per monster killed */
  raceHelperGainsLevelPerMonster?: boolean;
  /** Race ability: on failed flee roll, player may discard a card from hand to re-roll */
  raceFleeRetry?: boolean;
  /** Race ability: player may sell one item per SELL_ITEMS action at double its gold value */
  raceDoubleSellFirst?: boolean;

  // Semantic tags — used by engine instead of hard-coded card IDs
  classId?: 'warrior' | 'wizard' | 'cleric' | 'thief';
  raceId?: 'elf' | 'dwarf' | 'halfling';
  curseEffect?: CurseEffect;
}
