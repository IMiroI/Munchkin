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
  | 'swap-race-from-discard'
  | 'swap-class-from-discard'
  | 'change-gender'
  | 'duck-of-doom'
  | 'lose-big-item'
  | 'lose-small-item'
  | 'lose-two-cards'
  | 'lose-headgear'
  | 'lose-armor'
  | 'lose-footwear'
  | 'lose-highest-bonus-item'
  | 'persistent-equip'
  | 'no-item-bonus-next-combat'
  | 'gold-match-others'
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
  /** fleeSuccessPenalty only applies when the player's level is strictly above this value */
  fleeSuccessPenaltyMinLevel?: number;
  /** On bad stuff, set player level to exactly this value (overrides badStuffLevel) */
  badStuffSetToLevel?: number;
  /** Flee bonus granted to the active player when fighting this monster */
  monsterFleeBonus?: number;
  /** On bad stuff, active player loses all equipped big items */
  badStuffLoseAllBigItems?: boolean;
  /** On bad stuff, active player loses all equipped Race and Class cards (becomes a plain human) */
  badStuffLoseAllRaceAndClass?: boolean;
  /** On bad stuff, active player loses their equipped headgear (if any) */
  badStuffLoseHeadgear?: boolean;
  /** On bad stuff, active player loses their equipped armor and footwear (if any) */
  badStuffLoseArmorAndFootwear?: boolean;
  /** Player cannot flee from this monster — RUN_AWAY is not available */
  noFlee?: boolean;
  /** Player may discard any equipped item worth ≥ this gold value to skip combat entirely (no treasure, no level) */
  bribeToAvoidGoldValue?: number;
  /** On bad stuff, active player discards their entire hand */
  badStuffDiscardHand?: boolean;
  /** On kill: if player had no helpers AND played no bonus cards, gain 1 extra level */
  bonusLevelIfNoHelpersNoBonuses?: boolean;
  /** On bad stuff: if player is a Wizard → lose only their Wizard class card; otherwise → death (badStuffLevel: -99 applies) */
  badStuffLoseClassIfWizard?: boolean;
  /** On bad stuff, active player loses all equipped items AND all hand cards */
  badStuffLoseAllItemsAndHand?: boolean;
  /** On bad stuff, lose equipped footwear; if none, lose this many levels instead */
  badStuffLoseFootwearOrLevel?: number;
  /** On bad stuff, roll a die — player must discard that many equipped items OR hand cards (their choice) */
  badStuffDieRollItemLoss?: boolean;
  /** On bad stuff, roll a die: if result ≤ this threshold → death; otherwise → lose that many levels */
  badStuffDieRollDeathThreshold?: number;
  /** Combat against this monster ignores all equipment, class bonuses, and one-shot bonus cards — only raw level counts */
  rawLevelOnly?: boolean;
  /** Combat against this monster ignores the player's level — only equipment bonuses and class bonuses count */
  rawEquipOnly?: boolean;
  /** Penalty added to die rolls when this card is in player.equipped (negative value = worse rolls) */
  dieRollPenalty?: number;
  /** When equipped: removed whenever the player's headgear slot is cleared by a curse or bad stuff */
  removedWithHeadgear?: boolean;
  /** On bad stuff, player's level is set to the current minimum level among all players */
  badStuffSetToMinLevel?: boolean;
  /** Player may choose to avoid this monster entirely (no fight, no treasure, no level) */
  avoidable?: boolean;
  /** Monster won't chase players at or below this level — auto-flee succeeds without a die roll */
  noChaseIfLevelBelow?: number;
  /** Race that is excluded from the noChaseIfLevelBelow exemption (e.g. elves still get chased) */
  noChaseExceptionRace?: string;
  /** On bad stuff, ALL other players (starting right) each pick one equipped or hand card from the victim */
  badStuffAllPlayersPickItem?: boolean;
  /** On bad stuff, each other player (starting left) takes one card from victim's hand; remaining hand cards are discarded */
  badStuffHandToOthers?: boolean;
  /** This monster does not fight thief players — they may avoid it freely or use thiefTreasureSwapCount */
  avoidsThief?: boolean;
  /** This monster doesn't fight female players or players who changed gender — gives them 1 treasure instead, no fight */
  avoidsGenderCondition?: boolean;
  /** On bad stuff: lose ALL equipped class cards; if player has no class, apply badStuffLevel instead */
  badStuffLoseAllClasses?: boolean;
  /** Thief alternative: discard this many equipped/hand treasures and draw the same count face-down from deck */
  thiefTreasureSwapCount?: number;
  /** On bad stuff, player(s) with the highest level each take one equipped item from the victim */
  badStuffHighestLevelPlayersPickItem?: boolean;
  /** When avoidable, halfling players cannot use the avoid option and must fight */
  halflingMustFight?: boolean;
  /** On bad stuff, active player must discard equipped items totaling this many gold pieces; if insufficient, loses all equipped + badStuffLevel */
  badStuffGoldDiscard?: number;
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
  /** If set, only players with this current effective gender can equip/use this item */
  requiredCurrentGender?: 'female' | 'male';
  /** If true, only players with no race (human) can equip/use this item */
  requiredNoRace?: boolean;
  /** If set, players of this race cannot equip/use this item (bypassed in Sang-mêlé super mode) */
  forbiddenRace?: 'elf' | 'dwarf' | 'halfling';
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
  /** When played during MonsterFight or FleeReaction, active player escapes automatically (no die roll, no bad stuff) */
  autoFleeEarly?: boolean;
  /** When discarded during MonsterFight or FleeReaction, auto-flee if monster power is ≤ this value */
  autoFleeThreshold?: number;
  /** When played during MonsterFight or FleeReaction, banishes the current monster: player gets its treasures but no level */
  banishMonster?: boolean;
  /** Monster IDs that this card instantly kills (player wins combat normally: treasures + level) */
  instantKillMonsters?: string[];
  /** Banishes the current monster (no level, no treasures), player gets to open/loot the room again (KickDown) */
  banishAndLoot?: boolean;
  /** When played during MonsterFight: discard ALL monsters in combat, active player draws N treasures (no level) */
  banishAllMonstersDrawTreasures?: number;
  /** When played during MonsterFight: steal one equipped item from any other player — only if it makes you win a combat you were losing */
  stealItemIfWinCondition?: boolean;
  /** Cannot be played by the player who is at (or tied for) the highest level among all players */
  blockedIfLeading?: boolean;
  /** When played during MonsterFight, forces action.targetId (higher-level player) to help; active player gains no level on win */
  forcedHelper?: boolean;
  /** When equipped, grants the player one extra big-item slot (normally limited to 1) */
  extraBigItemSlot?: boolean;
  /** When equipped and discarded during combat, auto-flees any monster; action.targetId = big item to sacrifice */
  discardForAutoFlee?: boolean;
  /** MonsterBooster: if the monster is still defeated, active player draws this many extra treasure cards */
  bonusTreasuresIfDefeated?: number;
  /** On kill: active player draws extra treasures if they have the matching race (e.g. { elf: 1 }) */
  bonusTreasureVsRace?: Partial<Record<string, number>>;
  /** Fleeing from this monster always succeeds — no die roll needed */
  autoFleeSuccess?: boolean;
  /** MonsterBooster: adds a clone of the current monster (same power + bonuses); rewards doubled if defeated */
  clonesCurrentMonster?: boolean;
  /** Can only be played during Loot or Charity phase (i.e. after a combat), by any player */
  afterCombatOnly?: boolean;
  /** When played, lets the player take any card from a discard pile (specified via action.searchDiscardCardId) */
  searchDiscard?: boolean;
  /** When played, all players with the given classId gain 1 level (can allow winning the game) */
  levelUpAllByClass?: string;
  /** When played during MonsterFight, transfers the combat to a target player (action.targetId) */
  transferCombat?: boolean;
  /** When played during MonsterFight, replaces action.targetId monster with action.replacementCardId monster from hand */
  replacesMonsterInCombat?: boolean;
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
  /** On kill: gain 1 extra level if any combat bonus card's name contains one of these keywords (case-insensitive) */
  bonusLevelIfItemNameMatches?: string[];
  /** Gold value for selling (informational) */
  goldValue?: number;

  /** Semantic category tags for items (e.g. ['wand'], ['staff'], ['lance']) — used by monster escape mechanics */
  itemTags?: string[];
  /** Monster field: during MonsterFight/FleeReaction, active player may discard any item with one of these tags to auto-flee */
  autoFleeByItemTag?: string[];

  /** Super Munchkin (d-085): allows a 2nd Class card; single-class super mode negates monster class penalties */
  isSuperMunchkin?: boolean;
  /** Sang-mêlé (d-081): allows a 2nd Race card; single-race super mode negates monster race penalties */
  isSangMele?: boolean;

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
  /** A Priest can take this monster's treasure without fighting (no level gained) */
  priestCanClaimTreasure?: boolean;
  /** Before combat starts, the active player must discard one equipped item of their choice */
  requiresPreCombatDiscard?: boolean;
  /** Race-specific bad stuff level override (e.g. { elf: -3 }) — takes priority over badStuffLevel for that race */
  badStuffLevelVsRace?: Partial<Record<string, number>>;
  /** Class ability: during any combat (not own turn), discard 1 card to give a player -2 (once per victim per combat) */
  classBackstab?: boolean;
  /** Class ability: during any combat (not own turn), discard 1 card to attempt stealing a small item (die 4+ = success, else -1 level) */
  classPickpocket?: boolean;
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
  /** Race ability: player may equip any number of big items (ignores the 1-big-item limit) */
  raceUnlimitedBigItems?: boolean;
  /** Race ability: player's hand limit is increased by this amount (e.g. +1 for dwarves → 6 cards) */
  raceHandSizeBonus?: number;
  /** Race ability: on failed flee roll, player may discard a card from hand to re-roll */
  raceFleeRetry?: boolean;
  /** Race ability: player may sell one item per SELL_ITEMS action at double its gold value */
  raceDoubleSellFirst?: boolean;

  // Semantic tags — used by engine instead of hard-coded card IDs
  classId?: 'warrior' | 'wizard' | 'cleric' | 'thief';
  raceId?: 'elf' | 'dwarf' | 'halfling';
  curseEffect?: CurseEffect;
}
