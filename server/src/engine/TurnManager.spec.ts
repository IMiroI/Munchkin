import { describe, it, expect } from 'vitest';
import { GamePhase, CardType } from '@munchkin/shared';
import type { GameState, Player, Card } from '@munchkin/shared';
import { TurnManager } from './TurnManager.js';

// ---------------------------------------------------------------------------
// Fixtures — use semantic fields (classId, raceId, curseEffect, levelUp)
// so the engine doesn't rely on hard-coded card IDs.
// ---------------------------------------------------------------------------

const MONSTER: Card = { id: 'd-001', name: 'Plante d\'Ornement', type: CardType.Monster, power: 1, treasuresOnKill: 1, badStuffLevel: -1 };
const CURSE_LEVEL: Card  = { id: 'd-039', name: 'Malédiction !',       type: CardType.DoorCurse, curseEffect: 'lose-level' };
const CURSE_CLASS: Card  = { id: 'd-049', name: 'Déclassé !',          type: CardType.DoorCurse, curseEffect: 'lose-class' };
const CURSE_RACE: Card   = { id: 'd-048', name: 'Commun des Mortels',  type: CardType.DoorCurse, curseEffect: 'lose-race' };
const CURSE_DOOM: Card   = { id: 'd-044', name: 'Canard de l\'Apoc.', type: CardType.DoorCurse, curseEffect: 'duck-of-doom' };
const CLASS_WARRIOR: Card = { id: 'd-022', name: 'Guerrier', type: CardType.Class, classId: 'warrior' };
const CLASS_WIZARD: Card  = { id: 'd-036', name: 'Magicien', type: CardType.Class, classId: 'wizard' };
const RACE_ELF: Card     = { id: 'd-011', name: 'Elfe',     type: CardType.Race,  raceId: 'elf' };
const RACE_DWARF: Card   = { id: 'd-065', name: 'Nain',     type: CardType.Race,  raceId: 'dwarf' };
const EQUIPMENT: Card    = { id: 't-016', name: 'Bottes',   type: CardType.Treasure, power: 2 };
const LEVEL_UP: Card     = { id: 't-051', name: 'Pillaaaaaaage !', type: CardType.Treasure, levelUp: 1 };

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return { id, name: id, level: 1, combatPower: 1, hand: [], equipped: [], gender: 'male', ...overrides };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'game-1',
    phase: GamePhase.KickDown,
    players: [
      makePlayer('p1'),
      makePlayer('p2'),
      makePlayer('p3'),
    ],
    doorDeck: [],
    treasureDeck: [],
    discardDoor: [],
    discardTreasure: [],
    currentPlayerId: 'p1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateAction
// ---------------------------------------------------------------------------

