import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { GameState } from '@munchkin/shared';
import type { ActionLogEntry, ClientGameAction } from '@munchkin/shared';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly socket = inject(SocketService);

  // ---------------------------------------------------------------------------
  // Core state
  // ---------------------------------------------------------------------------

  readonly gameState = signal<GameState | null>(null);
  readonly actionLog  = signal<ActionLogEntry[]>([]);
  readonly lastError  = signal<string | null>(null);

  /** Current user's player ID — read from the JWT sub claim at boot. */
  readonly myPlayerId = signal<string>(this.readPlayerIdFromJwt());

  // ---------------------------------------------------------------------------
  // Derived signals (all O(1), purely computed)
  // ---------------------------------------------------------------------------

  readonly phase       = computed(() => this.gameState()?.phase ?? null);
  readonly currentPlayerId = computed(() => this.gameState()?.currentPlayerId ?? null);
  readonly isMyTurn    = computed(() => this.currentPlayerId() === this.myPlayerId());
  readonly monster      = computed(() => this.gameState()?.currentMonster ?? null);
  readonly monsterPower = computed(() => this.monster()?.power ?? 0);
  readonly pendingCurse = computed(() => this.gameState()?.pendingCurse ?? null);

  readonly allPlayers  = computed(() => this.gameState()?.players ?? []);

  readonly myPlayer = computed(() =>
    this.allPlayers().find(p => p.id === this.myPlayerId()) ?? null,
  );

  readonly myHand     = computed(() => this.myPlayer()?.hand ?? []);
  readonly myEquipped = computed(() => this.myPlayer()?.equipped ?? []);

  /** During Charity: true if the active player must discard (they are lowest or tied for lowest among living players) */
  readonly charityMustDiscard = computed(() => {
    const me = this.myPlayer();
    if (!me) return false;
    const livingOthers = this.allPlayers().filter(p => p.id !== me.id && !p.isDead);
    if (livingOthers.length === 0) return true;
    const minLiving = Math.min(...livingOthers.map(p => p.level));
    return me.level <= minLiving;
  });

  /** During Charity: living players tied for the lowest level (empty if mustDiscard) */
  readonly charityTargets = computed(() => {
    if (this.charityMustDiscard()) return [];
    const me = this.myPlayer();
    if (!me) return [];
    const others = this.allPlayers().filter(p => p.id !== me.id && !p.isDead);
    if (others.length === 0) return [];
    const minLevel = Math.min(...others.map(p => p.level));
    return others.filter(p => p.level === minLevel);
  });

  readonly myTotalPower = computed(() => this.myPlayer()?.combatPower ?? 0);

  /** Maximum cards the player may hold at end of turn (5 + race bonus) */
  readonly myMaxHandSize = computed(() => {
    const bonus = this.myEquipped().reduce((sum, c) => sum + (c.raceHandSizeBonus ?? 0), 0);
    return 5 + bonus;
  });

  /** Last 5 log entries, newest last. */
  readonly recentLog = computed(() => this.actionLog().slice(-5));

  /** Card drawn face-up from the door deck (visible to all) */
  readonly lastRevealedCard = computed(() => this.gameState()?.lastRevealedCard ?? null);

  // ---------------------------------------------------------------------------
  // Socket subscriptions
  // ---------------------------------------------------------------------------

  constructor() {
    const destroyRef = inject(DestroyRef);

    const s1 = this.socket
      .on('game:state')
      .subscribe(state => this.gameState.set(state));

    const s2 = this.socket
      .on('game:log')
      .subscribe(entry =>
        this.actionLog.update(log => [...log.slice(-99), entry]),
      );

    const s3 = this.socket
      .on('game:error')
      .subscribe(err => {
        this.lastError.set(err.message);
        setTimeout(() => this.lastError.set(null), 4000);
      });

    destroyRef.onDestroy(() => { s1.unsubscribe(); s2.unsubscribe(); s3.unsubscribe(); });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  sendAction(gameId: string, action: ClientGameAction): void {
    this.socket.emit('game:action', gameId, action);
  }

  setMyPlayerId(id: string): void {
    this.myPlayerId.set(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private readPlayerIdFromJwt(): string {
    try {
      const jwt = sessionStorage.getItem('jwt');
      if (!jwt) return '';
      const payload = JSON.parse(atob(jwt.split('.')[1]!)) as { sub?: string };
      return payload.sub ?? '';
    } catch {
      return '';
    }
  }
}
