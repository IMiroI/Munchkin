import { GamePhase, CardType } from '@munchkin/shared';
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

      case 'FIGHT_MONSTER':
      case 'RUN_AWAY':
        return (
          isActivePlayer &&
          state.phase === GamePhase.MonsterFight &&
          state.currentMonster != null
        );

      case 'PLAY_CARD': {
        const player = getPlayer(state, playerId);
        if (!player) return false;
        const hasCard = player.hand.some(c => c.id === action.cardId);
        const validPhase =
          state.phase === GamePhase.KickDown ||
          state.phase === GamePhase.MonsterFight ||
          state.phase === GamePhase.Loot ||
          state.phase === GamePhase.Charity;
        return hasCard && (isActivePlayer || state.phase === GamePhase.MonsterFight) && validPhase;
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
          const { player: cursedPlayer, discardedTreasure } = applyCurse(activePlayer, card);
          return {
            ...updatePlayer(base, cursedPlayer),
            phase: GamePhase.Loot,
            discardDoor: [...base.discardDoor, card],
            discardTreasure: discardedTreasure
              ? [...state.discardTreasure, discardedTreasure]
              : state.discardTreasure,
          };
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
        const helpers = state.players.filter(p => helperIds.includes(p.id));
        const bonusCards = activePlayer.hand.filter(c => bonusCardIds.includes(c.id));
        const monster = state.currentMonster!;

        const { winner, playerGains, playerLoses, newTreasureDeck } =
          CombatResolver.resolveCombat(
            activePlayer,
            monster,
            helpers,
            bonusCards,
            state.treasureDeck,
          );

        const usedBonusIds = new Set(bonusCardIds);
        const handWithoutBonus = activePlayer.hand.filter(c => !usedBonusIds.has(c.id));

        if (winner === 'player') {
          const gained = playerGains ?? [];
          const updatedActive = withCombatPower({
            ...activePlayer,
            level: Math.min(activePlayer.level + 1, 10),
            hand: [...handWithoutBonus, ...gained],
          });

          let nextState: GameState = updatePlayer(state, updatedActive);

          // Elf helpers gain a level when they help kill a monster (capped at 9)
          for (const helper of helpers) {
            const isElf = helper.equipped.some(c => c.raceId === 'elf');
            if (isElf) {
              const boostedHelper = withCombatPower({
                ...helper,
                level: Math.min(helper.level + 1, 9),
              });
              nextState = updatePlayer(nextState, boostedHelper);
            }
          }

          return {
            ...nextState,
            phase: GamePhase.Charity,
            treasureDeck: newTreasureDeck,
            discardDoor: [...state.discardDoor, monster],
            discardTreasure: [...state.discardTreasure, ...bonusCards],
            currentMonster: undefined,
          };
        }

        // Monster wins — apply bad stuff
        const levelDelta = playerLoses ?? -1;
        const isDeath = levelDelta <= -99;

        if (isDeath) {
          const { discardDoor, discardTreasure } = disperseDeadItems(
            { ...activePlayer, hand: handWithoutBonus },
            [...state.discardDoor, monster],
            [...state.discardTreasure, ...bonusCards],
          );
          const deadPlayer = applyLevelChange({ ...activePlayer, hand: handWithoutBonus }, levelDelta, true);
          return {
            ...updatePlayer(state, deadPlayer),
            phase: GamePhase.Charity,
            discardDoor,
            discardTreasure,
            currentMonster: undefined,
          };
        }

        const updatedPlayer = applyLevelChange(
          { ...activePlayer, hand: handWithoutBonus },
          levelDelta,
          false,
        );
        return {
          ...updatePlayer(state, updatedPlayer),
          phase: GamePhase.Charity,
          discardDoor: [...state.discardDoor, monster],
          discardTreasure: [...state.discardTreasure, ...bonusCards],
          currentMonster: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'RUN_AWAY': {
        const monster = state.currentMonster!;
        const escaped = action.dieRoll >= 5;

        if (escaped) {
          // Rule: no level/treasure gained, skip Charity — advance to EndTurn
          return {
            ...state,
            phase: GamePhase.EndTurn,
            discardDoor: [...state.discardDoor, monster],
            currentMonster: undefined,
          };
        }

        // Caught — apply bad stuff, then proceed to Charity
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
            phase: GamePhase.Charity,
            discardDoor,
            discardTreasure,
            currentMonster: undefined,
          };
        }

        const updatedPlayer = applyLevelChange(activePlayer, levelDelta, false);
        return {
          ...updatePlayer(state, updatedPlayer),
          phase: GamePhase.Charity,
          discardDoor: [...state.discardDoor, monster],
          currentMonster: undefined,
        };
      }

      // ---------------------------------------------------------------
      case 'PLAY_CARD': {
        const player = getPlayer(state, _playerId)!;
        const card = player.hand.find(c => c.id === action.cardId);
        if (!card) return state;

        const handWithout = player.hand.filter(c => c.id !== action.cardId);

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

        // One-shot items (potions, single-use): discard to treasure pile
        if (card.type === CardType.Treasure && card.isOneShot) {
          return {
            ...updatePlayer(state, { ...player, hand: handWithout }),
            discardTreasure: [...state.discardTreasure, card],
          };
        }

        // Equippable treasure (has a combat power value)
        if (card.type === CardType.Treasure && card.power != null) {
          const updatedPlayer = withCombatPower({
            ...player,
            hand: handWithout,
            equipped: [...player.equipped, card],
          });
          return updatePlayer(state, updatedPlayer);
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

        // All other door-origin cards (Monster, DoorCurse, MonsterBooster, Special): discard to door pile
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
