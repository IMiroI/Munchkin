import type { GameState } from './game';
import type { ClientGameAction, ActionLogEntry } from './action';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
}

export type RoomStatus = 'waiting' | 'playing';

export interface RoomState {
  id: string;
  code: string;
  hostId: string;
  players: RoomPlayer[];
  status: RoomStatus;
}

export interface ClientToServerEvents {
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: { code: string; playerName: string }) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:action': (gameId: string, action: ClientGameAction) => void;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; code: string }) => void;
  'room:updated': (state: RoomState) => void;
  'room:destroyed': (data: { roomId: string }) => void;
  'room:error': (error: { message: string }) => void;
  'game:started': (state: RoomState) => void;
  'game:state': (state: GameState) => void;
  'game:log': (entry: ActionLogEntry) => void;
}
