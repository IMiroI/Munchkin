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

@Component({
  selector: 'app-combat-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combat-overlay.component.html',
})
export class CombatOverlayComponent implements OnInit, OnDestroy {
  protected readonly gs = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly monster      = this.gs.monster;
  protected readonly myPower      = this.gs.myTotalPower;
  protected readonly monsterPower = this.gs.monsterPower;
  protected readonly isMyTurn     = this.gs.isMyTurn;

  protected readonly playerWins = computed(() => this.myPower() > this.monsterPower());
  protected readonly powerDiff  = computed(() => this.myPower() - this.monsterPower());
  protected readonly diffLabel  = computed(() => {
    const d = this.powerDiff();
    return d > 0 ? `+${d}` : String(d);
  });

  // ── Timer ──────────────────────────────────────────────────────────────────

  protected readonly timeLeft    = signal(30);
  protected readonly timerPct    = computed(() => (this.timeLeft() / 30) * 100);
  protected readonly timerColor  = computed(() => {
    const t = this.timeLeft();
    if (t > 15) return 'bg-green-500';
    if (t > 5)  return 'bg-amber-500';
    return 'bg-red-500';
  });
  protected readonly timerTextColor = computed(() => {
    const t = this.timeLeft();
    if (t > 15) return 'text-green-400';
    if (t > 5)  return 'text-amber-400';
    return 'text-red-400';
  });

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Reset the 30s window each time a new combat begins.
    effect(() => {
      if (this.gs.phase() === GamePhase.MonsterFight) {
        this.startTimer();
      }
    });
  }

  ngOnInit(): void {
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.clearTimer();
    this.timeLeft.set(30);
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

  // ── Actions ────────────────────────────────────────────────────────────────

  protected fight(): void {
    this.gs.sendAction(this.gs.gameState()!.id, {
      type: 'FIGHT_MONSTER',
      helperIds: [],
      bonusCardIds: [],
    });
  }

  protected flee(): void {
    this.gs.sendAction(this.gs.gameState()!.id, { type: 'RUN_AWAY' });
  }
}
