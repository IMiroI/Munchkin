import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
} from '@munchkin/shared';

const SERVER_URL = `http://${window.location.hostname}:3001`;

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;

  constructor() {
    this.socket = io(SERVER_URL, {
      auth: { token: sessionStorage.getItem('jwt') ?? undefined },
      autoConnect: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
  ): Observable<Parameters<ServerToClientEvents[K]>[0]> {
    return new Observable((observer) => {
      const handler = (data: Parameters<ServerToClientEvents[K]>[0]) =>
        observer.next(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket as any).on(event, handler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => (this.socket as any).off(event, handler);
    });
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as any).emit(event, ...args);
  }

  get connected$(): Observable<void> {
    return new Observable((observer) => {
      this.socket.on('connect', () => observer.next());
      return () => this.socket.off('connect');
    });
  }

  get disconnected$(): Observable<string> {
    return new Observable((observer) => {
      const handler = (reason: string) => observer.next(reason);
      this.socket.on('disconnect', handler);
      return () => this.socket.off('disconnect', handler);
    });
  }

  get roomCreated$(): Observable<{ roomId: string; code: string }> {
    return this.on('room:created');
  }

  get roomUpdated$(): Observable<RoomState> {
    return this.on('room:updated');
  }

  get roomDestroyed$(): Observable<{ roomId: string }> {
    return this.on('room:destroyed');
  }

  get roomError$(): Observable<{ message: string }> {
    return this.on('room:error');
  }

  get gameStarted$(): Observable<RoomState> {
    return this.on('game:started');
  }

  /** Reconnect with the current JWT from sessionStorage (call after auth). */
  reconnect(): void {
    this.socket.auth = { token: sessionStorage.getItem('jwt') ?? undefined };
    this.socket.disconnect();
    this.socket.connect();
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
