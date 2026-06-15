import { GamePhase, CardType } from '@munchkin/shared';
import type { GameState, Player } from '@munchkin/shared';
import { DeckManager } from './DeckManager.js';
import { CombatResolver } from './CombatResolver.js';
import type { GameAction } from './types.js';

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
    return withCombatPower({ ...player, level: 1, equipped: [] });
  }
  return withCombatPower({ ...player, level: Math.max(1, player.level + delta) });
}

/** Returns ID of the next player in turn order. */
function nextPlayerId(state: GameState): string {
  const idx = state.players.findIndex(p => p.id === state.currentPlayerId);
  const next = (idx + 1) % state.players.length;
  return state.players[next]!.id;
}

/** Draws `n` cards, reshuffling discard into deck if needed. */
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

import type { LevelChange } from './types.js';

// ---------------------------------------------------------------------------
// TurnManager
// ---------------------------------------------------------------------------

export const TurnManager = {
  /**
   * Validates whether `playerId` may perform `action` in the current state.
   * Non-active players may only donate cards or play certain out-of-turn cards.
   */
  validateAction(state: GameState, playerId: string, action: GameAction): boolean {
    const isActivePlayer = playerId === state.currentPlayerId;

    switch (action.type) {
      case 'KICK_DOOR':
        return isActivePlayer && state.phase === GamePhase.KickDown;

      case 'LOOT_ROOM':
      case 'LOOK_FOR_TROUBLE':
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
        // Equipment can be played in most phases; out-of-turn play allowed in MonsterFight
        const validPhase =
          state.phase === GamePhase.KickDown ||
          state.phase === GamePhase.MonsterFight ||
          state.phase === GamePhase.Loot;
        return hasCard && (isActivePlayer || state.phase === GamePhase.MonsterFight) && validPhase;
      }

      case 'DONATE_CARD': {
        if (state.phase !== GamePhase.Charity) return false;
        const player = getPlayer(state, playerId);
        return player != null && player.hand.some(c => c.id === action.cardId);
      }

      case 'END_TURN':
        return isActivePlayer && state.phase === GamePhase.Charity;

      default:
        return false;
    }
  },

  /**
   * Applies `action` to `state` and returns the new state.
   * Pure: does not mutate `state`.
   */
  applyAction(state: GameState, _playerId: string, action: GameAction): GameState {
    switch (action.type) {
      // ---------------------------------------------------------------
      case 'KICK_DOOR': {
        const { cards, deck, discard } = drawFromDoor(state.doorDeck, state.discardDoor, 1);
        const card = cards[0];
        if (!card) return state;

        const base = { ...state, doorDeck: deck, discardDoor: discard };

        if (card.type === CardType.Monster) {
          return { ...base, phase: GamePhase.MonsterFight, currentMonster: card };
        }

        // Curse or non-monster door card → go to Loot phase
        // Curses are placed in discard; class/race cards go to active player's hand
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const isDoorCurse = card.type === CardType.DoorCurse;
        const updatedPlayer: Player = isDoorCurse
          ? activePlayer
          : { ...activePlayer, hand: [...activePlayer.hand, card] };

        return {
          ...updatePlayer(base, updatedPlayer),
          phase: GamePhase.Loot,
          discardDoor: isDoorCurse ? [...base.discardDoor, card] : base.discardDoor,
        };
      }

      // ---------------------------------------------------------------
      case 'LOOT_ROOM': {
        // Draw 2 door cards face-down into active player's hand
        const { cards, deck, discard } = drawFromDoor(state.doorDeck, state.discardDoor, 2);
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
          const updatedPlayer = withCombatPower({
            ...activePlayer,
            level: Math.min(activePlayer.level + 1, 10),
            hand: [...handWithoutBonus, ...gained],
          });
          return {
            ...updatePlayer(state, updatedPlayer),
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
        const updatedPlayer = applyLevelChange(
          { ...activePlayer, hand: handWithoutBonus },
          levelDelta,
          isDeath,
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
        const nextPhase = escaped ? GamePhase.EndTurn : GamePhase.Charity;

        if (escaped) {
          return {
            ...state,
            phase: nextPhase,
            discardDoor: [...state.discardDoor, monster],
            currentMonster: undefined,
          };
        }

        // Failed to run — bad stuff applied
        const activePlayer = getPlayer(state, state.currentPlayerId)!;
        const levelDelta = CombatResolver.badStuffLevelLoss(monster);
        const isDeath = levelDelta <= -99;
        const updatedPlayer = applyLevelChange(activePlayer, levelDelta, isDeath);
        return {
          ...updatePlayer(state, updatedPlayer),
          phase: nextPhase,
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

        if (card.type === CardType.Treasure && card.power != null) {
          // Equip the item
          const updatedPlayer = withCombatPower({
            ...player,
            hand: handWithout,
            equipped: [...player.equipped, card],
          });
          return updatePlayer(state, updatedPlayer);
        }

        // Non-equipment cards: discard (full effect engine is out of scope here)
        const isDoorType =
          card.type === CardType.Monster ||
          card.type === CardType.DoorCurse ||
          card.type === CardType.Class ||
          card.type === CardType.Race;
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
            if (p.id === giver.id)    return { ...p, hand: p.hand.filter(c => c.id !== cardId) };
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

  /**
   * Advances state to the next phase along the default (non-branching) path.
   * Use applyAction(KICK_DOOR) for the KickDown → MonsterFight|Loot branch.
   *
   * MonsterFight → Charity
   * Loot        → Charity
   * Charity     → EndTurn
   * EndTurn     → KickDown (rotates to next player)
   */
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
        // Branching transition: caller must use applyAction(KICK_DOOR)
        return state;
    }
  },
} as const;
