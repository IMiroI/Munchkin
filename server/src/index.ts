import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomPlayer,
  ActionLogEntry,
  GameState,
} from '@munchkin/shared';
import { GamePhase } from '@munchkin/shared';
import { RoomManager } from './room/RoomManager.js';
import { DeckManager, TurnManager } from './engine/index.js';
import type { GameAction } from './engine/index.js';
import { GameRepository } from './db/index.js';

const PORT = process.env['PORT'] ?? 3000;

const httpServer = createServer(app);

interface SocketData {
  playerId: string;
  playerName: string;
}

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST'],
  },
});

const rooms = RoomManager.getInstance();

/** playerId → socketId, for targeted help-negotiation events. */
const playerSockets = new Map<string, string>();

io.use((socket, next) => {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1]!, 'base64url').toString('utf-8')
      ) as { sub?: string; name?: string };
      socket.data.playerId = payload.sub ?? socket.id;
      socket.data.playerName = payload.name ?? 'Player';
    } catch {
      socket.data.playerId = socket.id;
      socket.data.playerName = 'Player';
    }
  } else {
    socket.data.playerId = socket.id;
    socket.data.playerName = 'Player';
  }
  next();
});

function buildLogEntry(
  state: GameState,
  newState: GameState,
  playerId: string,
  playerName: string,
  action: GameAction,
): ActionLogEntry {
  const ts = Date.now();
  switch (action.type) {
    case 'KICK_DOOR': {
      const monster = newState.currentMonster;
      return {
        playerName,
        description: monster
          ? `ouvre la porte… ${monster.name} !`
          : 'ouvre la porte — rien.',
        timestamp: ts,
      };
    }
    case 'LOOT_ROOM':
      return { playerName, description: 'pille la pièce vide.', timestamp: ts };
    case 'LOOK_FOR_TROUBLE': {
      const monster = newState.currentMonster;
      return { playerName, description: `cherche des ennuis avec ${monster?.name ?? '?'}.`, timestamp: ts };
    }
    case 'FIGHT_MONSTER': {
      const oldLevel = state.players.find(p => p.id === playerId)?.level ?? 1;
      const newLevel = newState.players.find(p => p.id === playerId)?.level ?? 1;
      return {
        playerName,
        description: newLevel > oldLevel
          ? `vainc le monstre ! (niveau ${newLevel})`
          : `perd le combat… (niveau ${newLevel})`,
        timestamp: ts,
      };
    }
    case 'RUN_AWAY':
      return {
        playerName,
        description: action.dieRoll >= 5
          ? `s'échappe ! (dé ${action.dieRoll})`
          : `ne s'échappe pas… (dé ${action.dieRoll})`,
        timestamp: ts,
      };
    case 'PLAY_CARD': {
      const card = state.players.find(p => p.id === playerId)?.hand.find(c => c.id === action.cardId);
      return { playerName, description: `joue ${card?.name ?? 'une carte'}.`, timestamp: ts };
    }
    case 'DONATE_CARD': {
      const card = state.players.find(p => p.id === playerId)?.hand.find(c => c.id === action.cardId);
      const target = state.players.find(p => p.id === action.targetPlayerId);
      return { playerName, description: `donne ${card?.name ?? 'une carte'} à ${target?.name ?? '?'}.`, timestamp: ts };
    }
    case 'PASS_LOOT':
      return { playerName, description: 'passe la phase de pillage.', timestamp: ts };
    case 'END_TURN':
      return { playerName, description: 'termine son tour.', timestamp: ts };
    case 'RESOLVE_CURSE':
      return { playerName, description: 'résout la malédiction.', timestamp: ts };
    case 'RESOLVE_FLEE':
      return { playerName, description: 'subit les conséquences de la fuite.', timestamp: ts };
    case 'RESOLVE_FLEE_SUCCESS':
      return { playerName, description: 'fuit avec succès.', timestamp: ts };
    case 'RETRY_FLEE':
      return { playerName, description: 'réessaie de fuir.', timestamp: ts };
    case 'SELL_ITEMS':
      return { playerName, description: 'vend des objets.', timestamp: ts };
    case 'CHOOSE_VICTIM_ITEM':
      return { playerName, description: 'choisit un objet à défausser.', timestamp: ts };
    case 'CHOOSE_CURSE_ITEM':
      return { playerName, description: 'choisit l\'objet à perdre.', timestamp: ts };
    case 'DISCARD_ITEM_TO_FLEE':
      return { playerName, description: 'défausse un objet pour fuir.', timestamp: ts };
    case 'SET_SUPER_MUNCHKIN_MODE':
      return { playerName, description: `passe en mode ${action.mode === 'dual' ? 'double classe' : 'super'}.`, timestamp: ts };
    case 'WIZARD_CHARM':
      return { playerName, description: 'charme un monstre (sort de charme).', timestamp: ts };
    default:
      return { playerName, description: 'joue une action.', timestamp: ts };
  }
}

