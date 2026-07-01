import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Card } from '@munchkin/shared';
import { CardType, GamePhase } from '@munchkin/shared';

@Component({
  selector: 'app-hand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './hand.component.html',
})
export class HandComponent {
  readonly cards        = input<Card[]>([]);
  readonly equipped     = input<Card[]>([]);
  readonly phase        = input<GamePhase | null>(null);
  readonly isMyTurn     = input<boolean>(false);
  readonly mustDonate   = input<boolean>(false);
  readonly playerGender = input<'male' | 'female' | null>(null);

  readonly cardPlayed = output<string>();

  protected readonly CardType = CardType;

  /** Card currently shown in the lightbox preview (null = closed). */
  protected readonly previewCard = signal<Card | null>(null);

  // ── Playability ────────────────────────────────────────────────────────────

  protected isPlayable(card: Card): boolean {
    const phase = this.phase();
    const myTurn = this.isMyTurn();

    if (!myTurn) {
      return phase === GamePhase.MonsterFight && card.type === CardType.MonsterBooster;
    }

    switch (phase) {
      case GamePhase.KickDown:
        if (card.type === CardType.DoorCurse) return true;
        if (card.type === CardType.Class || card.type === CardType.Race || card.type === CardType.Special) return true;
        if (card.type === CardType.Treasure) return this._isItemUsable(card);
        return false;

      case GamePhase.Loot:
        if (card.type === CardType.Monster || card.type === CardType.DoorCurse) return true;
        if (card.type === CardType.Class || card.type === CardType.Race || card.type === CardType.Special) return true;
        if (card.type === CardType.Treasure) return this._isItemUsable(card);
        return false;

      case GamePhase.MonsterFight:
        if (card.type === CardType.MonsterBooster) return true;
        if (card.type !== CardType.Treasure) return false;
        if (!card.isOneShot && (card.power ?? 0) <= 0) return false;
        return this._isItemUsable(card);

      case GamePhase.Charity:
        // During charity the player donates — no restriction check (they aren't equipping it)
        if (card.type === CardType.DoorCurse) return true;
        return card.type === CardType.Class ||
               card.type === CardType.Race ||
               card.type === CardType.Special ||
               card.type === CardType.Treasure;

      default:
        return false;
    }
  }

  /** True when this Treasure card has no class/race/gender/slot/hand restrictions against the player. */
  private _isItemUsable(card: Card): boolean {
    const eq = this.equipped();
    const playerClasses = eq.filter(c => c.type === CardType.Class && c.classId).map(c => c.classId!);
    const playerRaces   = eq.filter(c => c.type === CardType.Race  && c.raceId).map(c => c.raceId!);

    if (card.requiredClass && !playerClasses.includes(card.requiredClass)) return false;
    if (card.forbiddenClass && playerClasses.includes(card.forbiddenClass)) return false;
    if (card.requiredRace   && !playerRaces.includes(card.requiredRace))   return false;
    if (card.requiredNoRace && playerRaces.length > 0)                     return false;
    if (card.forbiddenRace  && playerRaces.includes(card.forbiddenRace))   return false;

    const gender = this.playerGender();
    if (card.requiredCurrentGender && gender && card.requiredCurrentGender !== gender) return false;

    // One-shot potions don't occupy a slot or hands — only class/race/gender matters
    if (card.isOneShot) return true;

    // Big-item slot
    if (card.isBigItem && !eq.some(c => c.raceUnlimitedBigItems)) {
      const extraSlots  = eq.filter(c => c.extraBigItemSlot).length;
      const bigEquipped = eq.filter(c => c.isBigItem).length;
      if (bigEquipped >= 1 + extraSlots) return false;
    }

    // Equipment slot (headgear / armor / footwear)
    if (card.equipSlot && eq.some(c => c.equipSlot === card.equipSlot)) return false;

    // Hand slots
    if ((card.handUsage ?? 0) > 0) {
      const handsUsed = eq.reduce((sum, c) => sum + (c.handUsage ?? 0), 0);
      if (handsUsed + (card.handUsage ?? 0) > 2) return false;
    }

    return true;
  }