describe('TurnManager.validateAction', () => {
  it('allows KICK_DOOR for active player in KickDown phase', () => {
    const state = makeState();
    expect(TurnManager.validateAction(state, 'p1', { type: 'KICK_DOOR' })).toBe(true);
  });

  it('rejects KICK_DOOR for non-active player', () => {
    const state = makeState();
    expect(TurnManager.validateAction(state, 'p2', { type: 'KICK_DOOR' })).toBe(false);
  });

  it('rejects KICK_DOOR in wrong phase', () => {
    const state = makeState({ phase: GamePhase.Loot });
    expect(TurnManager.validateAction(state, 'p1', { type: 'KICK_DOOR' })).toBe(false);
  });

  it('allows FIGHT_MONSTER in MonsterFight with a current monster', () => {
    const state = makeState({ phase: GamePhase.MonsterFight, currentMonster: MONSTER });
    expect(TurnManager.validateAction(state, 'p1', { type: 'FIGHT_MONSTER', helperIds: [], bonusCardIds: [] })).toBe(true);
  });

  it('rejects FIGHT_MONSTER without a current monster', () => {
    const state = makeState({ phase: GamePhase.MonsterFight });
    expect(TurnManager.validateAction(state, 'p1', { type: 'FIGHT_MONSTER', helperIds: [], bonusCardIds: [] })).toBe(false);
  });

  it('allows PLAY_CARD if player has the card in KickDown', () => {
    const state = makeState({
      players: [makePlayer('p1', { hand: [EQUIPMENT] }), makePlayer('p2'), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p1', { type: 'PLAY_CARD', cardId: EQUIPMENT.id })).toBe(true);
  });

  it('rejects PLAY_CARD if player does not have the card', () => {
    const state = makeState();
    expect(TurnManager.validateAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'unknown' })).toBe(false);
  });

  it('allows out-of-turn PLAY_CARD in MonsterFight', () => {
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: MONSTER,
      players: [makePlayer('p1'), makePlayer('p2', { hand: [EQUIPMENT] }), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p2', { type: 'PLAY_CARD', cardId: EQUIPMENT.id })).toBe(true);
  });

  it('allows non-active player to equip an item at any phase (KickDown)', () => {
    const state = makeState({
      phase: GamePhase.KickDown,
      players: [makePlayer('p1'), makePlayer('p2', { hand: [EQUIPMENT] }), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p2', { type: 'PLAY_CARD', cardId: EQUIPMENT.id })).toBe(true);
  });

  it('allows non-active player to play a Race card at any phase (Charity)', () => {
    const state = makeState({
      phase: GamePhase.Charity,
      players: [makePlayer('p1'), makePlayer('p2', { hand: [RACE_ELF] }), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p2', { type: 'PLAY_CARD', cardId: RACE_ELF.id })).toBe(true);
  });

  it('allows non-active player to play a Class card at any phase (Loot)', () => {
    const state = makeState({
      phase: GamePhase.Loot,
      players: [makePlayer('p1'), makePlayer('p2', { hand: [CLASS_WARRIOR] }), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p2', { type: 'PLAY_CARD', cardId: CLASS_WARRIOR.id })).toBe(true);
  });

  it('rejects non-active player playing a non-equippable card outside MonsterFight', () => {
    const state = makeState({
      phase: GamePhase.KickDown,
      players: [makePlayer('p1'), makePlayer('p2', { hand: [LEVEL_UP] }), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p2', { type: 'PLAY_CARD', cardId: LEVEL_UP.id })).toBe(false);
  });

  it('allows DONATE_CARD in Charity for the giver', () => {
    const state = makeState({
      phase: GamePhase.Charity,
      players: [makePlayer('p1', { hand: [EQUIPMENT] }), makePlayer('p2'), makePlayer('p3')],
    });
    expect(TurnManager.validateAction(state, 'p1', { type: 'DONATE_CARD', cardId: EQUIPMENT.id, targetPlayerId: 'p2' })).toBe(true);
  });

  it('allows END_TURN in Charity for active player', () => {
    const state = makeState({ phase: GamePhase.Charity });
    expect(TurnManager.validateAction(state, 'p1', { type: 'END_TURN' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyAction — KICK_DOOR
// ---------------------------------------------------------------------------

describe('TurnManager.applyAction — KICK_DOOR', () => {
  it('draws a monster → enters MonsterFight', () => {
    const state = makeState({ doorDeck: [MONSTER] });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.phase).toBe(GamePhase.MonsterFight);
    expect(next.currentMonster?.id).toBe(MONSTER.id);
    expect(next.doorDeck).toHaveLength(0);
  });

  it('draws a class card → goes to hand, enters Loot', () => {
    const state = makeState({ doorDeck: [CLASS_WARRIOR] });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.phase).toBe(GamePhase.Loot);
    expect(next.players[0]!.hand).toContainEqual(CLASS_WARRIOR);
  });

  it('draws "Lose a Level" curse → p1 loses 1 level', () => {
    const state = makeState({
      doorDeck: [CURSE_LEVEL],
      players: [makePlayer('p1', { level: 3, combatPower: 3 }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.phase).toBe(GamePhase.Loot);
    expect(next.players[0]!.level).toBe(2);
    expect(next.discardDoor).toContainEqual(CURSE_LEVEL);
  });

  it('"Lose a Level" curse cannot drop below level 1', () => {
    const state = makeState({ doorDeck: [CURSE_LEVEL] });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.players[0]!.level).toBe(1);
  });

  it('"Lose Your Class" curse removes equipped class', () => {
    const state = makeState({
      doorDeck: [CURSE_CLASS],
      players: [
        makePlayer('p1', { equipped: [CLASS_WARRIOR] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.players[0]!.equipped.find(c => c.type === CardType.Class)).toBeUndefined();
  });

  it('"Lose Your Race" curse removes equipped race', () => {
    const state = makeState({
      doorDeck: [CURSE_RACE],
      players: [makePlayer('p1', { equipped: [RACE_ELF] }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.players[0]!.equipped.find(c => c.type === CardType.Race)).toBeUndefined();
  });

  it('"Duck of Doom" curse removes most powerful equipped item', () => {
    const weak: Card = { id: 't-018', name: 'Casque', type: CardType.Treasure, power: 1 };
    const state = makeState({
      doorDeck: [CURSE_DOOM],
      players: [
        makePlayer('p1', { equipped: [EQUIPMENT, weak] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'KICK_DOOR' });
    expect(next.players[0]!.equipped).not.toContainEqual(EQUIPMENT);
    expect(next.players[0]!.equipped).toContainEqual(weak);
    expect(next.discardTreasure).toContainEqual(EQUIPMENT);
  });
});

// ---------------------------------------------------------------------------
// applyAction — PLAY_CARD
// ---------------------------------------------------------------------------

describe('TurnManager.applyAction — PLAY_CARD', () => {
  it('equips a treasure item', () => {
    const state = makeState({
      players: [makePlayer('p1', { hand: [EQUIPMENT] }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: EQUIPMENT.id });
    expect(next.players[0]!.hand).not.toContainEqual(EQUIPMENT);
    expect(next.players[0]!.equipped).toContainEqual(EQUIPMENT);
    expect(next.players[0]!.combatPower).toBe(1 + 2); // level + equipment bonus
  });

  it('playing level-up card grants +1 level (max 9)', () => {
    const state = makeState({
      players: [makePlayer('p1', { level: 5, combatPower: 5, hand: [LEVEL_UP] }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: LEVEL_UP.id });
    expect(next.players[0]!.level).toBe(6);
    expect(next.discardTreasure).toContainEqual(LEVEL_UP);
  });

  it('level-up card cannot exceed level 9', () => {
    const state = makeState({
      players: [makePlayer('p1', { level: 9, hand: [LEVEL_UP] }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: LEVEL_UP.id });
    expect(next.players[0]!.level).toBe(9);
  });

  it('equipping a class card replaces the existing one', () => {
    const state = makeState({
      players: [
        makePlayer('p1', { hand: [CLASS_WIZARD], equipped: [CLASS_WARRIOR] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: CLASS_WIZARD.id });
    expect(next.players[0]!.equipped.find(c => c.type === CardType.Class)?.id).toBe(CLASS_WIZARD.id);
    expect(next.discardDoor).toContainEqual(CLASS_WARRIOR);
  });

  it('equipping a race card replaces the existing one', () => {
    const state = makeState({
      players: [
        makePlayer('p1', { hand: [RACE_DWARF], equipped: [RACE_ELF] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: RACE_DWARF.id });
    expect(next.players[0]!.equipped.find(c => c.type === CardType.Race)?.id).toBe(RACE_DWARF.id);
    expect(next.discardDoor).toContainEqual(RACE_ELF);
  });

  it('playing a one-shot item discards it to treasure pile', () => {
    const potion: Card = { id: 't-053', name: 'Potion Acide', type: CardType.Treasure, power: 3, isOneShot: true };
    const state = makeState({
      players: [makePlayer('p1', { hand: [potion] }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: potion.id });
    expect(next.players[0]!.hand).not.toContainEqual(potion);
    expect(next.players[0]!.equipped).not.toContainEqual(potion);
    expect(next.discardTreasure).toContainEqual(potion);
  });
});

// ---------------------------------------------------------------------------
// applyAction — FIGHT_MONSTER
// ---------------------------------------------------------------------------

describe('TurnManager.applyAction — FIGHT_MONSTER', () => {
  it('player wins: gains a level and draws treasures', () => {
    const treasure: Card = { id: 't-016', name: 'Bottes', type: CardType.Treasure, power: 2 };
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: MONSTER, // power 1, treasuresOnKill 1
      players: [makePlayer('p1', { level: 5, combatPower: 5 }), makePlayer('p2'), makePlayer('p3')],
      treasureDeck: [treasure],
    });
    const next = TurnManager.applyAction(state, 'p1', {
      type: 'FIGHT_MONSTER',
      helperIds: [],
      bonusCardIds: [],
    });
    expect(next.phase).toBe(GamePhase.Charity);
    expect(next.players[0]!.level).toBe(6);
    expect(next.players[0]!.hand).toContainEqual(treasure);
    expect(next.currentMonster).toBeUndefined();
  });

  it('monster wins: player loses levels', () => {
    const bigMonster: Card = {
      id: 'd-005', name: 'Belvédère Sauvage', type: CardType.Monster,
      power: 8, badStuffLevel: -3,
    };
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: bigMonster,
      players: [makePlayer('p1', { level: 3, combatPower: 3 }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', {
      type: 'FIGHT_MONSTER',
      helperIds: [],
      bonusCardIds: [],
    });
    expect(next.phase).toBe(GamePhase.Charity);
    expect(next.players[0]!.level).toBe(1); // 3 - 3 = 0 → capped at 1
  });

  it('death monster (power 20, badStuffLevel -99) clears equipment but keeps level (Munchkin rule)', () => {
    const deathMonster: Card = {
      id: 'd-010', name: 'Dragon de Plutonium', type: CardType.Monster,
      power: 20, badStuffLevel: -99,
    };
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: deathMonster,
      players: [
        makePlayer('p1', { level: 5, combatPower: 7, equipped: [EQUIPMENT] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', {
      type: 'FIGHT_MONSTER',
      helperIds: [],
      bonusCardIds: [],
    });
    // Rule: "Vous gardez votre niveau ainsi que vos Malédictions" — level is preserved on death
    expect(next.players[0]!.level).toBe(5);
    expect(next.players[0]!.equipped).toHaveLength(0);
    expect(next.players[0]!.hand).toHaveLength(0);
  });

  it('Elf helper (raceId) gains a level when player wins', () => {
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: MONSTER,
      players: [
        makePlayer('p1', { level: 5, combatPower: 5 }),
        makePlayer('p2', { level: 3, combatPower: 3, equipped: [RACE_ELF] }),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', {
      type: 'FIGHT_MONSTER',
      helperIds: ['p2'],
      bonusCardIds: [],
    });
    expect(next.players[1]!.level).toBe(4); // Elf gains a level
  });

  it('non-Elf helper does NOT gain a level', () => {
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: MONSTER,
      players: [
        makePlayer('p1', { level: 5 }),
        makePlayer('p2', { level: 3 }),
        makePlayer('p3'),
      ],
    });
    const next = TurnManager.applyAction(state, 'p1', {
      type: 'FIGHT_MONSTER',
      helperIds: ['p2'],
      bonusCardIds: [],
    });
    expect(next.players[1]!.level).toBe(3); // unchanged
  });
});

// ---------------------------------------------------------------------------
// applyAction — RUN_AWAY
// ---------------------------------------------------------------------------

describe('TurnManager.applyAction — RUN_AWAY', () => {
  it('die roll >= 5 → escape, move to Charity (no loot, still check hand limit)', () => {
    const state = makeState({ phase: GamePhase.MonsterFight, currentMonster: MONSTER });
    const next = TurnManager.applyAction(state, 'p1', { type: 'RUN_AWAY', dieRoll: 5 });
    expect(next.phase).toBe(GamePhase.Charity);
    expect(next.currentMonster).toBeUndefined();
    expect(next.discardDoor).toContainEqual(MONSTER);
  });

  it('die roll < 5 → failed escape, monster inflicts bad stuff, move to Charity', () => {
    const state = makeState({
      phase: GamePhase.MonsterFight,
      currentMonster: MONSTER, // badStuffLevel -1
      players: [makePlayer('p1', { level: 3, combatPower: 3 }), makePlayer('p2'), makePlayer('p3')],
    });
    const next = TurnManager.applyAction(state, 'p1', { type: 'RUN_AWAY', dieRoll: 4 });
    expect(next.phase).toBe(GamePhase.Charity);
    expect(next.players[0]!.level).toBe(2); // MONSTER badStuffLevel -1
  });
});

// ---------------------------------------------------------------------------
// applyAction — END_TURN
// ---------------------------------------------------------------------------

describe('TurnManager.applyAction — END_TURN', () => {
  it('advances to next player and resets to KickDown', () => {
    const state = makeState({ phase: GamePhase.Charity, currentPlayerId: 'p1' });
    const next = TurnManager.applyAction(state, 'p1', { type: 'END_TURN' });
    expect(next.phase).toBe(GamePhase.KickDown);
    expect(next.currentPlayerId).toBe('p2');
  });

  it('wraps around to first player after last player', () => {
    const state = makeState({ phase: GamePhase.Charity, currentPlayerId: 'p3' });
    const next = TurnManager.applyAction(state, 'p3', { type: 'END_TURN' });
    expect(next.currentPlayerId).toBe('p1');
  });
});

// ---------------------------------------------------------------------------
// nextPhase
// ---------------------------------------------------------------------------

describe('TurnManager.nextPhase', () => {
  it('MonsterFight → Charity', () => {
    const state = makeState({ phase: GamePhase.MonsterFight });
    expect(TurnManager.nextPhase(state).phase).toBe(GamePhase.Charity);
  });
  it('Loot → Charity', () => {
    const state = makeState({ phase: GamePhase.Loot });
    expect(TurnManager.nextPhase(state).phase).toBe(GamePhase.Charity);
  });
  it('Charity → EndTurn', () => {
    const state = makeState({ phase: GamePhase.Charity });
    expect(TurnManager.nextPhase(state).phase).toBe(GamePhase.EndTurn);
  });
  it('EndTurn → KickDown and advances player', () => {
    const state = makeState({ phase: GamePhase.EndTurn });
    const next = TurnManager.nextPhase(state);
    expect(next.phase).toBe(GamePhase.KickDown);
    expect(next.currentPlayerId).toBe('p2');
  });
  it('KickDown stays KickDown (branching handled by KICK_DOOR action)', () => {
    const state = makeState({ phase: GamePhase.KickDown });
    expect(TurnManager.nextPhase(state).phase).toBe(GamePhase.KickDown);
  });
});
