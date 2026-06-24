import { GamePhase, CardType, playerRace, playerClass, playerClasses } from '@munchkin/shared';
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
    return withCombatPower({ ...player, equipped: [], hand: [] });
  }
  return withCombatPower({ ...player, level: Math.max(1, player.level + delta) });
}

function disperseDeadItems(
  player: Player,
  discardDoor: Card[],
  discardTreasure: Card[],
): { discardDoor: Card[]; discardTreasure: Card[] } {
  const all = [...player.equipped, ...player.hand];
  const toDoor = all.filter(
    c =>
      c.type === CardType.Class ||
      c.type === CardType.Race ||
      c.type === CardType.DoorCurse ||
      c.type === CardType.Monster ||
      c.type === CardType.MonsterBooster ||
      c.type === CardType.Special,
  );
  const toTreasure = all.filter(c => c.type === CardType.Treasure);
  return {
    discardDoor: [...discardDoor, ...toDoor],
    discardTreasure: [...discardTreasure, ...toTreasure],
  };
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
 * When equipped items are removed, also pull any attached cards (bypassesItemRestrictions).
 * Returns the attachment cards that must be added to discardDoor.
 */
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
function postCombatTransition(state: GameState): Pick<GameState, 'phase' | 'currentPlayerId' | 'transferOriginalPlayerId'> {
  if (state.transferOriginalPlayerId) {
    return { phase: GamePhase.Loot, currentPlayerId: state.transferOriginalPlayerId, transferOriginalPlayerId: undefined };
  }
  return { phase: GamePhase.Charity, currentPlayerId: state.currentPlayerId, transferOriginalPlayerId: undefined };
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

    case 'lose-race':
      return {
        player: withCombatPower({
          ...player,
          equipped: player.equipped.filter(c => c.type !== CardType.Race),
        }),
      };

    case 'duck-of-doom': {
      const powerItems = player.equipped.filter(
        c => c.type === CardType.Treasure && c.power != null,
      );
      const most = powerItems.reduce<Card | undefined>(
        (best, c) => (!best || (c.power ?? 0) > (best.power ?? 0) ? c : best),
        undefined,
      );
      if (!most) return { player };
      const { kept: keptD, detachedDoor: detD } = splitAttachments(player.equipped, new Set([most.id]));
      return {
        player: withCombatPower({ ...player, equipped: keptD }),
        discardedTreasure: most,
        detachedDoorCards: detD.length > 0 ? detD : undefined,
      };
    }

    case 'lose-big-item': {
      const bigItems = player.equipped.filter(c => c.type === CardType.Treasure && c.isBigItem);
      if (bigItems.length === 0) return { player };
      const item = bigItems[0]!;
      const { kept: keptB, detachedDoor: detB } = splitAttachments(player.equipped, new Set([item.id]));
      return {
        player: withCombatPower({ ...player, equipped: keptB }),
        discardedTreasure: item,
        detachedDoorCards: detB.length > 0 ? detB : undefined,
      };
    }

    case 'lose-small-item': {
      const smallItems = player.equipped.filter(
        c => c.type === CardType.Treasure && !c.isBigItem && c.power != null,
      );
      if (smallItems.length === 0) return { player };
      const item = smallItems[0]!;
      const { kept: keptS, detachedDoor: detS } = splitAttachments(player.equipped, new Set([item.id]));
      return {
        player: withCombatPower({ ...player, equipped: keptS }),
        discardedTreasure: item,
        detachedDoorCards: detS.length > 0 ? detS : undefined,
      };
    }

    case 'lose-two-cards': {
      // Simplified: remove first 2 cards from hand.
      return { player: { ...player, hand: player.hand.slice(2) } };
    }

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
        if (!monster?.avoidable) return false;
        if (monster.halflingMustFight && playerRace(getPlayer(state, playerId)!) === 'halfling') return false;
        return true;
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
        return target?.equipped.some(c => c.id === action.targetItemId) ?? false;
      }

      case 'CHOOSE_CURSE_ITEM':
        return (
          isActivePlayer &&
          state.phase === GamePhase.CurseItemChoice &&
          (state.pendingCurseItemChoices?.includes(action.cardId) ?? false)
        );

      case 'SET_SUPER_MUNCHKIN_MODE': {
        const p = getPlayer(state, playerId)!;
        return p.equipped.some(c => c.isSuperMunchkin);
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
          const hasSuperMunchkin = player.equipped.some(c => c.isSuperMunchkin);
          if (card.requiredClass != null && !classes.includes(card.requiredClass)) return false;
          if (!hasSuperMunchkin && card.forbiddenClass != null && classes.includes(card.forbiddenClass)) return false;
          if (card.requiredRace != null && playerRace(player) !== card.requiredRace) return false;
          if (card.requiredNoRace && playerRace(player) != null) return false;
          if (card.handUsage != null) {
            const replaceIds = new Set(action.replaceEquippedIds ?? []);
            const handsAfterRemoval = player.equipped.reduce(
              (sum, c) => sum + (replaceIds.has(c.id) ? 0 : (c.handUsage ?? 0)),
              0,
            );
            if (handsAfterRemoval + card.handUsage > 2) return false;
          }
          // Big-item limit: max 1, +1 per extraBigItemSlot equipped
          if (card.isBigItem) {
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

        // Steal-level cards require a valid target (another player)
        if (card.stealLevel) {
          const target = state.players.find(p => p.id === action.targetId);
          return target != null && target.id !== playerId;
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
        const others = state.players.filter(p => p.id !== playerId);
        if (others.length === 0) return false;
        const minLevel = Math.min(...others.map(p => p.level));
        const target = state.players.find(p => p.id === action.targetPlayerId);
        return target != null && target.level === minLevel;
      }

      case 'END_TURN': {
        if (!isActivePlayer || state.phase !== GamePhase.Charity) return false;
        const player = getPlayer(state, playerId);
        return player != null && player.hand.length <= 5;
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
          return { ...base, phase: GamePhase.MonsterFight, currentMonster: card };
        }

        if (card.type === CardType.DoorCurse) {
          const isImmune = activePlayer.equipped.some(e => e.immuneToDoorCurse);
          if (isImmune) {
            return { ...base, phase: GamePhase.Loot, discardDoor: [...base.discardDoor, card] };
          }
          return { ...base, phase: GamePhase.CurseReaction, pendingCurse: card };
        }

        // Class / Race / Special / MonsterBooster go to active player's hand
        const updatedPlayer = { ...activePlayer, hand: [...activePlayer.hand, card] };
        return { ...updatePlayer(base, updatedPlayer), phase: GamePhase.Loot };
      }

      // ---------------------------------------------------------------
      case 'LOOT_ROOM': {
        const { cards, deck, discard } = drawFromDoor(state.doorDeck, state.discardDoor, 1);
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const updatedPlayer = { ...activePlayer, hand: [...activePlayer.hand, ...cards] };
        return {
          ...updatePlayer(state, updatedPlayer),
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
        return {
          ...updatePlayer(state, updatedPlayer),
          phase: GamePhase.MonsterFight,
          currentMonster: monster,
        };
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
          power: (state.currentMonster!.power ?? 0) + monsterBonusPower + additionalMonsterPower,
        };

        const hasPriestResurrection = activePlayer.equipped.some(c => c.classResurrection);

        const { winner, playerGains, playerLoses, newTreasureDeck } =
          CombatResolver.resolveCombat(
            activePlayer,
            monster,
            helpers,
            allBonusCards,
            state.treasureDeck,
            state.currentMonster!.rawLevelOnly,
            turningBonus + berserkerBonus,
            hasPriestResurrection,
          );

        if (winner === 'player') {
          const extraMonsters = state.additionalMonsters ?? [];
          const allKilledMonsters = [state.currentMonster!, ...extraMonsters];

          const levelsGained = allKilledMonsters.reduce((sum, m) => sum + (m.levelsOnKill ?? 1), 0);
          const baseDiscardDoor = [...state.discardDoor, ...allKilledMonsters, ...turningDoor, ...berserkerDoor];
          const baseDiscardTreasure = [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure];
          const combatCleanup = {
            currentMonster: undefined as Card | undefined,
            additionalMonsters: undefined as Card[] | undefined,
            combatBonusCards: undefined as Card[] | undefined,
            combatMonsterBonusCards: undefined as Card[] | undefined,
            forcedHelperId: undefined as string | undefined,
            combatLevelCap: undefined as number | undefined,
          };

          if (hasPriestResurrection) {
            // Priest resurrection: defer treasure draw, enter PriestResurrection phase
            const totalTreasureCount = allKilledMonsters.reduce(
              (sum, m) => sum + CombatResolver.treasureCount(m), 0,
            );
            const playerAfterLevel = withCombatPower({
              ...activePlayer,
              level: Math.min(activePlayer.level + levelsGained, state.combatLevelCap ?? 10),
              hand: handWithoutAll,
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

          const updatedActive = withCombatPower({
            ...activePlayer,
            level: Math.min(activePlayer.level + levelsGained, state.combatLevelCap ?? 10),
            hand: [...handWithoutAll, ...allGained],
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
        const levelDelta = playerLoses ?? -1;
        const isDeath = levelDelta <= -99;

        const allDefeatedMonsters = [monster, ...(state.additionalMonsters ?? [])];

        const applyMonsterBadStuff = (p: Player, dead: boolean): Player => {
          if (state.currentMonster!.badStuffSetToMinLevel) {
            const minLevel = Math.min(...state.players.map(pl => pl.level));
            return { ...p, level: Math.min(p.level, minLevel) };
          }
          return applyLevelChange(p, levelDelta, dead);
        };

        if (isDeath) {
          const basePlayer = { ...activePlayer, hand: handWithoutAll };
          const { discardDoor, discardTreasure } = disperseDeadItems(
            basePlayer,
            [...state.discardDoor, ...allDefeatedMonsters, ...turningDoor, ...berserkerDoor],
            [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards, ...turningTreasure, ...berserkerTreasure],
          );
          const deadPlayer = applyMonsterBadStuff(basePlayer, true);
          return {
            ...updatePlayer(state, deadPlayer),
            ...postCombatTransition(state),
            discardDoor,
            discardTreasure,
            currentMonster: undefined,
            additionalMonsters: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        const updatedPlayer = applyMonsterBadStuff(
          { ...activePlayer, hand: handWithoutAll },
          false,
        );

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
            neighborDiscardTarget: state.currentPlayerId,
            neighborDiscardQueue: neighborQueue,
          };
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
        const escaped = action.dieRoll + equippedFleeBonus >= 5;

        const runBonusCards = state.combatBonusCards ?? [];
        const runMonsterBonusCards = state.combatMonsterBonusCards ?? [];
        const allRunBonusCards = [...runBonusCards, ...runMonsterBonusCards];
        const baseState = wizardBoost > 0 ? updatePlayer(state, runnerAfterBoost) : state;
        const baseDiscardTreasure = [...(baseState.discardTreasure), ...wizardDiscardedTreasure];
        const baseDiscardDoor = [...(baseState.discardDoor), ...wizardDiscardedDoor];

        if (escaped) {
          const monsterPenalty = monster.fleeSuccessPenalty ?? 0;
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
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (state.currentMonster?.fleeSuccessPenalty ?? 0),
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
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (monster.fleeSuccessPenalty ?? 0),
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
            pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (state.currentMonster?.fleeSuccessPenalty ?? 0),
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

        // Race card: equip, replace existing race
        if (card.type === CardType.Race) {
          const existingRace = player.equipped.find(c => c.type === CardType.Race);
          const newEquipped = [
            ...player.equipped.filter(c => c.type !== CardType.Race),
            card,
          ];
          return {
            ...updatePlayer(state, withCombatPower({ ...player, hand: handWithout, equipped: newEquipped })),
            discardDoor: existingRace ? [...state.discardDoor, existingRace] : state.discardDoor,
          };
        }

        // Curse played manually on a target player
        if (card.type === CardType.DoorCurse && action.targetId) {
          const target = getPlayer(state, action.targetId);
          if (!target) return state;
          const { player: cursedTarget, discardedTreasure } = applyCurse(target, card);
          return {
            ...updatePlayer(updatePlayer(state, { ...player, hand: handWithout }), cursedTarget),
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
        const receiver = getPlayer(state, targetPlayerId);
        if (!receiver) return state;

        return {
          ...state,
          players: state.players.map(p => {
            if (p.id === giver.id)       return { ...p, hand: p.hand.filter(c => c.id !== cardId) };
            if (p.id === targetPlayerId) return { ...p, hand: [...p.hand, card] };
            return p;
          }),
        };
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
        const fleePenalty = (state.pendingFleePenalty ?? 0) + (monster.fleeSuccessPenalty ?? 0);
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
        const item = target.equipped.find(c => c.id === action.targetItemId)!;
        const { kept: keptEquipped, detachedDoor } = splitAttachments(target.equipped, new Set([item.id]));
        const updatedTarget = { ...target, equipped: keptEquipped };
        const remainingQueue = (state.neighborDiscardQueue ?? []).slice(1);
        const victimHasMoreItems = updatedTarget.equipped.length > 0;
        const queueContinues = remainingQueue.length > 0 && victimHasMoreItems;

        if (queueContinues) {
          return {
            ...updatePlayer(state, updatedTarget),
            discardTreasure: [...state.discardTreasure, item],
            neighborDiscardQueue: remainingQueue,
          };
        }

        return {
          ...updatePlayer(state, updatedTarget),
          ...postCombatTransition(state),
          discardTreasure: [...state.discardTreasure, item],
          neighborDiscardTarget: undefined,
          neighborDiscardQueue: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'SET_SUPER_MUNCHKIN_MODE': {
        const p = getPlayer(state, _playerId)!;
        return updatePlayer(state, { ...p, superMunchkinMode: action.mode });
      }

      // ---------------------------------------------------------------
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
        if (action.choice === 'hand') {
          const handDoor = p.hand.filter(c => c.type !== CardType.Treasure);
          const handTreasure = p.hand.filter(c => c.type === CardType.Treasure);
          return {
            ...updatePlayer(state, withCombatPower({ ...p, hand: [] })),
            ...postCombatTransition(state),
            discardDoor: [...state.discardDoor, ...handDoor],
            discardTreasure: [...state.discardTreasure, ...handTreasure],
          };
        }
        const levelDelta = state.pendingBadStuffLevels ?? -1;
        const updatedP = applyLevelChange(p, levelDelta, false);
        return {
          ...updatePlayer(state, updatedP),
          ...postCombatTransition(state),
        };
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
          pendingFleePenalty: (state.pendingFleePenalty ?? 0) + (state.currentMonster?.fleeSuccessPenalty ?? 0),
        };
      }

      // ---------------------------------------------------------------
      case 'CHOOSE_CURSE_ITEM': {
        const p = getPlayer(state, state.currentPlayerId)!;
        const item = p.equipped.find(c => c.id === action.cardId)!;
        const { kept, detachedDoor } = splitAttachments(p.equipped, new Set([item.id]));
        return {
          ...updatePlayer(state, withCombatPower({ ...p, equipped: kept })),
          phase: GamePhase.Loot,
          pendingCurse: undefined,
          pendingCurseItemChoices: undefined,
          discardDoor: [...state.discardDoor, ...(state.pendingCurse ? [state.pendingCurse] : []), ...detachedDoor],
          discardTreasure: [...state.discardTreasure, item],
        };
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
        const levelDelta = CombatResolver.badStuffLevelLoss(monster);
        const isDeath = levelDelta <= -99;

        const allFleeMonsters = [monster, ...(state.additionalMonsters ?? [])];

        const applyFleeBadStuff = (p: Player, dead: boolean): Player => {
          if (monster.badStuffSetToMinLevel) {
            const minLevel = Math.min(...state.players.map(pl => pl.level));
            return { ...p, level: Math.min(p.level, minLevel) };
          }
          return applyLevelChange(p, levelDelta, dead);
        };

        if (isDeath) {
          const { discardDoor, discardTreasure } = disperseDeadItems(
            activePlayer,
            [...state.discardDoor, ...allFleeMonsters],
            state.discardTreasure,
          );
          const deadPlayer = applyFleeBadStuff(activePlayer, true);
          return {
            ...updatePlayer(state, deadPlayer),
            ...postCombatTransition(state),
            discardDoor,
            discardTreasure,
            currentMonster: undefined,
            additionalMonsters: undefined,
          };
        }

        const updatedPlayer = applyFleeBadStuff(activePlayer, false);

        // badStuffChoiceLevelsOrHand: player chooses between level loss or discarding entire hand
        if (monster.badStuffChoiceLevelsOrHand) {
          return {
            ...state,
            phase: GamePhase.BadStuffChoice,
            pendingBadStuffLevels: levelDelta,
            discardDoor: [...state.discardDoor, ...allFleeMonsters],
            currentMonster: undefined,
            additionalMonsters: undefined,
          };
        }

        // badStuffLoseAllBigItems: player loses all equipped big items
        if (monster.badStuffLoseAllBigItems) {
          const bigItemIds = new Set(updatedPlayer.equipped.filter(c => c.isBigItem).map(c => c.id));
          if (bigItemIds.size > 0) {
            const { kept, detachedDoor } = splitAttachments(updatedPlayer.equipped, bigItemIds);
            const lostBigItems = updatedPlayer.equipped.filter(c => bigItemIds.has(c.id));
            const playerAfterLoss = withCombatPower({ ...updatedPlayer, equipped: kept });
            return {
              ...updatePlayer(state, playerAfterLoss),
              ...postCombatTransition(state),
              discardDoor: [...state.discardDoor, ...allFleeMonsters, ...detachedDoor],
              discardTreasure: [...state.discardTreasure, ...lostBigItems],
              currentMonster: undefined,
              additionalMonsters: undefined,
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
            discardDoor: [...state.discardDoor, ...allFleeMonsters],
            currentMonster: undefined,
            additionalMonsters: undefined,
            neighborDiscardTarget: state.currentPlayerId,
            neighborDiscardQueue: neighborQueue,
          };
        }

        return {
          ...updatePlayer(state, updatedPlayer),
          ...postCombatTransition(state),
          discardDoor: [...state.discardDoor, ...allFleeMonsters],
          currentMonster: undefined,
          additionalMonsters: undefined,
        };
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
        return {
          ...state,
          phase: GamePhase.KickDown,
          currentPlayerId: nextPlayerId(state),
          currentMonster: undefined,
        };
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
        return {
          ...state,
          phase: GamePhase.KickDown,
          currentPlayerId: nextPlayerId(state),
          currentMonster: undefined,
        };

      case GamePhase.KickDown:
      default:
        return state;
    }
  },
} as const;
