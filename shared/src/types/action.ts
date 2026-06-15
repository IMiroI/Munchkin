export interface ActionLogEntry {
  playerName: string;
  description: string;
  timestamp: number;
}

/** Actions the client sends to the server. The server adds any randomness (e.g. die rolls). */
export type ClientGameAction =
  | { type: 'KICK_DOOR' }
  | { type: 'LOOT_ROOM' }
  | { type: 'LOOK_FOR_TROUBLE'; monsterId: string }
  | { type: 'FIGHT_MONSTER'; helperIds: string[]; bonusCardIds: string[] }
  | { type: 'RUN_AWAY' }
  | { type: 'PLAY_CARD'; cardId: string; targetId?: string }
  | { type: 'DONATE_CARD'; cardId: string; targetPlayerId: string }
  | { type: 'END_TURN' };
