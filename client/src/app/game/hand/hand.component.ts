import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
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

  /** Card currently shown in the lightbox preview (null = closed). */
  protected readonly previewCard = signal<Card | null>(null);

  // ── Playability ────────────────────────────────────────────────────────────

  protected isPlayable(card: Card): boolean {
    const phase = this.phase();
    const myTurn = this.isMyTurn();

    // Non-active players can only play MonsterBoosters during combat
    if (!myTurn) {
      return phase === GamePhase.MonsterFight && card.type === CardType.MonsterBooster;
    }

    switch (phase) {
      case GamePhase.KickDown:
        return card.type === CardType.Class ||
               card.type === CardType.Race ||
               card.type === CardType.Special ||
               card.type === CardType.Treasure;

      case GamePhase.Loot:
        // Monster = chercher des ennuis; everything else as normal
        return card.type === CardType.Monster ||
               card.type === CardType.Class ||
               card.type === CardType.Race ||
               card.type === CardType.Special ||
               card.type === CardType.Treasure;

      case GamePhase.MonsterFight:
        // Equip items mid-combat, play one-shot potions, or discard MonsterBoosters
        if (card.type === CardType.MonsterBooster) return true;
        if (card.type !== CardType.Treasure) return false;
        return !!card.isOneShot || (card.power ?? 0) > 0;

      case GamePhase.Charity:
        // Monsters and curses must be donated, not played
        return card.type === CardType.Class ||
               card.type === CardType.Race ||
               card.type === CardType.Special ||
               card.type === CardType.Treasure;

      default:
        return false;
    }
  }

  protected isEquippable(card: Card): boolean {
    // Equipment: treasures with combat power or flee bonus, but not level-up cards or one-shots
    if (card.type !== CardType.Treasure) return false;
    if (card.levelUp != null || card.isOneShot) return false;
    return (card.power ?? 0) > 0 || (card.fleeBonus ?? 0) > 0;
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  protected cardClasses(card: Card): string {
    const color = this.colorClass(card);
    const base = 'relative flex-none w-[80px] h-[136px] rounded-xl border-2 select-none transition-all duration-200 group overflow-hidden';
    const playable = this.isPlayable(card);
    const interactive = playable
      ? 'hover:scale-105 hover:-translate-y-3 cursor-pointer shadow-lg'
      : 'opacity-60 cursor-pointer';
    return `${base} ${color} ${interactive}`;
  }

  protected colorClass(card: Card): string {
    switch (card.type) {
      case CardType.Monster:        return 'bg-red-950 border-red-800 card-glow-red';
      case CardType.Treasure:       return 'bg-amber-950 border-amber-800 card-glow-amber';
      case CardType.DoorCurse:      return 'bg-purple-950 border-purple-800 card-glow-purple';
      case CardType.Class:          return 'bg-blue-950 border-blue-800 card-glow-blue';
      case CardType.Race:           return 'bg-green-950 border-green-800 card-glow-green';
      case CardType.MonsterBooster: return 'bg-orange-950 border-orange-800';
      case CardType.Special:        return 'bg-violet-950 border-violet-800';
      default:                      return 'bg-gray-800 border-gray-700';
    }
  }

  protected typeLabel(card: Card): string {
    switch (card.type) {
      case CardType.Monster:        return 'Monstre';
      case CardType.Treasure:       return 'Trésor';
      case CardType.DoorCurse:      return 'Malédiction';
      case CardType.Class:          return 'Classe';
      case CardType.Race:           return 'Race';
      case CardType.MonsterBooster: return 'Amplificateur';
      case CardType.Special:        return 'Spéciale';
      default:                      return '';
    }
  }

  /**
   * Returns the primary stat badge shown on the card face:
   * monsters show their level, equipment shows +bonus, level-up shows +NIV.
   */
  protected statBadge(card: Card): { value: string; sub?: string } | null {
    if (card.type === CardType.Monster) {
      return card.power != null ? { value: String(card.power), sub: 'NIV' } : null;
    }
    if (card.levelUp != null) {
      return { value: `+${card.levelUp}`, sub: 'NIV' };
    }
    if ((card.power ?? 0) > 0) {
      return { value: `+${card.power}` };
    }
    if ((card.fleeBonus ?? 0) > 0) {
      return { value: `+${card.fleeBonus}`, sub: 'FUITE' };
    }
    return null;
  }

  protected badgeColor(card: Card): string {
    if (card.type === CardType.Monster) return 'text-red-400';
    if (card.levelUp != null)           return 'text-green-400';
    if ((card.fleeBonus ?? 0) > 0 && !(card.power ?? 0)) return 'text-sky-400';
    return 'text-amber-400';
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  protected onCardClick(card: Card): void {
    this.previewCard.set(card);
  }

  protected onPlayFromPreview(): void {
    const card = this.previewCard();
    if (card && this.isPlayable(card)) {
      this.cardPlayed.emit(card.id);
      this.previewCard.set(null);
    }
  }

  protected onClosePreview(): void {
    this.previewCard.set(null);
  }

  /** Called when any item is dropped onto the equip zone. */
  protected onEquip(event: CdkDragDrop<Card[]>): void {
    const card = event.item.data as Card;
    if (!this.isEquippable(card)) return;
    this.cardEquipped.emit(card.id);
  }
}
