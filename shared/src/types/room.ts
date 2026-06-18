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
  'game:help:request': (gameId: string, helperId: string) => void;
  'game:help:accept': (gameId: string, requesterId: string) => void;
  'game:help:decline': (gameId: string, requesterId: string) => void;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; code: string }) => void;
  'room:updated': (state: RoomState) => void;
  'room:destroyed': (data: { roomId: string }) => void;
  'room:error': (error: { message: string }) => void;
  'game:started': (state: RoomState) => void;
  'game:state': (state: GameState) => void;
  'game:log': (entry: ActionLogEntry) => void;
  'game:help:requested': (data: { gameId: string; requesterId: string; requesterName: string }) => void;
  'game:help:responded': (data: { gameId: string; helperId: string; helperName: string; accepted: boolean }) => void;
}
