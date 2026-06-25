import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardType, GamePhase } from '@munchkin/shared';
import { GameService } from '../../services/game.service';
import { HandComponent } from '../hand/hand.component';
import { CombatOverlayComponent } from '../combat-overlay/combat-overlay.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandComponent, CombatOverlayComponent],
  templateUrl: './game-board.component.html',
  host: { style: 'display:block;min-height:100dvh;' },
})
export class GameBoardComponent {
  protected readonly gs = inject(GameService);
  protected readonly GamePhase = GamePhase;

  protected readonly phase           = this.gs.phase;
  protected readonly isMyTurn        = this.gs.isMyTurn;
  protected readonly myHand          = this.gs.myHand;
  protected readonly monster         = this.gs.monster;
  protected readonly pendingCurse    = this.gs.pendingCurse;
  protected readonly myEquipped      = this.gs.myEquipped;
  protected readonly charityMustDiscard = this.gs.charityMustDiscard;
  protected readonly charityTargets  = this.gs.charityTargets;
  protected readonly allPlayers      = this.gs.allPlayers;
  protected readonly currentPlayerId = this.gs.currentPlayerId;
  protected readonly recentLog       = this.gs.recentLog;

  /** Charity: when multiple players are tied for lowest, the active player picks a target per card */
  protected readonly selectedCharityTargetId = signal<string | null>(null);

  protected readonly inCombat = computed(
    () => this.phase() === GamePhase.MonsterFight,
  );

  /** True when the active player still holds more than 5 cards and must donate/discard before ending. */
  protected readonly mustDonate = computed(() => this.myHand().length > 5);

  protected readonly phaseLabel = computed(() => {
    switch (this.phase()) {
      case GamePhase.KickDown:    return 'Ouvrir la porte';
      case GamePhase.MonsterFight:return 'Combat !';
      case GamePhase.Loot:        return 'Piller ou chercher des ennuis';
      case GamePhase.Charity:     return 'Charité';
      case GamePhase.EndTurn:     return 'Fin de tour';
      case GamePhase.BodyPillage: return 'Pillage du cadavre';
      default:                    return 'En attente…';
    }
  });

  /** During BodyPillage: true when it is this player's turn to pick */
  protected readonly isMyBodyPillageTurn = computed(() =>
    this.phase() === GamePhase.BodyPillage &&
    this.gs.gameState()?.bodyPillagingQueue?.[0] === this.gs.myPlayerId(),
  );

  /** During BodyPillage: items available to pick */
  protected readonly bodyPillageItems = computed(() =>
    this.gs.gameState()?.bodyPillagingItems ?? [],
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  protected kickDoor(): void {
    this.action({ type: 'KICK_DOOR' });
  }

  protected lootRoom(): void {
    this.action({ type: 'LOOT_ROOM' });
  }

  protected passLoot(): void {
    this.action({ type: 'PASS_LOOT' });
  }

  protected endTurn(): void {
    this.action({ type: 'END_TURN' });
  }

  protected resolveCurse(): void {
    this.action({ type: 'RESOLVE_CURSE' });
  }

  protected discardPreCombatItem(cardId: string): void {
    this.action({ type: 'DISCARD_PRE_COMBAT_ITEM', cardId });
  }

  protected selectCharityTarget(targetId: string): void {
    this.selectedCharityTargetId.set(targetId);
  }

  protected onCardPlayed(cardId: string): void {
    const phase = this.phase();

    if (phase === GamePhase.Charity) {
      if (this.mustDonate()) {
        // Still over 5 cards: this click is a donate/discard
        if (this.charityMustDiscard()) {
          const myId = this.gs.myPlayerId();
          this.action({ type: 'DONATE_CARD', cardId, targetPlayerId: myId });
          return;
        }
        const targets = this.charityTargets();
        if (targets.length === 1) {
          this.action({ type: 'DONATE_CARD', cardId, targetPlayerId: targets[0]!.id });
          return;
        }
        const targetPlayerId = this.selectedCharityTargetId();
        if (targetPlayerId) {
          this.action({ type: 'DONATE_CARD', cardId, targetPlayerId });
          return;
        }
        // Multiple targets but none selected — UI shows picker, do nothing
        return;
      }
      // At ≤5 cards: player can play cards normally (equip items, play curses…)
      this.action({ type: 'PLAY_CARD', cardId });
      return;
    }

    // In Loot phase a Monster card means "look for trouble", not a regular play
    const card = this.myHand().find(c => c.id === cardId);
    if (card?.type === CardType.Monster && phase === GamePhase.Loot) {
      this.action({ type: 'LOOK_FOR_TROUBLE', monsterId: cardId });
    } else {
      this.action({ type: 'PLAY_CARD', cardId });
    }
  }

  protected onCardEquipped(cardId: string): void {
    this.action({ type: 'PLAY_CARD', cardId });
  }

  protected pickBodyLoot(cardId: string): void {
    this.action({ type: 'PICK_BODY_LOOT', cardId });
  }

  protected giveItem(itemId: string, targetPlayerId: string): void {
    this.action({ type: 'GIVE_ITEM', itemId, targetPlayerId });
  }

  private action(a: Parameters<GameService['sendAction']>[1]): void {
    const id = this.gs.gameState()?.id;
    if (!id) return;
    this.gs.sendAction(id, a);
  }
}
