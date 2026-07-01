import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { GamePhase } from '@munchkin/shared';
import type { Card, GameState, ActionLogEntry, ClientGameAction, GameAnimationEvent } from '@munchkin/shared';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly socket = inject(SocketService);

  // ---------------------------------------------------------------------------
  // Core state
  // ---------------------------------------------------------------------------

  readonly gameState = signal<GameState | null>(null);
  readonly actionLog  = signal<ActionLogEntry[]>([]);
  readonly lastError  = signal<string | null>(null);

  readonly spotlightCard = signal<{ card: Card; playerName: string; description: string } | null>(null);
  readonly phaseAnnouncement = signal<string | null>(null);
  readonly currentAnimation = signal<GameAnimationEvent | null>(null);
  private _spotlightTimer: ReturnType<typeof setTimeout> | null = null;
  private _announcementTimer: ReturnType<typeof setTimeout> | null = null;
  private _animationTimer: ReturnType<typeof setTimeout> | null = null;

  /** Current user's player ID — read from the JWT sub claim at boot. */
  readonly myPlayerId = signal<string>(this.readPlayerIdFromJwt());

  // ---------------------------------------------------------------------------
  // Derived signals (all O(1), purely computed)
  // ---------------------------------------------------------------------------

  readonly phase       = computed(() => this.gameState()?.phase ?? null);
  readonly currentPlayerId = computed(() => this.gameState()?.currentPlayerId ?? null);
  readonly isMyTurn    = computed(() => this.currentPlayerId() === this.myPlayerId());
  readonly monster      = computed(() => this.gameState()?.currentMonster ?? null);
  readonly monsterPower = computed(() => this.monster()?.power ?? 0);
  readonly pendingCurse = computed(() => this.gameState()?.pendingCurse ?? null);

  readonly allPlayers  = computed(() => this.gameState()?.players ?? []);

  readonly myPlayer = computed(() =>
    this.allPlayers().find(p => p.id === this.myPlayerId()) ?? null,
  );

  readonly myHand     = computed(() => this.myPlayer()?.hand ?? []);
  readonly myEquipped = computed(() => this.myPlayer()?.equipped ?? []);

  /** During Charity: true if the active player must discard (they are lowest or tied for lowest among living players) */
  readonly charityMustDiscard = computed(() => {
    const me = this.myPlayer();
    if (!me) return false;
    const livingOthers = this.allPlayers().filter(p => p.id !== me.id && !p.isDead);
    if (livingOthers.length === 0) return true;
    const minLiving = Math.min(...livingOthers.map(p => p.level));
    return me.level <= minLiving;
  });

  /** During Charity: living players tied for the lowest level (empty if mustDiscard) */
  readonly charityTargets = computed(() => {
    if (this.charityMustDiscard()) return [];
    const me = this.myPlayer();
    if (!me) return [];
    const others = this.allPlayers().filter(p => p.id !== me.id && !p.isDead);
    if (others.length === 0) return [];
    const minLevel = Math.min(...others.map(p => p.level));
    return others.filter(p => p.level === minLevel);
  });

  readonly myTotalPower = computed(() => this.myPlayer()?.combatPower ?? 0);
  readonly myGender    = computed(() => this.myPlayer()?.gender ?? null);

  /** Maximum cards the player may hold at end of turn (5 + race bonus) */
  readonly myMaxHandSize = computed(() => {
    const bonus = this.myEquipped().reduce((sum, c) => sum + (c.raceHandSizeBonus ?? 0), 0);
    return 5 + bonus;
  });

  /** Last 5 log entries, newest last. */
  readonly recentLog = computed(() => this.actionLog().slice(-5));

  /** Card drawn face-up from the door deck (visible to all) */
  readonly lastRevealedCard = computed(() => this.gameState()?.lastRevealedCard ?? null);

  readonly combatBonusCards = computed(() => this.gameState()?.combatBonusCards ?? []);
  readonly combatMonsterBonusCards = computed(() => this.gameState()?.combatMonsterBonusCards ?? []);
  readonly additionalMonsters = computed(() => this.gameState()?.additionalMonsters ?? []);
  readonly pendingShareTreasures = computed(() => this.gameState()?.pendingShareTreasures ?? []);
  readonly pendingShareHelperIds = computed(() => this.gameState()?.pendingShareHelperIds ?? []);

  // ---------------------------------------------------------------------------
  // Socket subscriptions
  // ---------------------------------------------------------------------------

  constructor() {
    const destroyRef = inject(DestroyRef);

    const s1 = this.socket
      .on('game:state')
      .subscribe(state => {
        const prevPhase = this.gameState()?.phase ?? null;
        this.gameState.set(state);
        if (prevPhase && state.phase !== prevPhase) {
          this._announcePhase(state.phase);
        }
      });

    const s2 = this.socket
      .on('game:log')
      .subscribe(entry => {
        this.actionLog.update(log => [...log.slice(-99), entry]);
        if (entry.card) {
          if (this._spotlightTimer !== null) clearTimeout(this._spotlightTimer);
          this.spotlightCard.set({ card: entry.card, playerName: entry.playerName, description: entry.description });
          this._spotlightTimer = setTimeout(() => this.spotlightCard.set(null), 2800);
        }
      });

    const s3 = this.socket
      .on('game:error')
      .subscribe(err => {
        this.lastError.set(err.message);
        setTimeout(() => this.lastError.set(null), 4000);
      });

    const s4 = this.socket
      .on('game:animation')
      .subscribe(event => {
        if (this._animationTimer !== null) clearTimeout(this._animationTimer);
        this.currentAnimation.set(event);
        const duration = event.type === 'FLEE_DICE' ? 3800 : 2800;
        this._animationTimer = setTimeout(() => this.currentAnimation.set(null), duration);
      });

    destroyRef.onDestroy(() => { s1.unsubscribe(); s2.unsubscribe(); s3.unsubscribe(); s4.unsubscribe(); });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  sendAction(gameId: string, action: ClientGameAction): void {
    this.socket.emit('game:action', gameId, action);
  }

  setMyPlayerId(id: string): void {
    this.myPlayerId.set(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _announcePhase(phase: string): void {
    const labels: Record<string, string> = {
      KickDown:         '🚪 Ouvrir la Porte',
      MonsterFight:     '⚔ Combat !',
      Loot:             '💰 Piller la Salle',
      Charity:          '🙏 Phase de Charité',
      CurseReaction:    '🪄 Malédiction !',
      PreCombatDiscard: '⚔ Sacrifice Requis',
      BodyPillage:      '💀 Pillage du Cadavre',
      FleeReaction:     '🏃 Tentative de Fuite',
      TreasureShare:    '💰 Distribution des Trésors',
    };
    const label = labels[phase];
    if (!label) return;
    if (this._announcementTimer !== null) clearTimeout(this._announcementTimer);
    this.phaseAnnouncement.set(label);
    this._announcementTimer = setTimeout(() => this.phaseAnnouncement.set(null), 2000);
  }

  private readPlayerIdFromJwt(): string {
    try {
      const jwt = sessionStorage.getItem('jwt');
      if (!jwt) return '';
      const payload = JSON.parse(atob(jwt.split('.')[1]!)) as { sub?: string };
      return payload.sub ?? '';
    } catch {
      return '';
    }
  }
}