io.on('connection', (socket) => {
  const playerId = socket.data.playerId;
  console.log(`Client connected: ${socket.id} (playerId: ${playerId})`);
  playerSockets.set(playerId, socket.id);

  // ── Lobby ──────────────────────────────────────────────────────────────────

  socket.on('room:create', ({ playerName }) => {
    const name = playerName || socket.data.playerName;
    const roomId = rooms.createRoom(playerId, name);
    socket.join(roomId);
    socket.emit('room:created', { roomId, code: roomId });
    const state = rooms.getRoomState(roomId)!;
    io.to(roomId).emit('room:updated', state);
  });

  socket.on('room:join', ({ code, playerName }) => {
    const roomId = code.toUpperCase();
    const player: RoomPlayer = {
      id: playerId,
      name: playerName || socket.data.playerName,
      isHost: false,
    };
    try {
      rooms.joinRoom(roomId, player);
      socket.join(roomId);
      const state = rooms.getRoomState(roomId)!;
      io.to(roomId).emit('room:updated', state);
    } catch (err) {
      socket.emit('room:error', { message: (err as Error).message });
    }
  });

  socket.on('room:leave', () => {
    const room = rooms.findRoomByPlayerId(playerId);
    if (!room) return;
    const roomId = room.id;
    socket.leave(roomId);
    const updatedRoom = rooms.leaveRoom(roomId, playerId);
    if (updatedRoom) {
      io.to(roomId).emit('room:updated', updatedRoom);
    } else {
      io.to(roomId).emit('room:destroyed', { roomId });
    }
  });

  // ── Game start ─────────────────────────────────────────────────────────────

  socket.on('game:start', async () => {
    const room = rooms.findRoomByPlayerId(playerId);
    if (!room) {
      socket.emit('room:error', { message: 'Not in a room' });
      return;
    }
    if (room.hostId !== playerId) {
      socket.emit('room:error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.length < 3) {
      socket.emit('room:error', { message: 'Need at least 3 players to start' });
      return;
    }

    rooms.setRoomStatus(room.id, 'playing');
    const roomState = rooms.getRoomState(room.id)!;
    io.to(room.id).emit('game:started', roomState);

    const { doorDeck, treasureDeck } = DeckManager.initDecks();

    // Rule: each player starts with 4 door cards + 4 treasure cards
    let dDeck = doorDeck;
    let tDeck = treasureDeck;
    const players: GameState['players'] = room.players.map(p => {
      const { cards: doorCards, newDeck: d } = DeckManager.draw(dDeck, 4);
      dDeck = d;
      const { cards: treasureCards, newDeck: t } = DeckManager.draw(tDeck, 4);
      tDeck = t;
      return { id: p.id, name: p.name, level: 1, combatPower: 1, hand: [...doorCards, ...treasureCards], equipped: [], gender: p.gender ?? 'male' };
    });

    const initialState: GameState = {
      id: room.id,
      phase: GamePhase.KickDown,
      players,
      doorDeck: dDeck,
      treasureDeck: tDeck,
      discardDoor: [],
      discardTreasure: [],
      currentPlayerId: room.players[0]!.id,
    };

    await GameRepository.saveState(room.id, initialState);
    io.to(room.id).emit('game:state', initialState);
  });

  // ── Game action ────────────────────────────────────────────────────────────

  socket.on('game:action', async (gameId, clientAction) => {
    try {
      const state = await GameRepository.loadState(gameId);
      if (!state) {
        socket.emit('room:error', { message: 'Partie introuvable' });
        return;
      }

      const action: GameAction = clientAction.type === 'RUN_AWAY'
        ? { type: 'RUN_AWAY', dieRoll: Math.ceil(Math.random() * 6) }
        : clientAction.type === 'THIEF_PICKPOCKET'
        ? { ...clientAction, dieRoll: Math.ceil(Math.random() * 6) }
        : clientAction;

      if (!TurnManager.validateAction(state, playerId, action)) {
        socket.emit('room:error', { message: 'Action invalide' });
        return;
      }

      const newState = TurnManager.applyAction(state, playerId, action);
      await GameRepository.saveState(gameId, newState);
      io.to(gameId).emit('game:state', newState);

      const logEntry = buildLogEntry(state, newState, playerId, socket.data.playerName, action);
      io.to(gameId).emit('game:log', logEntry);

      const winner = newState.players.find(p => p.level >= 10);
      if (winner) {
        const winLog: ActionLogEntry = {
          playerName: winner.name,
          description: 'gagne la partie ! 🎉',
          timestamp: Date.now(),
        };
        io.to(gameId).emit('game:log', winLog);

        try {
          await GameRepository.persistFinishedGame(gameId, {
            winnerId: winner.id,
            players: newState.players.map((p, i) => ({
              userId: p.id,
              finalLevel: p.level,
              rank: i + 1,
            })),
          });
        } catch {
          // PostgreSQL may not be configured; Redis cleanup still proceeds
        }
        await GameRepository.deleteState(gameId);
      }
    } catch (err) {
      console.error('game:action error:', err);
      socket.emit('room:error', { message: 'Erreur serveur' });
    }
  });

  // ── Help negotiation ───────────────────────────────────────────────────────

  socket.on('game:help:request', (gameId, helperId) => {
    const helperSocketId = playerSockets.get(helperId);
    if (!helperSocketId) return;
    const room = rooms.findRoomByPlayerId(playerId);
    const requesterName = room?.players.find(p => p.id === playerId)?.name ?? socket.data.playerName;
    io.to(helperSocketId).emit('game:help:requested', {
      gameId,
      requesterId: playerId,
      requesterName,
    });
  });

  socket.on('game:help:accept', (gameId, requesterId) => {
    const requesterSocketId = playerSockets.get(requesterId);
    if (!requesterSocketId) return;
    io.to(requesterSocketId).emit('game:help:responded', {
      gameId,
      helperId: playerId,
      helperName: socket.data.playerName,
      accepted: true,
    });
  });

  socket.on('game:help:decline', (gameId, requesterId) => {
    const requesterSocketId = playerSockets.get(requesterId);
    if (!requesterSocketId) return;
    io.to(requesterSocketId).emit('game:help:responded', {
      gameId,
      helperId: playerId,
      helperName: socket.data.playerName,
      accepted: false,
    });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    playerSockets.delete(playerId);
    const room = rooms.findRoomByPlayerId(playerId);
    if (!room) return;
    const roomId = room.id;
    const updatedRoom = rooms.leaveRoom(roomId, playerId);
    if (updatedRoom) {
      io.to(roomId).emit('room:updated', updatedRoom);
    } else {
      io.to(roomId).emit('room:destroyed', { roomId });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
