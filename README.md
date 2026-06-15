# Munchkin — Serveur de jeu multijoueur

Implémentation en ligne du jeu de cartes **Munchkin** (base, 168 cartes) sous forme de monorepo TypeScript.  
Architecture client/serveur temps réel : pas d'appels HTTP pendant la partie, uniquement Socket.io.

---

## Structure du projet

```
Munchkin/
├── shared/          Types TypeScript partagés (Card, Player, GameState, events Socket.io)
├── server/          Serveur Express + Socket.io
│   ├── src/
│   │   ├── engine/  Moteur de jeu pur (sans effets de bord)
│   │   ├── db/      Couche de persistance (Redis + PostgreSQL)
│   │   ├── room/    Gestionnaire de salles (lobby)
│   │   └── index.ts Point d'entrée Socket.io
│   └── prisma/      Schéma, migration, seed (168 cartes)
├── client/          Application Angular 21
│   └── src/app/
│       ├── game/    Plateau, main, overlay combat
│       └── services/ GameService (signals), SocketService
└── docker-compose.yml  Redis 7 + PostgreSQL 16
```

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Serveur | Node.js 20, TypeScript 5.7, Express 4, Socket.io 4 |
| Moteur de jeu | Fonctions pures TypeScript (pas de mutation d'état) |
| Cache état live | Redis 7 (ioredis 5) — TTL 4h par partie |
| Historique parties | PostgreSQL 16 (Prisma 6) |
| Client | Angular 21 standalone, zoneless, Signals |
| Drag & drop | Angular CDK 21 |
| Styles | Tailwind CSS v4 |
| Tests | Vitest (configuration en place, tests à écrire) |
| Infra locale | Docker Compose |

---

## Ce qui est implémenté

### `shared/` — Types partagés
- `Card`, `CardType`, `Player`, `GameState`, `GamePhase` (KickDown → MonsterFight → Loot → Charity → EndTurn)
- Événements Socket.io typés : `ClientToServerEvents` / `ServerToClientEvents`
- Actions joueur : `ClientGameAction` (KICK_DOOR, FIGHT_MONSTER, RUN_AWAY, PLAY_CARD, DONATE_CARD, END_TURN…)

### `server/engine/` — Moteur de jeu (fonctions pures)
- **DeckManager** : `initDecks()` (24 portes + 18 trésors), `draw()`, `reshuffle()`
- **CombatResolver** : `resolveCombat()` — calcule puissance (niveau + équipement + alliés + bonus), butin (1/2/3 trésors selon puissance), mauvaise fortune (-1 à mort si fuite échouée)
- **TurnManager** : `validateAction()`, `applyAction()` (switch complet sur tous les types d'action), `nextPhase()`

### `server/db/` — Persistance
- **Redis** : `saveState` / `loadState` / `deleteState` (TTL 4h), action en attente (TTL 30s), session joueur
- **PostgreSQL** : tables `users`, `games`, `game_players`, `cards` — transaction atomique pour finaliser une partie
- **GameRepository** : façade unifiée Redis + Prisma

### `server/src/` — Serveur Socket.io
- Lobby complet : `room:create`, `room:join`, `room:leave`, `game:start`
- Authentification légère : lecture du `sub` + `name` depuis le JWT du handshake Socket.io (fallback sur `socket.id`)
- Transfert automatique de l'hôte si le créateur quitte

### `client/` — Interface Angular
- **GameBoardComponent** : grille CSS 3 zones (header log / plateau + panneau joueurs / main), phase affichée en français
- **HandComponent** : cartes jouables selon la phase, drag & drop CDK vers la zone "Équiper", tooltip au survol
- **CombatOverlayComponent** : overlay fixe au-dessus de la main, comparaison puissance joueur vs monstre, timer 30 s (vert → orange → rouge), boutons Demander de l'aide / Se battre / Fuir
- **GameService** : signals `gameState`, `actionLog`, `myPlayer`, `myHand`, `isMyTurn`, `monsterPower`, `recentLog`

---

## Ce qui manque

### Critique — la partie ne peut pas se jouer

#### 1. Initialisation de la partie côté serveur
Quand `game:start` est reçu, le serveur change le statut de la salle mais **ne crée pas d'état de jeu**.  
À ajouter dans `server/src/index.ts`, handler `game:start` :

```typescript
import { DeckManager, TurnManager } from './engine/index.js';
import { GameRepository } from './db/index.js';

// Après rooms.setRoomStatus(room.id, 'playing') :
const { doorDeck, treasureDeck } = DeckManager.initDecks();
const initialState: GameState = {
  id: room.id,
  phase: GamePhase.KickDown,
  players: room.players.map(p => ({
    id: p.id, name: p.name, level: 1, combatPower: 1,
    hand: [], equipped: [],
  })),
  doorDeck, treasureDeck,
  discardDoor: [], discardTreasure: [],
  currentPlayerId: room.players[0].id,
};
await GameRepository.saveState(room.id, initialState);
io.to(room.id).emit('game:state', initialState);
```

#### 2. Handler `game:action` manquant
Le serveur ne traite pas les actions des joueurs.  
À ajouter dans `server/src/index.ts` :

```typescript
socket.on('game:action', async (gameId, clientAction) => {
  const state = await GameRepository.loadState(gameId);
  if (!state) return;

  // Convertir ClientGameAction → GameAction (ajout du dé pour RUN_AWAY)
  const action: GameAction = clientAction.type === 'RUN_AWAY'
    ? { type: 'RUN_AWAY', dieRoll: Math.ceil(Math.random() * 6) }
    : clientAction;

  if (!TurnManager.validateAction(state, playerId, action)) {
    socket.emit('room:error', { message: 'Action invalide' });
    return;
  }

  const newState = TurnManager.applyAction(state, playerId, action);
  await GameRepository.saveState(gameId, newState);
  io.to(gameId).emit('game:state', newState);

  // Vérifier la victoire (niveau 10)
  const winner = newState.players.find(p => p.level >= 10);
  if (winner) {
    await GameRepository.persistFinishedGame(gameId, {
      winnerId: winner.id,
      players: newState.players.map((p, i) => ({
        userId: p.id, finalLevel: p.level, rank: i + 1,
      })),
    });
    await GameRepository.deleteState(gameId);
  }
});
```

### Important — fonctionnalités incomplètes

| Fonctionnalité | État | Notes |
|---|---|---|
| Authentification / inscription | Absent | Le serveur lit un JWT mais il n'y a pas d'UI de connexion ni d'endpoint pour créer un compte |
| Négociation d'aide (helper) | UI absente | Le bouton "Demander de l'aide" existe dans l'overlay mais n'ouvre pas de dialogue de négociation |
| Effets des cartes Classe/Race/Malédiction | Non résolus | `TurnManager.applyAction(PLAY_CARD)` retire la carte de la main mais n'applique pas l'effet |
| Historique de partie (PostgreSQL) | Jamais appelé | `persistFinishedGame` est implémenté mais le trigger victoire n'existe pas encore |
| Page lobby côté client | Absente | Pas d'UI pour créer/rejoindre une salle ; les routes n'exposent que `/game` |
| Tests | Absents | Vitest est configuré, les spec files sont vides |

---

## Démarrer localement

### Prérequis

- **Node.js 20+**
- **Docker Desktop** (pour Redis et PostgreSQL)

### 1. Lancer l'infrastructure

```powershell
# Depuis la racine du projet
docker compose up -d

# Vérifier que les deux services sont healthy
docker compose ps
```

### 2. Installer les dépendances (première fois)

```powershell
cd shared && npm install && npx tsc
cd ..\server && npm install
cd ..\client && npm install
```

### 3. Initialiser la base de données (première fois)

```powershell
cd server

# Applique la migration SQL et génère le client Prisma
npm run db:migrate

# Insère les 168 cartes Munchkin
npm run db:seed
```

### 4. Démarrer le serveur — Terminal 1

```powershell
cd server
npm run dev
# → Server running on http://localhost:3000
```

### 5. Démarrer le client — Terminal 2

```powershell
cd client
npm run dev
# → Local: http://localhost:4200
```

### Variables d'environnement

Le fichier `server/.env` est pré-rempli pour Docker Compose :

```env
DATABASE_URL="postgresql://munchkin:munchkin@localhost:5432/munchkin"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"
PORT=3000
```

---

## Ordre de développement suggéré

Pour avoir une partie jouable bout en bout, voici les étapes dans l'ordre de priorité :

1. **Brancher le moteur de jeu** — ajouter les deux handlers Socket.io décrits ci-dessus dans `server/src/index.ts`
2. **Page lobby client** — UI pour créer une salle, afficher le code, rejoindre via code
3. **Authentification minimale** — endpoint `/auth/guest` qui génère un JWT avec `sub` + `name`, stocké dans `localStorage`
4. **Négociation d'aide** — événement Socket.io `game:help:request` / `game:help:accept` + dialogue côté client
5. **Effets cartes** — compléter `TurnManager.applyAction(PLAY_CARD)` pour les classes, races et malédictions
6. **Tests** — couvrir `TurnManager`, `CombatResolver`, `DeckManager` avec Vitest

---

## Commandes utiles

```powershell
# Arrêter les conteneurs (données conservées)
docker compose stop

# Tout supprimer, y compris les volumes
docker compose down -v

# Régénérer le client Prisma après modification du schéma
cd server && npm run db:generate

# Build de production client
cd client && npm run build
```
