import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { GamePhase } from '@munchkin/shared';
import { GameService } from '../../services/game.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-combat-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combat-overlay.component.html',
})
export class CombatOverlayComponent implements OnInit, OnDestroy {
  protected readonly gs = inject(GameService);
  private readonly socket = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly monster               = this.gs.monster;
  protected readonly additionalMonsters    = this.gs.additionalMonsters;
  protected readonly combatBonusCards      = this.gs.combatBonusCards;
  protected readonly combatMonsterBonusCards = this.gs.combatMonsterBonusCards;
  protected readonly myPower               = this.gs.myTotalPower;
  protected readonly monsterPower          = this.gs.monsterPower;
  protected readonly isMyTurn              = this.gs.isMyTurn;
  protected readonly phase                 = this.gs.phase;

  protected readonly isFleeReaction        = computed(() => this.phase() === GamePhase.FleeReaction);
  protected readonly isFleeSuccessReaction = computed(() => this.phase() === GamePhase.FleeSuccessReaction);

  protected readonly playerWins = computed(() => this.myPower() > this.monsterPower());
  protected readonly powerDiff  = computed(() => this.totalPowerWithHelpers() - this.monsterPower());
  protected readonly diffLabel  = computed(() => {
    const d = this.powerDiff();
    return d > 0 ? `+${d}` : String(d);
  });

  /** Other players available to request help from. */
  protected readonly otherPlayers = computed(() =>
    this.gs.allPlayers().filter(p => p.id !== this.gs.myPlayerId()),
  );

  // ── Help negotiation ───────────────────────────────────────────────────────

  /** Incoming help request (when we are the potential helper). */
  protected readonly incomingRequest = signal<{
    gameId: string;
    requesterId: string;
    requesterName: string;
  } | null>(null);

  /** Players we are waiting for a response from. */
  protected readonly pendingHelpTarget = signal<string | null>(null);

  /** Players who accepted to help. */
  protected readonly acceptedHelpers = signal<Array<{ id: string; name: string }>>([]);

  protected readonly acceptedHelperPower = computed(() =>
    this.acceptedHelpers()
      .map(h => this.gs.allPlayers().find(p => p.id === h.id))
      .reduce((sum, p) => sum + (p?.combatPower ?? 0), 0),
  );

  /** Power of the active player (not necessarily the viewer) — always the team's base. */
  protected readonly activePlayerCombatPower = computed(() => {
    const activeId = this.gs.currentPlayerId();
    return this.gs.allPlayers().find(p => p.id === activeId)?.combatPower ?? 0;
  });

  /** True for non-active players who accepted to help. */
  protected readonly isHelper = computed(() =>
    !this.isMyTurn() && this.acceptedHelpers().some(h => h.id === this.gs.myPlayerId()),
  );

  protected readonly totalPowerWithHelpers = computed(
    () => this.activePlayerCombatPower() + this.acceptedHelperPower(),
  );

  protected readonly winsWithHelpers = computed(
    () => this.totalPowerWithHelpers() > this.monsterPower(),
  );

  // ── Bribe (Nez Flottant) ───────────────────────────────────────────────────

  protected readonly bribeValue = computed(() => this.gs.monster()?.bribeToAvoidGoldValue ?? null);

  protected readonly bribeableItems = computed(() => {
    const required = this.bribeValue();
    if (required == null) return [];
    return this.gs.myEquipped().filter(c => (c.goldValue ?? 0) >= required);
  });

  protected readonly selectedBribeItemId = signal<string | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────

  protected readonly timeLeft    = signal(300);
  protected readonly timerPct    = computed(() => (this.timeLeft() / 300) * 100);
  protected readonly timerColor  = computed(() => {
    const t = this.timeLeft();
    if (t > 120) return 'bg-green-500';
    if (t > 30)  return 'bg-amber-500';
    return 'bg-red-500';
  });
  protected readonly timerLabel = computed(() => {
    const t = this.timeLeft();
    if (t >= 60) return `${Math.floor(t / 60)}m${String(t % 60).padStart(2, '0')}`;
    return `${t}s`;
  });

  protected readonly timerTextColor = computed(() => {
    const t = this.timeLeft();
    if (t > 120) return 'text-green-400';
    if (t > 30)  return 'text-amber-400';
    return 'text-red-400';
  });

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.gs.phase() === GamePhase.MonsterFight) {
        this.startTimer();
        this.acceptedHelpers.set([]);
        this.pendingHelpTarget.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.startTimer();

    const s1 = this.socket.on('game:help:requested').subscribe(data => {
      this.incomingRequest.set(data);
    });

    const s2 = this.socket.on('game:help:responded').subscribe(data => {
      this.pendingHelpTarget.set(null);
      if (data.accepted) {
        this.acceptedHelpers.update(list => [...list, { id: data.helperId, name: data.helperName }]);
      }
    });

    this.destroyRef.onDestroy(() => {
      s1.unsubscribe();
      s2.unsubscribe();
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  protected requestHelp(helperId: string): void {
    const gameId = this.gs.gameState()?.id;
    if (!gameId) return;
    this.pendingHelpTarget.set(helperId);
    this.socket.emit('game:help:request', gameId, helperId);
  }

  protected acceptHelp(): void {
    const req = this.incomingRequest();
    if (!req) return;
    this.socket.emit('game:help:accept', req.gameId, req.requesterId);
    this.incomingRequest.set(null);
  }

  protected declineHelp(): void {
    const req = this.incomingRequest();
    if (!req) return;
    this.socket.emit('game:help:decline', req.gameId, req.requesterId);
    this.incomingRequest.set(null);
  }

  protected fight(): void {
    const gameId = this.gs.gameState()?.id;
    if (!gameId) return;
    this.gs.sendAction(gameId, {
      type: 'FIGHT_MONSTER',
      helperIds: this.acceptedHelpers().map(h => h.id),
      bonusCardIds: [],
    });
    this.acceptedHelpers.set([]);
  }

  protected flee(): void {
    const gameId = this.gs.gameState()?.id;
    if (!gameId) return;
    this.gs.sendAction(gameId, { type: 'RUN_AWAY' });
  }

  protected resolveFlee(): void {
    const gameId = this.gs.gameState()?.id;
    if (!gameId) return;
    this.gs.sendAction(gameId, { type: 'RESOLVE_FLEE' });
  }

  protected resolveFleeSuccess(): void {
    const gameId = this.gs.gameState()?.id;
    if (!gameId) return;
    this.gs.sendAction(gameId, { type: 'RESOLVE_FLEE_SUCCESS' });
  }

  protected bribeMonster(): void {
    const gameId = this.gs.gameState()?.id;
    const itemId = this.selectedBribeItemId();
    if (!gameId || !itemId) return;
    this.gs.sendAction(gameId, { type: 'BRIBE_MONSTER', discardItemId: itemId });
    this.selectedBribeItemId.set(null);
  }

  // ── Timer helpers ──────────────────────────────────────────────────────────

  private startTimer(): void {
    this.clearTimer();
    this.timeLeft.set(300);
    this.timerHandle = setInterval(() => {
      this.timeLeft.update(t => {
        if (t <= 1) { this.clearTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
