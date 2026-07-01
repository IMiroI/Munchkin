import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { RoomState } from '@munchkin/shared';
import { SocketService } from '../services/socket.service';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './lobby.component.html',
  host: { style: 'display:block;min-height:100dvh;' },
})
export class LobbyComponent implements OnInit {
  private readonly socket = inject(SocketService);
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly step = signal<'auth' | 'lobby' | 'room'>('auth');
  protected readonly playerName = signal('');
  protected readonly nameInput = signal('');
  protected readonly genderInput = signal<'male' | 'female'>('male');
  protected readonly joinCode = signal('');
  protected readonly roomState = signal<RoomState | null>(null);
  protected readonly error = signal('');
  protected readonly isLoading = signal(false);

  protected readonly isHost = computed(() => {
    const room = this.roomState();
    const myId = this.gameService.myPlayerId();
    return !!room && room.hostId === myId;
  });

  protected readonly canStart = computed(
    () => this.isHost() && (this.roomState()?.players.length ?? 0) >= 3,
  );

  ngOnInit(): void {
    fetch('/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { playerId?: string; name?: string } | null) => {
        if (data?.playerId) {
          this.gameService.setMyPlayerId(data.playerId);
          this.playerName.set(data.name ?? '');
          this.step.set('lobby');
        }
      })
      .catch(() => { /* non authentifié, rester sur l'écran d'auth */ });

    const s1 = this.socket.on('room:updated').subscribe(state => {
      this.roomState.set(state);
      this.step.set('room');
    });

    const s2 = this.socket.on('room:destroyed').subscribe(() => {
      this.roomState.set(null);
      this.step.set('lobby');
    });

    const s3 = this.socket.on('room:error').subscribe(err => {
      this.error.set(err.message);
    });

    const s4 = this.socket.on('game:started').subscribe(() => {
      this.router.navigate(['/game']);
    });

    this.destroyRef.onDestroy(() => {
      s1.unsubscribe();
      s2.unsubscribe();
      s3.unsubscribe();
      s4.unsubscribe();
    });
  }

  protected async submitName(): Promise<void> {
    const name = this.nameInput().trim();
    if (!name) return;
    this.isLoading.set(true);
    this.error.set('');
    try {
      const resp = await fetch('/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, gender: this.genderInput() }),
      });
      if (!resp.ok) throw new Error('Server error');
      const data = await resp.json() as { playerId: string; name: string; gender: 'male' | 'female' };
      // Pas de sessionStorage — le cookie httpOnly est défini automatiquement par le serveur
      this.gameService.setMyPlayerId(data.playerId);
      this.playerName.set(data.name);
      this.socket.reconnect();
      this.step.set('lobby');
    } catch {
      this.error.set('Impossible de créer un compte invité. Serveur en ligne ?');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected createRoom(): void {
    this.error.set('');
    this.socket.emit('room:create', { playerName: this.playerName() });
  }

  protected joinRoom(): void {
    const code = this.joinCode().trim().toUpperCase();
    if (!code) return;
    this.error.set('');
    this.socket.emit('room:join', { code, playerName: this.playerName() });
  }

  protected leaveRoom(): void {
    this.socket.emit('room:leave');
    this.roomState.set(null);
    this.step.set('lobby');
  }

  protected startGame(): void {
    this.socket.emit('game:start');
  }
}
