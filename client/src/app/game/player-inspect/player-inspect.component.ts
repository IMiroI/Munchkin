import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Card, Player } from '@munchkin/shared';
import { CardType } from '@munchkin/shared';

@Component({
  selector: 'app-player-inspect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-inspect.component.html',
})
export class PlayerInspectComponent {
  readonly player  = input.required<Player>();
  readonly isMe    = input<boolean>(false);
  readonly closed  = output<void>();

  protected readonly zoomedCard = signal<Card | null>(null);
  protected readonly CardType = CardType;

  protected colorClass(card: Card): string {
    switch (card.type) {
      case CardType.Monster:        return 'bg-red-950 border-red-800';
      case CardType.Treasure:       return 'bg-amber-950 border-amber-800';
      case CardType.DoorCurse:      return 'bg-purple-950 border-purple-800';
      case CardType.Class:          return 'bg-blue-950 border-blue-800';
      case CardType.Race:           return 'bg-green-950 border-green-800';
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

  protected cardArtSymbol(card: Card): string {
    switch (card.type) {
      case CardType.Monster:        return '☠';
      case CardType.Treasure:       return '◈';
      case CardType.DoorCurse:      return '⌀';
      case CardType.Class:          return '⚔';
      case CardType.Race:           return '◉';
      case CardType.MonsterBooster: return '▲';
      case CardType.Special:        return '✦';
      default:                      return '◆';
    }
  }

  protected statBadge(card: Card): { value: string; sub?: string } | null {
    if (card.type === CardType.Monster) {
      return card.power != null ? { value: String(card.power), sub: 'NIV' } : null;
    }
    if (card.levelUp != null) return { value: `+${card.levelUp}`, sub: 'NIV' };
    if ((card.power ?? 0) > 0) return { value: `+${card.power}` };
    if ((card.fleeBonus ?? 0) > 0) return { value: `+${card.fleeBonus}`, sub: 'FUITE' };
    return null;
  }

  protected badgeColor(card: Card): string {
    if (card.type === CardType.Monster) return 'text-red-400';
    if (card.levelUp != null)           return 'text-green-400';
    if ((card.fleeBonus ?? 0) > 0 && !(card.power ?? 0)) return 'text-sky-400';
    return 'text-amber-400';
  }

  protected genderLabel(p: Player): string {
    return p.gender === 'female' ? '♀ Féminin' : '♂ Masculin';
  }
}
