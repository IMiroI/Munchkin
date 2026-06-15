import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import type { Card } from '@munchkin/shared';
import { CardType, GamePhase } from '@munchkin/shared';

@Component({
  selector: 'app-hand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './hand.component.html',
})
export class HandComponent {
  readonly cards     = input<Card[]>([]);
  readonly phase     = input<GamePhase | null>(null);
  readonly isMyTurn  = input<boolean>(false);

  readonly cardPlayed   = output<string>();
  readonly cardEquipped = output<string>();

  protected readonly CardType = CardType;

  /** Typed empty array for the equip drop zone so CDK infers Card[] not never[]. */
  protected readonly emptyCardList: Card[] = [];

  // ── Playability ────────────────────────────────────────────────────────────

  protected isPlayable(card: Card): boolean {
    if (!this.isMyTurn()) return false;
    switch (this.phase()) {
      case GamePhase.MonsterFight:
        return card.type === CardType.Treasure && (card.power ?? 0) > 0;
      case GamePhase.Loot:
        return card.type === CardType.Monster;
      case GamePhase.Charity:
        return true;
      default:
        return false;
    }
  }

  protected isEquippable(card: Card): boolean {
    return card.type === CardType.Treasure && (card.power ?? 0) > 0;
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  protected cardClasses(card: Card): string {
    const color = this.colorClass(card);
    const playable = this.isPlayable(card);
    const interactive = playable
      ? 'hover:scale-105 hover:-translate-y-3 cursor-pointer shadow-lg'
      : 'opacity-40 cursor-not-allowed';
    return `${color} ${interactive}`;
  }

  protected colorClass(card: Card): string {
    switch (card.type) {
      case CardType.Monster:    return 'bg-red-950 border-red-800 card-glow-red';
      case CardType.Treasure:   return 'bg-amber-950 border-amber-800 card-glow-amber';
      case CardType.DoorCurse:  return 'bg-purple-950 border-purple-800 card-glow-purple';
      case CardType.Class:      return 'bg-blue-950 border-blue-800 card-glow-blue';
      case CardType.Race:       return 'bg-green-950 border-green-800 card-glow-green';
      default:                  return 'bg-gray-800 border-gray-700';
    }
  }

  protected typeLabel(card: Card): string {
    switch (card.type) {
      case CardType.Monster:    return 'Monstre';
      case CardType.Treasure:   return 'Trésor';
      case CardType.DoorCurse:  return 'Malédiction';
      case CardType.Class:      return 'Classe';
      case CardType.Race:       return 'Race';
      default:                  return '';
    }
  }

  protected powerColor(card: Card): string {
    return card.type === CardType.Monster ? 'text-red-400' : 'text-amber-400';
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  protected onCardClick(card: Card): void {
    if (!this.isPlayable(card)) return;
    this.cardPlayed.emit(card.id);
  }

  /** Called when any item is dropped onto the equip zone. */
  protected onEquip(event: CdkDragDrop<Card[]>): void {
    const card = event.item.data as Card;
    if (!this.isEquippable(card)) return;
    this.cardEquipped.emit(card.id);
  }
}
