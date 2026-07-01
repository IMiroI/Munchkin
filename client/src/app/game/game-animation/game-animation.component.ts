import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import type { GameAnimationEvent } from '@munchkin/shared';

@Component({
  selector: 'app-game-animation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-animation.component.html',
})
export class GameAnimationComponent implements OnInit, OnDestroy {
  @Input({ required: true }) event!: GameAnimationEvent;

  protected readonly rolling    = signal(true);
  protected readonly displayRoll = signal(Math.ceil(Math.random() * 6));
  protected readonly showOutcome = signal(false);

  private rollInterval: ReturnType<typeof setInterval> | null = null;
  private timer1: ReturnType<typeof setTimeout> | null = null;
  private timer2: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.event.type !== 'FLEE_DICE') return;

    this.rollInterval = setInterval(() => {
      this.displayRoll.set(Math.ceil(Math.random() * 6));
    }, 80);

    this.timer1 = setTimeout(() => {
      clearInterval(this.rollInterval!);
      this.rollInterval = null;
      this.displayRoll.set((this.event as { type: 'FLEE_DICE'; roll: number }).roll);
      this.rolling.set(false);
    }, 1400);

    this.timer2 = setTimeout(() => {
      this.showOutcome.set(true);
    }, 1900);
  }

  ngOnDestroy(): void {
    if (this.rollInterval) clearInterval(this.rollInterval);
    if (this.timer1) clearTimeout(this.timer1);
    if (this.timer2) clearTimeout(this.timer2);
  }
}
