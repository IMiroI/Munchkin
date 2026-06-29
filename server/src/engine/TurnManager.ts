import { GamePhase, CardType, playerRace, playerRaces, playerClass, playerClasses } from '@munchkin/shared';
import type { GameState, Player, Card, CurseEffect } from '@munchkin/shared';
import { DeckManager } from './DeckManager.js';
import { CombatResolver } from './CombatResolver.js';
import type { GameAction, LevelChange } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find(p => p.id === id);
}

function updatePlayer(state: GameState, updated: Player): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === updated.id ? updated : p)),
  };
}

function withCombatPower(player: Player): Player {
  const equipBonus = player.equipped.reduce((sum, c) => sum + (c.power ?? 0), 0);
  return { ...player, combatPower: player.level + equipBonus };
}

function applyLevelChange(player: Player, delta: LevelChange, isDeath: boolean): Player {
  if (isDeath) {
    const keptEquipped = player.equipped.filter(
      c => c.type === CardType.Class || c.type === CardType.Race || c.isSuperMunchkin === true || c.isSangMele === true,
    );
    return withCombatPower({ ...player, equipped: keptEquipped, hand: [] });
  }
  return withCombatPower({ ...player, level: Math.max(1, player.level + delta) });
}

/**
 * If equipped has no Class card remaining and Super Munchkin is present, remove it too.
 * Returns the updated equipped array and the removed card (for discardDoor).
 */
function removeSuperMunchkinIfClassless(equipped: Card[]): { equipped: Card[]; removedSuperMunchkin?: Card } {
  const hasClass = equipped.some(c => c.type === CardType.Class);
  if (hasClass) return { equipped };
  const sm = equipped.find(c => c.isSuperMunchkin);
  if (!sm) return { equipped };
  return { equipped: equipped.filter(c => !c.isSuperMunchkin), removedSuperMunchkin: sm };
}

/**
 * If equipped has no Race card remaining and Sang-mêlé is present, remove it too.
 */
function removeSangMeleIfRaceless(equipped: Card[]): { equipped: Card[]; removedSangMele?: Card } {
  const hasRace = equipped.some(c => c.type === CardType.Race);
  if (hasRace) return { equipped };
  const sm = equipped.find(c => c.isSangMele);
  if (!sm) return { equipped };
  return { equipped: equipped.filter(c => !c.isSangMele), removedSangMele: sm };
}

/**
 * When equipped items are removed, also pull any attached cards (bypassesItemRestrictions).
 * Returns the attachment cards that must be added to discardDoor.
 */
function fleeSuccessPenaltyFor(monster: Card, playerLevel: number): number {
  const p = monster.fleeSuccessPenalty ?? 0;
  if (p === 0) return 0;
  return playerLevel > (monster.fleeSuccessPenaltyMinLevel ?? 0) ? p : 0;
}

function processGoldMatchQueue(state: GameState, target: number, queue: string[]): GameState {
  if (queue.length === 0) {
    return { ...state, phase: GamePhase.Loot, pendingGoldMatchTarget: undefined, pendingGoldMatchQueue: undefined };
  }
  const [currentId, ...rest] = queue;
  const currentPlayer = getPlayer(state, currentId!);
  if (!currentPlayer) return processGoldMatchQueue(state, target, rest);
  const totalGold = currentPlayer.equipped.reduce((sum, c) => sum + (c.goldValue ?? 0), 0);
  if (totalGold < target) {
    const lostTreasure = currentPlayer.equipped.filter(c => c.type === CardType.Treasure);
    const lostDoor = currentPlayer.equipped.filter(c => c.type !== CardType.Treasure);
    const stripped = withCombatPower({
      ...currentPlayer, equipped: [], level: Math.max(1, currentPlayer.level - 1),
    });
    const nextState = {
      ...updatePlayer(state, stripped),
      discardTreasure: [...state.discardTreasure, ...lostTreasure],
      discardDoor: [...state.discardDoor, ...lostDoor],
    };
    return processGoldMatchQueue(nextState, target, rest);
  }
  return { ...state, phase: GamePhase.CurseGoldMatch, pendingGoldMatchTarget: target, pendingGoldMatchQueue: queue };
}

function enterMonsterFight(state: GameState, monster: Card): GameState {
  const activePlayer = getPlayer(state, state.currentPlayerId)!;
  // avoidsGenderCondition: female player or player who changed gender gets 1 treasure instead of fighting
  if (monster.avoidsGenderCondition &&
      (activePlayer.gender === 'female' || activePlayer.hasChangedGender)) {
    const { cards: drawn, newDeck } = DeckManager.draw(state.treasureDeck, 1);
    const updatedPlayer = { ...activePlayer, hand: [...activePlayer.hand, ...drawn] };
    return {
      ...updatePlayer(state, updatedPlayer),
      phase: GamePhase.Loot,
      treasureDeck: newDeck,
      discardDoor: [...state.discardDoor, monster],
    };
  }
  if (monster.requiresPreCombatDiscard && activePlayer.equipped.length > 0) {
    return { ...state, phase: GamePhase.PreCombatDiscard, currentMonster: monster };
  }
  return { ...state, phase: GamePhase.MonsterFight, currentMonster: monster };
}

function splitAttachments(
  equipped: Card[],
  removedIds: ReadonlySet<string>,
): { kept: Card[]; detachedDoor: Card[] } {
  const detachedDoor: Card[] = [];
  const kept: Card[] = [];
  for (const c of equipped) {
    if (removedIds.has(c.id)) continue;
    if (c.attachedToItemId != null && removedIds.has(c.attachedToItemId)) {
      detachedDoor.push(c);
    } else {
      kept.push(c);
    }
  }
  return { kept, detachedDoor };
}

/** After combat, return to the original player for Loot if combat was transferred, else go to Charity. */
function postCombatTransition(state: GameState): Pick<GameState, 'phase' | 'currentPlayerId' | 'transferOriginalPlayerId' | 'combatBackstabPenalty' | 'backstabLog'> {
  if (state.transferOriginalPlayerId) {
    return { phase: GamePhase.Loot, currentPlayerId: state.transferOriginalPlayerId, transferOriginalPlayerId: undefined, combatBackstabPenalty: undefined, backstabLog: undefined };
  }
  return { phase: GamePhase.Charity, currentPlayerId: state.currentPlayerId, transferOriginalPlayerId: undefined, combatBackstabPenalty: undefined, backstabLog: undefined };
}

/** After a successful flee, enter FleeSuccessReaction so rerollFlee cards can be played. */
function fleeSuccess(): Pick<GameState, 'phase'> {
  return { phase: GamePhase.FleeSuccessReaction };
}

function nextPlayerId(state: GameState): string {
  const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
  const next = (idx + 1) % state.players.length;
  return state.players[next]!.id;
}

function drawFromDoor(
  deck: GameState['doorDeck'],
  discard: GameState['discardDoor'],
  n: number,
): { cards: ReturnType<typeof DeckManager.draw>['cards']; deck: typeof deck; discard: typeof discard } {
  let d = deck;
  let disc = discard;
  if (d.length < n && disc.length > 0) {
    d = [...d, ...DeckManager.reshuffle(disc)];
    disc = [];
  }
  const { cards, newDeck } = DeckManager.draw(d, n);
  return { cards, deck: newDeck, discard: disc };
}

function drawFromTreasure(
  deck: GameState['treasureDeck'],
  discard: GameState['discardTreasure'],
  n: number,
): { cards: ReturnType<typeof DeckManager.draw>['cards']; deck: typeof deck; discard: typeof discard } {
  let d = deck;
  let disc = discard;
  if (d.length < n && disc.length > 0) {
    d = [...d, ...DeckManager.reshuffle(disc)];
    disc = [];
  }
  const { cards, newDeck } = DeckManager.draw(d, Math.min(n, d.length));
  return { cards, deck: newDeck, discard: disc };
}

/**
 * Task 6 — After a failed flee from currentMonster: apply bad-stuff extras then check for remaining monsters.
 * Discards only the currentMonster; if additionalMonsters remain, enters ForcedFlee; else ends combat.
 */
function continueFleeOrEnd(
  state: GameState,
  updatedPlayer: Player,
  extraDiscardDoor: Card[] = [],
  extraDiscardTreasure: Card[] = [],
): GameState {
  const monster = state.currentMonster!;
  const remaining = state.additionalMonsters ?? [];
  const newDiscardDoor = [...state.discardDoor, monster, ...extraDiscardDoor];
  const newDiscardTreasure = [...state.discardTreasure, ...extraDiscardTreasure];
  const base = {
    ...updatePlayer(state, updatedPlayer),
    discardDoor: newDiscardDoor,
    discardTreasure: newDiscardTreasure,
  };
  if (remaining.length > 0) {
    const [next, ...rest] = remaining;
    return {
      ...base,
      phase: GamePhase.ForcedFlee,
      currentMonster: next,
      additionalMonsters: rest.length > 0 ? rest : undefined,
    };
  }
  return { ...base, ...postCombatTransition(state), currentMonster: undefined, additionalMonsters: undefined };
}

/**
 * Task 6 — After a flee sub-phase (BadStuffChoice, GoldDiscard, DieRollLoss, NeighborItemRemoval)
 * resolves: if pendingFleeMonsters is set, continue fleeing them; otherwise end combat normally.
 */
function afterFleeSubphase(state: GameState): GameState {
  const remaining = state.pendingFleeMonsters!;
  const base = { ...state, pendingFleeMonsters: undefined as Card[] | undefined };
  if (remaining.length > 0) {
    const [next, ...rest] = remaining;
    return {
      ...base,
      phase: GamePhase.ForcedFlee,
      currentMonster: next,
      additionalMonsters: rest.length > 0 ? rest : undefined,
    };
  }
  return { ...base, ...postCombatTransition(base) };
}

/**
 * Task 1 — After a player dies: collect pillage-eligible items, build picker queue, enter BodyPillage.
 * deadPlayer must still have their full equipped/hand (before being cleared).
 */
function enterBodyPillage(
  state: GameState,
  deadPlayer: Player,
  baseDiscardDoor: Card[],
  baseDiscardTreasure: Card[],
  combatCleanup: Partial<GameState> = {},
): GameState {
  const isKept = (c: Card) =>
    c.type === CardType.Class ||
    c.type === CardType.Race ||
    c.isSuperMunchkin === true ||
    c.isSangMele === true;

  const pillagingItems = [...deadPlayer.equipped.filter(c => !isKept(c)), ...deadPlayer.hand];
  const keptEquipped = deadPlayer.equipped.filter(isKept);
  const clearedDead = withCombatPower({ ...deadPlayer, equipped: keptEquipped, hand: [], isDead: true });

  const baseState: GameState = {
    ...updatePlayer(state, clearedDead),
    ...combatCleanup,
    discardDoor: baseDiscardDoor,
    discardTreasure: baseDiscardTreasure,
  };

  if (pillagingItems.length === 0) {
    return { ...baseState, ...postCombatTransition(baseState) };
  }

  const deadIdx = state.players.findIndex(p => p.id === deadPlayer.id);
  const clockwiseOthers = state.players
    .map((_, i) => state.players[(deadIdx + 1 + i) % state.players.length]!)
    .filter(p => p.id !== deadPlayer.id && !p.isDead);
  // Stable sort by level descending (preserves clockwise order for ties)
  clockwiseOthers.sort((a, b) => b.level - a.level);
  const pickers = clockwiseOthers.slice(0, pillagingItems.length).map(p => p.id);

  if (pickers.length === 0) {
    const toDoor = pillagingItems.filter(c => c.type !== CardType.Treasure);
    const toTreasure = pillagingItems.filter(c => c.type === CardType.Treasure);
    return {
      ...baseState,
      ...postCombatTransition(baseState),
      discardDoor: [...baseDiscardDoor, ...toDoor],
      discardTreasure: [...baseDiscardTreasure, ...toTreasure],
    };
  }

  return {
    ...baseState,
    phase: GamePhase.BodyPillage,
    bodyPillagingItems: pillagingItems,
    bodyPillagingQueue: pickers,
  };
}

/**
 * Transitions to the next player's KickDown phase.
 * If that player died this round (isDead), deals them 4 door + 4 treasure cards and clears isDead.
 */
function startNextTurn(state: GameState): GameState {
  const nextId = nextPlayerId(state);
  const nextPlayer = state.players.find(p => p.id === nextId)!;
  const base: GameState = { ...state, phase: GamePhase.KickDown, currentPlayerId: nextId, currentMonster: undefined, lastRevealedCard: undefined };

  if (!nextPlayer.isDead) return base;

  const { cards: doorCards, deck: doorDeck, discard: discardDoor } = drawFromDoor(state.doorDeck, state.discardDoor, 4);
  const { cards: treasureCards, deck: treasureDeck, discard: discardTreasure } = drawFromTreasure(state.treasureDeck, state.discardTreasure, 4);

  const revivedPlayer = withCombatPower({
    ...nextPlayer,
    isDead: false,
    hand: [...doorCards, ...treasureCards],
  });

  return updatePlayer(
    { ...base, doorDeck, discardDoor, treasureDeck, discardTreasure },
    revivedPlayer,
  );
}

/**
 * Applies a door curse to the active player.
 * Dispatches on curseEffect semantic tag instead of hard-coded card IDs.
 */
function applyCurse(
  player: Player,
  curse: Card,
): { player: Player; discardedTreasure?: Card; discardedDebuffs?: Card[]; detachedDoorCards?: Card[] } {
  const effect: CurseEffect = curse.curseEffect ?? 'generic';

  switch (effect) {
    case 'lose-level':
      return { player: withCombatPower({ ...player, level: Math.max(1, player.level - 1) }) };

    case 'lose-class': {
      const afterClass = player.equipped.filter(c => c.type !== CardType.Class);
      const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(afterClass);
      return {
        player: withCombatPower({ ...player, equipped: afterSM }),
        detachedDoorCards: removedSuperMunchkin ? [removedSuperMunchkin] : undefined,
      };
    }

    case 'lose-race': {
      const withoutRace = player.equipped.filter(c => c.type !== CardType.Race);
      const { equipped: afterSangMele, removedSangMele } = removeSangMeleIfRaceless(withoutRace);
      return {
        player: withCombatPower({ ...player, equipped: afterSangMele }),
        detachedDoorCards: removedSangMele ? [removedSangMele] : undefined,
      };
    }

    case 'duck-of-doom':
      return { player: withCombatPower({ ...player, level: Math.max(1, player.level - 2) }) };

    case 'lose-headgear': {
      const headgearItem = player.equipped.find(c => c.equipSlot === 'headgear');
      const debuffsRemoved = player.equipped.filter(c => c.removedWithHeadgear);
      const toRemove = new Set([
        ...(headgearItem ? [headgearItem.id] : []),
        ...debuffsRemoved.map(c => c.id),
      ]);
      const { kept: keptH, detachedDoor: detH } = splitAttachments(player.equipped, toRemove);
      return {
        player: withCombatPower({ ...player, equipped: keptH }),
        discardedTreasure: headgearItem,
        discardedDebuffs: debuffsRemoved.length > 0 ? debuffsRemoved : undefined,
        detachedDoorCards: detH.length > 0 ? detH : undefined,
      };
    }

    case 'lose-armor': {
      const armorItem = player.equipped.find(c => c.equipSlot === 'armor');
      if (!armorItem) return { player };
      const { kept: keptA, detachedDoor: detA } = splitAttachments(player.equipped, new Set([armorItem.id]));
      return {
        player: withCombatPower({ ...player, equipped: keptA }),
        discardedTreasure: armorItem,
        detachedDoorCards: detA.length > 0 ? detA : undefined,
      };
    }

    case 'lose-footwear': {
      const footwearItem = player.equipped.find(c => c.equipSlot === 'footwear');
      if (!footwearItem) return { player };
      const { kept: keptF, detachedDoor: detF } = splitAttachments(player.equipped, new Set([footwearItem.id]));
      return {
        player: withCombatPower({ ...player, equipped: keptF }),
        discardedTreasure: footwearItem,
        detachedDoorCards: detF.length > 0 ? detF : undefined,
      };
    }

    case 'change-gender':
      return {
        player: {
          ...player,
          gender: player.gender === 'male' ? 'female' : 'male',
          hasChangedGender: true,
          nextCombatPenalty: (player.nextCombatPenalty ?? 0) + 5,
        },
      };

    case 'no-item-bonus-next-combat':
      return { player: { ...player, nextCombatNoItemBonus: true } };

    default:
      return { player };
  }
}

// ---------------------------------------------------------------------------
// TurnManager
// ---------------------------------------------------------------------------

