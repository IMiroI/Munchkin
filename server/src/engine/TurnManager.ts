import { GamePhase, CardType, playerRace, playerClass } from '@munchkin/shared';
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
): { player: Player; discardedTreasure?: Card } {
  const effect: CurseEffect = curse.curseEffect ?? 'generic';

  switch (effect) {
    case 'lose-level':
      return { player: withCombatPower({ ...player, level: Math.max(1, player.level - 1) }) };

    case 'lose-class':
      return {
        player: withCombatPower({
          ...player,
          equipped: player.equipped.filter(c => c.type !== CardType.Class),
        }),
      };

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
      return {
        player: withCombatPower({
          ...player,
          equipped: player.equipped.filter(c => c.id !== most.id),
        }),
        discardedTreasure: most,
      };
    }

    case 'lose-big-item': {
      const bigItems = player.equipped.filter(c => c.type === CardType.Treasure && c.isBigItem);
      if (bigItems.length === 0) return { player };
      const item = bigItems[0]!;
      return {
        player: withCombatPower({
          ...player,
          equipped: player.equipped.filter(c => c.id !== item.id),
        }),
        discardedTreasure: item,
      };
    }

    case 'lose-small-item': {
      const smallItems = player.equipped.filter(
        c => c.type === CardType.Treasure && !c.isBigItem && c.power != null,
      );
      if (smallItems.length === 0) return { player };
      const item = smallItems[0]!;
      return {
        player: withCombatPower({
          ...player,
          equipped: player.equipped.filter(c => c.id !== item.id),
        }),
        discardedTreasure: item,
      };
    }

    case 'lose-two-cards': {
      // Simplified: remove first 2 cards from hand.
      return { player: { ...player, hand: player.hand.slice(2) } };
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
        const fightingPlayer = getPlayer(state, playerId);
        if (!fightingPlayer) return false;
        const hasDoubler = action.bonusCardIds.some(
          id => fightingPlayer.hand.find(c => c.id === id)?.doublesPlayerStrength,
        );
        if (hasDoubler && action.helperIds.length > 0) return false;
        return true;
      }

      case 'RUN_AWAY':
        return (
          isActivePlayer &&
          (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.ForcedFlee) &&
          state.currentMonster != null
        );

      case 'RESOLVE_CURSE':
        return isActivePlayer && state.phase === GamePhase.CurseReaction && state.pendingCurse != null;

      case 'RESOLVE_FLEE':
        return isActivePlayer && state.phase === GamePhase.FleeReaction;

      case 'RESOLVE_FLEE_SUCCESS':
        return isActivePlayer && state.phase === GamePhase.FleeSuccessReaction;

      case 'PLAY_CARD': {
        const player = getPlayer(state, playerId);
        if (!player) return false;
        const card =
          player.hand.find(c => c.id === action.cardId) ??
          player.equipped.find(c => c.id === action.cardId);
        if (!card) return false;

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

        // autoFleeThreshold: discard equipped/hand item during combat to flee if monster power ≤ threshold
        if (card.autoFleeThreshold != null) {
          return (
            isActivePlayer &&
            (state.phase === GamePhase.MonsterFight || state.phase === GamePhase.FleeReaction) &&
            state.currentMonster != null &&
            (state.currentMonster.power ?? 0) <= card.autoFleeThreshold
          );
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

        // Race, Class, and equippable items can be played at any time by any player (Munchkin rule)
        const isEquippable =
          card.type === CardType.Race ||
          card.type === CardType.Class ||
          (card.type === CardType.Treasure && card.power != null && !card.isOneShot && card.levelUp == null);
        if (isEquippable) {
          if (card.requiredClass != null && playerClass(player) !== card.requiredClass) return false;
          if (card.forbiddenClass != null && playerClass(player) === card.forbiddenClass) return false;
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
        const handBonusCards = activePlayer.hand.filter(c => bonusCardIds.includes(c.id));
        const stateBonusCards = state.combatBonusCards ?? [];
        const allBonusCards = [...stateBonusCards, ...handBonusCards];
        const monsterBonusCards = state.combatMonsterBonusCards ?? [];
        const monsterBonusPower = monsterBonusCards.reduce((sum, c) => sum + (c.power ?? 0), 0);
        const monster = {
          ...state.currentMonster!,
          power: (state.currentMonster!.power ?? 0) + monsterBonusPower,
        };

        const { winner, playerGains, playerLoses, newTreasureDeck } =
          CombatResolver.resolveCombat(
            activePlayer,
            monster,
            helpers,
            allBonusCards,
            state.treasureDeck,
          );

        const usedBonusIds = new Set(bonusCardIds);
        const handWithoutBonus = activePlayer.hand.filter(c => !usedBonusIds.has(c.id));

        if (winner === 'player') {
          const gained = playerGains ?? [];
          const levelsGained = monster.levelsOnKill ?? 1;
          const updatedActive = withCombatPower({
            ...activePlayer,
            level: Math.min(activePlayer.level + levelsGained, state.combatLevelCap ?? 10),
            hand: [...handWithoutBonus, ...gained],
          });

          let nextState: GameState = updatePlayer(state, updatedActive);

          // Elf helpers gain a level when they help kill a monster (capped at 9)
          for (const helper of helpers) {
            if (playerRace(helper) === 'elf') {
              const boostedHelper = withCombatPower({
                ...helper,
                level: Math.min(helper.level + 1, 9),
              });
              nextState = updatePlayer(nextState, boostedHelper);
            }
          }

          return {
            ...nextState,
            ...postCombatTransition(state),
            treasureDeck: newTreasureDeck,
            discardDoor: [...state.discardDoor, monster],
            discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards],
            currentMonster: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        // Monster wins — apply bad stuff
        const levelDelta = playerLoses ?? -1;
        const isDeath = levelDelta <= -99;

        if (isDeath) {
          const { discardDoor, discardTreasure } = disperseDeadItems(
            { ...activePlayer, hand: handWithoutBonus },
            [...state.discardDoor, monster],
            [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards],
          );
          const deadPlayer = applyLevelChange({ ...activePlayer, hand: handWithoutBonus }, levelDelta, true);
          return {
            ...updatePlayer(state, deadPlayer),
            ...postCombatTransition(state),
            discardDoor,
            discardTreasure,
            currentMonster: undefined,
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        const updatedPlayer = applyLevelChange(
          { ...activePlayer, hand: handWithoutBonus },
          levelDelta,
          false,
        );
        return {
          ...updatePlayer(state, updatedPlayer),
          ...postCombatTransition(state),
          discardDoor: [...state.discardDoor, monster],
          discardTreasure: [...state.discardTreasure, ...allBonusCards, ...monsterBonusCards],
          currentMonster: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'RUN_AWAY': {
        const monster = state.currentMonster!;
        const activeRunner = getPlayer(state, state.currentPlayerId)!;
        const equippedFleeBonus = activeRunner.equipped.reduce(
          (sum, c) => sum + (c.fleeBonus ?? 0),
          0,
        );
        const escaped = action.dieRoll + equippedFleeBonus >= 5;

        const runBonusCards = state.combatBonusCards ?? [];
        const runMonsterBonusCards = state.combatMonsterBonusCards ?? [];
        const allRunBonusCards = [...runBonusCards, ...runMonsterBonusCards];

        if (escaped) {
          return {
            ...state,
            ...fleeSuccess(),
            discardTreasure: [...state.discardTreasure, ...allRunBonusCards],
            combatBonusCards: undefined,
            combatMonsterBonusCards: undefined,
            forcedHelperId: undefined,
            combatLevelCap: undefined,
          };
        }

        // Failed flee roll — enter FleeReaction to allow auto-flee cards before bad stuff
        return {
          ...state,
          phase: GamePhase.FleeReaction,
          discardTreasure: [...state.discardTreasure, ...allRunBonusCards],
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
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

        // Transfer-combat one-shot: swap currentPlayerId to target, save original for post-combat Loot
        if (card.transferCombat && action.targetId) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            currentPlayerId: action.targetId,
            transferOriginalPlayerId: _playerId,
            discardTreasure: [...state.discardTreasure, card],
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
            discardDoor: [...state.discardDoor, monster],
            discardTreasure: [...state.discardTreasure, card, ...allCombatBonusCards],
            currentMonster: undefined,
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
            forcedHelperId: undefined,
            combatLevelCap: undefined,
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
            forcedHelperId: undefined,
            combatLevelCap: undefined,
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

        // Auto-flee one-shot: played after a failed flee roll — player escapes, enters FleeSuccessReaction
        if (card.autoFlee && state.phase === GamePhase.FleeReaction) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            ...fleeSuccess(),
            discardTreasure: [...state.discardTreasure, card],
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
          return {
            ...updatePlayer(state, updatedPlayer),
            discardTreasure: [...state.discardTreasure, card],
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

          const updatedPlayer = withCombatPower({
            ...player,
            hand: handWithout,
            equipped: [...player.equipped.filter(c => !discardIds.has(c.id)), card],
          });
          return {
            ...updatePlayer(state, updatedPlayer),
            discardTreasure: toDiscard.length > 0
              ? [...state.discardTreasure, ...toDiscard]
              : state.discardTreasure,
          };
        }

        // Class card: equip, replace existing class
        if (card.type === CardType.Class) {
          const existingClass = player.equipped.find(c => c.type === CardType.Class);
          const newEquipped = [
            ...player.equipped.filter(c => c.type !== CardType.Class),
            card,
          ];
          return {
            ...updatePlayer(state, withCombatPower({ ...player, hand: handWithout, equipped: newEquipped })),
            discardDoor: existingClass ? [...state.discardDoor, existingClass] : state.discardDoor,
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
        const updatedFleePlayer = fleeTreasureCount > 0
          ? { ...fleePlayer, hand: [...fleePlayer.hand, ...fleeGained] }
          : fleePlayer;
        return {
          ...updatePlayer(state, updatedFleePlayer),
          ...postCombatTransition(state),
          treasureDeck: fleeTreasureDeck,
          discardDoor: [...state.discardDoor, monster],
          currentMonster: undefined,
          combatBonusCards: undefined,
          combatMonsterBonusCards: undefined,
          forcedHelperId: undefined,
          combatLevelCap: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'RESOLVE_FLEE': {
        const monster = state.currentMonster!;
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const levelDelta = CombatResolver.badStuffLevelLoss(monster);
        const isDeath = levelDelta <= -99;

        if (isDeath) {
          const { discardDoor, discardTreasure } = disperseDeadItems(
            activePlayer,
            [...state.discardDoor, monster],
            state.discardTreasure,
          );
          const deadPlayer = applyLevelChange(activePlayer, levelDelta, true);
          return {
            ...updatePlayer(state, deadPlayer),
            ...postCombatTransition(state),
            discardDoor,
            discardTreasure,
            currentMonster: undefined,
          };
        }

        const updatedPlayer = applyLevelChange(activePlayer, levelDelta, false);
        return {
          ...updatePlayer(state, updatedPlayer),
          ...postCombatTransition(state),
          discardDoor: [...state.discardDoor, monster],
          currentMonster: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'RESOLVE_CURSE': {
        const curse = state.pendingCurse;
        if (!curse) return state;
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const { player: cursedPlayer, discardedTreasure } = applyCurse(activePlayer, curse);
        return {
          ...updatePlayer(state, cursedPlayer),
          phase: GamePhase.Loot,
          pendingCurse: undefined,
          discardDoor: [...state.discardDoor, curse],
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
