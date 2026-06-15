import type { GameState } from '@munchkin/shared';
import type { GameAction } from '../engine/types.js';
import { redis } from './redis.js';
import { prisma } from './prisma.js';

const TTL_GAME_STATE = 4 * 60 * 60; // 4 hours
const TTL_PENDING    = 30;           // 30 seconds

export interface PlayerSession {
  socketId: string;
  gameId: string;
}

export interface GameResult {
  winnerId: string;
  players: Array<{
    userId: string;
    finalLevel: number;
    rank: number;
  }>;
}

export const GameRepository = {
  // ---------------------------------------------------------------------------
  // Redis — game state   key: "game:{gameId}:state"
  // ---------------------------------------------------------------------------

  async saveState(gameId: string, state: GameState): Promise<void> {
    await redis.set(
      `game:${gameId}:state`,
      JSON.stringify(state),
      'EX', TTL_GAME_STATE,
    );
  },

  async loadState(gameId: string): Promise<GameState | null> {
    const raw = await redis.get(`game:${gameId}:state`);
    return raw ? (JSON.parse(raw) as GameState) : null;
  },

  async deleteState(gameId: string): Promise<void> {
    await redis.del(`game:${gameId}:state`);
  },

  // ---------------------------------------------------------------------------
  // Redis — pending action   key: "game:{gameId}:pending"   TTL: 30s
  // ---------------------------------------------------------------------------

  async savePendingAction(gameId: string, action: GameAction): Promise<void> {
    await redis.set(
      `game:${gameId}:pending`,
      JSON.stringify(action),
      'EX', TTL_PENDING,
    );
  },

  async getPendingAction(gameId: string): Promise<GameAction | null> {
    const raw = await redis.get(`game:${gameId}:pending`);
    return raw ? (JSON.parse(raw) as GameAction) : null;
  },

  async clearPendingAction(gameId: string): Promise<void> {
    await redis.del(`game:${gameId}:pending`);
  },

  // ---------------------------------------------------------------------------
  // Redis — player session   key: "player:{playerId}:session"
  // ---------------------------------------------------------------------------

  async savePlayerSession(
    playerId: string,
    socketId: string,
    gameId: string,
  ): Promise<void> {
    const session: PlayerSession = { socketId, gameId };
    await redis.set(`player:${playerId}:session`, JSON.stringify(session));
  },

  async getPlayerSession(playerId: string): Promise<PlayerSession | null> {
    const raw = await redis.get(`player:${playerId}:session`);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  },

  async deletePlayerSession(playerId: string): Promise<void> {
    await redis.del(`player:${playerId}:session`);
  },

  // ---------------------------------------------------------------------------
  // PostgreSQL — game lifecycle
  // ---------------------------------------------------------------------------

  /** Create a game record and its player slots at game start. */
  async createGame(gameId: string, userIds: string[]): Promise<void> {
    await prisma.game.create({
      data: {
        id: gameId,
        players: {
          create: userIds.map(userId => ({ userId })),
        },
      },
    });
  },

  /**
   * Persist the final outcome of a finished game.
   * Runs as an atomic transaction: updates Game (endedAt, winnerId) and each
   * GamePlayer (finalLevel, rank) in a single round-trip.
   */
  async persistFinishedGame(gameId: string, result: GameResult): Promise<void> {
    await prisma.$transaction([
      prisma.game.update({
        where: { id: gameId },
        data: {
          endedAt: new Date(),
          winnerId: result.winnerId,
        },
      }),
      ...result.players.map(({ userId, finalLevel, rank }) =>
        prisma.gamePlayer.update({
          where: { gameId_userId: { gameId, userId } },
          data: { finalLevel, rank },
        }),
      ),
    ]);
  },
} as const;