export const TurnManager = {
  validateAction(state: GameState, playerId: string, action: GameAction): boolean {
    const isActivePlayer = playerId === state.currentPlayerId;

    switch (action.type) {
      case 'KICK_DOOR':
        return isActivePlayer && state.phase === GamePhase.KickDown;

      case 'LOOT_ROOM':
      case 'LOOK_FOR_TROUBLE':
      case 'PASS_LOOT':
        return isActivePlayer && state.phase === GamePhase.Loot;

      case 'FIGHT_MONSTER': {
        if (!isActivePlayer || state.phase !== GamePhase.MonsterFight || state.currentMonster == null)
          return false;
        // Priest Turning: only vs undead, must have classTurning, ≤3 cards, all in hand
        if (action.priestTurningIds?.length) {
          const allMonsters = [state.currentMonster, ...(state.additionalMonsters ?? [])];
          if (!allMonsters.some(m => m.isUndead)) return false;
          const p = getPlayer(state, playerId)!;
          if (!p.equipped.some(c => c.classTurning)) return false;
          if (action.priestTurningIds.length > 3) return false;
          if (!action.priestTurningIds.every(id => p.hand.some(c => c.id === id))) return false;
        }
        // Warrior Berserker Rage: must have classBerserkerRage, ≤3 cards, all in hand
        if (action.warriorBerserkerIds?.length) {
          const p = getPlayer(state, playerId)!;
          if (!p.equipped.some(c => c.classBerserkerRage)) return false;
          if (action.warriorBerserkerIds.length > 3) return false;
          if (!action.warriorBerserkerIds.every(id => p.hand.some(c => c.id === id))) return false;
        }
        const fightingPlayer = getPlayer(state, playerId);
        if (!fightingPlayer) return false;
        if (state.currentMonster.noHelpers && action.helperIds.length > 0) return false;
        const hasDoubler = action.bonusCardIds.some(
          id => fightingPlayer.hand.find(c => c.id === id)?.doublesPlayerStrength,
        );
        if (hasDoubler && action.helperIds.length > 0) return false;
        return true;
      }

      case 'RUN_AWAY': {
        const canRunAway =
          (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.ForcedFlee) &&
          state.currentMonster != null;
        if (!canRunAway) return false;
        if (state.currentMonster?.noFlee) return false;
        if (state.phase === GamePhase.ForcedFlee && state.pendingDiceChooserPlayerId != null) {
          return playerId === state.pendingDiceChooserPlayerId;
        }
        if (!isActivePlayer) return false;
        // Wizard flee boost: must have class ability, ≤3 cards, all in hand
        if (action.wizardDiscardIds?.length) {
          const p = getPlayer(state, playerId)!;
          if (!p.equipped.some(c => c.classFleeBoostByDiscard)) return false;
          if (action.wizardDiscardIds.length > 3) return false;
          if (!action.wizardDiscardIds.every(id => p.hand.some(c => c.id === id))) return false;
        }
        return true;
      }

      case 'CHOOSE_BAD_STUFF':
        return isActivePlayer && state.phase === GamePhase.BadStuffChoice;

      case 'SKIP_RESURRECTION':
        return isActivePlayer && state.phase === GamePhase.PriestResurrection;

      case 'PRIEST_RESURRECT': {
        if (!isActivePlayer || state.phase !== GamePhase.PriestResurrection) return false;
        const count = state.pendingTreasureCount ?? 0;
        if (action.fromDiscardIds.length === 0) return false;
        if (action.fromDiscardIds.length > count) return false;
        if (action.fromDiscardIds.length !== action.payCardIds.length) return false;
        if (!action.fromDiscardIds.every(id => state.discardTreasure.some(c => c.id === id))) return false;
        const p = getPlayer(state, playerId)!;
        const fromSet = new Set(action.fromDiscardIds);
        const handWithoutFromDiscard = p.hand.filter(c => !fromSet.has(c.id));
        return action.payCardIds.every(id => handWithoutFromDiscard.some(c => c.id === id));
      }

      case 'AVOID_MONSTER': {
        if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        const monster = state.currentMonster;
        if (!monster) return false;
        // avoidsThief: thief players can always avoid this monster
        if (monster.avoidsThief && playerClasses(getPlayer(state, playerId)!).includes('thief')) return true;
        if (!monster.avoidable) return false;
        if (monster.halflingMustFight && playerRace(getPlayer(state, playerId)!) === 'halfling') return false;
        return true;
      }

      case 'BRIBE_MONSTER': {
        if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        const bribeMonster = state.currentMonster;
        if (!bribeMonster?.bribeToAvoidGoldValue) return false;
        const bribePlayer = getPlayer(state, playerId)!;
        const bribeItem = bribePlayer.equipped.find(c => c.id === action.discardItemId);
        return bribeItem != null && (bribeItem.goldValue ?? 0) >= bribeMonster.bribeToAvoidGoldValue;
      }

      case 'THIEF_SWAP_TREASURES': {
        if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        const monster = state.currentMonster;
        if (!monster?.thiefTreasureSwapCount) return false;
        const p = getPlayer(state, playerId)!;
        if (!playerClasses(p).includes('thief')) return false;
        const allCards = [...p.equipped, ...p.hand];
        const selected = action.discardCardIds.map(id => allCards.find(c => c.id === id)).filter(Boolean);
        if (selected.length !== monster.thiefTreasureSwapCount) return false;
        return selected.every(c => c!.type === CardType.Treasure);
      }

      case 'THIEF_BACKSTAB': {
        if (isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        const thief = getPlayer(state, playerId)!;
        if (!thief.equipped.some(c => c.classBackstab)) return false;
        if (!thief.hand.some(c => c.id === action.discardCardId)) return false;
        if (action.targetPlayerId === playerId) return false;
        if (!state.players.some(p => p.id === action.targetPlayerId)) return false;
        // Once per victim per thief
        const alreadyStabbed = (state.backstabLog ?? []).some(
          e => e.thiefId === playerId && e.victimId === action.targetPlayerId,
        );
        return !alreadyStabbed;
      }

      case 'THIEF_PICKPOCKET': {
        if (isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        const thief = getPlayer(state, playerId)!;
        if (!thief.equipped.some(c => c.classPickpocket)) return false;
        if (!thief.hand.some(c => c.id === action.discardCardId)) return false;
        if (action.targetPlayerId === playerId) return false;
        const target = getPlayer(state, action.targetPlayerId);
        if (!target) return false;
        return target.equipped.some(
          c => c.id === action.targetItemId && c.type === CardType.Treasure && !c.isBigItem,
        );
      }

      case 'MATCH_GOLD_VALUE': {
        if (state.phase !== GamePhase.CurseGoldMatch) return false;
        if (state.pendingGoldMatchQueue?.[0] !== playerId) return false;
        const p = getPlayer(state, playerId)!;
        const target = state.pendingGoldMatchTarget ?? 0;
        const selected = action.cardIds.map(id => p.equipped.find(c => c.id === id)).filter(Boolean) as typeof p.equipped;
        if (selected.length !== action.cardIds.length) return false;
        return selected.reduce((sum, c) => sum + (c.goldValue ?? 0), 0) >= target;
      }

      case 'DISCARD_ITEMS_FOR_GOLD': {
        if (!isActivePlayer || state.phase !== GamePhase.BadStuffGoldDiscard) return false;
        const p = getPlayer(state, playerId)!;
        const required = state.pendingGoldDiscardRequired ?? 0;
        const selected = action.cardIds.map(id => p.equipped.find(c => c.id === id)).filter(Boolean) as typeof p.equipped;
        if (selected.length !== action.cardIds.length) return false;
        const total = selected.reduce((sum, c) => sum + (c.goldValue ?? 0), 0);
        return total >= required;
      }

      case 'DISCARD_PRE_COMBAT_ITEM': {
        if (!isActivePlayer || state.phase !== GamePhase.PreCombatDiscard) return false;
        const p = getPlayer(state, playerId)!;
        return p.equipped.some(c => c.id === action.cardId);
      }

      case 'PRIEST_CLAIM_TREASURE': {
        if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        if (!state.currentMonster?.priestCanClaimTreasure) return false;
        const p = getPlayer(state, playerId)!;
        return playerClasses(p).includes('cleric');
      }

      case 'WIZARD_CHARM': {
        if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
        const p = getPlayer(state, playerId)!;
        if (!p.equipped.some(c => c.classCharmMonster)) return false;
        if (p.hand.length < 3) return false;
        const allMonsters = [state.currentMonster!, ...(state.additionalMonsters ?? [])];
        return allMonsters.some(m => m.id === action.targetMonsterId);
      }

      case 'RESOLVE_CURSE':
        return isActivePlayer && state.phase === GamePhase.CurseReaction && state.pendingCurse != null;

      case 'RESOLVE_FLEE':
        return isActivePlayer && state.phase === GamePhase.FleeReaction;

      case 'RESOLVE_FLEE_SUCCESS':
        return isActivePlayer && state.phase === GamePhase.FleeSuccessReaction;

      case 'CHOOSE_VICTIM_ITEM': {
        if (state.phase !== GamePhase.NeighborItemRemoval) return false;
        if (state.neighborDiscardQueue?.[0] !== playerId) return false;
        const target = state.players.find(p => p.id === state.neighborDiscardTarget);
        if (!target) return false;
        if (state.neighborPickFromHandOnly) {
          return target.hand.some(c => c.id === action.targetItemId);
        }
        const inEquipped = target.equipped.some(c => c.id === action.targetItemId);
        const inHand = state.neighborPickIncludesHand
          ? target.hand.some(c => c.id === action.targetItemId)
          : false;
        return inEquipped || inHand;
      }

      case 'CHOOSE_CURSE_ITEM':
        return (
          (isActivePlayer || playerId === state.pendingCurseTarget) &&
          state.phase === GamePhase.CurseItemChoice &&
          (state.pendingCurseItemChoices?.includes(action.cardId) ?? false)
        );

      case 'SET_SUPER_MUNCHKIN_MODE': {
        const p = getPlayer(state, playerId)!;
        return p.equipped.some(c => c.isSuperMunchkin);
      }

      case 'SET_SANG_MELE_MODE': {
        const p = getPlayer(state, playerId)!;
        return p.equipped.some(c => c.isSangMele);
      }

      case 'DISCARD_ITEM_TO_FLEE': {
        if (!isActivePlayer) return false;
        if (state.phase !== GamePhase.MonsterFight && state.phase !== GamePhase.FleeReaction) return false;
        const monster = state.currentMonster;
        if (!monster?.autoFleeByItemTag?.length) return false;
        const p = getPlayer(state, playerId)!;
        const allItems = [...p.equipped, ...p.hand];
        const item = allItems.find(c => c.id === action.cardId);
        return item?.itemTags?.some(tag => monster.autoFleeByItemTag!.includes(tag)) ?? false;
      }

      case 'RETRY_FLEE': {
        if (!isActivePlayer || state.phase !== GamePhase.FleeReaction) return false;
        const p = getPlayer(state, playerId)!;
        const hasRetry = p.equipped.some(c => c.raceFleeRetry);
        return hasRetry && p.hand.some(c => c.id === action.discardedCardId);
      }

      case 'RESOLVE_DIE_ROLL_LOSS': {
        if (state.phase !== GamePhase.BadStuffDieRollLoss) return false;
        if (!isActivePlayer) return false;
        const p = getPlayer(state, playerId)!;
        const count = state.pendingDieRollLossCount ?? 0;
        if (action.cardIds.length !== Math.min(count, action.source === 'equipped' ? p.equipped.length : p.hand.length)) return false;
        const ids = new Set(action.cardIds);
        if (action.source === 'equipped') return action.cardIds.every(id => p.equipped.some(c => c.id === id));
        return action.cardIds.every(id => p.hand.some(c => c.id === id));
      }

      case 'SELL_ITEMS': {
        const combatPhases: GamePhase[] = [
          GamePhase.MonsterFight, GamePhase.FleeReaction, GamePhase.ForcedFlee,
          GamePhase.FleeSuccessReaction, GamePhase.CurseReaction, GamePhase.NeighborItemRemoval,
        ];
        if (combatPhases.includes(state.phase)) return false;
        if (action.cardIds.length === 0) return false;
        const p = getPlayer(state, playerId)!;
        const allItems = [...p.equipped, ...p.hand];
        if (!action.cardIds.every(id => allItems.some(c => c.id === id))) return false;
        if (action.doubleCardId != null) {
          if (!action.cardIds.includes(action.doubleCardId)) return false;
          if (!p.equipped.some(c => c.raceDoubleSellFirst)) return false;
        }
        const items = action.cardIds.map(id => allItems.find(c => c.id === id)!);
        const totalGold = items.reduce((sum, item) => {
          const multiplier = item.id === action.doubleCardId ? 2 : 1;
          return sum + (item.goldValue ?? 0) * multiplier;
        }, 0);
        return totalGold >= 1000;
      }

      case 'PLAY_CARD': {
        const player = getPlayer(state, playerId);
        if (!player) return false;
        const card =
          player.hand.find(c => c.id === action.cardId) ??
          player.equipped.find(c => c.id === action.cardId);
        if (!card) return false;

        // requiresLoyalServantInPlay: the Loyal Servant (t-035) must be equipped by any player
        if (card.requiresLoyalServantInPlay) {
          if (!state.players.some(p => p.equipped.some(c => c.isLoyalServant))) return false;
        }

        // rawLevelOnly: block one-shot combat bonus cards (equipment and class bonuses are already stripped in resolveCombat)
        if (
          state.currentMonster?.rawLevelOnly &&
          card.type === CardType.Treasure &&
          card.isOneShot &&
          card.power != null &&
          state.phase === GamePhase.MonsterFight
        ) return false;

        // requiredRace applies to any card (equippable items have an additional check in their own block)
        if (card.requiredRace != null && playerRace(player) !== card.requiredRace) return false;

        // cancelsCurse cards can be played by any player during CurseReaction
        if (card.cancelsCurse) {
          return state.phase === GamePhase.CurseReaction && state.pendingCurse != null;
        }

        // autoFlee cards can be played by the active player during FleeReaction
        if (card.autoFlee) {
          return isActivePlayer && state.phase === GamePhase.FleeReaction;
        }

        // autoFleeEarly: playable during MonsterFight or FleeReaction
        if (card.autoFleeEarly) {
          return isActivePlayer &&
            (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.FleeReaction) &&
            state.currentMonster != null;
        }

        // rerollFlee cards can be played by any player during FleeSuccessReaction
        if (card.rerollFlee) {
          return state.phase === GamePhase.FleeSuccessReaction;
        }

        // chooseDiceAfterRoll: any player can play during FleeReaction (failed) or FleeSuccessReaction (success)
        if (card.chooseDiceAfterRoll) {
          return state.phase === GamePhase.FleeReaction || state.phase === GamePhase.FleeSuccessReaction;
        }

        // autoFleeThreshold: discard equipped/hand item during combat to flee if monster power ≤ threshold
        if (card.autoFleeThreshold != null) {
          return (
            isActivePlayer &&
            (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.FleeReaction) &&
            state.currentMonster != null &&
            (state.currentMonster.power ?? 0) <= card.autoFleeThreshold
          );
        }

        // banishAndLoot: active player only, during MonsterFight
        if (card.banishAndLoot) {
          return isActivePlayer && state.phase === GamePhase.MonsterFight && state.currentMonster != null;
        }

        // Undead monster: any player can play it directly into the active combat (no d-059 needed)
        if (card.type === CardType.Monster && card.isUndead) {
          return state.phase === GamePhase.MonsterFight && state.currentMonster != null;
        }

        // addMonsterFromHand: any player during MonsterFight; action.targetId must be a Monster in player's hand
        if (card.addMonsterFromHand) {
          if (state.phase !== GamePhase.MonsterFight || state.currentMonster == null) return false;
          if (!action.targetId) return false;
          const addedMonster = player.hand.find(c => c.id === action.targetId);
          return addedMonster != null && addedMonster.type === CardType.Monster;
        }

        // banishMonster cards can be played during MonsterFight or FleeReaction by the active player
        if (card.banishMonster) {
          return (
            isActivePlayer &&
            (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.FleeReaction) &&
            state.currentMonster != null
          );
        }

        // searchDiscard cards require a valid card id present in one of the discard piles
        if (card.searchDiscard) {
          if (!isActivePlayer) return false;
          const { searchDiscardCardId } = action;
          if (!searchDiscardCardId) return false;
          return (
            state.discardDoor.some(c => c.id === searchDiscardCardId) ||
            state.discardTreasure.some(c => c.id === searchDiscardCardId)
          );
        }

        // transferCombat cards require a valid target during MonsterFight
        if (card.transferCombat) {
          if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
          const target = state.players.find(p => p.id === action.targetId);
          return target != null && target.id !== playerId;
        }

        // levelUpAllByClass: playable by any player at any time
        if (card.levelUpAllByClass) return true;

        // banishAllMonstersDrawTreasures: playable by any player during MonsterFight
        if (card.banishAllMonstersDrawTreasures != null) {
          return state.phase === GamePhase.MonsterFight && state.currentMonster != null;
        }

        // replacesMonsterInCombat: targetId = monster to replace, replacementCardId = monster from hand
        if (card.replacesMonsterInCombat) {
          if (state.phase !== GamePhase.MonsterFight) return false;
          const allMonsters = [state.currentMonster, ...(state.additionalMonsters ?? [])];
          if (!allMonsters.some(m => m?.id === action.targetId)) return false;
          if (!action.replacementCardId) return false;
          const p = getPlayer(state, playerId)!;
          return p.hand.some(c => c.id === action.replacementCardId && c.type === CardType.Monster);
        }

        // forcedHelper: active player, MonsterFight, target must have higher level than active player
        if (card.forcedHelper) {
          if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
          const target = state.players.find(p => p.id === action.targetId);
          return target != null && target.id !== playerId && target.level > player.level;
        }

        // bypassesItemRestrictions (d-088 Tricheur): attach to a restricted item to bypass class/race checks
        if (card.bypassesItemRestrictions) {
          if (!action.targetId) return false;
          const allItems = [...player.equipped, ...player.hand];
          const target = allItems.find(c => c.id === action.targetId);
          if (!target) return false;
          // Target must have at least one restriction the player doesn't meet
          const race = playerRace(player);
          const cls = playerClass(player);
          const hasRestriction =
            (target.requiredClass != null && target.requiredClass !== cls) ||
            (target.forbiddenClass != null && target.forbiddenClass === cls) ||
            (target.requiredRace != null && target.requiredRace !== race) ||
            (target.requiredNoRace === true && race != null);
          if (!hasRestriction) return false;
          // No existing bypass for this item
          return !player.equipped.some(c => c.bypassesItemRestrictions && c.attachedToItemId === action.targetId);
        }

        // Race, Class, and equippable items can be played at any time by any player (Munchkin rule)
        const isEquippable =
          card.type === CardType.Race ||
          card.type === CardType.Class ||
          (card.type === CardType.Treasure && card.power != null && !card.isOneShot && card.levelUp == null);
        if (isEquippable) {
          const classes = playerClasses(player);
          const races = playerRaces(player);
          const hasSuperMunchkin = player.equipped.some(c => c.isSuperMunchkin);
          const hasSangMele = player.equipped.some(c => c.isSangMele);
          const isSangMeleSuperMode = hasSangMele && player.sangMeleMode === 'super';
          if (card.requiredClass != null && !classes.includes(card.requiredClass)) return false;
          if (!hasSuperMunchkin && card.forbiddenClass != null && classes.includes(card.forbiddenClass)) return false;
          if (card.requiredRace != null && !races.includes(card.requiredRace)) return false;
          if (!isSangMeleSuperMode && card.forbiddenRace != null && races.includes(card.forbiddenRace)) return false;
          if (card.requiredNoRace && playerRace(player) !== 'human') return false;
          if (card.requiredCurrentGender != null && player.gender !== card.requiredCurrentGender) return false;
          // Race card: max 1 normally; max 2 with Sang-mêlé
          if (card.type === CardType.Race) {
            const currentRaceCount = player.equipped.filter(c => c.type === CardType.Race).length;
            if (currentRaceCount >= 1 && !hasSangMele) return false;
            if (currentRaceCount >= 2) return false;
          }
          if (card.handUsage != null) {
            const replaceIds = new Set(action.replaceEquippedIds ?? []);
            const handsAfterRemoval = player.equipped.reduce(
              (sum, c) => sum + (replaceIds.has(c.id) ? 0 : (c.handUsage ?? 0)),
              0,
            );
            if (handsAfterRemoval + card.handUsage > 2) return false;
          }
          // Big-item limit: max 1, +1 per extraBigItemSlot; bypassed if raceUnlimitedBigItems
          if (card.isBigItem && !player.equipped.some(c => c.raceUnlimitedBigItems)) {
            const extraSlots = player.equipped.filter(c => c.extraBigItemSlot).length;
            const currentBigItems = player.equipped.filter(c => c.isBigItem).length;
            if (currentBigItems >= 1 + extraSlots) return false;
          }
          return true;
        }

        // discardForAutoFlee: discard companion (from equipped) during combat to flee any monster
        if (card.discardForAutoFlee) {
          if (!isActivePlayer) return false;
          if (
            state.phase !== GamePhase.MonsterFight &&
            state.phase !== GamePhase.FleeReaction
          ) return false;
          if (state.currentMonster == null) return false;
          // If player has a big item equipped (extra slot from this card), they must name it to sacrifice
          const bigItemsEquipped = player.equipped.filter(c => c.isBigItem);
          if (bigItemsEquipped.length >= 1 && !action.targetId) return false;
          return true;
        }

        // Blocked for the player who is at (or tied for) the highest level
        if (card.blockedIfLeading) {
          const maxLevel = Math.max(...state.players.map(p => p.level));
          if (player.level >= maxLevel) return false;
        }

        // After-combat-only cards can be played by any player during Loot or Charity phase
        if (card.afterCombatOnly) {
          return (
            state.phase === GamePhase.Loot ||
            state.phase === GamePhase.Charity
          );
        }

        // clonesCurrentMonster (d-071): any player may play during MonsterFight to clone the monster
        if (card.clonesCurrentMonster) {
          return state.phase === GamePhase.MonsterFight && state.currentMonster != null;
        }

        // Steal-item-if-win-condition (d-087): take one equipped item from another player during combat
        // Valid only if: stealing the item (after optional own-item discard) tips combat from loss to win
        if (card.stealItemIfWinCondition) {
          if (!isActivePlayer || state.phase !== GamePhase.MonsterFight) return false;
          if (!state.currentMonster) return false;
          const targetPlayer = state.players.find(p => p.id === action.targetPlayerId);
          if (!targetPlayer || targetPlayer.id === playerId) return false;
          const stolenItem = targetPlayer.equipped.find(c => c.id === action.targetId);
          if (!stolenItem) return false;
          // optional pre-discard: at most one own equipped item
          if (action.replaceEquippedIds && action.replaceEquippedIds.length > 1) return false;
          const discardId = action.replaceEquippedIds?.[0];
          if (discardId && !player.equipped.some(c => c.id === discardId)) return false;
          // build effective monster (including bonus cards from play zone)
          const mb87Power = (state.combatMonsterBonusCards ?? []).reduce((s, c2) => s + (c2.power ?? 0), 0);
          const eff87Monster = { ...state.currentMonster, power: (state.currentMonster.power ?? 0) + mb87Power };
          const bonus87Cards = state.combatBonusCards ?? [];
          // "before": equipped minus optional discard
          const equipped87Before = discardId
            ? player.equipped.filter(c => c.id !== discardId)
            : player.equipped;
          const player87Before = withCombatPower({ ...player, equipped: equipped87Before });
          const result87Before = CombatResolver.resolveCombat(player87Before, eff87Monster, [], bonus87Cards, [], false, 0, true);
          if (result87Before.winner === 'player') return false; // was already winning — card can't be played
          // "after": add stolen item
          const equipped87After = [...equipped87Before, stolenItem];
          const player87After = withCombatPower({ ...player, equipped: equipped87After });
          const result87After = CombatResolver.resolveCombat(player87After, eff87Monster, [], bonus87Cards, [], false, 0, true);
          return result87After.winner === 'player';
        }

        // Steal-level cards require a valid target (another player)
        if (card.stealLevel) {
          const target = state.players.find(p => p.id === action.targetId);
          return target != null && target.id !== playerId;
        }

        // DoorCurse played from hand on an explicit target — any player, open phases only
        if (card.type === CardType.DoorCurse && action.targetId) {
          const openPhases = new Set([
            GamePhase.KickDown, GamePhase.MonsterFight, GamePhase.Loot,
            GamePhase.Charity, GamePhase.EndTurn,
          ]);
          if (!openPhases.has(state.phase)) return false;
          const target = state.players.find(p => p.id === action.targetId);
          return target != null && !target.isDead;
        }

        // All other cards: active player or intervention during combat, in a valid play phase
        const validPhase =
          state.phase === GamePhase.KickDown ||
          state.phase === GamePhase.MonsterFight ||
          state.phase === GamePhase.Loot ||
          state.phase === GamePhase.Charity;
        return validPhase && (isActivePlayer || state.phase === GamePhase.MonsterFight);
      }

      case 'DONATE_CARD': {
        if (state.phase !== GamePhase.Charity || !isActivePlayer) return false;
        const player = getPlayer(state, playerId);
        if (!player) return false;
        const hasCard = player.hand.some(c => c.id === action.cardId);
        if (!hasCard) return false;
        // Dead players cannot receive cards
        const target = state.players.find(p => p.id === action.targetPlayerId);
        if (target?.isDead) return false;
        // Self-donate = discard: allowed when active player is at or below the lowest level among living players
        const livingOthers = state.players.filter(p => p.id !== playerId && !p.isDead);
        if (action.targetPlayerId === playerId) {
          if (livingOthers.length === 0) return true; // sole survivor → always discard
          const minLiving = Math.min(...livingOthers.map(p => p.level));
          return player.level <= minLiving;
        }
        // Donate to another player: target must be living and at the minimum level among living others
        if (livingOthers.length === 0) return false;
        const minLevel = Math.min(...livingOthers.map(p => p.level));
        return target != null && !target.isDead && target.level === minLevel;
      }

      case 'END_TURN': {
        if (!isActivePlayer || state.phase !== GamePhase.Charity) return false;
        const player = getPlayer(state, playerId);
        if (!player) return false;
        const handSizeBonus = player.equipped.reduce((sum, c) => sum + (c.raceHandSizeBonus ?? 0), 0);
        return player.hand.length <= 5 + handSizeBonus;
      }

      case 'GIVE_ITEM': {
        const combatPhases: GamePhase[] = [
          GamePhase.MonsterFight, GamePhase.FleeReaction, GamePhase.ForcedFlee,
          GamePhase.FleeSuccessReaction, GamePhase.BodyPillage,
        ];
        if (combatPhases.includes(state.phase)) return false;
        const giver = getPlayer(state, playerId);
        if (!giver) return false;
        const item = giver.equipped.find(c => c.id === action.itemId);
        if (!item) return false;
        if (item.type === CardType.Class || item.type === CardType.Race) return false;
        const target = getPlayer(state, action.targetPlayerId);
        return target != null && target.id !== playerId && !target.isDead;
      }

      case 'PICK_BODY_LOOT': {
        if (state.phase !== GamePhase.BodyPillage) return false;
        if (state.bodyPillagingQueue?.[0] !== playerId) return false;
        return state.bodyPillagingItems?.some(c => c.id === action.cardId) ?? false;
      }

      default:
        return false;
    }
  },

  applyAction(state: GameState, _playerId: string, action: GameAction): GameState {
    switch (action.type) {
      // ---------------------------------------------------------------
      case 'KICK_DOOR': {
        const { cards, deck, discard } = drawFromDoor(state.doorDeck, state.discardDoor, 1);
        const card = cards[0];
        if (!card) return state;

        const base = { ...state, doorDeck: deck, discardDoor: discard };
        const activePlayer = getPlayer(state, state.currentPlayerId)!;

        if (card.type === CardType.Monster) {
          return enterMonsterFight(base, card);
        }

        if (card.type === CardType.DoorCurse) {
          const isImmune = activePlayer.equipped.some(e => e.immuneToDoorCurse);
          if (isImmune) {
            return { ...base, phase: GamePhase.Loot, discardDoor: [...base.discardDoor, card] };
          }
          return { ...base, phase: GamePhase.CurseReaction, pendingCurse: card };
        }

        // Class / Race / Special / MonsterBooster go to active player's hand, revealed to all
        const updatedPlayer = { ...activePlayer, hand: [...activePlayer.hand, card] };
        return { ...updatePlayer(base, updatedPlayer), phase: GamePhase.Loot, lastRevealedCard: card };
      }

      // ---------------------------------------------------------------
      case 'LOOT_ROOM': {
        const { cards, deck, discard } = drawFromDoor(state.doorDeck, state.discardDoor, 1);
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const updatedPlayer = { ...activePlayer, hand: [...activePlayer.hand, ...cards] };
        return {
          ...updatePlayer(state, updatedPlayer),
          lastRevealedCard: cards[0],
          phase: GamePhase.Charity,
          doorDeck: deck,
          discardDoor: discard,
        };
      }

      // ---------------------------------------------------------------
      case 'PASS_LOOT':
        return { ...state, phase: GamePhase.Charity };

      // ---------------------------------------------------------------
      case 'LOOK_FOR_TROUBLE': {
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const monster = activePlayer.hand.find(c => c.id === action.monsterId);
        if (!monster || monster.type !== CardType.Monster) return state;
        const updatedPlayer = {
          ...activePlayer,
          hand: activePlayer.hand.filter(c => c.id !== action.monsterId),
        };
        return enterMonsterFight(updatePlayer(state, updatedPlayer), monster);
      }

      // ---------------------------------------------------------------
      case 'FIGHT_MONSTER': {
        const { helperIds, bonusCardIds } = action;
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const forcedHelperIds = state.forcedHelperId
          ? [...new Set([...helperIds, state.forcedHelperId])]
          : helperIds;
        const helpers = state.players.filter(p => forcedHelperIds.includes(p.id));
        // Priest Turning: discard up to 3 hand cards for +3 each vs undead
        const turningIds = new Set(action.priestTurningIds ?? []);
        const turningCards = activePlayer.hand.filter(c => turningIds.has(c.id));
        const turningBonus = turningCards.length * 3;
        const turningDoor = turningCards.filter(c => c.type !== CardType.Treasure);
        const turningTreasure = turningCards.filter(c => c.type === CardType.Treasure);

        // Warrior Berserker Rage: discard up to 3 hand cards for +1 each
        const berserkerIds = new Set(action.warriorBerserkerIds ?? []);
        const berserkerCards = activePlayer.hand.filter(c => berserkerIds.has(c.id));
        const berserkerBonus = berserkerCards.length;
        const berserkerDoor = berserkerCards.filter(c => c.type !== CardType.Treasure);
        const berserkerTreasure = berserkerCards.filter(c => c.type === CardType.Treasure);

        const usedBonusIds = new Set(bonusCardIds);
        const handWithoutAll = activePlayer.hand.filter(
          c => !usedBonusIds.has(c.id) && !turningIds.has(c.id) && !berserkerIds.has(c.id),
        );

        const handBonusCards = activePlayer.hand.filter(c => bonusCardIds.includes(c.id));
        const stateBonusCards = state.combatBonusCards ?? [];
        const allBonusCards = [...stateBonusCards, ...handBonusCards];
        const monsterBonusCards = state.combatMonsterBonusCards ?? [];
        const monsterBonusPower = monsterBonusCards.reduce((sum, c) => sum + (c.power ?? 0), 0);
        const additionalMonsterPower = (state.additionalMonsters ?? []).reduce(
          (sum, m) => sum + (m.power ?? 0), 0,
        );
        const monster = {
          ...state.currentMonster!,
          power: Math.max(1, (state.currentMonster!.power ?? 0) + monsterBonusPower + additionalMonsterPower),
        };

        const hasPriestResurrection = activePlayer.equipped.some(c => c.classResurrection);
        const genderPenalty = activePlayer.nextCombatPenalty ?? 0;
        // d-052: no item bonus next combat — strip equipped to armor only, ignore one-shot bonus cards
        const combatPlayer = activePlayer.nextCombatNoItemBonus
          ? withCombatPower({ ...activePlayer, equipped: activePlayer.equipped.filter(c => c.equipSlot === 'armor') })
          : activePlayer;
        const combatBonusCards = activePlayer.nextCombatNoItemBonus ? [] : allBonusCards;
        // include race/class bonuses from additional monsters (e.g. d-071 clones current monster)
        const additionalMonsterRaceClassBonus = (state.additionalMonsters ?? []).reduce((sum, m) => {
          const raceBonus = playerRaces(combatPlayer).reduce((s, race) => s + (m.powerBonusVsRace?.[race] ?? 0), 0);
          const classBonus = playerClasses(combatPlayer).reduce((s, cls) => s + (m.powerBonusVsClass?.[cls] ?? 0), 0);
          return sum + raceBonus + classBonus;
        }, 0);
        const effectiveMonster = additionalMonsterRaceClassBonus > 0
          ? { ...monster, power: (monster.power ?? 0) + additionalMonsterRaceClassBonus }
          : monster;

        const { winner, playerGains, playerLoses, newTreasureDeck } =
          CombatResolver.resolveCombat(
            combatPlayer,
            effectiveMonster,
            helpers,
            combatBonusCards,
            state.treasureDeck,
            state.currentMonster!.rawLevelOnly,
            turningBonus + berserkerBonus - (state.combatBackstabPenalty ?? 0) - genderPenalty,
            hasPriestResurrection,
            state.currentMonster!.rawEquipOnly,
          );

        if (winner === 'player') {
          const extraMonsters = state.additionalMonsters ?? [];
          const allKilledMonsters = [state.currentMonster!, ...extraMonsters];

          const baseKillLevels = allKilledMonsters.reduce((sum, m) => sum + (m.levelsOnKill ?? 1), 0);
          const fireKeywords = allKilledMonsters.flatMap(m => m.bonusLevelIfItemNameMatches ?? []);
          const fireBonus = fireKeywords.length > 0 && [...allBonusCards, ...turningCards, ...berserkerCards].some(
            c => fireKeywords.some(kw => c.name.toLowerCase().includes(kw.toLowerCase())),
          ) ? 1 : 0;
          // bonusLevelIfNoHelpersNoBonuses: +1 level if killed solo with no bonus cards
          const soloNoBonusBonus = allKilledMonsters.some(m => m.bonusLevelIfNoHelpersNoBonuses) &&
            helpers.length === 0 && allBonusCards.length === 0 && turningCards.length === 0 && berserkerCards.length === 0
            ? 1 : 0;
          const levelsGained = baseKillLevels + fireBonus + soloNoBonusBonus;
          const baseDiscardDoor = [...state.discardDoor, ...allKilledMonsters, ...turningDoor, ...berserkerDoor];
          const baseDiscardTreasure = [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure];
          const combatCleanup = {
            currentMonster: undefined as Card | undefined,
            additionalMonsters: undefined as Card[] | undefined,
            combatBonusCards: undefined as Card[] | undefined,
            combatMonsterBonusCards: undefined as Card[] | undefined,
            forcedHelperId: undefined as string | undefined,
            combatLevelCap: undefined as number | undefined,
            combatBackstabPenalty: undefined as number | undefined,
            backstabLog: undefined as { thiefId: string; victimId: string }[] | undefined,
          };

          // MonsterBooster treasure modifier (positive = extra, negative = fewer, e.g. d-004 Bébé)
          const bonusTreasureCount = monsterBonusCards.reduce(
            (sum, c) => sum + (c.bonusTreasuresIfDefeated ?? 0), 0,
          );

          if (hasPriestResurrection) {
            // Priest resurrection: defer treasure draw, enter PriestResurrection phase
            const baseTreasureCount = allKilledMonsters.reduce(
              (sum, m) => sum + CombatResolver.treasureCount(m), 0,
            );
            const totalTreasureCount = Math.max(1, baseTreasureCount + bonusTreasureCount);
            const playerAfterLevel = withCombatPower({
              ...activePlayer,
              level: Math.min(activePlayer.level + levelsGained, state.combatLevelCap ?? 10),
              hand: handWithoutAll,
              nextCombatPenalty: undefined,
              nextCombatNoItemBonus: undefined,
            });
            let nextState: GameState = updatePlayer(state, playerAfterLevel);
            for (const helper of helpers) {
              if (helper.equipped.some(c => c.raceHelperGainsLevelPerMonster)) {
                nextState = updatePlayer(nextState, withCombatPower({
                  ...helper, level: Math.min(helper.level + allKilledMonsters.length, 9),
                }));
              }
            }
            return {
              ...nextState,
              ...combatCleanup,
              phase: GamePhase.PriestResurrection,
              pendingTreasureCount: totalTreasureCount,
              treasureDeck: state.treasureDeck,
              discardDoor: baseDiscardDoor,
              discardTreasure: baseDiscardTreasure,
            };
          }

          // Non-priest: draw treasures normally
          let finalTreasureDeck = newTreasureDeck;
          let allGained = playerGains ?? [];
          if (extraMonsters.length > 0) {
            const extraCount = extraMonsters.reduce((sum, m) => sum + CombatResolver.treasureCount(m), 0);
            const { cards: extraGained, newDeck } = DeckManager.draw(
              finalTreasureDeck, Math.min(extraCount, finalTreasureDeck.length),
            );
            allGained = [...allGained, ...extraGained];
            finalTreasureDeck = newDeck;
          }
          if (bonusTreasureCount > 0) {
            const { cards: bonusGained, newDeck } = DeckManager.draw(
              finalTreasureDeck, Math.min(bonusTreasureCount, finalTreasureDeck.length),
            );
            allGained = [...allGained, ...bonusGained];
            finalTreasureDeck = newDeck;
          } else if (bonusTreasureCount < 0) {
            // remove treasures (keep minimum 1 total)
            const toRemove = Math.min(-bonusTreasureCount, Math.max(0, allGained.length - 1));
            if (toRemove > 0) {
              const putBack = allGained.slice(-toRemove);
              allGained = allGained.slice(0, allGained.length - toRemove);
              finalTreasureDeck = [...putBack, ...finalTreasureDeck];
            }
          }
          // bonusTreasureVsRace: extra treasures on kill if active player has matching race (e.g. d-073 Elves)
          const raceExtraTreasures = allKilledMonsters.reduce((sum, m) => {
            if (!m.bonusTreasureVsRace) return sum;
            return sum + playerRaces(activePlayer).reduce((s, race) => s + (m.bonusTreasureVsRace![race] ?? 0), 0);
          }, 0);
          if (raceExtraTreasures > 0) {
            const { cards: raceGained, newDeck } = DeckManager.draw(
              finalTreasureDeck, Math.min(raceExtraTreasures, finalTreasureDeck.length),
            );
            allGained = [...allGained, ...raceGained];
            finalTreasureDeck = newDeck;
          }

          const updatedActive = withCombatPower({
            ...activePlayer,
            level: Math.min(activePlayer.level + levelsGained, state.combatLevelCap ?? 10),
            hand: [...handWithoutAll, ...allGained],
            nextCombatPenalty: undefined,
            nextCombatNoItemBonus: undefined,
          });

          let nextState: GameState = updatePlayer(state, updatedActive);
          for (const helper of helpers) {
            if (helper.equipped.some(c => c.raceHelperGainsLevelPerMonster)) {
              nextState = updatePlayer(nextState, withCombatPower({
                ...helper, level: Math.min(helper.level + allKilledMonsters.length, 9),
              }));
            }
          }

          return {
            ...nextState,
            ...postCombatTransition(state),
            ...combatCleanup,
            treasureDeck: finalTreasureDeck,
            discardDoor: baseDiscardDoor,
            discardTreasure: baseDiscardTreasure,
          };
        }

        // Monster wins — apply bad stuff
        let levelDelta = playerLoses ?? -1;
        // badStuffLevelVsRace: race-specific level override
        if (state.currentMonster!.badStuffLevelVsRace) {
          for (const [race, delta] of Object.entries(state.currentMonster!.badStuffLevelVsRace)) {
            if (playerRaces(activePlayer).includes(race)) { levelDelta = delta!; break; }
          }
        }
        // badStuffDieRollDeathThreshold: roll a die — ≤ threshold = death, else = lose die result levels
        if (state.currentMonster!.badStuffDieRollDeathThreshold != null) {
          const roll = Math.ceil(Math.random() * 6);
          levelDelta = roll <= state.currentMonster!.badStuffDieRollDeathThreshold ? -99 : -roll;
        }
        const isDeath = levelDelta <= -99;

        const allDefeatedMonsters = [monster, ...(state.additionalMonsters ?? [])];

        const applyMonsterBadStuff = (p: Player, dead: boolean): Player => {
          if (state.currentMonster!.badStuffSetToLevel != null) {
            return { ...p, level: Math.max(1, state.currentMonster!.badStuffSetToLevel) };
          }
          if (state.currentMonster!.badStuffSetToMinLevel) {
            const minLevel = Math.min(...state.players.map(pl => pl.level));
            return { ...p, level: Math.min(p.level, minLevel) };
          }
          return applyLevelChange(p, levelDelta, dead);
        };

        if (isDeath) {
          const basePlayer = { ...activePlayer, hand: handWithoutAll, nextCombatPenalty: undefined, nextCombatNoItemBonus: undefined };
          // Apply level/special bad stuff ONLY to derive the new level; enterBodyPillage handles clearing equipped/hand
          const withBadStuffLevel = applyMonsterBadStuff(basePlayer, true);
          const preDeathPlayer = { ...basePlayer, level: withBadStuffLevel.level };
          return enterBodyPillage(
            state,
            preDeathPlayer,
            [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
            { combatBonusCards: undefined, combatMonsterBonusCards: undefined, forcedHelperId: undefined, combatLevelCap: undefined },
          );
        }

        const updatedPlayer = applyMonsterBadStuff(
          { ...activePlayer, hand: handWithoutAll, nextCombatPenalty: undefined, nextCombatNoItemBonus: undefined },
          false,
        );

        // badStuffHighestLevelPlayersPickItem: highest-level player(s) each take one equipped item
        if (state.currentMonster!.badStuffHighestLevelPlayersPickItem && updatedPlayer.equipped.length > 0) {
          const others = state.players.filter(p => p.id !== state.currentPlayerId);
          const maxLevel = Math.max(...others.map(p => p.level));
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const highestQueue = state.players
            .map((_, i) => state.players[(idx + 1 + i) % state.players.length]!)
            .filter(p => p.id !== state.currentPlayerId && p.level === maxLevel)
            .map(p => p.id)
            .slice(0, updatedPlayer.equipped.length);
          if (highestQueue.length > 0) {
            return {
              ...updatePlayer(state, updatedPlayer),
              phase: GamePhase.NeighborItemRemoval,
              discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
              combatBackstabPenalty: undefined,
              backstabLog: undefined,
              neighborDiscardTarget: state.currentPlayerId,
              neighborDiscardQueue: highestQueue,
              neighborPickGivesToPicker: true,
            };
          }
        }

        // badStuffAllPlayersPickItem: ALL other players (right first) each take one equipped/hand item
        if (state.currentMonster!.badStuffAllPlayersPickItem) {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const allOthers = state.players
            .map((_, i) => state.players[(idx + 1 + i) % state.players.length]!.id)
            .filter(id => id !== state.currentPlayerId);
          const victimItems = updatedPlayer.equipped.length + updatedPlayer.hand.length;
          const allPlayersQueue = allOthers.slice(0, victimItems);
          if (allPlayersQueue.length > 0) {
            return {
              ...updatePlayer(state, updatedPlayer),
              phase: GamePhase.NeighborItemRemoval,
              discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
              combatBackstabPenalty: undefined,
              backstabLog: undefined,
              neighborDiscardTarget: state.currentPlayerId,
              neighborDiscardQueue: allPlayersQueue,
              neighborPickIncludesHand: true,
              neighborPickGivesToPicker: true,
            };
          }
        }

        // badStuffNeighborsDiscard: neighbors each pick one equipped item to discard
        if (state.currentMonster!.badStuffNeighborsDiscard && updatedPlayer.equipped.length > 0) {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const prevId = state.players[(idx - 1 + state.players.length) % state.players.length]!.id;
          const nextId = state.players[(idx + 1) % state.players.length]!.id;
          const fullQueue = [prevId, nextId];
          // Cap queue to number of items available (each neighbor removes at most 1)
          const neighborQueue = fullQueue.slice(0, updatedPlayer.equipped.length);
          return {
            ...updatePlayer(state, updatedPlayer),
            phase: GamePhase.NeighborItemRemoval,
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            combatBackstabPenalty: undefined,
            backstabLog: undefined,
            neighborDiscardTarget: state.currentPlayerId,
            neighborDiscardQueue: neighborQueue,
          };
        }

        // badStuffHandToOthers: each other player (left to right) picks one card from victim's hand; rest discarded
        if (state.currentMonster!.badStuffHandToOthers && updatedPlayer.hand.length > 0) {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const n = state.players.length;
          const allOthers = Array.from({ length: n - 1 }, (_, i) => state.players[(idx + 1 + i) % n]!.id);
          const handToOthersQueue = allOthers.slice(0, updatedPlayer.hand.length);
          return {
            ...updatePlayer(state, updatedPlayer),
            phase: GamePhase.NeighborItemRemoval,
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            combatBackstabPenalty: undefined,
            backstabLog: undefined,
            neighborDiscardTarget: state.currentPlayerId,
            neighborDiscardQueue: handToOthersQueue,
            neighborPickFromHandOnly: true,
            neighborPickGivesToPicker: true,
          };
        }

        // badStuffGoldDiscard: player must discard equipped items worth N gold; if insufficient, lose all equipped + level
        if (state.currentMonster!.badStuffGoldDiscard != null) {
          const required = state.currentMonster!.badStuffGoldDiscard;
          const totalGold = updatedPlayer.equipped.reduce((sum, c) => sum + (c.goldValue ?? 0), 0);
          const combatDiscardBase = {
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
            currentMonster: undefined, additionalMonsters: undefined,
            combatBonusCards: undefined, combatMonsterBonusCards: undefined,
            combatBackstabPenalty: undefined, backstabLog: undefined,
          };
          if (totalGold >= required) {
            return { ...updatePlayer(state, updatedPlayer), ...combatDiscardBase, phase: GamePhase.BadStuffGoldDiscard, pendingGoldDiscardRequired: required };
          }
          // Can't afford: lose all equipped + level penalty
          const lostItems = [...updatedPlayer.equipped];
          const stripped = withCombatPower({ ...updatedPlayer, equipped: [] });
          const final = applyLevelChange(stripped, levelDelta, false);
          return { ...updatePlayer(state, final), ...combatDiscardBase, discardTreasure: [...combatDiscardBase.discardTreasure, ...lostItems] };
        }

        // badStuffDieRollItemLoss: roll a die, player loses that many equipped OR hand cards
        if (state.currentMonster!.badStuffDieRollItemLoss) {
          const dieRoll = Math.ceil(Math.random() * 6);
          return {
            ...updatePlayer(state, updatedPlayer),
            phase: GamePhase.BadStuffDieRollLoss,
            pendingDieRollLossCount: dieRoll,
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            combatBackstabPenalty: undefined,
            backstabLog: undefined,
          };
        }

        // badStuffLoseFootwearOrLevel: lose equipped footwear, or N levels if none
        if (state.currentMonster!.badStuffLoseFootwearOrLevel != null) {
          const footwear = updatedPlayer.equipped.find(c => c.equipSlot === 'footwear');
          if (footwear) {
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, new Set([footwear.id]));
            const cleansed = withCombatPower({ ...updatedPlayer, equipped: kept });
            return {
              ...updatePlayer(state, cleansed),
              ...postCombatTransition(state),
              discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor, ...detachedDoor],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure, footwear],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
            };
          }
          // No footwear — lose N levels instead
          const penalized = withCombatPower({ ...updatedPlayer, level: Math.max(1, updatedPlayer.level - state.currentMonster!.badStuffLoseFootwearOrLevel!) });
          return {
            ...updatePlayer(state, penalized),
            ...postCombatTransition(state),
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
          };
        }

        // badStuffLoseAllItemsAndHand: player loses all equipped items AND all hand cards
        if (state.currentMonster!.badStuffLoseAllItemsAndHand) {
          const allEquipped = [...updatedPlayer.equipped];
          const allHand = [...updatedPlayer.hand];
          const stripped = withCombatPower({ ...updatedPlayer, equipped: [], hand: [] });
          const lostDoor = allEquipped.filter(c => c.type !== CardType.Treasure);
          const lostTreasure = allEquipped.filter(c => c.type === CardType.Treasure);
          const handDoor = allHand.filter(c => c.type !== CardType.Treasure);
          const handTreasure = allHand.filter(c => c.type === CardType.Treasure);
          return {
            ...updatePlayer(state, stripped),
            ...postCombatTransition(state),
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor, ...lostDoor, ...handDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure, ...lostTreasure, ...handTreasure],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
          };
        }

        // badStuffDiscardHand: player discards entire hand, no level loss
        if (state.currentMonster!.badStuffDiscardHand) {
          const lostDoor = updatedPlayer.hand.filter(c => c.type !== CardType.Treasure);
          const lostTreasure = updatedPlayer.hand.filter(c => c.type === CardType.Treasure);
          const stripped = withCombatPower({ ...updatedPlayer, hand: [] });
          return {
            ...updatePlayer(state, stripped),
            ...postCombatTransition(state),
            discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor, ...lostDoor],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure, ...lostTreasure],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
          };
        }

        // badStuffLoseAllClasses: player loses ALL class cards; if no class → apply levelDelta (badStuffLevel)
        if (state.currentMonster!.badStuffLoseAllClasses) {
          const classCards = updatedPlayer.equipped.filter(c => c.type === CardType.Class);
          if (classCards.length > 0) {
            const classIds = new Set(classCards.map(c => c.id));
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, classIds);
            const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(kept);
            const stripped = withCombatPower({ ...updatedPlayer, equipped: afterSM, superMunchkinMode: undefined });
            return {
              ...updatePlayer(state, stripped),
              ...postCombatTransition(state),
              discardDoor: [
                ...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor,
                ...classCards, ...detachedDoor, ...(removedSuperMunchkin ? [removedSuperMunchkin] : []),
              ],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
            };
          }
          // no class → fall through to normal levelDelta path
        }

        // badStuffLoseAllRaceAndClass: player loses all Race and Class cards
        if (state.currentMonster!.badStuffLoseAllRaceAndClass) {
          const lostCards = updatedPlayer.equipped.filter(
            c => c.type === CardType.Race || c.type === CardType.Class ||
                 c.isSuperMunchkin || c.isSangMele,
          );
          if (lostCards.length > 0) {
            const lostIds = new Set(lostCards.map(c => c.id));
            const { kept } = splitAttachments(updatedPlayer.equipped, lostIds);
            const cleansed = withCombatPower({ ...updatedPlayer, equipped: kept, superMunchkinMode: undefined, sangMeleMode: undefined });
            const lostDoor = lostCards.filter(c => c.type !== CardType.Treasure);
            return {
              ...updatePlayer(state, cleansed),
              ...postCombatTransition(state),
              discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor, ...lostDoor],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
            };
          }
        }

        // badStuffLoseHeadgear: player loses their equipped headgear (level change from badStuffLevel)
        if (state.currentMonster!.badStuffLoseHeadgear) {
          const headgear = updatedPlayer.equipped.find(c => c.equipSlot === 'headgear');
          if (headgear) {
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, new Set([headgear.id]));
            const stripped = withCombatPower({ ...updatedPlayer, equipped: kept });
            return {
              ...updatePlayer(state, stripped),
              ...postCombatTransition(state),
              discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor, headgear, ...detachedDoor],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
            };
          }
        }

        // badStuffLoseArmorAndFootwear: player loses armor and footwear slots (if any)
        if (state.currentMonster!.badStuffLoseArmorAndFootwear) {
          const armorFoot = updatedPlayer.equipped.filter(
            c => c.equipSlot === 'armor' || c.equipSlot === 'footwear',
          );
          if (armorFoot.length > 0) {
            const removedIds = new Set(armorFoot.map(c => c.id));
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, removedIds);
            const stripped = withCombatPower({ ...updatedPlayer, equipped: kept });
            const lostTreasure = armorFoot.filter(c => c.type === CardType.Treasure);
            const lostDoor = armorFoot.filter(c => c.type !== CardType.Treasure);
            return {
              ...updatePlayer(state, stripped),
              ...postCombatTransition(state),
              discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor, ...lostDoor, ...detachedDoor],
              discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure, ...lostTreasure],
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
            };
          }
        }

        // badStuffLoseClassIfWizard: Wizard loses only their wizard class; non-Wizard dies (badStuffLevel: -99)
        if (state.currentMonster!.badStuffLoseClassIfWizard) {
          if (playerClasses(updatedPlayer).includes('wizard')) {
            const wizardCard = updatedPlayer.equipped.find(c => c.classId === 'wizard');
            if (wizardCard) {
              const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, new Set([wizardCard.id]));
              const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(kept);
              const stripped = withCombatPower({ ...updatedPlayer, equipped: afterSM });
              return {
                ...updatePlayer(state, stripped),
                ...postCombatTransition(state),
                discardDoor: [
                  ...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor,
                  wizardCard, ...detachedDoor,
                  ...(removedSuperMunchkin ? [removedSuperMunchkin] : []),
                ],
                discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
                currentMonster: undefined,
                additionalMonsters: undefined,
                combatBonusCards: undefined,
                combatMonsterBonusCards: undefined,
              };
            }
          }
          // Non-wizard: death is handled by the standard levelDelta = -99 path below
        }

        return {
          ...updatePlayer(state, updatedPlayer),
          ...postCombatTransition(state),
          discardDoor: [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
          discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
          currentMonster: undefined,
          additionalMonsters: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          combatBackstabPenalty: undefined,
          backstabLog: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'RUN_AWAY': {
        const monster = state.currentMonster!;
        const activeRunner = getPlayer(state, state.currentPlayerId)!;

        // Wizard flee boost: discard up to 3 cards for +1 each
        const wizardDiscardIds = new Set(action.wizardDiscardIds ?? []);
        const wizardDiscarded = activeRunner.hand.filter(c => wizardDiscardIds.has(c.id));
        const wizardBoost = wizardDiscarded.length;
        const runnerAfterBoost = wizardBoost > 0
          ? withCombatPower({ ...activeRunner, hand: activeRunner.hand.filter(c => !wizardDiscardIds.has(c.id)) })
          : activeRunner;
        const wizardDiscardedTreasure = wizardDiscarded.filter(c => c.type === CardType.Treasure);
        const wizardDiscardedDoor = wizardDiscarded.filter(c => c.type !== CardType.Treasure);

        const monsterFleeBonus = state.currentMonster?.monsterFleeBonus ?? 0;
        const equippedFleeBonus = activeRunner.equipped.reduce(
          (sum, c) => sum + (c.fleeBonus ?? 0) + (c.dieRollPenalty ?? 0),
          wizardBoost + monsterFleeBonus,
        );
        const noChaseThreshold = monster.noChaseIfLevelBelow;
        const isNoChaseException = monster.noChaseExceptionRace != null &&
          playerRaces(activeRunner).includes(monster.noChaseExceptionRace);
        const autoEscape = (noChaseThreshold != null && !isNoChaseException && activeRunner.level <= noChaseThreshold)
          || (monster.autoFleeSuccess === true);
        const escaped = autoEscape || action.dieRoll + equippedFleeBonus >= 5;

        const runBonusCards = state.combatBonusCards ?? [];
        const runMonsterBonusCards = state.combatMonsterBonusCards ?? [];
        const allRunBonusCards = [...runBonusCards, ...runMonsterBonusCards];
        const baseState = wizardBoost > 0 ? updatePlayer(state, runnerAfterBoost) : state;
        const baseDiscardTreasure = [...(baseState.discardTreasure), ...wizardDiscardedTreasure];
        const baseDiscardDoor = [...(baseState.discardDoor), ...wizardDiscardedDoor];

        if (escaped) {
          const monsterPenalty = fleeSuccessPenaltyFor(monster, activeRunner.level);
          const remainingMonsters = state.additionalMonsters ?? [];
          if (remainingMonsters.length > 0) {
            // Fled currentMonster successfully, must still flee each additional monster
            const [nextMonster, ...rest] = remainingMonsters;
            return {
              ...baseState,
              currentMonster: nextMonster,
              additionalMonsters: rest.length > 0 ? rest : undefined,
              phase: GamePhase.ForcedFlee,
              discardDoor: [...baseDiscardDoor, monster],
              discardTreasure: baseDiscardTreasure,
              pendingFleePenalty: (state.pendingFleePenalty ?? 0) + monsterPenalty,
              pendingDiceChooserPlayerId: undefined,
            };
          }
          return {
            ...baseState,
            ...fleeSuccess(),
            discardTreasure: [...baseDiscardTreasure, ...allRunBonusCards],
            discardDoor: baseDiscardDoor,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + monsterPenalty,
            pendingDiceChooserPlayerId: undefined,
          };
        }

        // Failed flee roll — enter FleeReaction to allow auto-flee cards before bad stuff
        return {
          ...baseState,
          phase: GamePhase.FleeReaction,
          discardTreasure: [...baseDiscardTreasure, ...allRunBonusCards],
          discardDoor: baseDiscardDoor,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          pendingDiceChooserPlayerId: undefined,
          pendingFleePenalty: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'PLAY_CARD': {
        const player = getPlayer(state, _playerId)!;
        const cardInHand = player.hand.find(c => c.id === action.cardId);
        const cardInEquipped = player.equipped.find(c => c.id === action.cardId);
        const card = cardInHand ?? cardInEquipped;
        if (!card) return state;

        const handWithout = player.hand.filter(c => c.id !== action.cardId);
        const equippedWithout = player.equipped.filter(c => c.id !== action.cardId);

        // Search-discard one-shot: take a chosen card from a discard pile into hand
        if (card.searchDiscard && action.searchDiscardCardId) {
          const picked =
            state.discardDoor.find(c => c.id === action.searchDiscardCardId) ??
            state.discardTreasure.find(c => c.id === action.searchDiscardCardId);
          if (!picked) return state;
          const updatedPlayer = { ...player, hand: [...handWithout, picked] };
          return {
            ...updatePlayer(state, updatedPlayer),
            discardDoor: state.discardDoor.filter(c => c.id !== picked.id),
            discardTreasure: [
              ...state.discardTreasure.filter(c => c.id !== picked.id),
              card,
            ],
          };
        }

        // ForcedHelper one-shot: register forced helper, suppress active player's level gain on win
        if (card.forcedHelper && action.targetId) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            discardTreasure: [...state.discardTreasure, card],
            forcedHelperId: action.targetId,
            combatLevelCap: 9,
          };
        }

        // bypassesItemRestrictions (d-088): attach to a restricted item; if item is in hand, also equip it
        if (card.bypassesItemRestrictions && action.targetId) {
          const attachment = { ...card, attachedToItemId: action.targetId };
          const targetInEquipped = player.equipped.find(c => c.id === action.targetId);
          if (targetInEquipped) {
            // Item already equipped — just add the attachment card
            return updatePlayer(state, withCombatPower({
              ...player,
              hand: handWithout,
              equipped: [...player.equipped, attachment],
            }));
          }
          // Item is in hand — equip it alongside the attachment (restrictions bypassed)
          const targetItem = player.hand.find(c => c.id === action.targetId)!;
          const handWithoutBoth = player.hand.filter(c => c.id !== card.id && c.id !== targetItem.id);
          const toDiscard: Card[] = [];
          if (targetItem.equipSlot != null) {
            toDiscard.push(...player.equipped.filter(c => c.equipSlot === targetItem.equipSlot));
          }
          if (action.replaceEquippedIds?.length) {
            const replaceIds = new Set(action.replaceEquippedIds);
            const discardIds = new Set(toDiscard.map(c => c.id));
            toDiscard.push(...player.equipped.filter(c => replaceIds.has(c.id) && !discardIds.has(c.id)));
          }
          const discardIds = new Set(toDiscard.map(c => c.id));
          const { kept: keptEquipped, detachedDoor } = splitAttachments(player.equipped, discardIds);
          return {
            ...updatePlayer(state, withCombatPower({
              ...player,
              hand: handWithoutBoth,
              equipped: [...keptEquipped, targetItem, attachment],
            })),
            discardTreasure: toDiscard.length > 0
              ? [...state.discardTreasure, ...toDiscard]
              : state.discardTreasure,
            discardDoor: detachedDoor.length > 0
              ? [...state.discardDoor, ...detachedDoor]
              : state.discardDoor,
          };
        }

        // Undead monster played directly into active combat (no Special card needed)
        if (card.type === CardType.Monster && card.isUndead && state.currentMonster != null) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            additionalMonsters: [...(state.additionalMonsters ?? []), card],
          };
        }

        // clonesCurrentMonster (d-071): clone the current monster — same power + bonuses, doubled rewards
        if (card.clonesCurrentMonster && state.currentMonster) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            additionalMonsters: [...(state.additionalMonsters ?? []), state.currentMonster],
            discardDoor: [...state.discardDoor, card],
          };
        }

        // addMonsterFromHand: play a monster from hand into the combat, powers add together
        if (card.addMonsterFromHand && action.targetId) {
          const addedMonster = player.hand.find(c => c.id === action.targetId);
          if (!addedMonster) return state;
          const handWithoutMonster = handWithout.filter(c => c.id !== action.targetId);
          return {
            ...updatePlayer(state, { ...player, hand: handWithoutMonster }),
            additionalMonsters: [...(state.additionalMonsters ?? []), addedMonster],
            discardDoor: [...state.discardDoor, card],
          };
        }

        // levelUpAllByClass: all players with classId gain +1 level
        if (card.levelUpAllByClass) {
          let nextState = updatePlayer(state, withCombatPower({ ...player, hand: handWithout }));
          for (const p of state.players) {
            if (p.equipped.some(c => c.classId === card.levelUpAllByClass)) {
              nextState = updatePlayer(nextState, withCombatPower({ ...p, level: Math.min(p.level + 1, 10) }));
            }
          }
          return { ...nextState, discardDoor: [...state.discardDoor, card] };
        }

        // banishAllMonstersDrawTreasures: discard all monsters, active player draws N treasures, no level
        if (card.banishAllMonstersDrawTreasures != null) {
          const allMonsters = [state.currentMonster!, ...(state.additionalMonsters ?? [])];
          const monsterBonusDiscards = state.combatMonsterBonusCards ?? [];
          const { cards: gained, newDeck } = DeckManager.draw(
            state.treasureDeck,
            Math.min(card.banishAllMonstersDrawTreasures, state.treasureDeck.length),
          );
          const activeP = getPlayer(state, state.currentPlayerId)!;
          const updatedActiveP = withCombatPower({ ...activeP, hand: [...activeP.hand.filter(c => c.id !== card.id), ...gained] });
          return {
            ...updatePlayer(state, updatedActiveP),
            ...postCombatTransition(state),
            treasureDeck: newDeck,
            discardDoor: [...state.discardDoor, card, ...allMonsters, ...monsterBonusDiscards],
            discardTreasure: [...state.discardTreasure, ...(state.combatBonusCards ?? [])],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
          };
        }

        // replacesMonsterInCombat: discard target monster (+its modifiers if current), replace with hand monster
        if (card.replacesMonsterInCombat && action.targetId && action.replacementCardId) {
          const p = getPlayer(state, _playerId)!;
          const replacementMonster = p.hand.find(c => c.id === action.replacementCardId)!;
          const handWithoutBoth = p.hand.filter(
            c => c.id !== card.id && c.id !== action.replacementCardId,
          );
          const updatedPlayer = withCombatPower({ ...p, hand: handWithoutBoth });

          if (state.currentMonster?.id === action.targetId) {
            // Replace currentMonster — discard it and all its monster bonus cards
            const discardedMonster = state.currentMonster;
            const monsterBonusDiscards = state.combatMonsterBonusCards ?? [];
            return {
              ...updatePlayer(state, updatedPlayer),
              currentMonster: replacementMonster,
              combatMonsterBonusCards: undefined,
              discardDoor: [...state.discardDoor, card, discardedMonster, ...monsterBonusDiscards],
            };
          }
          // Replace an additional monster
          const newAdditional = (state.additionalMonsters ?? []).map(
            m => m.id === action.targetId ? replacementMonster : m,
          );
          const discardedAdditional = state.additionalMonsters!.find(m => m.id === action.targetId)!;
          return {
            ...updatePlayer(state, updatedPlayer),
            additionalMonsters: newAdditional,
            discardDoor: [...state.discardDoor, card, discardedAdditional],
          };
        }

        // Transfer-combat one-shot: swap currentPlayerId to target, save original for post-combat Loot
        if (card.transferCombat && action.targetId) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            currentPlayerId: action.targetId,
            transferOriginalPlayerId: _playerId,
            discardTreasure: [...state.discardTreasure, card],
          };
        }

        // banishAndLoot: banish all monsters (no level, no treasures), player can open/loot the room (back to KickDown)
        if (card.banishAndLoot && state.currentMonster) {
          const monster = state.currentMonster;
          const allCombatBonusCards = [
            ...(state.combatBonusCards ?? []),
            ...(state.combatMonsterBonusCards ?? []),
          ];
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            phase: GamePhase.KickDown,
            discardDoor: [...state.discardDoor, monster, ...(state.additionalMonsters ?? [])],
            discardTreasure: [...state.discardTreasure, card, ...allCombatBonusCards],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        // Banish-monster one-shot: monster disappears, player gets treasures but no level
        if (card.banishMonster && state.currentMonster) {
          const monster = state.currentMonster;
          const count = monster.treasuresOnKill ?? (monster.power != null && monster.power >= 8 ? 2 : 1);
          const { cards: gained, newDeck: newTreasureDeck } = DeckManager.draw(
            state.treasureDeck,
            Math.min(count, state.treasureDeck.length),
          );
          const updatedPlayer = { ...player, hand: [...handWithout, ...gained] };
          const allCombatBonusCards = [
            ...(state.combatBonusCards ?? []),
            ...(state.combatMonsterBonusCards ?? []),
          ];
          return {
            ...updatePlayer(state, updatedPlayer),
            ...postCombatTransition(state),
            treasureDeck: newTreasureDeck,
            discardDoor: [...state.discardDoor, monster, ...(state.additionalMonsters ?? [])],
            discardTreasure: [...state.discardTreasure, card, ...allCombatBonusCards],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        // discardForAutoFlee: discard companion from equipped, sacrifice a big item if named, flee
        if (card.discardForAutoFlee && state.currentMonster != null) {
          const monster = state.currentMonster;
          const allCombatBonus = [
            ...(state.combatBonusCards ?? []),
            ...(state.combatMonsterBonusCards ?? []),
          ];
          const sacrificedId = action.type === 'PLAY_CARD' ? action.targetId : undefined;
          const newEquipped = equippedWithout.filter(c => c.id !== sacrificedId);
          const sacrificedCard = sacrificedId
            ? player.equipped.find(c => c.id === sacrificedId)
            : undefined;
          return {
            ...updatePlayer(state, { ...player, hand: handWithout, equipped: newEquipped }),
            ...fleeSuccess(),
            discardTreasure: [
              ...state.discardTreasure,
              card,
              ...(sacrificedCard ? [sacrificedCard] : []),
              ...allCombatBonus,
            ],
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            additionalMonsters: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (state.currentMonster ? fleeSuccessPenaltyFor(state.currentMonster, getPlayer(state, state.currentPlayerId)!.level) : 0),
          };
        }

        // autoFleeThreshold: discard equipped/hand item to flee if monster power ≤ threshold
        if (
          card.autoFleeThreshold != null &&
          state.currentMonster != null &&
          (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.FleeReaction)
        ) {
          const monster = state.currentMonster;
          const allCombatBonus = [
            ...(state.combatBonusCards ?? []),
            ...(state.combatMonsterBonusCards ?? []),
          ];
          return {
            ...updatePlayer(state, { ...player, hand: handWithout, equipped: equippedWithout }),
            ...fleeSuccess(),
            discardTreasure: [...state.discardTreasure, card, ...allCombatBonus],
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            additionalMonsters: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + fleeSuccessPenaltyFor(monster, getPlayer(state, state.currentPlayerId)!.level),
          };
        }

        // rerollFlee one-shot: any player plays during FleeSuccessReaction — forces the fleeing player to re-roll
        if (card.rerollFlee && state.phase === GamePhase.FleeSuccessReaction) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            phase: GamePhase.ForcedFlee,
            discardTreasure: [...state.discardTreasure, card],
          };
        }

        // chooseDiceAfterRoll: any player plays during FleeReaction or FleeSuccessReaction — card player chooses die result
        if (card.chooseDiceAfterRoll &&
            (state.phase === GamePhase.FleeReaction || state.phase === GamePhase.FleeSuccessReaction)) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            phase: GamePhase.ForcedFlee,
            pendingDiceChooserPlayerId: _playerId,
            discardTreasure: [...state.discardTreasure, card],
          };
        }

        // Auto-flee one-shot: played after a failed flee roll — player escapes, enters FleeSuccessReaction
        if (card.autoFlee && state.phase === GamePhase.FleeReaction) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            ...fleeSuccess(),
            discardTreasure: [...state.discardTreasure, card],
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (state.currentMonster ? fleeSuccessPenaltyFor(state.currentMonster, getPlayer(state, state.currentPlayerId)!.level) : 0),
          };
        }

        // autoFleeEarly: escape from MonsterFight or FleeReaction without rolling and without bad stuff
        if (card.autoFleeEarly && (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.FleeReaction)) {
          const monster = state.currentMonster!;
          const penalty = fleeSuccessPenaltyFor(monster, player.level);
          const updatedP = penalty > 0
            ? withCombatPower({ ...player, hand: handWithout, level: Math.max(1, player.level - penalty) })
            : withCombatPower({ ...player, hand: handWithout });
          return {
            ...updatePlayer(state, updatedP),
            ...postCombatTransition(state),
            phase: GamePhase.Loot,
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
            pendingFleePenalty: undefined,
            discardDoor: [...state.discardDoor, monster, ...(state.additionalMonsters ?? [])],
            discardTreasure: [...state.discardTreasure, card, ...(state.combatBonusCards ?? []), ...(state.combatMonsterBonusCards ?? [])],
          };
        }

        // Cancel-curse one-shot: discard both the card and the pending curse, continue to Loot
        if (card.cancelsCurse && state.pendingCurse) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            phase: GamePhase.Loot,
            pendingCurse: undefined,
            discardTreasure: [...state.discardTreasure, card],
            discardDoor: [...state.discardDoor, state.pendingCurse],
          };
        }

        // stealItemIfWinCondition (d-087): take one equipped item from another player during combat
        if (card.stealItemIfWinCondition) {
          const targetPlayer = getPlayer(state, action.targetPlayerId!)!;
          const stolenItem = targetPlayer.equipped.find(c => c.id === action.targetId)!;
          const discardId = action.replaceEquippedIds?.[0];

          // Remove stolen item from target player (handle attachments)
          const { kept: targetKept, detachedDoor: targetDetached } = splitAttachments(
            targetPlayer.equipped, new Set([stolenItem.id]),
          );
          let nextState = updatePlayer(state, withCombatPower({ ...targetPlayer, equipped: targetKept }));
          if (targetDetached.length > 0) {
            nextState = { ...nextState, discardDoor: [...nextState.discardDoor, ...targetDetached] };
          }

          // Optionally discard own item first
          let ownEquipped = player.equipped.filter(c => c.id !== action.cardId);
          if (discardId) {
            const { kept: ownKept, detachedDoor: ownDetached } = splitAttachments(ownEquipped, new Set([discardId]));
            const discardedOwn = ownEquipped.find(c => c.id === discardId)!;
            ownEquipped = ownKept;
            const discardPile = discardedOwn.type === CardType.Treasure ? 'discardTreasure' : 'discardDoor';
            nextState = { ...nextState, [discardPile]: [...nextState[discardPile], discardedOwn] };
            if (ownDetached.length > 0) {
              nextState = { ...nextState, discardDoor: [...nextState.discardDoor, ...ownDetached] };
            }
          }

          // Add stolen item to own equipped
          const newEquipped = [...ownEquipped, stolenItem];
          const updatedSelf = withCombatPower({ ...player, hand: handWithout, equipped: newEquipped });
          nextState = updatePlayer(nextState, updatedSelf);
          return { ...nextState, discardDoor: [...nextState.discardDoor, card] };
        }

        // Steal-level one-shot: active player gains 1 level, target loses 1
        if (card.type === CardType.Treasure && card.stealLevel) {
          const target = action.targetId ? getPlayer(state, action.targetId) : undefined;
          if (!target || target.id === _playerId) return state;
          let nextState = updatePlayer(state, withCombatPower({
            ...player,
            hand: handWithout,
            level: Math.min(9, player.level + 1),
          }));
          nextState = updatePlayer(nextState, withCombatPower({
            ...target,
            level: Math.max(1, target.level - 1),
          }));
          return { ...nextState, discardTreasure: [...state.discardTreasure, card] };
        }

        // Level-up cards (discard, grant level)
        if (card.type === CardType.Treasure && card.levelUp != null) {
          const updatedPlayer = withCombatPower({
            ...player,
            hand: handWithout,
            level: Math.min(9, player.level + card.levelUp),
          });
          let stateAfterLevel = updatePlayer(state, updatedPlayer);
          let extraDiscardTreasure: Card[] = [];

          // discardLoyalServantOnPlay: find and remove the Loyal Servant from whoever has it
          if (card.discardLoyalServantOnPlay) {
            for (const p of stateAfterLevel.players) {
              const servant = p.equipped.find(c => c.isLoyalServant);
              if (servant) {
                const { kept, detachedDoor } = splitAttachments(p.equipped, new Set([servant.id]));
                const updP = withCombatPower({ ...p, equipped: kept });
                stateAfterLevel = updatePlayer(stateAfterLevel, updP);
                extraDiscardTreasure = [servant];
                if (detachedDoor.length > 0) {
                  stateAfterLevel = { ...stateAfterLevel, discardDoor: [...stateAfterLevel.discardDoor, ...detachedDoor] };
                }
                break;
              }
            }
          }

          return {
            ...stateAfterLevel,
            discardTreasure: [...stateAfterLevel.discardTreasure, card, ...extraDiscardTreasure],
          };
        }

        // Instant-kill one-shot: player wins combat immediately (treasures + level), if current monster matches
        if (
          card.instantKillMonsters != null &&
          state.phase === GamePhase.MonsterFight &&
          state.currentMonster != null &&
          card.instantKillMonsters.includes(state.currentMonster.id)
        ) {
          const monster = state.currentMonster;
          const allCombatBonus = [
            ...(state.combatBonusCards ?? []),
            ...(state.combatMonsterBonusCards ?? []),
          ];
          const levelsGained = monster.levelsOnKill ?? 1;
          const count = monster.treasuresOnKill ?? (monster.power != null && monster.power >= 8 ? 2 : 1);
          const { cards: gained, newDeck: newTreasureDeck } = DeckManager.draw(
            state.treasureDeck,
            Math.min(count, state.treasureDeck.length),
          );
          const activePlayer = getPlayer(state, state.currentPlayerId)!;
          const updatedActive = {
            ...activePlayer,
            hand: [...handWithout, ...gained],
            level: Math.min(activePlayer.level + levelsGained, state.combatLevelCap ?? 10),
          };
          return {
            ...updatePlayer(state, updatedActive),
            ...postCombatTransition(state),
            treasureDeck: newTreasureDeck,
            discardDoor: [...state.discardDoor, monster, ...(state.additionalMonsters ?? [])],
            discardTreasure: [...state.discardTreasure, card, ...allCombatBonus],
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        // One-shot combat bonus: accumulate in state during MonsterFight, resolved at FIGHT_MONSTER
        if (
          card.type === CardType.Treasure &&
          card.isOneShot &&
          card.power != null &&
          state.phase === GamePhase.MonsterFight
        ) {
          if (action.combatBeneficiary === 'monster') {
            return {
              ...updatePlayer(state, { ...player, hand: handWithout }),
              combatMonsterBonusCards: [...(state.combatMonsterBonusCards ?? []), card],
            };
          }
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            combatBonusCards: [...(state.combatBonusCards ?? []), card],
          };
        }

        // drawTreasuresOnPlay: draw N treasure cards face-down (hand) or face-up (equipped if equippable)
        if (card.drawTreasuresOnPlay != null) {
          const count = Math.min(card.drawTreasuresOnPlay, state.treasureDeck.length);
          const { cards: drawn, newDeck } = DeckManager.draw(state.treasureDeck, count);
          const faceUp = action.type === 'PLAY_CARD' && action.faceUp === true;
          let newHand = handWithout;
          let newEquipped = player.equipped;
          if (faceUp) {
            // Face-up: equippable items go to equipped, others to hand
            for (const c of drawn) {
              const canEquip =
                c.type === CardType.Treasure && c.power != null && !c.isOneShot && c.levelUp == null;
              if (canEquip) {
                newEquipped = [...newEquipped, c];
              } else {
                newHand = [...newHand, c];
              }
            }
          } else {
            newHand = [...newHand, ...drawn];
          }
          return {
            ...updatePlayer(state, { ...player, hand: newHand, equipped: newEquipped }),
            treasureDeck: newDeck,
            discardTreasure: [...state.discardTreasure, card],
          };
        }

        // One-shot items (potions, single-use): discard to treasure pile
        if (card.type === CardType.Treasure && card.isOneShot) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            discardTreasure: [...state.discardTreasure, card],
          };
        }

        // Equippable treasure (has a combat power value)
        if (card.type === CardType.Treasure && card.power != null) {
          if (card.requiredClass != null && playerClass(player) !== card.requiredClass) return state;
          if (card.forbiddenClass != null && playerClass(player) === card.forbiddenClass) return state;
          if (card.requiredRace != null && playerRace(player) !== card.requiredRace) return state;
          if (card.requiredNoRace && playerRace(player) != null) return state;
          if (card.requiredCurrentGender != null && player.gender !== card.requiredCurrentGender) return state;

          // Collect items to discard: same-slot replacement + explicit hand replacements
          const toDiscard: Card[] = [];
          if (card.equipSlot != null) {
            toDiscard.push(...player.equipped.filter(c => c.equipSlot === card.equipSlot));
          }
          if (action.replaceEquippedIds?.length) {
            const replaceIds = new Set(action.replaceEquippedIds);
            const discardIds = new Set(toDiscard.map(c => c.id));
            toDiscard.push(...player.equipped.filter(c => replaceIds.has(c.id) && !discardIds.has(c.id)));
          }

          const discardIds = new Set(toDiscard.map(c => c.id));
          if (card.handUsage != null) {
            const handsAfterRemoval = player.equipped.reduce(
              (sum, c) => sum + (discardIds.has(c.id) ? 0 : (c.handUsage ?? 0)),
              0,
            );
            if (handsAfterRemoval + card.handUsage > 2) return state;
          }

          const { kept: keptEquipped, detachedDoor } = splitAttachments(player.equipped, discardIds);
          const updatedPlayer = withCombatPower({
            ...player,
            hand: handWithout,
            equipped: [...keptEquipped, card],
          });
          return {
            ...updatePlayer(state, updatedPlayer),
            discardTreasure: toDiscard.length > 0
              ? [...state.discardTreasure, ...toDiscard]
              : state.discardTreasure,
            discardDoor: detachedDoor.length > 0
              ? [...state.discardDoor, ...detachedDoor]
              : state.discardDoor,
          };
        }

        // Class card: equip (replace, or add 2nd if Super Munchkin allows)
        if (card.type === CardType.Class) {
          const hasSuperMunchkin = player.equipped.some(c => c.isSuperMunchkin);
          const currentClasses = playerClasses(player);
          if (hasSuperMunchkin && currentClasses.length < 2) {
            // Add second class without replacing
            return {
              ...updatePlayer(state, withCombatPower({
                ...player, hand: handWithout,
                equipped: [...player.equipped, card],
                superMunchkinMode: player.superMunchkinMode ?? 'dual',
              })),
            };
          }
          // Replace: discard specified class if given, otherwise discard first class
          const replaceId = action.replaceEquippedIds?.[0];
          const toDiscard = replaceId
            ? player.equipped.find(c => c.id === replaceId)
            : player.equipped.find(c => c.type === CardType.Class);
          const newEquipped = toDiscard
            ? [...player.equipped.filter(c => c.id !== toDiscard.id), card]
            : [...player.equipped, card];
          return {
            ...updatePlayer(state, withCombatPower({ ...player, hand: handWithout, equipped: newEquipped })),
            discardDoor: toDiscard ? [...state.discardDoor, toDiscard] : state.discardDoor,
          };
        }

        // Race card: equip; if Sang-mêlé active, add without replacing existing race
        if (card.type === CardType.Race) {
          const hasSangMele = player.equipped.some(c => c.isSangMele);
          const currentRaces = player.equipped.filter(c => c.type === CardType.Race);
          if (hasSangMele && currentRaces.length < 2) {
            // Add 2nd race, keep existing
            return {
              ...updatePlayer(state, withCombatPower({
                ...player, hand: handWithout, equipped: [...player.equipped, card],
              })),
            };
          }
          // Normal: replace single existing race
          const existingRace = currentRaces[0];
          const { equipped: afterSangMele, removedSangMele } = removeSangMeleIfRaceless(
            player.equipped.filter(c => c.type !== CardType.Race),
          );
          return {
            ...updatePlayer(state, withCombatPower({
              ...player, hand: handWithout, equipped: [...afterSangMele, card],
            })),
            discardDoor: [
              ...state.discardDoor,
              ...(existingRace ? [existingRace] : []),
              ...(removedSangMele ? [removedSangMele] : []),
            ],
          };
        }

        // Curse played manually on a target player
        if (card.type === CardType.DoorCurse && action.targetId) {
          const target = getPlayer(state, action.targetId);
          if (!target) return state;
          const baseState = updatePlayer(state, { ...player, hand: handWithout });

          const getCandidates = (p: Player, effect: string): Player['equipped'] => {
            if (effect === 'lose-big-item') return p.equipped.filter(c => c.type === CardType.Treasure && c.isBigItem);
            if (effect === 'lose-small-item') return p.equipped.filter(c => c.type === CardType.Treasure && !c.isBigItem);
            if (effect === 'lose-highest-bonus-item') {
              const treasures = p.equipped.filter(c => c.type === CardType.Treasure && (c.power ?? 0) > 0);
              if (treasures.length === 0) return [];
              const max = Math.max(...treasures.map(c => c.power ?? 0));
              return treasures.filter(c => (c.power ?? 0) === max);
            }
            return [];
          };

          const effect = card.curseEffect ?? '';
          const isItemLossCurse = effect === 'lose-big-item' || effect === 'lose-small-item' || effect === 'lose-highest-bonus-item';
          if (isItemLossCurse) {
            const candidates = getCandidates(target, effect);
            if (candidates.length === 0) {
              return { ...baseState, discardDoor: [...state.discardDoor, card] };
            }
            if (candidates.length === 1) {
              const item = candidates[0]!;
              const { kept, detachedDoor } = splitAttachments(target.equipped, new Set([item.id]));
              return {
                ...updatePlayer(baseState, withCombatPower({ ...target, equipped: kept })),
                discardDoor: [...state.discardDoor, card, ...detachedDoor],
                discardTreasure: [...state.discardTreasure, item],
              };
            }
            // Multiple candidates: victim must choose
            return {
              ...updatePlayer(baseState, target),
              phase: GamePhase.CurseItemChoice,
              pendingCurse: card,
              pendingCurseItemChoices: candidates.map(c => c.id),
              pendingCurseTarget: target.id,
            };
          }

          const { player: cursedTarget, discardedTreasure } = applyCurse(target, card);
          return {
            ...updatePlayer(baseState, cursedTarget),
            discardDoor: [...state.discardDoor, card],
            discardTreasure: discardedTreasure
              ? [...state.discardTreasure, discardedTreasure]
              : state.discardTreasure,
          };
        }

        // MonsterBooster adds power to the active monster
        if (card.type === CardType.MonsterBooster && state.currentMonster) {
          const boostedMonster = {
            ...state.currentMonster,
            power: (state.currentMonster.power ?? 0) + (card.power ?? 0),
          };
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            currentMonster: boostedMonster,
            discardDoor: [...state.discardDoor, card],
          };
        }

        // All other door-origin cards: discard to door pile
        const isDoorType =
          card.type === CardType.Monster ||
          card.type === CardType.DoorCurse ||
          card.type === CardType.MonsterBooster ||
          card.type === CardType.Special;
        return {
          ...updatePlayer(state, { ...player, hand: handWithout }),
          discardDoor: isDoorType ? [...state.discardDoor, card] : state.discardDoor,
          discardTreasure: !isDoorType ? [...state.discardTreasure, card] : state.discardTreasure,
        };
      }

      // ---------------------------------------------------------------
      case 'DONATE_CARD': {
        const { cardId, targetPlayerId } = action;
        const giver = getPlayer(state, _playerId)!;
        const card = giver.hand.find(c => c.id === cardId);
        if (!card) return state;
        const giverWithout = { ...giver, hand: giver.hand.filter(c => c.id !== cardId) };
        // Self-donate = discard to appropriate pile
        if (targetPlayerId === _playerId) {
          const isDoor = card.type !== CardType.Treasure;
          return {
            ...updatePlayer(state, giverWithout),
            discardDoor: isDoor ? [...state.discardDoor, card] : state.discardDoor,
            discardTreasure: !isDoor ? [...state.discardTreasure, card] : state.discardTreasure,
          };
        }
        const receiver = getPlayer(state, targetPlayerId);
        if (!receiver) return state;
        const receiverWith = { ...receiver, hand: [...receiver.hand, card] };
        return updatePlayer(updatePlayer(state, giverWithout), receiverWith);
      }

      // ---------------------------------------------------------------
      case 'RESOLVE_FLEE_SUCCESS': {
        const monster = state.currentMonster!;
        const fleePlayer = getPlayer(state, state.currentPlayerId)!;
        const fleeTreasureCount = fleePlayer.equipped.reduce(
          (sum, c) => sum + (c.fleeDrawsTreasure ?? 0),
          0,
        );
        const { cards: fleeGained, newDeck: fleeTreasureDeck } = DeckManager.draw(
          state.treasureDeck,
          Math.min(fleeTreasureCount, state.treasureDeck.length),
        );
        // Apply flee-success level penalty (e.g. Mr. Nonos: -1 even on successful escape)
        const fleePenalty = (state.pendingFleePenalty ?? 0) + fleeSuccessPenaltyFor(monster, fleePlayer.level);
        const basePlayer = fleeTreasureCount > 0
          ? { ...fleePlayer, hand: [...fleePlayer.hand, ...fleeGained] }
          : fleePlayer;
        const updatedFleePlayer = fleePenalty > 0
          ? { ...basePlayer, level: Math.max(1, basePlayer.level - fleePenalty) }
          : basePlayer;
        return {
          ...updatePlayer(state, updatedFleePlayer),
          ...postCombatTransition(state),
          treasureDeck: fleeTreasureDeck,
          discardDoor: [...state.discardDoor, monster],
          currentMonster: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          additionalMonsters: undefined,
          forcedHelperId: undefined,
          combatLevelCap: undefined,
          pendingDiceChooserPlayerId: undefined,
          pendingFleePenalty: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'CHOOSE_VICTIM_ITEM': {
        const target = getPlayer(state, state.neighborDiscardTarget!)!;
        const fromEquipped = target.equipped.find(c => c.id === action.targetItemId);
        const fromHand = !fromEquipped ? target.hand.find(c => c.id === action.targetItemId) : undefined;
        const item = (fromEquipped ?? fromHand)!;
        const remainingQueue = (state.neighborDiscardQueue ?? []).slice(1);

        let nextState = state;
        let extraDiscardTreasure: Card[] = [];
        let extraDiscardDoor: Card[] = [];

        if (fromEquipped) {
          const { kept: keptEquipped, detachedDoor } = splitAttachments(target.equipped, new Set([item.id]));
          nextState = updatePlayer(nextState, { ...target, equipped: keptEquipped });
          if (detachedDoor.length > 0) extraDiscardDoor = detachedDoor;
        } else {
          nextState = updatePlayer(nextState, { ...target, hand: target.hand.filter(c => c.id !== item.id) });
        }

        if (state.neighborPickGivesToPicker) {
          const picker = getPlayer(nextState, _playerId)!;
          nextState = updatePlayer(nextState, { ...picker, hand: [...picker.hand, item] });
        } else {
          extraDiscardTreasure = [item];
        }

        const updatedTarget = getPlayer(nextState, state.neighborDiscardTarget!)!;
        const victimHasItems = state.neighborPickFromHandOnly
          ? updatedTarget.hand.length > 0
          : updatedTarget.equipped.length > 0 || (state.neighborPickIncludesHand && updatedTarget.hand.length > 0);
        const queueContinues = remainingQueue.length > 0 && victimHasItems;

        const discardTreasure = [...state.discardTreasure, ...extraDiscardTreasure];
        const discardDoor = [...state.discardDoor, ...extraDiscardDoor];

        if (queueContinues) {
          return {
            ...nextState,
            discardTreasure,
            discardDoor,
            neighborDiscardQueue: remainingQueue,
          };
        }

        // neighborPickFromHandOnly (d-034): discard remaining victim hand cards when queue done
        let finalDiscardTreasure = discardTreasure;
        let finalDiscardDoor = discardDoor;
        if (!queueContinues && state.neighborPickFromHandOnly) {
          const finalTarget = getPlayer(nextState, state.neighborDiscardTarget!)!;
          const remainingHand = finalTarget.hand;
          if (remainingHand.length > 0) {
            nextState = updatePlayer(nextState, { ...finalTarget, hand: [] });
            finalDiscardTreasure = [...finalDiscardTreasure, ...remainingHand.filter(c => c.type === CardType.Treasure)];
            finalDiscardDoor = [...finalDiscardDoor, ...remainingHand.filter(c => c.type !== CardType.Treasure)];
          }
        }

        const resultState: GameState = {
          ...nextState,
          discardTreasure: finalDiscardTreasure,
          discardDoor: finalDiscardDoor,
          neighborDiscardTarget: undefined,
          neighborDiscardQueue: undefined,
          neighborPickIncludesHand: undefined,
          neighborPickGivesToPicker: undefined,
          neighborPickFromHandOnly: undefined,
        };
        if (state.pendingFleeMonsters !== undefined) return afterFleeSubphase(resultState);
        return { ...resultState, ...postCombatTransition(resultState) };
      }

      // ---------------------------------------------------------------
      case 'SET_SUPER_MUNCHKIN_MODE': {
        const p = getPlayer(state, _playerId)!;
        return updatePlayer(state, { ...p, superMunchkinMode: action.mode });
      }

      // ---------------------------------------------------------------
      case 'SET_SANG_MELE_MODE': {
        const p = getPlayer(state, _playerId)!;
        return updatePlayer(state, { ...p, sangMeleMode: action.mode });
      }

      // ---------------------------------------------------------------
      case 'MATCH_GOLD_VALUE': {
        const p = getPlayer(state, state.pendingGoldMatchQueue![0]!)!;
        const discardIds = new Set(action.cardIds);
        const { kept, detachedDoor } = splitAttachments(p.equipped, discardIds);
        const discarded = p.equipped.filter(c => discardIds.has(c.id));
        const updatedP = withCombatPower({ ...p, equipped: kept });
        const nextBase = {
          ...updatePlayer(state, updatedP),
          discardTreasure: [...state.discardTreasure, ...discarded.filter(c => c.type === CardType.Treasure)],
          discardDoor: detachedDoor.length > 0
            ? [...state.discardDoor, ...detachedDoor, ...discarded.filter(c => c.type !== CardType.Treasure)]
            : [...state.discardDoor, ...discarded.filter(c => c.type !== CardType.Treasure)],
          pendingGoldMatchQueue: undefined,
          pendingGoldMatchTarget: undefined,
        };
        return processGoldMatchQueue(
          nextBase,
          state.pendingGoldMatchTarget!,
          state.pendingGoldMatchQueue!.slice(1),
        );
      }

      case 'DISCARD_ITEMS_FOR_GOLD': {
        const p = getPlayer(state, state.currentPlayerId)!;
        const discardIds = new Set(action.cardIds);
        const { kept, detachedDoor } = splitAttachments(p.equipped, discardIds);
        const discarded = p.equipped.filter(c => discardIds.has(c.id));
        const updatedP = withCombatPower({ ...p, equipped: kept });
        const resultState: GameState = {
          ...updatePlayer(state, updatedP),
          pendingGoldDiscardRequired: undefined,
          discardTreasure: [...state.discardTreasure, ...discarded],
          discardDoor: detachedDoor.length > 0 ? [...state.discardDoor, ...detachedDoor] : state.discardDoor,
        };
        if (state.pendingFleeMonsters !== undefined) return afterFleeSubphase(resultState);
        return { ...resultState, phase: GamePhase.Loot };
      }

      case 'DISCARD_PRE_COMBAT_ITEM': {
        const p = getPlayer(state, state.currentPlayerId)!;
        const discarded = p.equipped.find(c => c.id === action.cardId)!;
        const { kept, detachedDoor } = splitAttachments(
          p.equipped,
          new Set([action.cardId]),
        );
        const updatedP = withCombatPower({ ...p, equipped: kept });
        return {
          ...updatePlayer(state, updatedP),
          phase: GamePhase.MonsterFight,
          discardTreasure: [...state.discardTreasure, discarded],
          discardDoor: detachedDoor.length > 0 ? [...state.discardDoor, ...detachedDoor] : state.discardDoor,
        };
      }

      case 'PRIEST_CLAIM_TREASURE': {
        const monster = state.currentMonster!;
        const p = getPlayer(state, state.currentPlayerId)!;
        const count = monster.treasuresOnKill ?? 1;
        const { cards: claimedTreasure, newDeck } = DeckManager.draw(
          state.treasureDeck,
          Math.min(count, state.treasureDeck.length),
        );
        const updatedP = withCombatPower({ ...p, hand: [...p.hand, ...claimedTreasure] });
        return {
          ...updatePlayer(state, updatedP),
          phase: GamePhase.Loot,
          currentMonster: undefined,
          additionalMonsters: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          forcedHelperId: undefined,
          combatLevelCap: undefined,
          treasureDeck: newDeck,
          discardDoor: [...state.discardDoor, monster, ...(state.additionalMonsters ?? [])],
        };
      }

      case 'WIZARD_CHARM': {
        // Discard entire hand, remove target monster, draw its treasure (no level gain)
        const p = getPlayer(state, state.currentPlayerId)!;
        const handDoor = p.hand.filter(c => c.type !== CardType.Treasure);
        const handTreasure = p.hand.filter(c => c.type === CardType.Treasure);
        const updatedP = withCombatPower({ ...p, hand: [] });

        const isCurrentMonster = state.currentMonster!.id === action.targetMonsterId;
        const target = isCurrentMonster
          ? state.currentMonster!
          : (state.additionalMonsters ?? []).find(m => m.id === action.targetMonsterId)!;

        const count = target.treasuresOnKill ?? 1;
        const { cards: charmedTreasure, newDeck: newTreasureDeck } = DeckManager.draw(
          state.treasureDeck,
          Math.min(count, state.treasureDeck.length),
        );
        const playerWithTreasure = withCombatPower({ ...updatedP, hand: [...updatedP.hand, ...charmedTreasure] });

        const remainingAdditional = (state.additionalMonsters ?? []).filter(m => m.id !== action.targetMonsterId);

        if (isCurrentMonster) {
          if (remainingAdditional.length === 0) {
            // No more monsters — combat ends, go to Loot (no level)
            return {
              ...updatePlayer(state, playerWithTreasure),
              phase: GamePhase.Loot,
              currentMonster: undefined,
              additionalMonsters: undefined,
              combatBonusCards: undefined,
              combatMonsterBonusCards: undefined,
              forcedHelperId: undefined,
              combatLevelCap: undefined,
              treasureDeck: newTreasureDeck,
              discardDoor: [...state.discardDoor, target, ...handDoor],
              discardTreasure: [...state.discardTreasure, ...handTreasure],
            };
          }
          // Replace current monster with next additional
          const [nextMonster, ...rest] = remainingAdditional;
          return {
            ...updatePlayer(state, playerWithTreasure),
            currentMonster: nextMonster,
            additionalMonsters: rest.length > 0 ? rest : undefined,
            treasureDeck: newTreasureDeck,
            discardDoor: [...state.discardDoor, target, ...handDoor],
            discardTreasure: [...state.discardTreasure, ...handTreasure],
          };
        }

        // Target was an additional monster — remove it, current monster remains
        return {
          ...updatePlayer(state, playerWithTreasure),
          additionalMonsters: remainingAdditional.length > 0 ? remainingAdditional : undefined,
          treasureDeck: newTreasureDeck,
          discardDoor: [...state.discardDoor, target, ...handDoor],
          discardTreasure: [...state.discardTreasure, ...handTreasure],
        };
      }

      // ---------------------------------------------------------------
      case 'CHOOSE_BAD_STUFF': {
        const p = getPlayer(state, state.currentPlayerId)!;
        let resultState: GameState;
        if (action.choice === 'hand') {
          const handDoor = p.hand.filter(c => c.type !== CardType.Treasure);
          const handTreasure = p.hand.filter(c => c.type === CardType.Treasure);
          resultState = {
            ...updatePlayer(state, withCombatPower({ ...p, hand: [] })),
            pendingBadStuffLevels: undefined,
            discardDoor: [...state.discardDoor, ...handDoor],
            discardTreasure: [...state.discardTreasure, ...handTreasure],
          };
        } else {
          const levelDelta = state.pendingBadStuffLevels ?? -1;
          resultState = { ...updatePlayer(state, applyLevelChange(p, levelDelta, false)), pendingBadStuffLevels: undefined };
        }
        if (state.pendingFleeMonsters !== undefined) return afterFleeSubphase(resultState);
        return { ...resultState, ...postCombatTransition(resultState) };
      }

      // ---------------------------------------------------------------
      case 'SKIP_RESURRECTION': {
        const p = getPlayer(state, state.currentPlayerId)!;
        const count = state.pendingTreasureCount ?? 0;
        const { cards: drawn, newDeck } = DeckManager.draw(state.treasureDeck, Math.min(count, state.treasureDeck.length));
        return {
          ...updatePlayer(state, withCombatPower({ ...p, hand: [...p.hand, ...drawn] })),
          ...postCombatTransition(state),
          treasureDeck: newDeck,
          pendingTreasureCount: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'PRIEST_RESURRECT': {
        const p = getPlayer(state, state.currentPlayerId)!;
        const count = state.pendingTreasureCount ?? 0;
        const fromSet = new Set(action.fromDiscardIds);
        const paySet = new Set(action.payCardIds);
        const takenFromDiscard = state.discardTreasure.filter(c => fromSet.has(c.id));
        const paidCards = p.hand.filter(c => paySet.has(c.id));
        const paidDoor = paidCards.filter(c => c.type !== CardType.Treasure);
        const paidTreasure = paidCards.filter(c => c.type === CardType.Treasure);
        const remaining = count - action.fromDiscardIds.length;
        const { cards: deckDrawn, newDeck } = DeckManager.draw(state.treasureDeck, Math.min(remaining, state.treasureDeck.length));
        const updatedP = withCombatPower({
          ...p,
          hand: [...p.hand.filter(c => !paySet.has(c.id)), ...takenFromDiscard, ...deckDrawn],
        });
        return {
          ...updatePlayer(state, updatedP),
          ...postCombatTransition(state),
          treasureDeck: newDeck,
          pendingTreasureCount: undefined,
          discardTreasure: [...state.discardTreasure.filter(c => !fromSet.has(c.id)), ...paidTreasure],
          discardDoor: [...state.discardDoor, ...paidDoor],
        };
      }

      // ---------------------------------------------------------------
      case 'THIEF_SWAP_TREASURES': {
        const p = getPlayer(state, _playerId)!;
        const swapCount = state.currentMonster!.thiefTreasureSwapCount!;
        const discardSet = new Set(action.discardCardIds);
        const discarded = [...p.equipped, ...p.hand].filter(c => discardSet.has(c.id));
        const { cards: drawn, newDeck } = DeckManager.draw(state.treasureDeck, swapCount);
        const newEquipped = p.equipped.filter(c => !discardSet.has(c.id));
        const newHand = [...p.hand.filter(c => !discardSet.has(c.id)), ...drawn];
        const updatedP = withCombatPower({ ...p, equipped: newEquipped, hand: newHand });
        return {
          ...updatePlayer(state, updatedP),
          ...postCombatTransition(state),
          treasureDeck: newDeck,
          discardTreasure: [...state.discardTreasure, ...discarded],
          currentMonster: undefined,
          additionalMonsters: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'AVOID_MONSTER': {
        const monster = state.currentMonster!;
        const allMonsters = [monster, ...(state.additionalMonsters ?? [])];
        return {
          ...state,
          ...postCombatTransition(state),
          discardDoor: [...state.discardDoor, ...allMonsters],
          currentMonster: undefined,
          additionalMonsters: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          forcedHelperId: undefined,
          combatLevelCap: undefined,
        };
      }

      case 'BRIBE_MONSTER': {
        const briberMonster = state.currentMonster!;
        const allBribeMonsters = [briberMonster, ...(state.additionalMonsters ?? [])];
        const briberPlayer = getPlayer(state, _playerId)!;
        const briberItem = briberPlayer.equipped.find(c => c.id === action.discardItemId)!;
        const { kept, detachedDoor } = splitAttachments(briberPlayer.equipped, new Set([briberItem.id]));
        const updatedBriber = withCombatPower({ ...briberPlayer, equipped: kept });
        const lostTreasure = briberItem.type === CardType.Treasure ? [briberItem] : [];
        const lostDoor = briberItem.type !== CardType.Treasure ? [briberItem] : [];
        return {
          ...updatePlayer(state, updatedBriber),
          ...postCombatTransition(state),
          discardDoor: [...state.discardDoor, ...allBribeMonsters, ...lostDoor, ...detachedDoor],
          discardTreasure: [...state.discardTreasure, ...lostTreasure],
          currentMonster: undefined,
          additionalMonsters: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          forcedHelperId: undefined,
          combatLevelCap: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'THIEF_BACKSTAB': {
        const thief = getPlayer(state, _playerId)!;
        const discarded = thief.hand.find(c => c.id === action.discardCardId)!;
        const discardDoor = discarded.type !== CardType.Treasure
          ? [...state.discardDoor, discarded]
          : state.discardDoor;
        const discardTreasure = discarded.type === CardType.Treasure
          ? [...state.discardTreasure, discarded]
          : state.discardTreasure;
        const updatedThief = withCombatPower({
          ...thief, hand: thief.hand.filter(c => c.id !== action.discardCardId),
        });
        return {
          ...updatePlayer(state, updatedThief),
          discardDoor,
          discardTreasure,
          combatBackstabPenalty: (state.combatBackstabPenalty ?? 0) + 2,
          backstabLog: [...(state.backstabLog ?? []), { thiefId: _playerId, victimId: action.targetPlayerId }],
        };
      }

      // ---------------------------------------------------------------
      case 'THIEF_PICKPOCKET': {
        const thief = getPlayer(state, _playerId)!;
        const target = getPlayer(state, action.targetPlayerId)!;
        const discarded = thief.hand.find(c => c.id === action.discardCardId)!;
        const discardDoor = discarded.type !== CardType.Treasure
          ? [...state.discardDoor, discarded]
          : state.discardDoor;
        const discardTreasure = discarded.type === CardType.Treasure
          ? [...state.discardTreasure, discarded]
          : state.discardTreasure;
        const thiefAfterDiscard = withCombatPower({
          ...thief, hand: thief.hand.filter(c => c.id !== action.discardCardId),
        });

        if (action.dieRoll >= 4) {
          // Success: steal the item
          const stolenItem = target.equipped.find(c => c.id === action.targetItemId)!;
          const { kept: targetKept } = splitAttachments(target.equipped, new Set([stolenItem.id]));
          const updatedTarget = withCombatPower({ ...target, equipped: targetKept });
          const updatedThief = withCombatPower({
            ...thiefAfterDiscard, hand: [...thiefAfterDiscard.hand, stolenItem],
          });
          let nextState = updatePlayer(state, updatedThief);
          nextState = updatePlayer(nextState, updatedTarget);
          return { ...nextState, discardDoor, discardTreasure };
        } else {
          // Failure: thief loses 1 level
          const updatedThief = withCombatPower({
            ...thiefAfterDiscard, level: Math.max(1, thiefAfterDiscard.level - 1),
          });
          return { ...updatePlayer(state, updatedThief), discardDoor, discardTreasure };
        }
      }

      // ---------------------------------------------------------------
      case 'DISCARD_ITEM_TO_FLEE': {
        const p = getPlayer(state, state.currentPlayerId)!;
        const fromEquipped = p.equipped.find(c => c.id === action.cardId);
        const item = fromEquipped ?? p.hand.find(c => c.id === action.cardId)!;
        let updatedPlayer: Player;
        let detachedDoor: Card[] = [];
        if (fromEquipped) {
          const { kept, detachedDoor: det } = splitAttachments(p.equipped, new Set([item.id]));
          updatedPlayer = withCombatPower({ ...p, equipped: kept });
          detachedDoor = det;
        } else {
          updatedPlayer = { ...p, hand: p.hand.filter(c => c.id !== item.id) };
        }
        const allBonusCards = [
          ...(state.combatBonusCards ?? []),
          ...(state.combatMonsterBonusCards ?? []),
        ];
        return {
          ...updatePlayer(state, updatedPlayer),
          phase: GamePhase.FleeSuccessReaction,
          discardTreasure: [...state.discardTreasure, item, ...allBonusCards],
          discardDoor: detachedDoor.length > 0
            ? [...state.discardDoor, ...detachedDoor]
            : state.discardDoor,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (state.currentMonster ? fleeSuccessPenaltyFor(state.currentMonster, p.level) : 0),
        };
      }

      // ---------------------------------------------------------------
      case 'CHOOSE_CURSE_ITEM': {
        const victimId = state.pendingCurseTarget ?? state.currentPlayerId;
        const p = getPlayer(state, victimId)!;
        const item = p.equipped.find(c => c.id === action.cardId)!;
        const { kept, detachedDoor } = splitAttachments(p.equipped, new Set([item.id]));
        // if discarding a Class card, also remove Super Munchkin if now classless
        const isClassCard = item.type === CardType.Class;
        const { equipped: afterSM, removedSuperMunchkin } = isClassCard
          ? removeSuperMunchkinIfClassless(kept)
          : { equipped: kept, removedSuperMunchkin: undefined };
        const updatedSuperMode = isClassCard && afterSM.every(c => c.type !== CardType.Class)
          ? undefined : p.superMunchkinMode;
        const isDoorCard = item.type !== CardType.Treasure;
        const baseState = {
          ...updatePlayer(state, withCombatPower({ ...p, equipped: afterSM, superMunchkinMode: updatedSuperMode })),
          pendingCurse: undefined,
          pendingCurseItemChoices: undefined,
          pendingCurseTarget: undefined as string | undefined,
          discardDoor: [
            ...state.discardDoor,
            ...(state.pendingCurse ? [state.pendingCurse] : []),
            ...detachedDoor,
            ...(isDoorCard ? [item] : []),
            ...(removedSuperMunchkin ? [removedSuperMunchkin] : []),
          ],
          discardTreasure: [...state.discardTreasure, ...(isDoorCard ? [] : [item])],
        };
        // gold-match-others: victim discarded, now process other players
        if (state.pendingGoldMatchQueue != null) {
          const target = item.goldValue ?? 0;
          return processGoldMatchQueue(
            { ...baseState, pendingGoldMatchQueue: undefined },
            target,
            state.pendingGoldMatchQueue,
          );
        }
        return { ...baseState, phase: GamePhase.Loot };
      }

      // ---------------------------------------------------------------
      case 'RETRY_FLEE': {
        const p = getPlayer(state, state.currentPlayerId)!;
        return {
          ...updatePlayer(state, { ...p, hand: p.hand.filter(c => c.id !== action.discardedCardId) }),
          phase: GamePhase.ForcedFlee,
          discardTreasure: [
            ...state.discardTreasure,
            p.hand.find(c => c.id === action.discardedCardId)!,
          ],
          pendingDiceChooserPlayerId: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'RESOLVE_DIE_ROLL_LOSS': {
        const p = getPlayer(state, _playerId)!;
        const lostIds = new Set(action.cardIds);
        let resultState: GameState;
        if (action.source === 'equipped') {
          const { kept, detachedDoor } = splitAttachments(p.equipped, lostIds);
          const lostTreasures = p.equipped.filter(c => lostIds.has(c.id) && c.type === CardType.Treasure);
          const lostDoors = p.equipped.filter(c => lostIds.has(c.id) && c.type !== CardType.Treasure);
          const updatedP = withCombatPower({ ...p, equipped: kept });
          resultState = {
            ...updatePlayer(state, updatedP),
            pendingDieRollLossCount: undefined,
            discardTreasure: [...state.discardTreasure, ...lostTreasures],
            discardDoor: [...state.discardDoor, ...lostDoors, ...detachedDoor],
          };
        } else {
          const lostCards = p.hand.filter(c => lostIds.has(c.id));
          const updatedP = withCombatPower({ ...p, hand: p.hand.filter(c => !lostIds.has(c.id)) });
          const lostTreasures = lostCards.filter(c => c.type === CardType.Treasure);
          const lostDoors = lostCards.filter(c => c.type !== CardType.Treasure);
          resultState = {
            ...updatePlayer(state, updatedP),
            pendingDieRollLossCount: undefined,
            discardTreasure: [...state.discardTreasure, ...lostTreasures],
            discardDoor: [...state.discardDoor, ...lostDoors],
          };
        }
        if (state.pendingFleeMonsters !== undefined) return afterFleeSubphase(resultState);
        return { ...resultState, ...postCombatTransition(resultState) };
      }

      // ---------------------------------------------------------------
      case 'SELL_ITEMS': {
        const p = getPlayer(state, _playerId)!;
        const allItems = [...p.equipped, ...p.hand];
        const items = action.cardIds.map(id => allItems.find(c => c.id === id)!);
        const totalGold = items.reduce((sum, item) => {
          const multiplier = item.id === action.doubleCardId ? 2 : 1;
          return sum + (item.goldValue ?? 0) * multiplier;
        }, 0);
        const levelsGained = Math.floor(totalGold / 1000);
        const sellIds = new Set(action.cardIds);
        const { kept: keptEquipped, detachedDoor } = splitAttachments(p.equipped, sellIds);
        const updatedPlayer = withCombatPower({
          ...p,
          level: Math.min(9, p.level + levelsGained),
          equipped: keptEquipped,
          hand: p.hand.filter(c => !sellIds.has(c.id)),
        });
        return {
          ...updatePlayer(state, updatedPlayer),
          discardTreasure: [...state.discardTreasure, ...items],
          discardDoor: detachedDoor.length > 0
            ? [...state.discardDoor, ...detachedDoor]
            : state.discardDoor,
        };
      }

      // ---------------------------------------------------------------
      case 'RESOLVE_FLEE': {
        const monster = state.currentMonster!;
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        let levelDelta = CombatResolver.badStuffLevelLoss(monster);
        if (monster.badStuffLevelVsRace) {
          for (const [race, delta] of Object.entries(monster.badStuffLevelVsRace)) {
            if (playerRaces(activePlayer).includes(race)) { levelDelta = delta!; break; }
          }
        }
        if (monster.badStuffDieRollDeathThreshold != null) {
          const roll = Math.ceil(Math.random() * 6);
          levelDelta = roll <= monster.badStuffDieRollDeathThreshold ? -99 : -roll;
        }
        const isDeath = levelDelta <= -99;

        const allFleeMonsters = [monster, ...(state.additionalMonsters ?? [])];

        const applyFleeBadStuff = (p: Player, dead: boolean): Player => {
          if (monster.badStuffSetToLevel != null) {
            return { ...p, level: Math.max(1, monster.badStuffSetToLevel) };
          }
          if (monster.badStuffSetToMinLevel) {
            const minLevel = Math.min(...state.players.map(pl => pl.level));
            return { ...p, level: Math.min(p.level, minLevel) };
          }
          return applyLevelChange(p, levelDelta, dead);
        };

        if (isDeath) {
          const withBadStuffLevel = applyFleeBadStuff(activePlayer, true);
          const preDeathPlayer = { ...activePlayer, level: withBadStuffLevel.level };
          return enterBodyPillage(
            state,
            preDeathPlayer,
            [...state.discardDoor, ...allFleeMonsters],
            state.discardTreasure,
          );
        }

        const updatedPlayer = applyFleeBadStuff(activePlayer, false);

        // badStuffChoiceLevelsOrHand: player chooses between level loss or discarding entire hand
        if (monster.badStuffChoiceLevelsOrHand) {
          return {
            ...state,
            phase: GamePhase.BadStuffChoice,
            pendingBadStuffLevels: levelDelta,
            discardDoor: [...state.discardDoor, monster],
            currentMonster: undefined,
            additionalMonsters: undefined,
            pendingFleeMonsters: state.additionalMonsters ?? [],
          };
        }

        // badStuffLoseAllItemsAndHand: player loses all equipped items AND all hand cards
        if (monster.badStuffLoseAllItemsAndHand) {
          const allEquipped = [...updatedPlayer.equipped];
          const allHand = [...updatedPlayer.hand];
          const stripped = withCombatPower({ ...updatedPlayer, equipped: [], hand: [] });
          const lostDoor = allEquipped.filter(c => c.type !== CardType.Treasure);
          const lostTreasure = allEquipped.filter(c => c.type === CardType.Treasure);
          const handDoor = allHand.filter(c => c.type !== CardType.Treasure);
          const handTreasure = allHand.filter(c => c.type === CardType.Treasure);
          return continueFleeOrEnd(
            state,
            stripped,
            [...lostDoor, ...handDoor],
            [...lostTreasure, ...handTreasure],
          );
        }

        // badStuffDiscardHand: player discards entire hand, no level loss
        if (monster.badStuffDiscardHand) {
          const lostDoor = updatedPlayer.hand.filter(c => c.type !== CardType.Treasure);
          const lostTreasure = updatedPlayer.hand.filter(c => c.type === CardType.Treasure);
          const stripped = withCombatPower({ ...updatedPlayer, hand: [] });
          return continueFleeOrEnd(state, stripped, lostDoor, lostTreasure);
        }

        // badStuffLoseAllClasses: player loses ALL class cards; if no class → apply levelDelta (badStuffLevel)
        if (monster.badStuffLoseAllClasses) {
          const classCards = updatedPlayer.equipped.filter(c => c.type === CardType.Class);
          if (classCards.length > 0) {
            const classIds = new Set(classCards.map(c => c.id));
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, classIds);
            const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(kept);
            const stripped = withCombatPower({ ...updatedPlayer, equipped: afterSM, superMunchkinMode: undefined });
            return continueFleeOrEnd(
              state,
              stripped,
              [...classCards, ...detachedDoor, ...(removedSuperMunchkin ? [removedSuperMunchkin] : [])],
            );
          }
          // no class → fall through to normal levelDelta path
        }

        // badStuffLoseAllBigItems: player loses all equipped big items
        if (monster.badStuffLoseAllBigItems) {
          const bigItemIds = new Set(updatedPlayer.equipped.filter(c => c.isBigItem).map(c => c.id));
          if (bigItemIds.size > 0) {
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, bigItemIds);
            const lostBigItems = updatedPlayer.equipped.filter(c => bigItemIds.has(c.id));
            const playerAfterLoss = withCombatPower({ ...updatedPlayer, equipped: kept });
            return continueFleeOrEnd(state, playerAfterLoss, detachedDoor, lostBigItems);
          }
        }

        // badStuffLoseHeadgear: player loses their equipped headgear (level change from badStuffLevel)
        if (monster.badStuffLoseHeadgear) {
          const headgear = updatedPlayer.equipped.find(c => c.equipSlot === 'headgear');
          if (headgear) {
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, new Set([headgear.id]));
            const stripped = withCombatPower({ ...updatedPlayer, equipped: kept });
            return continueFleeOrEnd(state, stripped, [headgear, ...detachedDoor]);
          }
        }

        // badStuffLoseArmorAndFootwear: player loses armor and footwear slots (if any)
        if (monster.badStuffLoseArmorAndFootwear) {
          const armorFoot = updatedPlayer.equipped.filter(
            c => c.equipSlot === 'armor' || c.equipSlot === 'footwear',
          );
          if (armorFoot.length > 0) {
            const removedIds = new Set(armorFoot.map(c => c.id));
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, removedIds);
            const stripped = withCombatPower({ ...updatedPlayer, equipped: kept });
            const lostTreasure = armorFoot.filter(c => c.type === CardType.Treasure);
            const lostDoor = armorFoot.filter(c => c.type !== CardType.Treasure);
            return continueFleeOrEnd(state, stripped, [...lostDoor, ...detachedDoor], lostTreasure);
          }
        }

        // badStuffLoseClassIfWizard: Wizard loses only their wizard class; non-Wizard dies
        if (monster.badStuffLoseClassIfWizard) {
          if (playerClasses(updatedPlayer).includes('wizard')) {
            const wizardCard = updatedPlayer.equipped.find(c => c.classId === 'wizard');
            if (wizardCard) {
              const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, new Set([wizardCard.id]));
              const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(kept);
              const stripped = withCombatPower({ ...updatedPlayer, equipped: afterSM });
              return continueFleeOrEnd(
                state,
                stripped,
                [wizardCard, ...detachedDoor, ...(removedSuperMunchkin ? [removedSuperMunchkin] : [])],
              );
            }
          }
          // Non-wizard: death handled by standard levelDelta = -99
        }

        // badStuffGoldDiscard: discard items worth N gold; if insufficient, lose all equipped + level
        if (monster.badStuffGoldDiscard != null) {
          const required = monster.badStuffGoldDiscard;
          const totalGold = updatedPlayer.equipped.reduce((sum, c) => sum + (c.goldValue ?? 0), 0);
          if (totalGold >= required) {
            return {
              ...updatePlayer(state, updatedPlayer),
              phase: GamePhase.BadStuffGoldDiscard,
              pendingGoldDiscardRequired: required,
              discardDoor: [...state.discardDoor, monster],
              currentMonster: undefined,
              additionalMonsters: undefined,
              pendingFleeMonsters: state.additionalMonsters ?? [],
            };
          }
          const lostItems = [...updatedPlayer.equipped];
          const stripped = withCombatPower({ ...updatedPlayer, equipped: [] });
          const final = applyLevelChange(stripped, levelDelta, false);
          return continueFleeOrEnd(state, final, [], lostItems);
        }

        // badStuffDieRollItemLoss: roll a die, player loses that many equipped OR hand cards
        if (monster.badStuffDieRollItemLoss) {
          const dieRoll = Math.ceil(Math.random() * 6);
          return {
            ...updatePlayer(state, updatedPlayer),
            phase: GamePhase.BadStuffDieRollLoss,
            pendingDieRollLossCount: dieRoll,
            discardDoor: [...state.discardDoor, monster],
            currentMonster: undefined,
            additionalMonsters: undefined,
            pendingFleeMonsters: state.additionalMonsters ?? [],
          };
        }

        // badStuffHighestLevelPlayersPickItem: highest-level player(s) each take one equipped item
        if (monster.badStuffHighestLevelPlayersPickItem && updatedPlayer.equipped.length > 0) {
          const others = state.players.filter(p => p.id !== state.currentPlayerId);
          const maxLevel = Math.max(...others.map(p => p.level));
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const highestQueue = state.players
            .map((_, i) => state.players[(idx + 1 + i) % state.players.length]!)
            .filter(p => p.id !== state.currentPlayerId && p.level === maxLevel)
            .map(p => p.id)
            .slice(0, updatedPlayer.equipped.length);
          if (highestQueue.length > 0) {
            return {
              ...updatePlayer(state, updatedPlayer),
              phase: GamePhase.NeighborItemRemoval,
              discardDoor: [...state.discardDoor, monster],
              currentMonster: undefined,
              additionalMonsters: undefined,
              pendingFleeMonsters: state.additionalMonsters ?? [],
              neighborDiscardTarget: state.currentPlayerId,
              neighborDiscardQueue: highestQueue,
              neighborPickGivesToPicker: true,
            };
          }
        }

        // badStuffAllPlayersPickItem: ALL other players (right first) each take one equipped/hand item
        if (monster.badStuffAllPlayersPickItem) {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const allOthers = state.players
            .map((_, i) => state.players[(idx + 1 + i) % state.players.length]!.id)
            .filter(id => id !== state.currentPlayerId);
          const victimItems = updatedPlayer.equipped.length + updatedPlayer.hand.length;
          const allPlayersQueue = allOthers.slice(0, victimItems);
          if (allPlayersQueue.length > 0) {
            return {
              ...updatePlayer(state, updatedPlayer),
              phase: GamePhase.NeighborItemRemoval,
              discardDoor: [...state.discardDoor, monster],
              currentMonster: undefined,
              additionalMonsters: undefined,
              pendingFleeMonsters: state.additionalMonsters ?? [],
              neighborDiscardTarget: state.currentPlayerId,
              neighborDiscardQueue: allPlayersQueue,
              neighborPickIncludesHand: true,
              neighborPickGivesToPicker: true,
            };
          }
        }

        // badStuffNeighborsDiscard: neighbors each pick one equipped item to discard
        if (monster.badStuffNeighborsDiscard && updatedPlayer.equipped.length > 0) {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const prevId = state.players[(idx - 1 + state.players.length) % state.players.length]!.id;
          const nextId = state.players[(idx + 1) % state.players.length]!.id;
          const fullQueue = [prevId, nextId];
          const neighborQueue = fullQueue.slice(0, updatedPlayer.equipped.length);
          return {
            ...updatePlayer(state, updatedPlayer),
            phase: GamePhase.NeighborItemRemoval,
            discardDoor: [...state.discardDoor, monster],
            currentMonster: undefined,
            additionalMonsters: undefined,
            pendingFleeMonsters: state.additionalMonsters ?? [],
            neighborDiscardTarget: state.currentPlayerId,
            neighborDiscardQueue: neighborQueue,
          };
        }

        // badStuffHandToOthers: each other player picks one card from victim's hand; rest discarded
        if (monster.badStuffHandToOthers && updatedPlayer.hand.length > 0) {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const n = state.players.length;
          const allOthers = Array.from({ length: n - 1 }, (_, i) => state.players[(idx + 1 + i) % n]!.id);
          const handToOthersQueue = allOthers.slice(0, updatedPlayer.hand.length);
          return {
            ...updatePlayer(state, updatedPlayer),
            phase: GamePhase.NeighborItemRemoval,
            discardDoor: [...state.discardDoor, monster],
            currentMonster: undefined,
            additionalMonsters: undefined,
            pendingFleeMonsters: state.additionalMonsters ?? [],
            neighborDiscardTarget: state.currentPlayerId,
            neighborDiscardQueue: handToOthersQueue,
            neighborPickFromHandOnly: true,
            neighborPickGivesToPicker: true,
          };
        }

        return continueFleeOrEnd(state, updatedPlayer);
      }

      // ---------------------------------------------------------------
      case 'RESOLVE_CURSE': {
        const curse = state.pendingCurse;
        if (!curse) return state;
        const activePlayer = getPlayer(state, state.currentPlayerId)!;

        // lose-highest-bonus-item: discard the equipped item with the highest power; tie → player chooses
        if (curse.curseEffect === 'lose-highest-bonus-item') {
          const candidates = activePlayer.equipped.filter(
            c => c.type === CardType.Treasure && !c.bypassesItemRestrictions && (c.power ?? 0) > 0,
          );
          if (candidates.length === 0) {
            return {
              ...state,
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...state.discardDoor, curse],
            };
          }
          const maxPower = Math.max(...candidates.map(c => c.power ?? 0));
          const tied = candidates.filter(c => (c.power ?? 0) === maxPower);
          if (tied.length === 1) {
            const item = tied[0]!;
            const { kept, detachedDoor } = splitAttachments(activePlayer.equipped, new Set([item.id]));
            return {
              ...updatePlayer(state, withCombatPower({ ...activePlayer, equipped: kept })),
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...state.discardDoor, curse, ...detachedDoor],
              discardTreasure: [...state.discardTreasure, item],
            };
          }
          // Tie: player must choose
          return {
            ...state,
            phase: GamePhase.CurseItemChoice,
            pendingCurseItemChoices: tied.map(c => c.id),
          };
        }

        // lose-class: 0 classes → lose 1 level; 1 class → auto-discard; 2 classes → choose
        if (curse.curseEffect === 'lose-class') {
          const classCards = activePlayer.equipped.filter(c => c.type === CardType.Class);
          const baseDoor = [...state.discardDoor, curse];
          if (classCards.length === 0) {
            return {
              ...updatePlayer(state, withCombatPower({ ...activePlayer, level: Math.max(1, activePlayer.level - 1) })),
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: baseDoor,
            };
          }
          if (classCards.length === 1) {
            const classCard = classCards[0]!;
            const { kept, detachedDoor } = splitAttachments(activePlayer.equipped, new Set([classCard.id]));
            const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(kept);
            return {
              ...updatePlayer(state, withCombatPower({ ...activePlayer, equipped: afterSM, superMunchkinMode: undefined })),
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...baseDoor, classCard, ...detachedDoor, ...(removedSuperMunchkin ? [removedSuperMunchkin] : [])],
            };
          }
          // 2 classes (Super Munchkin): player chooses which one via CurseItemChoice
          return {
            ...state,
            phase: GamePhase.CurseItemChoice,
            pendingCurse: undefined,
            pendingCurseItemChoices: classCards.map(c => c.id),
            discardDoor: baseDoor,
          };
        }

        // gold-match-others: victim chooses 1 item; others must match its gold value or lose all + 1 level
        if (curse.curseEffect === 'gold-match-others') {
          if (activePlayer.equipped.length === 0) {
            return { ...state, phase: GamePhase.Loot, pendingCurse: undefined, discardDoor: [...state.discardDoor, curse] };
          }
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const n = state.players.length;
          const otherIds = Array.from({ length: n - 1 }, (_, i) => state.players[(idx + 1 + i) % n]!.id);
          return {
            ...state,
            phase: GamePhase.CurseItemChoice,
            pendingCurse: undefined,
            pendingCurseItemChoices: activePlayer.equipped.map(c => c.id),
            pendingGoldMatchQueue: otherIds,
            discardDoor: [...state.discardDoor, curse],
          };
        }

        // lose-small-item / lose-big-item: player chooses which item to discard (CurseItemChoice if multiple)
        if (curse.curseEffect === 'lose-small-item' || curse.curseEffect === 'lose-big-item') {
          const candidates = activePlayer.equipped.filter(c =>
            c.type === CardType.Treasure &&
            (curse.curseEffect === 'lose-big-item' ? c.isBigItem : !c.isBigItem),
          );
          if (candidates.length === 0) {
            return { ...state, phase: GamePhase.Loot, pendingCurse: undefined, discardDoor: [...state.discardDoor, curse] };
          }
          if (candidates.length === 1) {
            const item = candidates[0]!;
            const { kept, detachedDoor } = splitAttachments(activePlayer.equipped, new Set([item.id]));
            return {
              ...updatePlayer(state, withCombatPower({ ...activePlayer, equipped: kept })),
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...state.discardDoor, curse, ...detachedDoor],
              discardTreasure: [...state.discardTreasure, item],
            };
          }
          return { ...state, phase: GamePhase.CurseItemChoice, pendingCurseItemChoices: candidates.map(c => c.id) };
        }

        // swap-race-from-discard: if player has a race, replace with last Race in discardDoor (or just lose race)
        if (curse.curseEffect === 'swap-race-from-discard') {
          const currentRaces = activePlayer.equipped.filter(c => c.type === CardType.Race);
          if (currentRaces.length === 0) {
            // No race — no effect
            return {
              ...state,
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...state.discardDoor, curse],
            };
          }
          // Remove current race(s) from equipped
          const raceIds = new Set(currentRaces.map(c => c.id));
          const equippedWithoutRace = activePlayer.equipped.filter(c => !raceIds.has(c.id));
          // Search discardDoor from last to first for a Race card
          const raceIdx = [...state.discardDoor].reverse().findIndex(c => c.type === CardType.Race);
          if (raceIdx === -1) {
            // No Race in discard — just lose race
            const { equipped: afterSM, removedSangMele } = removeSangMeleIfRaceless(equippedWithoutRace);
            return {
              ...updatePlayer(state, withCombatPower({ ...activePlayer, equipped: afterSM })),
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...state.discardDoor, curse, ...currentRaces, ...(removedSangMele ? [removedSangMele] : [])],
            };
          }
          // Found: the actual index in original array
          const actualIdx = state.discardDoor.length - 1 - raceIdx;
          const newRace = state.discardDoor[actualIdx]!;
          const newDiscardDoor = [
            ...state.discardDoor.slice(0, actualIdx),
            ...state.discardDoor.slice(actualIdx + 1),
            curse,
            ...currentRaces,
          ];
          return {
            ...updatePlayer(state, withCombatPower({
              ...activePlayer,
              equipped: [...equippedWithoutRace, newRace],
            })),
            phase: GamePhase.Loot,
            pendingCurse: undefined,
            discardDoor: newDiscardDoor,
          };
        }

        // swap-class-from-discard: if player has a class, replace with last Class in discardDoor (or just lose class)
        if (curse.curseEffect === 'swap-class-from-discard') {
          const currentClasses = activePlayer.equipped.filter(c => c.type === CardType.Class);
          if (currentClasses.length === 0) {
            // No class — no effect
            return {
              ...state,
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [...state.discardDoor, curse],
            };
          }
          // Remove all current class cards from equipped + SM cleanup
          const classIds = new Set(currentClasses.map(c => c.id));
          const equippedWithoutClass = activePlayer.equipped.filter(c => !classIds.has(c.id));
          const { equipped: afterSM, removedSuperMunchkin } = removeSuperMunchkinIfClassless(equippedWithoutClass);
          // Search discardDoor from last to first for a Class card
          const classIdx = [...state.discardDoor].reverse().findIndex(c => c.type === CardType.Class);
          if (classIdx === -1) {
            // No Class in discard — just lose class
            return {
              ...updatePlayer(state, withCombatPower({ ...activePlayer, equipped: afterSM })),
              phase: GamePhase.Loot,
              pendingCurse: undefined,
              discardDoor: [
                ...state.discardDoor, curse, ...currentClasses,
                ...(removedSuperMunchkin ? [removedSuperMunchkin] : []),
              ],
            };
          }
          // Found: pull it out of discard and equip it (replaces all previous classes)
          const actualIdx = state.discardDoor.length - 1 - classIdx;
          const newClass = state.discardDoor[actualIdx]!;
          const newDiscardDoor = [
            ...state.discardDoor.slice(0, actualIdx),
            ...state.discardDoor.slice(actualIdx + 1),
            curse,
            ...currentClasses,
            ...(removedSuperMunchkin ? [removedSuperMunchkin] : []),
          ];
          // Re-equip with SM stripped (they now have exactly 1 class — no need for SM)
          return {
            ...updatePlayer(state, withCombatPower({
              ...activePlayer,
              equipped: [...afterSM, newClass],
            })),
            phase: GamePhase.Loot,
            pendingCurse: undefined,
            discardDoor: newDiscardDoor,
          };
        }

        // lose-two-cards: left neighbor takes 1 random hand card, then right neighbor takes 1 random hand card
        if (curse.curseEffect === 'lose-two-cards') {
          const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
          const n = state.players.length;
          const leftId = state.players[(idx - 1 + n) % n]!.id;
          const rightId = state.players[(idx + 1) % n]!.id;

          let remaining = [...activePlayer.hand];
          let nextState = state;

          if (remaining.length > 0) {
            const i1 = Math.floor(Math.random() * remaining.length);
            const [stolen1] = remaining.splice(i1, 1);
            const left = getPlayer(nextState, leftId)!;
            nextState = updatePlayer(nextState, { ...left, hand: [...left.hand, stolen1!] });
          }

          if (remaining.length > 0) {
            const i2 = Math.floor(Math.random() * remaining.length);
            const [stolen2] = remaining.splice(i2, 1);
            const right = getPlayer(nextState, rightId)!;
            nextState = updatePlayer(nextState, { ...right, hand: [...right.hand, stolen2!] });
          }

          return {
            ...updatePlayer(nextState, { ...activePlayer, hand: remaining }),
            phase: GamePhase.Loot,
            pendingCurse: undefined,
            discardDoor: [...state.discardDoor, curse],
          };
        }

        // persistent-equip: curse card moves to player.equipped as a permanent debuff
        if (curse.curseEffect === 'persistent-equip') {
          return {
            ...updatePlayer(state, { ...activePlayer, equipped: [...activePlayer.equipped, curse] }),
            phase: GamePhase.Loot,
            pendingCurse: undefined,
          };
        }

        const { player: cursedPlayer, discardedTreasure, discardedDebuffs, detachedDoorCards } = applyCurse(activePlayer, curse);
        return {
          ...updatePlayer(state, cursedPlayer),
          phase: GamePhase.Loot,
          pendingCurse: undefined,
          discardDoor: [
            ...state.discardDoor, curse,
            ...(discardedDebuffs ?? []),
            ...(detachedDoorCards ?? []),
          ],
          discardTreasure: discardedTreasure
            ? [...state.discardTreasure, discardedTreasure]
            : state.discardTreasure,
        };
      }

      // ---------------------------------------------------------------
      case 'END_TURN': {
        return startNextTurn(state);
      }

      // ---------------------------------------------------------------
      case 'GIVE_ITEM': {
        const giver = getPlayer(state, _playerId)!;
        const item = giver.equipped.find(c => c.id === action.itemId)!;
        const { kept: giverEquipped, detachedDoor } = splitAttachments(giver.equipped, new Set([action.itemId]));
        const updatedGiver = withCombatPower({ ...giver, equipped: giverEquipped });
        const recipient = getPlayer(state, action.targetPlayerId)!;
        const updatedRecipient = withCombatPower({ ...recipient, equipped: [...recipient.equipped, item] });
        let s = updatePlayer(updatePlayer(state, updatedGiver), updatedRecipient);
        if (detachedDoor.length > 0) s = { ...s, discardDoor: [...s.discardDoor, ...detachedDoor] };
        return s;
      }

      // ---------------------------------------------------------------
      case 'PICK_BODY_LOOT': {
        const picker = getPlayer(state, _playerId)!;
        const card = state.bodyPillagingItems!.find(c => c.id === action.cardId)!;
        const remainingItems = state.bodyPillagingItems!.filter(c => c.id !== action.cardId);
        const [, ...nextQueue] = state.bodyPillagingQueue!;
        const updatedPicker = withCombatPower({ ...picker, hand: [...picker.hand, card] });
        const baseState = updatePlayer(state, updatedPicker);

        if (nextQueue.length === 0 || remainingItems.length === 0) {
          const toDoor = remainingItems.filter(c => c.type !== CardType.Treasure);
          const toTreasure = remainingItems.filter(c => c.type === CardType.Treasure);
          return {
            ...baseState,
            ...postCombatTransition(baseState),
            bodyPillagingItems: undefined,
            bodyPillagingQueue: undefined,
            discardDoor: [...state.discardDoor, ...toDoor],
            discardTreasure: [...state.discardTreasure, ...toTreasure],
          };
        }

        return { ...baseState, bodyPillagingItems: remainingItems, bodyPillagingQueue: nextQueue };
      }
    }
  },

  nextPhase(state: GameState): GameState {
    switch (state.phase) {
      case GamePhase.MonsterFight:
      case GamePhase.Loot:
        return { ...state, phase: GamePhase.Charity };

      case GamePhase.Charity:
        return { ...state, phase: GamePhase.EndTurn };

      case GamePhase.EndTurn:
        return startNextTurn(state);

      case GamePhase.KickDown:
      default:
        return state;
    }
  },
} as const;