  /** Human-readable explanation of why a card cannot be played right now. */
  protected notPlayableReason(card: Card): string {
    const phase  = this.phase();
    const myTurn = this.isMyTurn();

    if (!myTurn) {
      return card.type === CardType.MonsterBooster
        ? 'Amplificateur jouable uniquement en combat actif'
        : 'Ce n\'est pas votre tour';
    }

    // ── Item restrictions (Treasure cards) ────────────────────────────────
    if (card.type === CardType.Treasure && phase !== GamePhase.Charity) {
      const eq = this.equipped();
      const playerClasses = eq.filter(c => c.type === CardType.Class && c.classId).map(c => c.classId!);
      const playerRaces   = eq.filter(c => c.type === CardType.Race  && c.raceId).map(c => c.raceId!);

      if (card.requiredClass && !playerClasses.includes(card.requiredClass))
        return `Réservé aux ${this._classLabel(card.requiredClass)}s`;
      if (card.forbiddenClass && playerClasses.includes(card.forbiddenClass))
        return `Interdit aux ${this._classLabel(card.forbiddenClass)}s`;
      if (card.requiredRace && !playerRaces.includes(card.requiredRace))
        return `Réservé aux ${this._raceLabel(card.requiredRace)}s`;
      if (card.requiredNoRace && playerRaces.length > 0)
        return 'Réservé aux humains (sans race)';
      if (card.forbiddenRace && playerRaces.includes(card.forbiddenRace))
        return `Interdit aux ${this._raceLabel(card.forbiddenRace)}s`;

      const gender = this.playerGender();
      if (card.requiredCurrentGender && gender && card.requiredCurrentGender !== gender)
        return card.requiredCurrentGender === 'female'
          ? 'Réservé aux personnages féminins'
          : 'Réservé aux personnages masculins';

      if (!card.isOneShot) {
        if (card.isBigItem && !eq.some(c => c.raceUnlimitedBigItems)) {
          const extraSlots  = eq.filter(c => c.extraBigItemSlot).length;
          const bigEquipped = eq.filter(c => c.isBigItem).length;
          if (bigEquipped >= 1 + extraSlots) return 'Vous portez déjà un grand objet';
        }
        if (card.equipSlot && eq.some(c => c.equipSlot === card.equipSlot))
          return `Emplacement ${this._slotLabel(card.equipSlot)} déjà occupé`;
        if ((card.handUsage ?? 0) > 0) {
          const handsUsed   = eq.reduce((sum, c) => sum + (c.handUsage ?? 0), 0);
          const available   = 2 - handsUsed;
          if ((card.handUsage ?? 0) > available)
            return available === 0
              ? 'Aucune main libre disponible'
              : 'Nécessite 2 mains — une seule est libre';
        }
      }
    }

    // ── Phase-level reasons ────────────────────────────────────────────────
    switch (card.type) {
      case CardType.Monster:
        if (phase === GamePhase.MonsterFight) return 'Impossible d\'ajouter un monstre en combat';
        if (phase === GamePhase.Charity)      return 'Donnez ce monstre à un autre joueur';
        return 'Jouable uniquement pour "chercher des ennuis" (phase pillage)';

      case CardType.MonsterBooster:
        return 'Amplificateurs jouables uniquement par les non-actifs en combat';

      case CardType.Class:
      case CardType.Race:
        if (phase === GamePhase.MonsterFight) return 'Classes et races non jouables en combat';
        return 'Non jouable dans cette phase';

      case CardType.DoorCurse:
        return 'Sélectionnez une cible pour lancer la malédiction';

      case CardType.Special:
        if (phase === GamePhase.MonsterFight) return 'Carte spéciale non jouable en combat';
        return 'Non jouable dans cette phase';

      case CardType.Treasure:
        if (phase === GamePhase.MonsterFight) return 'Seuls les objets avec bonus et les potions sont utilisables en combat';
        return 'Non jouable dans cette phase';

      default:
        return `Non jouable en phase "${phase}"`;
    }
  }

  private _classLabel(c: string): string {
    switch (c) {
      case 'warrior': return 'Guerrier';
      case 'wizard':  return 'Mage';
      case 'cleric':  return 'Clerc';
      case 'thief':   return 'Voleur';
      default:        return c;
    }
  }

  private _raceLabel(r: string): string {
    switch (r) {
      case 'elf':      return 'Elfe';
      case 'dwarf':    return 'Nain';
      case 'halfling': return 'Halfling';
      default:         return r;
    }
  }

  private _slotLabel(s: string): string {
    switch (s) {
      case 'headgear': return 'couvre-chef';
      case 'armor':    return 'armure';
      case 'footwear': return 'chaussures';
      default:         return s;
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
    const base = 'card-hand-item card-inner-border relative flex-none w-[80px] h-[136px] rounded-xl border-2 select-none group overflow-hidden cursor-pointer';
    const playable = this.isPlayable(card);
    const state = playable ? 'shadow-xl' : 'card-not-playable opacity-50';
    return `${base} ${color} ${state}`;
  }

  protected cardFanRot(i: number, n: number): number {
    if (n <= 1) return 0;
    const center = (n - 1) / 2;
    const offset = i - center;
    const step = Math.min(4.5, 18 / n);
    return offset * step;
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

  protected playButtonLabel(card: Card): string {
    if (
      this.phase() === GamePhase.Charity &&
      this.mustDonate() &&
      card.type !== CardType.Class &&
      card.type !== CardType.Race &&
      card.levelUp == null
    ) {
      return 'En faire charité';
    }
    return 'Jouer cette carte';
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
}
