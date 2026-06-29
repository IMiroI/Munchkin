import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import type { Card, Player } from '@munchkin/shared';

const GOLD_PER_LEVEL = 1000;

@Component({
  selector: 'app-sell-items',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sell-items.component.html',
})
export class SellItemsComponent {
  readonly player = input.required<Player>();
  readonly closed = output<void>();
  readonly sold   = output<{ cardIds: string[]; doubleCardId?: string }>();

  protected readonly Math = Math;

  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly doubleCardId = signal<string | undefined>(undefined);

  protected readonly sellableItems = computed(() => {
    const p = this.player();
    const equipped = p.equipped.filter(c => (c.goldValue ?? 0) > 0);
    const hand     = p.hand.filter(c => (c.goldValue ?? 0) > 0);
    return [...equipped, ...hand];
  });

  protected readonly canDoubleOne = computed(() =>
    this.player().equipped.some(c => c.raceDoubleSellFirst),
  );

  protected readonly selectedItems = computed(() => {
    const ids = this.selectedIds();
    return this.sellableItems().filter(c => ids.has(c.id));
  });

  protected readonly totalGold = computed(() => {
    const dbl = this.doubleCardId();
    return this.selectedItems().reduce(
      (sum, c) => sum + (c.goldValue ?? 0) * (c.id === dbl ? 2 : 1),
      0,
    );
  });

  protected readonly levelsGained = computed(() =>
    Math.floor(this.totalGold() / GOLD_PER_LEVEL),
  );

  protected readonly canSell = computed(() => this.totalGold() >= GOLD_PER_LEVEL);

  protected toggle(card: Card): void {
    const cur = new Set(this.selectedIds());
    if (cur.has(card.id)) {
      cur.delete(card.id);
      if (this.doubleCardId() === card.id) this.doubleCardId.set(undefined);
    } else {
      cur.add(card.id);
    }
    this.selectedIds.set(cur);
  }

  protected setDouble(card: Card): void {
    this.doubleCardId.set(
      this.doubleCardId() === card.id ? undefined : card.id,
    );
  }

  protected confirm(): void {
    if (!this.canSell()) return;
    this.sold.emit({
      cardIds: [...this.selectedIds()],
      doubleCardId: this.doubleCardId(),
    });
    this.selectedIds.set(new Set());
    this.doubleCardId.set(undefined);
  }

  protected isSelected(card: Card): boolean {
    return this.selectedIds().has(card.id);
  }

  protected goldLabel(card: Card): string {
    const dbl = this.doubleCardId();
    const val  = card.goldValue ?? 0;
    return card.id === dbl ? `${val * 2} po (×2)` : `${val} po`;
  }
}
