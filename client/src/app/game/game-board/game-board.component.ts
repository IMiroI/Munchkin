import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
})
export class GameBoardComponent {
  protected readonly gs = inject(GameService);
  protected readonly GamePhase = GamePhase;

  protected readonly phase        = this.gs.phase;
  protected readonly isMyTurn     = this.gs.isMyTurn;
  protected readonly myHand       = this.gs.myHand;
  protected readonly monster      = this.gs.monster;
  protected readonly allPlayers   = this.gs.allPlayers;
  protected readonly currentPlayerId = this.gs.currentPlayerId;
  protected readonly recentLog    = this.gs.recentLog;

  protected readonly inCombat = computed(
    () => this.phase() === GamePhase.MonsterFight,
  );

  /** True when the active player still holds more than 5 cards and must donate before ending. */
  protected readonly mustDonate = computed(() => this.myHand().length > 5);

  protected readonly phaseLabel = computed(() => {
    switch (this.phase()) {
      case GamePhase.KickDown:    return 'Ouvrir la porte';
      case GamePhase.MonsterFight:return 'Combat !';
      case GamePhase.Loot:        return 'Piller ou chercher des ennuis';
      case GamePhase.Charity:     return 'Charité';
      case GamePhase.EndTurn:     return 'Fin de tour';
      default:                    return 'En attente…';
    }
  });

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

  protected onCardPlayed(cardId: string): void {
    // In Loot phase a Monster card means "look for trouble", not a regular play
    const card = this.myHand().find(c => c.id === cardId);
    if (card?.type === CardType.Monster && this.phase() === GamePhase.Loot) {
      this.action({ type: 'LOOK_FOR_TROUBLE', monsterId: cardId });
    } else {
      this.action({ type: 'PLAY_CARD', cardId });
    }
  }

  protected onCardEquipped(cardId: string): void {
    this.action({ type: 'PLAY_CARD', cardId });
  }

  private action(a: Parameters<GameService['sendAction']>[1]): void {
    const id = this.gs.gameState()?.id;
    if (!id) return;
    this.gs.sendAction(id, a);
  }
}
