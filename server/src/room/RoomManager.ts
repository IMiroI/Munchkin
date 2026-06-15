import type { RoomPlayer, RoomState } from '@munchkin/shared';

const MAX_PLAYERS = 6;
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class RoomManager {
  private static instance: RoomManager;
  private rooms = new Map<string, RoomState>();

  private constructor() {}

  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  createRoom(hostId: string, hostName: string): string {
    const code = this.generateCode();
    const room: RoomState = {
      id: code,
      code,
      hostId,
      players: [{ id: hostId, name: hostName, isHost: true }],
      status: 'waiting',
    };
    this.rooms.set(code, room);
    return code;
  }

  joinRoom(roomId: string, player: RoomPlayer): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Game already started');
    if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full');
    if (room.players.some((p) => p.id === player.id)) return;
    room.players.push(player);
  }

  leaveRoom(roomId: string, playerId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    if (room.hostId === playerId) {
      const newHost = room.players[0];
      room.hostId = newHost.id;
      newHost.isHost = true;
    }

    return room;
  }

  getRoomState(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  findRoomByPlayerId(playerId: string): RoomState | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) return room;
    }
    return undefined;
  }

  setRoomStatus(roomId: string, status: RoomState['status']): void {
    const room = this.rooms.get(roomId);
    if (room) room.status = status;
  }

  private generateCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
