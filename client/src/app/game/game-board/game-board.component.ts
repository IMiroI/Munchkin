import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Card, Player } from '@munchkin/shared';
import { CardType, GamePhase } from '@munchkin/shared';
import { GameService } from '../../services/game.service';
import { HandComponent } from '../hand/hand.component';
import { CombatOverlayComponent } from '../combat-overlay/combat-overlay.component';
import { PlayerInspectComponent } from '../player-inspect/player-inspect.component';
import { SellItemsComponent } from '../sell-items/sell-items.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandComponent, CombatOverlayComponent, PlayerInspectComponent, SellItemsComponent],
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

  /** Player whose equipment panel is open (null = closed) */
  protected readonly inspectedPlayer = signal<Player | null>(null);

  /** Curse card the player wants to play — waiting for a target selection */
  protected readonly pendingCursePlay = signal<Card | null>(null);

  /** Steal-level card waiting for a target selection */
  protected readonly pendingStealLevel = signal<Card | null>(null);

  /** Card from log history the player is previewing */
  protected readonly logDetailCard = signal<Card | null>(null);

  /** Revealed card from door deck (face-up for all to see) */
  protected readonly lastRevealedCard = this.gs.lastRevealedCard;

  /** Error message from the last invalid action */
  protected readonly actionError = this.gs.lastError;

  /** Whether the sell-items panel is open */
  protected readonly sellPanelOpen = signal(false);

  /** Monster cards in my hand that I can play to look for trouble */
  protected readonly myHandMonsters = computed(() =>
    this.myHand().filter(c => c.type === CardType.Monster),
  );

  protected readonly inCombat = computed(() => {
    const p = this.phase();
    return p === GamePhase.MonsterFight
        || p === GamePhase.FleeReaction
        || p === GamePhase.FleeSuccessReaction
        || p === GamePhase.ForcedFlee;
  });

  /** True when the active player still holds more than the allowed hand size. */
  protected readonly mustDonate = computed(() => this.myHand().length > this.gs.myMaxHandSize());

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
    const card = this.myHand().find(c => c.id === cardId);

    if (phase === GamePhase.Charity) {
      // Curses always need a target, even during charity
      if (card?.type === CardType.DoorCurse) {
        this.pendingCursePlay.set(card);
        return;
      }
      // Cards with an immediate play effect (level-up, class, race, equippable items)
      // must be played, not donated — even when mustDonate() is true
      const isImmediatePlay =
        card != null && (
          card.levelUp != null ||
          card.levelUpAllByClass != null ||
          card.type === CardType.Class ||
          card.type === CardType.Race
        );
      if (isImmediatePlay) {
        this.action({ type: 'PLAY_CARD', cardId });
        return;
      }
      if (this.mustDonate()) {
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
        return;
      }
      this.action({ type: 'PLAY_CARD', cardId });
      return;
    }

    // DoorCurse from hand: pick a target before sending
    if (card?.type === CardType.DoorCurse) {
      this.pendingCursePlay.set(card);
      return;
    }

    // Steal-level card: pick a target before sending
    if (card?.stealLevel) {
      this.pendingStealLevel.set(card);
      return;
    }

    // In Loot phase a Monster card means "look for trouble"
    if (card?.type === CardType.Monster && phase === GamePhase.Loot) {
      this.action({ type: 'LOOK_FOR_TROUBLE', monsterId: cardId });
    } else {
      this.action({ type: 'PLAY_CARD', cardId });
    }
  }

  protected castCurseOn(targetPlayerId: string): void {
    const curse = this.pendingCursePlay();
    if (!curse) return;
    this.pendingCursePlay.set(null);
    this.action({ type: 'PLAY_CARD', cardId: curse.id, targetId: targetPlayerId });
  }

  protected stealLevelFrom(targetPlayerId: string): void {
    const card = this.pendingStealLevel();
    if (!card) return;
    this.pendingStealLevel.set(null);
    this.action({ type: 'PLAY_CARD', cardId: card.id, targetId: targetPlayerId });
  }

  protected onCardEquipped(cardId: string): void {
    this.action({ type: 'PLAY_CARD', cardId });
  }

  protected pickBodyLoot(cardId: string): void {
    this.action({ type: 'PICK_BODY_LOOT', cardId });
  }

  protected lookForTrouble(monsterId: string): void {
    this.action({ type: 'LOOK_FOR_TROUBLE', monsterId });
  }

  protected giveItem(itemId: string, targetPlayerId: string): void {
    this.action({ type: 'GIVE_ITEM', itemId, targetPlayerId });
  }

  protected sellItems(payload: { cardIds: string[]; doubleCardId?: string }): void {
    this.sellPanelOpen.set(false);
    this.action({ type: 'SELL_ITEMS', cardIds: payload.cardIds, doubleCardId: payload.doubleCardId });
  }

  private action(a: Parameters<GameService['sendAction']>[1]): void {
    const id = this.gs.gameState()?.id;
    if (!id) return;
    this.gs.sendAction(id, a);
  }
}
