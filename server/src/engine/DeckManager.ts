import { CardType } from '@munchkin/shared';
import type { Card } from '@munchkin/shared';

function shuffle<T>(arr: readonly T[]): T[] {
  const deck = [...arr];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

// ---------------------------------------------------------------------------
// PORTES — 95 cartes
// IDs calqués sur les positions du fichier munchkin_base.json (d-001 … d-095)
// Les puissances/trésors non vérifiés sont des estimations raisonnables.
// ---------------------------------------------------------------------------

const DOOR_CARDS: readonly Card[] = [
  // ── Monstres ──────────────────────────────────────────────────────────────
  {
    id: 'd-001', name: '3872 Orques', type: CardType.Monster,
    power: 1, treasuresOnKill: 1,
    badStuff: 'Aucun effet particulier.',
  },
  {
    id: 'd-002', name: 'Amazone', type: CardType.Monster,
    power: 6, treasuresOnKill: 1,
    badStuff: 'Son comportement varie selon le sexe du joueur.',
  },
  {
    id: 'd-003', name: 'Balrog Charolais', type: CardType.Monster,
    power: 10, treasuresOnKill: 2,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-004', name: 'Bébé !', type: CardType.Monster,
    power: 1, treasuresOnKill: 1,
    badStuff: 'Aucun effet.',
  },
  {
    id: 'd-005', name: 'Belvédère Sauvage', type: CardType.Monster,
    power: 8, treasuresOnKill: 2,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
    effect: 'Doit être combattu seul, sans aide.',
  },
  {
    id: 'd-006', name: 'Bigfoot, alias Grand-Pied', type: CardType.Monster,
    power: 10, treasuresOnKill: 3,
    badStuff: 'Il vous écrase la coiffe : perdez votre couvre-tête.',
    badStuffLevel: -1,
  },
  {
    id: 'd-007', name: 'Binoclard Hurleur', type: CardType.Monster,
    power: 2, treasuresOnKill: 1,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-008', name: 'Céphalopodzilla', type: CardType.Monster,
    power: 18, treasuresOnKill: 4,
    badStuff: 'Mort du joueur.',
    badStuffLevel: -99,
  },
  {
    id: 'd-009', name: 'Cheval Zombie', type: CardType.Monster,
    power: 6, treasuresOnKill: 1,
    badStuff: 'Perdez 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-010', name: 'Dragon de Plutonium', type: CardType.Monster,
    power: 20, treasuresOnKill: 5,
    badStuff: 'Mort du joueur.',
    badStuffLevel: -99,
    effect: 'Boss final ; optionnel pour les joueurs de niveau 5 ou moins.',
  },
  {
    id: 'd-016', name: 'Escargots sous Acide', type: CardType.Monster,
    power: 4, treasuresOnKill: 2,
    badStuff: 'Lancez le dé : perdez ce nombre de cartes.',
    badStuffLevel: -1,
    effect: '-2 pour fuir ce combat.',
  },
  {
    id: 'd-017', name: 'Fan de Vampire', type: CardType.Monster,
    power: 3, treasuresOnKill: 1,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-018', name: 'Gerbosaure', type: CardType.Monster,
    power: 5, treasuresOnKill: 1,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-019', name: 'Goblin Estropié', type: CardType.Monster,
    power: 1, treasuresOnKill: 1,
    badStuff: 'Aucun effet.',
  },
  {
    id: 'd-020', name: 'Golem Fracassé', type: CardType.Monster,
    power: 10, treasuresOnKill: 1,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
    effect: 'Peut être ignoré sans risque par la plupart des joueurs s\'il apparaît comme Monstre Errant.',
  },
  {
    id: 'd-021', name: 'Grenouilles Volantes', type: CardType.Monster,
    power: 2, treasuresOnKill: 1,
    badStuff: 'Elles mordent : perdez 2 niveaux.',
    badStuffLevel: -2,
    effect: '-1 pour fuir ce combat.',
  },
  {
    id: 'd-031', name: 'Harpistes Harpies', type: CardType.Monster,
    power: 2, treasuresOnKill: 2,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-032', name: 'Hippogriffe', type: CardType.Monster,
    power: 16, treasuresOnKill: 3,
    badStuff: 'Piétiné et dévoré : chaque autre joueur prend une carte trésor de votre main.',
    badStuffLevel: -3,
    effect: 'Ne poursuit pas les joueurs de niveau 3 ou moins.',
  },
  {
    id: 'd-033', name: 'Horreur non-euclidienne indicible', type: CardType.Monster,
    power: 16, treasuresOnKill: 4,
    badStuff: 'Mort — sauf si vous êtes Magicien (perdez seulement votre classe).',
    badStuffLevel: -99,
  },
  {
    id: 'd-034', name: 'Huissier', type: CardType.Monster,
    power: 6, treasuresOnKill: 2,
    badStuff: 'Chaque autre joueur pioche une carte.',
    badStuffLevel: -1,
    effect: 'N\'attaque jamais un Voleur ; le Voleur peut défausser 2 trésors pour en piocher 2.',
  },
  {
    id: 'd-035', name: 'Lépréxchaun', type: CardType.Monster,
    power: 2, treasuresOnKill: 1,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-058', name: 'Manticor-nithorynque', type: CardType.Monster,
    power: 12, treasuresOnKill: 2,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-062', name: 'Morpions', type: CardType.Monster,
    power: 4, treasuresOnKill: 1,
    badStuff: 'Défaussez toute votre armure et objets portés sous la ceinture.',
    badStuffLevel: -2,
    effect: 'Impossible de fuir ce monstre.',
  },
  {
    id: 'd-063', name: 'Mr. Nonos', type: CardType.Monster,
    power: 6, treasuresOnKill: 1,
    badStuff: 'Perdez 2 niveaux.',
    badStuffLevel: -2,
    effect: 'Classé comme Mort-Vivant (erratum officiel).',
  },
  {
    id: 'd-064', name: 'Mucus Baveux', type: CardType.Monster,
    power: 1, treasuresOnKill: 1,
    badStuff: 'Perdez vos chaussures ; si vous n\'en portez pas, perdez 1 niveau.',
    badStuffLevel: -1,
    effect: '+4 contre les Elfes.',
  },
  {
    id: 'd-068', name: 'Nez Flottant', type: CardType.Monster,
    power: 4, treasuresOnKill: 1,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-069', name: 'Octaèdre Gélatineux', type: CardType.Monster,
    power: 5, treasuresOnKill: 1,
    badStuff: 'Perdez 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-072', name: 'Pit Bull', type: CardType.Monster,
    power: 3, treasuresOnKill: 1,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-073', name: 'Plante d\'Ornement', type: CardType.Monster,
    power: 1, treasuresOnKill: 1,
    badStuff: 'Aucun effet ; la fuite est automatique.',
    badStuffLevel: 0,
    effect: 'Donne un trésor supplémentaire si vaincue par un Elfe.',
  },
  {
    id: 'd-074', name: 'Poulet Élevé aux Stéroïdes', type: CardType.Monster,
    power: 2, treasuresOnKill: 1,
    badStuff: 'Coups de bec douloureux : perdez 1 niveau.',
    badStuffLevel: -1,
    effect: 'Si vaincu grâce au feu ou aux flammes, gagnez un niveau supplémentaire.',
  },
  {
    id: 'd-078', name: 'Rat Musclé', type: CardType.Monster,
    power: 1, treasuresOnKill: 1,
    badStuff: 'Aucun effet.',
  },
  {
    id: 'd-079', name: 'René Crophage et Fils, Dépanneurs en Chirurgie', type: CardType.Monster,
    power: 10, treasuresOnKill: 2,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-080', name: 'Représentant en Assurances', type: CardType.Monster,
    power: 8, treasuresOnKill: 4,
    badStuff: 'Obligé de souscrire une assurance : perdez des objets pour 1000 po.',
    badStuffLevel: -3,
  },
  {
    id: 'd-083', name: 'Succube Lange-de-Belle-Mère', type: CardType.Monster,
    power: 6, treasuresOnKill: 1,
    badStuff: 'Perdez 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-084', name: 'Suceur de Tête', type: CardType.Monster,
    power: 8, treasuresOnKill: 3,
    badStuff: 'Un baiser dégoûtant : perdez 2 niveaux (3 pour un Elfe).',
    badStuffLevel: -2,
    effect: 'Le joueur doit défausser un objet de son choix avant le combat.',
  },
  {
    id: 'd-089', name: 'Trôliste', type: CardType.Monster,
    power: 10, treasuresOnKill: 2,
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-090', name: 'Tut-Tuuut-Ankh-Ammon', type: CardType.Monster,
    power: 14, treasuresOnKill: 3,
    badStuff: 'Défaussez toute votre main et tous vos objets en jeu.',
    badStuffLevel: -3,
  },
  {
    id: 'd-091', name: 'Vamps...ires !?!', type: CardType.Monster,
    power: 3, treasuresOnKill: 1,
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },

  // ── Amplificateurs de monstre ──────────────────────────────────────────────
  {
    id: 'd-014', name: 'Énoooorme !', type: CardType.MonsterBooster,
    effect: 'Augmente la force d\'un monstre et le nombre de trésors qu\'il rapporte.',
  },
  {
    id: 'd-015', name: 'Enragé', type: CardType.MonsterBooster,
    effect: 'Augmente la force de combat d\'un monstre.',
  },
  {
    id: 'd-027', name: 'Intelligent', type: CardType.MonsterBooster,
    effect: 'Augmente la force de combat d\'un monstre.',
  },
  {
    id: 'd-071', name: 'Petite Amie', type: CardType.MonsterBooster,
    effect: 'Ajoute un second monstre identique (la compagne) au combat.',
  },
  {
    id: 'd-092', name: 'Vénérable', type: CardType.MonsterBooster,
    effect: 'Augmente la force de combat d\'un monstre.',
  },

  // ── Malédictions ──────────────────────────────────────────────────────────
  {
    id: 'd-039', name: 'Malédiction !', type: CardType.DoorCurse,
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-040', name: 'Malédiction !', type: CardType.DoorCurse,
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-041', name: 'Malédiction !', type: CardType.DoorCurse,
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-042', name: 'Malédiction !', type: CardType.DoorCurse,
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-043', name: 'Malédiction !', type: CardType.DoorCurse,
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-044', name: 'Malédiction ! Canard de l\'Apocalypse', type: CardType.DoorCurse,
    curseEffect: 'duck-of-doom',
    effect: 'Défaussez votre objet équipé le plus puissant.',
  },
  {
    id: 'd-045', name: 'Malédiction ! Changement de Classe', type: CardType.DoorCurse,
    curseEffect: 'lose-class',
    effect: 'Échangez votre classe actuelle contre une autre.',
  },
  {
    id: 'd-046', name: 'Malédiction ! Changement de Race', type: CardType.DoorCurse,
    curseEffect: 'lose-race',
    effect: 'Échangez votre race actuelle contre une autre.',
  },
  {
    id: 'd-047', name: 'Malédiction ! Changement de Sexe', type: CardType.DoorCurse,
    curseEffect: 'generic',
    effect: 'Le sexe du personnage change ; peut rendre certains objets (in)utilisables.',
  },
  {
    id: 'd-048', name: 'Malédiction ! Commun des Mortels', type: CardType.DoorCurse,
    curseEffect: 'lose-race',
    effect: 'Perdez votre race actuelle et redevenez Humain.',
  },
  {
    id: 'd-049', name: 'Malédiction ! Déclassé !', type: CardType.DoorCurse,
    curseEffect: 'lose-class',
    effect: 'Perdez votre classe actuelle.',
  },
  {
    id: 'd-050', name: 'Malédiction ! Impôt sur le Revenu', type: CardType.DoorCurse,
    curseEffect: 'lose-two-cards',
    effect: 'Perdez des objets ou pièces d\'or selon un jet de dé.',
  },
  {
    id: 'd-051', name: 'Malédiction ! Grosse Perte', type: CardType.DoorCurse,
    curseEffect: 'lose-big-item',
    effect: 'Perdez un gros objet de votre choix.',
  },
  {
    id: 'd-052', name: 'Malédiction ! Miroir Perfide', type: CardType.DoorCurse,
    curseEffect: 'generic',
    effect: 'Effets variés selon les cartes présentes.',
  },
  {
    id: 'd-053', name: 'Malédiction ! Perdez deux cartes', type: CardType.DoorCurse,
    curseEffect: 'lose-two-cards',
    effect: 'Défaussez deux cartes de votre choix.',
  },
  {
    id: 'd-054', name: 'Malédiction ! Petite Perte', type: CardType.DoorCurse,
    curseEffect: 'lose-small-item',
    effect: 'Perdez un petit objet de votre choix.',
  },
  {
    id: 'd-055', name: 'Malédiction ! Petite Perte', type: CardType.DoorCurse,
    curseEffect: 'lose-small-item',
    effect: 'Perdez un petit objet de votre choix.',
  },
  {
    id: 'd-056', name: 'Malédiction ! Poulet sur la Tête', type: CardType.DoorCurse,
    curseEffect: 'generic',
    effect: 'Votre coiffe ne vous procure plus son bonus jusqu\'à ce que la malédiction soit levée.',
  },
  {
    id: 'd-057', name: 'Malédiction Vraiment Trop Injuste !', type: CardType.DoorCurse,
    curseEffect: 'lose-two-cards',
    effect: 'Cumule plusieurs pénalités : perdez des cartes ET des niveaux.',
  },

  // ── Classes (3 exemplaires chacune) ───────────────────────────────────────
  {
    id: 'd-022', name: 'Guerrier', type: CardType.Class, classId: 'warrior',
    effect: 'Gagne les combats à égalité. Peut défausser jusqu\'à 3 cartes en combat pour +1 chacune (Berserk).',
  },
  {
    id: 'd-023', name: 'Guerrier', type: CardType.Class, classId: 'warrior',
    effect: 'Gagne les combats à égalité. Peut défausser jusqu\'à 3 cartes en combat pour +1 chacune (Berserk).',
  },
  {
    id: 'd-024', name: 'Guerrier', type: CardType.Class, classId: 'warrior',
    effect: 'Gagne les combats à égalité. Peut défausser jusqu\'à 3 cartes en combat pour +1 chacune (Berserk).',
  },
  {
    id: 'd-036', name: 'Magicien', type: CardType.Class, classId: 'wizard',
    effect: 'Sort de Fuite : défaussez jusqu\'à 3 cartes après le jet de fuite pour +1 chacune. Sort de Charme : défaussez toute votre main (min 3 cartes) pour neutraliser un monstre (trésor sans niveau).',
  },
  {
    id: 'd-037', name: 'Magicien', type: CardType.Class, classId: 'wizard',
    effect: 'Sort de Fuite : défaussez jusqu\'à 3 cartes après le jet de fuite pour +1 chacune. Sort de Charme : défaussez toute votre main (min 3 cartes) pour neutraliser un monstre (trésor sans niveau).',
  },
  {
    id: 'd-038', name: 'Magicien', type: CardType.Class, classId: 'wizard',
    effect: 'Sort de Fuite : défaussez jusqu\'à 3 cartes après le jet de fuite pour +1 chacune. Sort de Charme : défaussez toute votre main (min 3 cartes) pour neutraliser un monstre (trésor sans niveau).',
  },
  {
    id: 'd-075', name: 'Prêtre', type: CardType.Class, classId: 'cleric',
    effect: 'Résurrection : peut piocher dans la défausse (en défaussant une carte pour chacune récupérée). Renvoi : défaussez jusqu\'à 3 cartes contre un Mort-Vivant pour +3 chacune.',
  },
  {
    id: 'd-076', name: 'Prêtre', type: CardType.Class, classId: 'cleric',
    effect: 'Résurrection : peut piocher dans la défausse (en défaussant une carte pour chacune récupérée). Renvoi : défaussez jusqu\'à 3 cartes contre un Mort-Vivant pour +3 chacune.',
  },
  {
    id: 'd-077', name: 'Prêtre', type: CardType.Class, classId: 'cleric',
    effect: 'Résurrection : peut piocher dans la défausse (en défaussant une carte pour chacune récupérée). Renvoi : défaussez jusqu\'à 3 cartes contre un Mort-Vivant pour +3 chacune.',
  },
  {
    id: 'd-093', name: 'Voleur', type: CardType.Class, classId: 'thief',
    effect: 'Vol : défaussez une carte et lancez le dé — 4+ vole un petit objet porté. Coup dans le dos : défaussez une carte pour infliger -2 à un joueur en combat.',
  },
  {
    id: 'd-094', name: 'Voleur', type: CardType.Class, classId: 'thief',
    effect: 'Vol : défaussez une carte et lancez le dé — 4+ vole un petit objet porté. Coup dans le dos : défaussez une carte pour infliger -2 à un joueur en combat.',
  },
  {
    id: 'd-095', name: 'Voleur', type: CardType.Class, classId: 'thief',
    effect: 'Vol : défaussez une carte et lancez le dé — 4+ vole un petit objet porté. Coup dans le dos : défaussez une carte pour infliger -2 à un joueur en combat.',
  },

  // ── Races (3 exemplaires chacune) ─────────────────────────────────────────
  {
    id: 'd-011', name: 'Elfe', type: CardType.Race, raceId: 'elf',
    effect: '+1 pour fuir. Quand vous aidez quelqu\'un à vaincre un monstre, vous gagnez aussi un niveau.',
  },
  {
    id: 'd-012', name: 'Elfe', type: CardType.Race, raceId: 'elf',
    effect: '+1 pour fuir. Quand vous aidez quelqu\'un à vaincre un monstre, vous gagnez aussi un niveau.',
  },
  {
    id: 'd-013', name: 'Elfe', type: CardType.Race, raceId: 'elf',
    effect: '+1 pour fuir. Quand vous aidez quelqu\'un à vaincre un monstre, vous gagnez aussi un niveau.',
  },
  {
    id: 'd-028', name: 'Halfelin', type: CardType.Race, raceId: 'halfling',
    effect: 'Peut vendre un objet par tour au double de sa valeur. Si le premier jet de fuite échoue, peut défausser une carte pour retenter.',
  },
  {
    id: 'd-029', name: 'Halfelin', type: CardType.Race, raceId: 'halfling',
    effect: 'Peut vendre un objet par tour au double de sa valeur. Si le premier jet de fuite échoue, peut défausser une carte pour retenter.',
  },
  {
    id: 'd-030', name: 'Halfelin', type: CardType.Race, raceId: 'halfling',
    effect: 'Peut vendre un objet par tour au double de sa valeur. Si le premier jet de fuite échoue, peut défausser une carte pour retenter.',
  },
  {
    id: 'd-065', name: 'Nain', type: CardType.Race, raceId: 'dwarf',
    effect: 'Peut porter un nombre illimité de gros objets. Peut avoir jusqu\'à 6 cartes en main.',
  },
  {
    id: 'd-066', name: 'Nain', type: CardType.Race, raceId: 'dwarf',
    effect: 'Peut porter un nombre illimité de gros objets. Peut avoir jusqu\'à 6 cartes en main.',
  },
  {
    id: 'd-067', name: 'Nain', type: CardType.Race, raceId: 'dwarf',
    effect: 'Peut porter un nombre illimité de gros objets. Peut avoir jusqu\'à 6 cartes en main.',
  },

  // ── Cartes spéciales (porte) ───────────────────────────────────────────────
  {
    id: 'd-025', name: 'Illusion', type: CardType.Special,
    effect: 'Fait disparaître un monstre du combat sans en tirer de niveau.',
  },
  {
    id: 'd-026', name: 'Intervention Divine', type: CardType.Special,
    effect: 'Usages multiples liés au Prêtre.',
  },
  {
    id: 'd-059', name: 'Monstre Errant', type: CardType.Special,
    effect: 'Ajoute un second monstre à un combat en cours.',
  },
  {
    id: 'd-060', name: 'Monstre Errant', type: CardType.Special,
    effect: 'Ajoute un second monstre à un combat en cours.',
  },
  {
    id: 'd-061', name: 'Monstre Errant', type: CardType.Special,
    effect: 'Ajoute un second monstre à un combat en cours.',
  },
  {
    id: 'd-070', name: 'Pause Déjeuner', type: CardType.Special,
    effect: 'Retire temporairement un monstre du combat.',
  },
  {
    id: 'd-081', name: 'Sang-mêlé', type: CardType.Special,
    effect: 'Permet de cumuler deux races en même temps.',
  },
  {
    id: 'd-082', name: 'Sang-mêlé', type: CardType.Special,
    effect: 'Permet de cumuler deux races en même temps.',
  },
  {
    id: 'd-085', name: 'Super Munchkin', type: CardType.Special,
    effect: 'Permet de cumuler deux classes en même temps, avec les avantages des deux.',
  },
  {
    id: 'd-086', name: 'Super Munchkin', type: CardType.Special,
    effect: 'Permet de cumuler deux classes en même temps, avec les avantages des deux.',
  },
  {
    id: 'd-087', name: 'Tire-moi de là !', type: CardType.Special,
    effect: 'Permet de demander ou forcer une aide en combat.',
  },
  {
    id: 'd-088', name: 'Tricheur !', type: CardType.Special,
    effect: 'Permet d\'utiliser un objet normalement interdit par la race, la classe ou le sexe du joueur.',
  },
];

// ---------------------------------------------------------------------------
// TRÉSORS — 73 cartes
// IDs calqués sur les positions du fichier munchkin_base.json (t-001 … t-073)
// Les bonus non vérifiés sont des estimations raisonnables.
// ---------------------------------------------------------------------------

const TREASURE_CARDS: readonly Card[] = [
  // ── Pièces d'or / Monte d'un niveau ───────────────────────────────────────
  {
    id: 't-001', name: '1000 pièces d\'or', type: CardType.Treasure,
    levelUp: 1, goldValue: 1000,
    effect: 'Gagnez 1 niveau immédiatement (max 9 hors combat).',
  },
  {
    id: 't-021', name: 'Champagne', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-026', name: 'Don de Chips Désintéressé au MJ', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-034', name: 'Erreur de Calcul Avantageuse', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-037', name: 'Génocide de Fourmis à l\'Huile Bouillante', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-042', name: 'Invocation de Règles Obscures', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-048', name: 'Mutiler les Cadavres', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-051', name: 'Pillaaaaaaage !', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-052', name: 'Pleurer dans les Jupes du MJ', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-057', name: 'Potion de Machisme Triomphant', type: CardType.Treasure,
    levelUp: 1, isOneShot: true,
    effect: 'Gagnez 1 niveau immédiatement.',
  },
  {
    id: 't-072', name: 'Tuer le Fidèle Serviteur', type: CardType.Treasure,
    levelUp: 1,
    effect: 'Gagnez 1 niveau immédiatement (défaussez le Fidèle Serviteur).',
  },

  // ── Armes ─────────────────────────────────────────────────────────────────
  {
    id: 't-004', name: 'Arc Enrubanné', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-012', name: 'Bâton de Napalm', type: CardType.Treasure,
    power: 5, goldValue: 500, isBigItem: true,
    effect: 'Arme à 2 mains. Magicien uniquement. Bonus de combat le plus élevé du jeu de base.',
  },
  {
    id: 't-017', name: 'Brochette de Rat', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-025', name: 'Dague de Traîtrise', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-029', name: 'Énorme Rocher', type: CardType.Treasure,
    power: 3, goldValue: 300, isBigItem: true,
    effect: 'Arme à 2 mains (gros objet).',
  },
  {
    id: 't-031', name: 'Épée (de) Bâtard(e)', type: CardType.Treasure,
    power: 3, goldValue: 400,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-032', name: 'Épée de Féminisme Exacerbé', type: CardType.Treasure,
    power: 3, goldValue: 400,
    effect: 'Arme à 1 main (jeu de mots sur "broad sword").',
  },
  {
    id: 't-033', name: 'Épée Karaoké', type: CardType.Treasure,
    power: 2, goldValue: 400,
    effect: 'Arme à 1 main. Tous sauf Voleur.',
  },
  {
    id: 't-040', name: 'Gourdin de Misogynie Fracassante', type: CardType.Treasure,
    power: 2, goldValue: 200,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-041', name: 'Hallebarde Suisse Multifonctions', type: CardType.Treasure,
    power: 4, goldValue: 500, isBigItem: true,
    effect: 'Arme à 2 mains (gros objet, erratum officiel).',
  },
  {
    id: 't-044', name: 'Lance de 3,50 m', type: CardType.Treasure,
    power: 3, goldValue: 300, isBigItem: true,
    effect: 'Arme à 2 mains (gros objet).',
  },
  {
    id: 't-045', name: 'Masse d\'Armes de Répartie Piquante', type: CardType.Treasure,
    power: 3, goldValue: 300,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-046', name: 'Marteau des Rotules Douloureuses', type: CardType.Treasure,
    power: 2, goldValue: 200,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-047', name: 'Missile Magique', type: CardType.Treasure,
    power: 3, goldValue: 300,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-064', name: 'Râpe à Fromage de la Paix', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-065', name: 'Rapière d\'Injustice Flagrante', type: CardType.Treasure,
    power: 3, goldValue: 400,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-070', name: 'Tronçonneuse de la Mort', type: CardType.Treasure,
    power: 5, goldValue: 600, isBigItem: true,
    effect: 'Arme à 2 mains (gros objet). Nécessite une source d\'énergie.',
  },
  {
    id: 't-071', name: 'Tuba d\'Envoûtement', type: CardType.Treasure,
    power: 0, fleeBonus: 3, goldValue: 300,
    effect: 'Gros objet à 1 main. +3 pour fuir. En cas de fuite réussie, prenez une carte trésor face cachée.',
    isBigItem: true,
  },

  // ── Armures ────────────────────────────────────────────────────────────────
  {
    id: 't-005', name: 'Armure de Cuir', type: CardType.Treasure,
    power: 1, goldValue: 200,
    effect: 'Armure légère.',
  },
  {
    id: 't-006', name: 'Armure de Flamme', type: CardType.Treasure,
    power: 3, goldValue: 400,
    effect: 'Armure enflammée.',
  },
  {
    id: 't-007', name: 'Armure de Mithril', type: CardType.Treasure,
    power: 4, goldValue: 600, isBigItem: true,
    effect: 'Armure lourde (gros objet). Interdite au Magicien.',
  },
  {
    id: 't-008', name: 'Armure Gluante', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Armure collante.',
  },
  {
    id: 't-009', name: 'Armure Trapue', type: CardType.Treasure,
    power: 2, goldValue: 200,
    effect: 'Armure courte et large.',
  },
  {
    id: 't-020', name: 'Cape d\'Ombre', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Armure légère.',
  },

  // ── Coiffes ────────────────────────────────────────────────────────────────
  {
    id: 't-011', name: 'Bandana de Gros Dur', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Couvre-tête.',
  },
  {
    id: 't-018', name: 'Casque de Courage', type: CardType.Treasure,
    power: 1, goldValue: 200,
    effect: 'Couvre-tête.',
  },
  {
    id: 't-019', name: 'Casque de Virilité Ostentatoire', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Couvre-tête avec des cornes.',
  },
  {
    id: 't-022', name: 'Chapeau Pointu de Thaumaturgie', type: CardType.Treasure,
    power: 3, goldValue: 400,
    effect: 'Couvre-tête. Magicien uniquement.',
  },

  // ── Boucliers ──────────────────────────────────────────────────────────────
  {
    id: 't-014', name: 'Bouclier Surdimensionné', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Bouclier à 1 main.',
  },
  {
    id: 't-068', name: 'Targe d\'Inconscience Suicidaire', type: CardType.Treasure,
    power: 2, goldValue: 200,
    effect: 'Bouclier à 1 main.',
  },

  // ── Chaussures ────────────────────────────────────────────────────────────
  {
    id: 't-015', name: 'Bottes de Convocation d\'Hémorroïdes', type: CardType.Treasure,
    power: 0, fleeBonus: 2, goldValue: 200,
    effect: '+2 pour fuir (Boots of Running Really Fast).',
  },
  {
    id: 't-016', name: 'Bottes de Déplacement Frénétique', type: CardType.Treasure,
    power: 2, goldValue: 400,
    effect: '+2 en combat (Boots of Butt-Kicking).',
  },
  {
    id: 't-066', name: 'Sandales de Protection', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Protection contre certaines malédictions.',
  },

  // ── Objets divers (équipables) ────────────────────────────────────────────
  {
    id: 't-023', name: 'Collants de Force de Géant', type: CardType.Treasure,
    power: 2, goldValue: 300,
    effect: 'Objet équipable. Confère la force d\'un géant.',
  },
  {
    id: 't-030', name: 'Escabeau', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Objet équipable.',
  },
  {
    id: 't-039', name: 'Genouillères Perforantes', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Objet équipable.',
  },
  {
    id: 't-050', name: 'Oh, Les Jolis Ballons !', type: CardType.Treasure,
    power: 0, goldValue: 100,
    effect: 'Objet équipable. Effet esthétique.',
  },
  {
    id: 't-069', name: 'Titre qui en Jette Vraiment Grave', type: CardType.Treasure,
    power: 1, goldValue: 100,
    effect: 'Objet équipable. N\'est pas un objet sans valeur (erratum officiel).',
  },

  // ── Objets spéciaux ────────────────────────────────────────────────────────
  {
    id: 't-002', name: 'Anneau de Souhait', type: CardType.Treasure,
    isOneShot: true, goldValue: 500,
    effect: 'Annule n\'importe quelle malédiction, à tout moment.',
  },
  {
    id: 't-003', name: 'Anneau de Souhait', type: CardType.Treasure,
    isOneShot: true, goldValue: 500,
    effect: 'Annule n\'importe quelle malédiction, à tout moment.',
  },
  {
    id: 't-010', name: 'Baguette de Sourcier', type: CardType.Treasure,
    isOneShot: true, goldValue: 200,
    effect: 'Usage unique (erratum officiel).',
  },
  {
    id: 't-027', name: 'Doppelganger', type: CardType.Treasure,
    isOneShot: true, goldValue: 300,
    effect: 'Double la force de combat du joueur ou du monstre.',
  },
  {
    id: 't-028', name: 'Dé Pipé', type: CardType.Treasure,
    isOneShot: true, goldValue: 300,
    effect: 'Permet de truquer un jet de dé.',
  },
  {
    id: 't-035', name: 'Fidèle Serviteur', type: CardType.Treasure,
    power: 1, goldValue: 200,
    effect: 'Donne un bonus de combat et peut porter un objet pour le joueur.',
  },
  {
    id: 't-038', name: 'Genouillères de Séduction', type: CardType.Treasure,
    isOneShot: true, goldValue: 200,
    effect: 'Règles précises à vérifier sur la carte physique.',
  },
  {
    id: 't-073', name: 'Vol de Niveau', type: CardType.Treasure,
    isOneShot: true, goldValue: 400,
    effect: 'Choisissez un joueur : vous gagnez 1 niveau, il en perd 1.',
  },

  // ── Objets à usage unique ─────────────────────────────────────────────────
  {
    id: 't-013', name: 'Boisson Énergisante Éventée', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: '+2 en combat, usage unique.',
  },
  {
    id: 't-036', name: 'Flaque de Colle', type: CardType.Treasure,
    isOneShot: true, goldValue: 100,
    effect: 'Colle un monstre : impose -2 à la fuite du monstre.',
  },
  {
    id: 't-043', name: 'Lampe Merveilleuse', type: CardType.Treasure,
    isOneShot: true, goldValue: 500,
    effect: 'Invoque un génie qui fait disparaître un monstre ; récupérez son trésor sans gagner de niveau.',
  },
  {
    id: 't-049', name: 'Mur Instantané', type: CardType.Treasure,
    isOneShot: true, goldValue: 400,
    effect: 'Fuite automatique pour un ou deux joueurs consentants.',
  },
  {
    id: 't-067', name: 'Sandwich Chocolat-Moules-Anchois', type: CardType.Treasure,
    power: 3, isOneShot: true, goldValue: 300,
    effect: '+3 en combat, usage unique.',
  },

  // ── Potions (usage unique) ────────────────────────────────────────────────
  {
    id: 't-024', name: 'Cotion de Ponfusion', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: 'Potion (jeu de mots sur Potion de Confusion). +2 en combat.',
  },
  {
    id: 't-053', name: 'Potion Acide Radioactive et Électrique', type: CardType.Treasure,
    power: 3, isOneShot: true, goldValue: 300,
    effect: '+3 en combat, usage unique.',
  },
  {
    id: 't-054', name: 'Potion d\'Invisibilité', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: '+2 en combat, usage unique.',
  },
  {
    id: 't-055', name: 'Potion d\'Amitié', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: '+2 en combat, usage unique. Effets spéciaux d\'amitié selon la carte.',
  },
  {
    id: 't-056', name: 'Potion de Bravoure Hystérique', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: '+2 en combat, usage unique.',
  },
  {
    id: 't-058', name: 'Potion de Mauvaise Haleine', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: '+2 en combat, usage unique.',
  },
  {
    id: 't-059', name: 'Potion de Poison Enflammé', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 200,
    effect: '+2 en combat, usage unique.',
  },
  {
    id: 't-060', name: 'Potion de Polly-morphie', type: CardType.Treasure,
    isOneShot: true, goldValue: 200,
    effect: 'Transforme un monstre en perroquet (jeu de mots polymorph/Polly).',
  },
  {
    id: 't-061', name: 'Potion de Sommeil', type: CardType.Treasure,
    isOneShot: true, goldValue: 200,
    effect: 'Endort un monstre ou un joueur.',
  },
  {
    id: 't-062', name: 'Potion de Transfert', type: CardType.Treasure,
    isOneShot: true, goldValue: 200,
    effect: 'Transfère un effet ou un monstre.',
  },
  {
    id: 't-063', name: 'Potion Glaciale Explosive', type: CardType.Treasure,
    power: 3, isOneShot: true, goldValue: 300,
    effect: '+3 en combat, usage unique.',
  },
];

export const DeckManager = {
  initDecks(): { doorDeck: Card[]; treasureDeck: Card[] } {
    return {
      doorDeck: shuffle(DOOR_CARDS),
      treasureDeck: shuffle(TREASURE_CARDS),
    };
  },

  draw(deck: Card[], n: number): { cards: Card[]; newDeck: Card[] } {
    const cards = deck.slice(0, n);
    const newDeck = deck.slice(n);
    return { cards, newDeck };
  },

  reshuffle(discard: Card[]): Card[] {
    return shuffle(discard);
  },
} as const;
