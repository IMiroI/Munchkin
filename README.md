# Munchkin — Serveur de jeu multijoueur

> Cette application fait partie de la suite **VGAMES**. Elle est accessible depuis le portail [VGAMES](http://localhost:3000) (`/games`) et tourne sur le port `3002`. L'utilisateur connecté sur VGAMES n'a pas besoin de se reconnecter — l'intégration SSO est prévue dans une prochaine version (actuellement, Munchkin utilise sa propre authentification invité).

Implémentation en ligne du jeu de cartes **Munchkin** (base, 168 cartes) sous forme de monorepo TypeScript.  
Architecture client/serveur temps réel : pas d'appels HTTP pendant la partie, uniquement Socket.io.

---

## Structure du projet

```
Munchkin/
├── shared/          Types TypeScript partagés (Card, Player, GameState, events Socket.io)
├── server/          Serveur Express + Socket.io
│   ├── src/
│   │   ├── engine/  Moteur de jeu pur (sans effets de bord) + tests Vitest
│   │   ├── db/      Couche de persistance (Redis + PostgreSQL)
│   │   ├── room/    Gestionnaire de salles (lobby)
│   │   └── index.ts Point d'entrée Socket.io
│   └── prisma/      Schéma, migration, seed (168 cartes)
├── client/          Application Angular 21
│   └── src/app/
│       ├── lobby/   Page d'accueil (auth invité + créer/rejoindre une salle)
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
| Tests | Vitest 3 — 60 tests sur le moteur de jeu |
| Infra locale | Docker Compose |

---

## Ce qui est implémenté

### `shared/` — Types partagés
- `Card`, `CardType`, `Player`, `GameState`, `GamePhase` (KickDown → MonsterFight → Loot → Charity → EndTurn)
- Événements Socket.io typés : `ClientToServerEvents` / `ServerToClientEvents`
- Actions joueur : `ClientGameAction` (KICK_DOOR, FIGHT_MONSTER, RUN_AWAY, PLAY_CARD, DONATE_CARD, END_TURN…)
- Négociation d'aide : `game:help:request/accept/decline` (client→serveur) et `game:help:requested/responded` (serveur→client)

### `server/engine/` — Moteur de jeu (fonctions pures)
- **DeckManager** : `initDecks()` (24 portes + 18 trésors), `draw()`, `reshuffle()`
- **CombatResolver** : `resolveCombat()` — calcule puissance (niveau + équipement + bonus Warrior + alliés + bonus items), butin (1/2/3 trésors selon puissance), mauvaise fortune (-1 à mort si fuite échouée)
- **TurnManager** : `validateAction()`, `applyAction()` (switch complet sur tous les types d'action), `nextPhase()`
  - KICK_DOOR : applique immédiatement l'effet des malédictions (perte de niveau, perte de classe/race, Duck of Doom)
  - PLAY_CARD : équipe classes/races (remplace l'existante), gère les cartes +1 niveau (plafond 9), équipe les trésors
  - FIGHT_MONSTER : les alliés Elfe gagnent un niveau sur victoire

### `server/db/` — Persistance
- **Redis** : `saveState` / `loadState` / `deleteState` (TTL 4h), action en attente (TTL 30s), session joueur
- **PostgreSQL** : tables `users`, `games`, `game_players`, `cards` — transaction atomique pour finaliser une partie
- **GameRepository** : façade unifiée Redis + Prisma

### `server/src/` — Serveur Socket.io
- Lobby complet : `room:create`, `room:join`, `room:leave`, `game:start`
- **Initialisation de partie** : `game:start` crée l'état initial (decks mélangés, joueurs niveau 1), sauvegarde en Redis et diffuse `game:state`
- **Handler `game:action`** : charge l'état, valide, applique via TurnManager, sauvegarde, diffuse `game:state` + `game:log`. Détecte la victoire (niveau 10), persiste en PostgreSQL, émet le log du gagnant
- **Négociation d'aide** : relai `game:help:request` → `game:help:requested` et `game:help:accept/decline` → `game:help:responded`, par `socket.id` (map `playerId → socketId`)
- **Auth invité** : `POST /auth/guest` — génère un JWT HS256 (sub + name) signé avec `JWT_SECRET`
- Authentification légère : lecture du `sub` + `name` depuis le JWT du handshake Socket.io (fallback sur `socket.id`)
- Transfert automatique de l'hôte si le créateur quitte

### `client/` — Interface Angular
- **LobbyComponent** : page d'accueil — saisie du pseudo (appel `POST /auth/guest`), création/rejoindre une salle par code, liste des joueurs, bouton "Démarrer" (hôte, 3+ joueurs). Navigue vers `/game` au démarrage.
- **GameBoardComponent** : grille CSS 3 zones (header log / plateau + panneau joueurs / main), phase affichée en français
- **HandComponent** : cartes jouables selon la phase, drag & drop CDK vers la zone "Équiper", tooltip au survol
- **CombatOverlayComponent** : overlay fixe au-dessus de la main, comparaison puissance (y compris les alliés acceptés), timer 30 s (vert → orange → rouge), négociation d'aide (demande par joueur, bannière Accepter/Refuser pour le helper)
- **GameService** : signals `gameState`, `actionLog`, `myPlayer`, `myHand`, `isMyTurn`, `monsterPower`, `recentLog`
- **SocketService** : méthode `reconnect()` pour recharger le socket avec le nouveau JWT après authentification

### `server/src/engine/*.spec.ts` — Tests (60 tests, 3 fichiers)
- **DeckManager.spec.ts** : tailles des decks, types de cartes, `draw`, `reshuffle`
- **CombatResolver.spec.ts** : victoire/défaite, trésor gagné, bonus équipement/helpers/bonus items/Warrior, bad stuff
- **TurnManager.spec.ts** : `validateAction` (tous les types), `applyAction` (KICK_DOOR + malédictions, PLAY_CARD classe/race/level-up, FIGHT_MONSTER Elfe, RUN_AWAY, END_TURN), `nextPhase`

---

## Ce qui reste

| Fonctionnalité | État | Notes |
|---|---|---|
| Effets Wizard/Thief/Cleric | Partiels | Les cartes s'équipent mais les capacités spéciales (défausser pour +1, backstab, retourner les morts-vivants) ne sont pas résolues |
| Effets Dwarf/Halfling/Human | Partiels | Les cartes s'équipent ; "no hand limit" / "discard to escape" non appliqués mécaniquement |
| UI "Chercher des ennuis" | Absente | Le bouton existe mais ne permet pas encore de glisser un monstre depuis la main |
| Authentification complète | Invité uniquement | Pas d'inscription avec email/mot de passe ni de vérification côté serveur du JWT |
| Reconnexion en cours de partie | Absente | Si un joueur se déconnecte pendant la partie, son état Redis est préservé mais il ne peut pas rejoindre |

---

## Données cartes à vérifier (`munchkin_base.json`)

Le fichier `munchkin_base.json` contient la liste complète des 168 cartes (95 Portes + 73 Trésors) constituée par recherche web. Le champ `verifie` indique si les statistiques ont été confirmées sur une source fiable. **La majorité des cartes sont non vérifiées et doivent être renseignées depuis les cartes physiques.**

### Cartes Portes — champs à compléter (`verifie: false`)

| Carte | Données manquantes |
|---|---|
| 3872 Orques, Goblin Estropié, Mucus Baveux, Rat Musclé, Plante d'Ornement | `niveau` ou `bad_stuff` à confirmer |
| Amazone, Bébé !, Balrog Charolais, Cheval Zombie, Fan de Vampire, Gerbosaure | `niveau`, `tresors_gagnes`, `bad_stuff` tous nuls |
| Binoclard Hurleur, Céphalopodzilla, LépREYXchaun, Mr. Nonos, Nez Flottant, OctaèdRE Gélatineux | Idem |
| Pit Bull, Succube Lange-de-Belle-Mère, Tut-Tuuut-Ankh-Ammon, Vamps...ires !?! | Idem |
| Énoooorme !, Enragé, Intelligent, Vénérable, Petite Amie | Amplificateurs : effet exact non confirmé |
| Illusion, Intervention Divine, Pause Déjeuner, Tire-moi de là ! | Cartes spéciales : effet exact à vérifier |
| Malédiction ! (×5 génériques), Canard de l'Apocalypse, Impôt sur le Revenu, Miroir Perfide, Vraiment Trop Injuste ! | Effet exact à vérifier |

**Doublons de traduction à clarifier selon l'édition française :**
- Cartes 17 (*Fan de Vampire*) / 91 (*Vamps...ires !?!*) → même anglais `Wannabe Vampire`
- Cartes 18 (*Gerbosaure*) / 58 (*Manticor-nithorynque*) → même anglais `Platycore`
- Cartes 79 (*René Crophage et Fils*) / 89 (*Trôliste*) → même anglais `Net Troll`

### Cartes Trésors — champs à compléter (`verifie: false`)

La quasi-totalité des trésors n'a pas de `bonus_combat`, `valeur_or` ou `usable_par` renseignés. Priorité aux cartes qui ont un effet mécanique direct :

| Carte | Données à vérifier |
|---|---|
| Arc Enrubanné, Armures (Cuir/Flamme/Mithril/Gluante/Trapue) | `bonus_combat`, `valeur_or`, restrictions de port |
| Toutes les armes (Épées, Lance, Masse, Missile, Tronçonneuse…) | `bonus_combat`, `valeur_or`, 1 ou 2 mains |
| Toutes les coiffes et chaussures | `bonus_combat`/`bonus_fuite`, `valeur_or` |
| Potions (×10) | Effet exact (usage unique ou persistant) |
| Cartes "Monte d'un niveau" (×8+) | Confirmer que la mécanique est bien « gagner 1 niveau » |
| Genouillères de Séduction, DÉ Pipé, Doppelganger | Règles précises à vérifier (errata officiels connus) |

**Doublon potentiel :** Cartes 40 (*Gourdin de Misogynie*) / 46 (*Marteau des Rotules*) → même anglais `Hammer of Kneecapping`

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

### 6. Lancer les tests du moteur

```powershell
cd server
npm test
# → 60 tests passing
```

### Variables d'environnement

Le fichier `server/.env` est pré-rempli pour Docker Compose :

```env
DATABASE_URL="postgresql://munchkin:munchkin@localhost:5432/munchkin"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"
PORT=3002
JWT_SECRET="dev-secret-change-in-prod"
```

---

## Flux de jeu complet

1. Le joueur ouvre `http://localhost:4200` → page Lobby
2. Il entre son pseudo → `POST /auth/guest` → JWT stocké dans `localStorage`
3. Il crée une salle ou rejoint via un code à 6 lettres
4. L'hôte démarre la partie (≥ 3 joueurs) → `game:start` → état initial diffusé → redirection vers `/game`
5. Le joueur actif agit (ouvrir la porte, se battre, fuir…) → `game:action` → état mis à jour diffusé à tous
6. En combat, le joueur actif peut demander de l'aide à un autre joueur → réponse en temps réel
7. Premier joueur à atteindre le niveau 10 gagne → log de victoire, état supprimé de Redis

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

# Tests en mode watch (développement)
cd server && npm run test:watch
```
