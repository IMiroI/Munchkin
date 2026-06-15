import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import type { ClientToServerEvents, ServerToClientEvents, RoomPlayer } from '@munchkin/shared';
import { RoomManager } from './room/RoomManager.js';

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

io.use((socket, next) => {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf-8')
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

io.on('connection', (socket) => {
  const playerId = socket.data.playerId;
  console.log(`Client connected: ${socket.id} (playerId: ${playerId})`);

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

  socket.on('game:start', () => {
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
    const state = rooms.getRoomState(room.id)!;
    io.to(room.id).emit('game:started', state);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
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
