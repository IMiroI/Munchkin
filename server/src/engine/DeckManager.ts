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
// Valeurs issues de munchkin_base_v2.json (verifie=true).
// Les niveaux marqués null dans le JSON sont estimés (commentaire inline).
// ---------------------------------------------------------------------------

const DOOR_CARDS: readonly Card[] = [
  // ── Monstres ──────────────────────────────────────────────────────────────
  {
    id: 'd-001', name: '3872 Orques', type: CardType.Monster, image: '/cards/porte_001.jpg',
    power: 10, treasuresOnKill: 3,
    effect: '+6 contre les Nains.',
    badStuff: 'Lancez le dé : sur 1-2, mort. Sinon, perdez autant de niveaux qu\'indiqué par le dé.',
    badStuffLevel: -3,
  },
  {
    id: 'd-002', name: 'Amazone', type: CardType.Monster, image: '/cards/porte_002.jpg',
    power: 8, treasuresOnKill: 2,
    effect: 'N\'attaque pas les joueuses ni les joueurs ayant changé de sexe (leur donne 1 trésor à la place).',
    badStuff: 'Perdez votre (vos) classe(s). Si vous n\'avez pas de classe, perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-003', name: 'Balrog Charolais', type: CardType.Monster, image: '/cards/porte_003.jpg',
    power: 18, treasuresOnKill: 5,
    effect: 'Ne poursuit aucun joueur de niveau 4 ou inférieur. Vaincu : gagnez 2 niveaux.',
    badStuff: 'Mort du joueur.',
    badStuffLevel: -99,
  },
  {
    id: 'd-005', name: 'Belvédère Sauvage', type: CardType.Monster, image: '/cards/porte_005.jpg',
    power: 8, treasuresOnKill: 2, noHelpers: true,
    effect: 'Nul ne peut vous aider. Vous devez affronter seul le Belvédère.',
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-006', name: 'Bigfoot, alias Grand-Pied', type: CardType.Monster, image: '/cards/porte_006.jpg',
    power: 10, treasuresOnKill: 3, // niveau non vérifié dans le JSON
    badStuff: 'Le monstre vous écrase et mange votre coiffe : perdez votre couvre-tête.',
    badStuffLevel: -1,
  },
  {
    id: 'd-007', name: 'Binoclard Hurleur', type: CardType.Monster, image: '/cards/porte_007.jpg',
    power: 6, treasuresOnKill: 2,
    effect: '+6 contre les Guerriers.',
    badStuff: 'Devenez un humain anodin : défaussez toute carte de Race ou de Classe en jeu.',
  },
  {
    id: 'd-008', name: 'Céphalopodzilla', type: CardType.Monster, image: '/cards/porte_008.jpg',
    power: 18, treasuresOnKill: 4,
    effect: 'Les Elfes combattent à -4. Ne poursuit aucun joueur de niveau 4 ou moins, sauf un Elfe. Vaincu : gagnez 2 niveaux.',
    badStuff: 'Mort du joueur.',
    badStuffLevel: -99,
  },
  {
    id: 'd-009', name: 'Cheval Zombie', type: CardType.Monster, image: '/cards/porte_009.jpg',
    power: 4, treasuresOnKill: 2, isUndead: true,
    effect: '+5 contre les Nains. Mort-vivant.',
    badStuff: 'Il mord, rue, et sent le canasson crevé : perdez 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-010', name: 'Dragon de Plutonium', type: CardType.Monster, image: '/cards/porte_010.jpg',
    power: 20, treasuresOnKill: 5,
    effect: 'Boss final ; optionnel pour les joueurs de niveau 5 ou moins. Vaincu : gagnez 2 niveaux.',
    badStuff: 'Mort du joueur.',
    badStuffLevel: -99,
  },
  {
    id: 'd-016', name: 'Escargots sous Acide', type: CardType.Monster, image: '/cards/porte_016.jpg',
    power: 4, treasuresOnKill: 2,
    effect: '-2 pour fuir ce combat.',
    badStuff: 'Ils volent vos trésors : lancez le dé et perdez ce nombre de cartes ou objets.',
    badStuffLevel: -2,
  },
  {
    id: 'd-017', name: 'Fan de Vampire', type: CardType.Monster, image: '/cards/porte_017.jpg',
    power: 12, treasuresOnKill: 3,
    effect: 'Un Prêtre peut le faire fuir sans combat (incantation) et récupérer son trésor sans gagner de niveau.',
    badStuff: 'Il verrouille la porte et parle longuement de son personnage : perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-018', name: 'Gerbosaure', type: CardType.Monster, image: '/cards/porte_018.jpg',
    power: 6, treasuresOnKill: 2,
    effect: 'Gagnez un niveau supplémentaire si vous le tuez seul et sans bonus.',
    badStuff: 'Jet de vomi tiède : défaussez toute votre main.',
  },
  {
    id: 'd-019', name: 'Goblin Estropié', type: CardType.Monster, image: '/cards/porte_019.jpg',
    power: 1, treasuresOnKill: 1,
    effect: '+1 au jet pour Deguerpir.',
    badStuff: 'Il vous met un coup de béquille en traître : perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-020', name: 'Golem Fracassé', type: CardType.Monster, image: '/cards/porte_020.jpg',
    power: 14, treasuresOnKill: 4, avoidable: true, halflingMustFight: true,
    effect: 'Vous pouvez combattre ce Golem complètement défoncé ou vous contenter de lui faire coucou et lui laisser son trésor. (Exception: les savoureux halfelins doivent combattre).',
    badStuff: 'Incident Fâcheux: Il a la dalle. Il vous mange. Vous êtes mort.',
    badStuffLevel: -99,
  },
  {
    id: 'd-021', name: 'Grenouilles Volantes', type: CardType.Monster, image: '/cards/porte_021.jpg',
    power: 2, treasuresOnKill: 1,
    effect: '-1 pour fuir ce combat.',
    badStuff: 'Elles mordent : perdez 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-031', name: 'Harpistes X Harpies', type: CardType.Monster, image: '/cards/porte_031.jpg',
    power: 4, treasuresOnKill: 2, powerBonusVsClass: { wizard: 5 },
    effect: 'Résistent à la magie. +5 contre les Magiciens.',
    badStuff: 'Incident Fâcheux : Elles jouent vraiment comme des manches. Perdez 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-032', name: 'Hippogriffe', type: CardType.Monster, image: '/cards/porte_032.jpg',
    power: 16, treasuresOnKill: 4,
    effect: 'Ne poursuit pas les joueurs de niveau 3 ou moins. Vaincu : gagnez 2 niveaux.',
    badStuff: 'Piétiné et mâché : chaque autre joueur (en commençant par votre droite) prend une carte trésor posée devant vous ou dans votre main.',
  },
  {
    id: 'd-033', name: 'Horreur non-euclidienne indicible', type: CardType.Monster, image: '/cards/porte_033.jpg',
    power: 20, treasuresOnKill: 4, // niveau non vérifié dans le JSON
    badStuff: 'Mort — sauf si vous êtes Magicien (perdez seulement votre classe).',
    badStuffLevel: -99,
  },
  {
    id: 'd-034', name: 'Huissier', type: CardType.Monster, image: '/cards/porte_034.jpg',
    power: 6, treasuresOnKill: 2,
    effect: 'N\'attaque jamais un Voleur ; le Voleur peut défausser 2 trésors pour en piocher 2 face cachée.',
    badStuff: 'Chaque autre joueur pioche une carte.',
    badStuffLevel: -1,
  },
  {
    id: 'd-035', name: 'Lépreuxchaun', type: CardType.Monster, image: '/cards/porte_035.jpg',
    power: 4, treasuresOnKill: 2, powerBonusVsRace: { elf: 5 },
    badStuffLevel: 0, badStuffNeighborsDiscard: true,
    effect: 'Mais il est dégueu ! +5 contre les Elfes.',
    badStuff: 'Incident Fâcheux: il vous prend 2 objets, choisis par chacun des deux joueurs qui vous entourent.',
  },
  {
    id: 'd-058', name: 'Manticor-nithorynque', type: CardType.Monster, image: '/cards/porte_058.jpg',
    power: 6, treasuresOnKill: 2, powerBonusVsClass: { wizard: 6 },
    badStuffLevel: -2, badStuffChoiceLevelsOrHand: true,
    effect: 'Résiste à la magie. +6 contre les Magiciens.',
    badStuff: 'Incident Fâcheux : défaussez toute votre main ou perdez 2 niveaux (au choix).',
  },
  {
    id: 'd-062', name: 'Morpions', type: CardType.Monster, image: '/cards/porte_062.jpg',
    power: 6, treasuresOnKill: 1, // niveau non vérifié dans le JSON
    effect: 'Impossible de fuir ce monstre.',
    badStuff: 'Défaussez toute votre armure et tous les objets portés sous la ceinture.',
    badStuffLevel: -2,
  },
  {
    id: 'd-063', name: 'Mr. Nonos', type: CardType.Monster, image: '/cards/porte_063.jpg',
    power: 2, treasuresOnKill: 1, isUndead: true, fleeSuccessPenalty: 1,
    effect: 'Si vous devez vous enfuir, vous perdez 1 niveau même si vous arrivez à Déguerpir.',
    badStuff: 'Incident Fâcheux : son contact osscux vous coûte 2 niveaux.',
    badStuffLevel: -2,
  },
  {
    id: 'd-064', name: 'Mucus Baveux', type: CardType.Monster, image: '/cards/porte_064.jpg',
    power: 1, treasuresOnKill: 1,
    effect: '+4 contre les Elfes.',
    badStuff: 'Défaussez les chaussures portées. Si vous n\'en portez pas, perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-068', name: 'Nez Flottant', type: CardType.Monster, image: '/cards/porte_068.jpg',
    power: 6, treasuresOnKill: 1, // niveau et trésors non vérifiés dans le JSON
    badStuff: 'Perdez 3 niveaux.',
    badStuffLevel: -3,
  },
  {
    id: 'd-069', name: 'Octaèdre Gélatineux', type: CardType.Monster, image: '/cards/porte_069.jpg',
    power: 2, treasuresOnKill: 1, monsterFleeBonus: 1, badStuffLoseAllBigItems: true,
    effect: '+1 au jet pour Déguerpir.',
    badStuff: 'Incident Fâcheux : si vous n\'arrivez pas à Déguerpir, vous lâchez tous vos Gros objets.',
    badStuffLevel: -2,
  },
  {
    id: 'd-072', name: 'Pit Bull', type: CardType.Monster, image: '/cards/porte_072.jpg',
    power: 2, treasuresOnKill: 1, autoFleeByItemTag: ['wand', 'staff', 'lance'],
    effect: 'Si vous ne pouvez le vaincre, vous pouvez le distraire (vous Déguerpissez automatiquement) en lachant une baguette, un bâton ou une lance. Va chercher, Médor!',
    badStuff: 'Incident Fâcheux : traces de morsures sur vos fesses. Perdez 2 niveaux',
    badStuffLevel: -2,
  },
  {
    id: 'd-073', name: 'Plante d\'Ornement', type: CardType.Monster, image: '/cards/porte_073.jpg',
    power: 1, treasuresOnKill: 1,
    effect: 'Donne un trésor supplémentaire si vaincue par un Elfe.',
    badStuff: 'Aucun effet ; la fuite est automatique.',
    badStuffLevel: 0,
  },
  {
    id: 'd-074', name: 'Poulet Élevé aux Stéroïdes', type: CardType.Monster, image: '/cards/porte_074.jpg',
    power: 2, treasuresOnKill: 1,
    effect: 'Si vaincu grâce au feu ou aux flammes, gagnez un niveau supplémentaire.',
    badStuff: 'Coups de bec douloureux : perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-078', name: 'Rat Musclé', type: CardType.Monster, image: '/cards/porte_078.jpg',
    power: 1, treasuresOnKill: 1,
    effect: '+3 contre les Prêtres. Créature de l\'enfer.',
    badStuff: 'Perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-079', name: 'René Crophage et Fils, Dépanneurs en Chirurgie', type: CardType.Monster, image: '/cards/porte_079.jpg',
    power: 16, treasuresOnKill: 4, isUndead: true, levelsOnKill: 2, fleeSuccessPenalty: 2,
    effect: 'Ne poursuit aucun joueur de niveau 3 ou moins. Les autres perdent 2 niveaux même en cas de fuite réussie. Mort-vivant. Vaincu : gagnez 2 niveaux.',
    badStuff: 'Vidange des fluides vitaux : retombez au niveau 1.',
    badStuffLevel: -8,
  },
  {
    id: 'd-080', name: 'Représentant en Assurances', type: CardType.Monster, image: '/cards/porte_080.jpg',
    power: 14, treasuresOnKill: 4,
    effect: 'Votre niveau ne compte pas dans ce combat : seuls les bonus d\'objets s\'appliquent.',
    badStuff: 'Souscrivez une assurance forcée : défaussez des objets pour 1000 po. Si pas assez, perdez tout et perdez 1 niveau.',
    badStuffLevel: -3,
  },
  {
    id: 'd-083', name: 'Succube Lange-de-Belle-Mère', type: CardType.Monster, image: '/cards/porte_083.jpg',
    power: 12, treasuresOnKill: 3,
    effect: '+4 contre les Prêtres. Avant le combat, défaussez un objet de votre choix. Créature de l\'enfer.',
    badStuff: 'Un baiser dégoûtant : perdez 2 niveaux (3 pour un Elfe).',
    badStuffLevel: -2,
  },
  {
    id: 'd-084', name: 'Suceur de Tête', type: CardType.Monster, image: '/cards/porte_084.jpg',
    power: 8, treasuresOnKill: 2,
    effect: '+6 contre les Elfes.',
    badStuff: 'Il arrache votre visage et votre couvre-chef : défaussez tout couvre-chef porté et perdez 1 niveau.',
    badStuffLevel: -1,
  },
  {
    id: 'd-089', name: 'Trôliste', type: CardType.Monster, image: '/cards/porte_089.jpg',
    power: 10, treasuresOnKill: 3,
    effect: 'N\'a aucun pouvoir spécial, ce qui le rend furieux.',
    badStuff: 'Le ou les joueurs ayant le plus haut niveau prennent chacun un objet.',
    badStuffLevel: -1,
  },
  {
    id: 'd-090', name: 'Tut-Tuuut-Ankh-Ammon', type: CardType.Monster, image: '/cards/porte_090.jpg',
    power: 16, treasuresOnKill: 4, isUndead: true, levelsOnKill: 2, fleeSuccessPenalty: 2,
    effect: 'Ne poursuit aucun joueur de niveau 3 ou moins. Les autres perdent 2 niveaux même en cas de fuite réussie. Mort-vivant. Vaincu : gagnez 2 niveaux.',
    badStuff: 'Perdez tous vos objets et toutes les cartes de votre main.',
    badStuffLevel: -3,
  },
  {
    id: 'd-091', name: 'Vamps...ires !?!', type: CardType.Monster, image: '/cards/porte_091.jpg',
    power: 8, treasuresOnKill: 2, rawLevelOnly: true, badStuffSetToMinLevel: true,
    effect: 'Pour les combattre, vous ne pouvez utiliser aucun objet ni autre bonus! Vous ne pouvez utiliser que votre niveau.',
    badStuff: 'Incident Fâcheux : votre niveau devient équivalent à celui du joueur de plus bas niveau...',
    badStuffLevel: -3,
  },

  // ── Amplificateurs / affaiblisseurs de monstre ────────────────────────────
  {
    id: 'd-004', name: 'Bébé !', type: CardType.MonsterBooster, image: '/cards/porte_004.jpg',
    effect: '-5 au monstre (minimum niveau 1). Si le monstre est tout de même vaincu, tirez 1 carte trésor en moins (minimum 1).',
  },
  {
    id: 'd-014', name: 'Énoooorme !', type: CardType.MonsterBooster, image: '/cards/porte_014.jpg',
    power: 10,
    effect: '+10 au monstre. Si le monstre est tout de même vaincu, tirez 2 cartes trésor supplémentaires.',
  },
  {
    id: 'd-015', name: 'Enragé', type: CardType.MonsterBooster, image: '/cards/porte_015.jpg',
    power: 5,
    effect: '+5 au monstre. Si le monstre est tout de même vaincu, tirez 1 carte trésor supplémentaire.',
  },
  {
    id: 'd-027', name: 'Intelligent', type: CardType.MonsterBooster, image: '/cards/porte_027.jpg',
    power: 5,
    effect: '+5 au monstre. Si le monstre est tout de même vaincu, tirez 1 carte trésor supplémentaire.',
  },
  {
    id: 'd-071', name: 'Petite Amie', type: CardType.MonsterBooster, image: '/cards/porte_071.jpg',
    effect: 'Ajoute un second monstre identique au combat (même niveau, mêmes bonus). Trésors et niveaux comptés séparément pour chacun.',
  },
  {
    id: 'd-092', name: 'Vénérable', type: CardType.MonsterBooster, image: '/cards/porte_092.jpg',
    power: 10,
    effect: '+10 au monstre. Si le monstre est tout de même vaincu, tirez 2 cartes trésor supplémentaires.',
  },

  // ── Malédictions ──────────────────────────────────────────────────────────
  {
    id: 'd-039', name: 'Malédiction !', type: CardType.DoorCurse, image: '/cards/porte_039.jpg',
    curseEffect: 'generic',
    effect: 'Perdez l\'armure que vous portez.',
  },
  {
    id: 'd-040', name: 'Malédiction !', type: CardType.DoorCurse, image: '/cards/porte_040.jpg',
    curseEffect: 'generic',
    effect: 'Perdez les chaussures que vous portez.',
  },
  {
    id: 'd-041', name: 'Malédiction !', type: CardType.DoorCurse, image: '/cards/porte_041.jpg',
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-042', name: 'Malédiction !', type: CardType.DoorCurse, image: '/cards/porte_042.jpg',
    curseEffect: 'lose-level',
    effect: 'Perdez 1 niveau immédiatement.',
  },
  {
    id: 'd-043', name: 'Malédiction !', type: CardType.DoorCurse, image: '/cards/porte_043.jpg',
    curseEffect: 'generic',
    effect: 'Perdez le couvre-chef que vous portez.',
  },
  {
    id: 'd-044', name: 'Malédiction ! Canard de l\'Apocalypse', type: CardType.DoorCurse, image: '/cards/porte_044.jpg',
    curseEffect: 'duck-of-doom',
    effect: 'Perdez 2 niveaux.',
  },
  {
    id: 'd-045', name: 'Malédiction ! Changement de Classe', type: CardType.DoorCurse, image: '/cards/porte_045.jpg',
    curseEffect: 'lose-class',
    effect: 'Échangez votre classe actuelle contre une autre.',
  },
  {
    id: 'd-046', name: 'Malédiction ! Changement de Race', type: CardType.DoorCurse, image: '/cards/porte_046.jpg',
    curseEffect: 'lose-race',
    effect: 'Votre race est remplacée par la première race trouvée dans la défausse (ou perdue si aucune).',
  },
  {
    id: 'd-047', name: 'Malédiction ! Changement de Sexe', type: CardType.DoorCurse, image: '/cards/porte_047.jpg',
    curseEffect: 'generic',
    effect: '-5 à votre prochain combat. Le changement de sexe est permanent (affecte les objets réservés et l\'Amazone).',
  },
  {
    id: 'd-048', name: 'Malédiction ! Commun des Mortels', type: CardType.DoorCurse, image: '/cards/porte_048.jpg',
    curseEffect: 'lose-race',
    effect: 'Perdez votre race actuelle et redevenez Humain.',
  },
  {
    id: 'd-049', name: 'Malédiction ! Déclassé !', type: CardType.DoorCurse, image: '/cards/porte_049.jpg',
    curseEffect: 'lose-class',
    effect: 'Perdez votre classe actuelle.',
  },
  {
    id: 'd-050', name: 'Malédiction ! Impôt sur le Revenu', type: CardType.DoorCurse,
    curseEffect: 'generic',
    effect: 'Défaussez un objet. Chaque autre joueur doit défausser autant en valeur ; ceux qui ne peuvent pas défaussent tout et perdent 1 niveau.',
  },
  {
    id: 'd-051', name: 'Malédiction ! Grosse Perte', type: CardType.DoorCurse, image: '/cards/porte_051.jpg',
    curseEffect: 'lose-big-item',
    effect: 'Perdez un gros objet de votre choix.',
  },
  {
    id: 'd-052', name: 'Malédiction ! Miroir Perfide', type: CardType.DoorCurse, image: '/cards/porte_052.jpg',
    curseEffect: 'generic',
    effect: 'Lors de votre prochain combat, aucun bonus d\'objet ne s\'applique (sauf armure). Un Anneau de Souhait lève la malédiction avant ce combat.',
  },
  {
    id: 'd-053', name: 'Malédiction ! Perdez deux cartes', type: CardType.DoorCurse, image: '/cards/porte_053.jpg',
    curseEffect: 'lose-two-cards',
    effect: 'Le joueur à votre gauche puis celui à votre droite prennent chacun une carte au hasard dans votre main.',
  },
  {
    id: 'd-054', name: 'Malédiction ! Petite Perte', type: CardType.DoorCurse, image: '/cards/porte_054.jpg',
    curseEffect: 'lose-small-item',
    effect: 'Perdez un petit objet de votre choix (tout objet non marqué "Gros").',
  },
  {
    id: 'd-055', name: 'Malédiction ! Petite Perte', type: CardType.DoorCurse, image: '/cards/porte_055.jpg',
    curseEffect: 'lose-small-item',
    effect: 'Perdez un petit objet de votre choix (tout objet non marqué "Gros").',
  },
  {
    id: 'd-056', name: 'Malédiction ! Poulet sur la Tête', type: CardType.DoorCurse, image: '/cards/porte_056.jpg',
    curseEffect: 'persistent-equip', dieRollPenalty: -1, removedWithHeadgear: true,
    effect: '-1 à tous vos jets de dé. Toute Malédiction ou Incident Fâcheux qui vous retire votre Couvre-chef fera également disparaitre le poulet',
  },
  {
    id: 'd-057', name: 'Malédiction Vraiment Trop Injuste !', type: CardType.DoorCurse, image: '/cards/porte_057.jpg',
    curseEffect: 'lose-highest-bonus-item',
    effect: 'Perdez l\'objet qui vous donne le plus haut bonus.',
  },

  // ── Classes (3 exemplaires chacune) ───────────────────────────────────────
  {
    id: 'd-022', name: 'Guerrier', type: CardType.Class, classId: 'warrior', image: '/cards/porte_022.jpg',
    classBerserkerRage: true, classWarriorTiebreaker: true,
    effect: 'Rage de berserker: vous pouvez défausser jusqu\'à 3 cartes durant un combat. Chacune vous donne un bonus de +1. En cas d\'ex-aequo durant un combat, c\'est vous qui l\'emportez.',
  },
  {
    id: 'd-023', name: 'Guerrier', type: CardType.Class, classId: 'warrior', image: '/cards/porte_023.jpg',
    classBerserkerRage: true, classWarriorTiebreaker: true,
    effect: 'Rage de berserker: vous pouvez défausser jusqu\'à 3 cartes durant un combat. Chacune vous donne un bonus de +1. En cas d\'ex-aequo durant un combat, c\'est vous qui l\'emportez.',
  },
  {
    id: 'd-024', name: 'Guerrier', type: CardType.Class, classId: 'warrior', image: '/cards/porte_024.jpg',
    classBerserkerRage: true, classWarriorTiebreaker: true,
    effect: 'Rage de berserker: vous pouvez défausser jusqu\'à 3 cartes durant un combat. Chacune vous donne un bonus de +1. En cas d\'ex-aequo durant un combat, c\'est vous qui l\'emportez.',
  },
  {
    id: 'd-036', name: 'Magicien', type: CardType.Class, classId: 'wizard', image: '/cards/porte_036.jpg',
    classFleeBoostByDiscard: true, classCharmMonster: true,
    effect: 'Sort de vol : après avoir jeté le dé pour déguerpir, vous pouvez défausser jusqu\'à 3 cartes pour +1 chacune. Sort de charme : défaussez toute votre main (minimum 3 cartes) pour charmer un Monstre — prenez son Trésor sans gagner de niveau.',
  },
  {
    id: 'd-037', name: 'Magicien', type: CardType.Class, classId: 'wizard', image: '/cards/porte_037.jpg',
    classFleeBoostByDiscard: true, classCharmMonster: true,
    effect: 'Sort de vol : après avoir jeté le dé pour déguerpir, vous pouvez défausser jusqu\'à 3 cartes pour +1 chacune. Sort de charme : défaussez toute votre main (minimum 3 cartes) pour charmer un Monstre — prenez son Trésor sans gagner de niveau.',
  },
  {
    id: 'd-038', name: 'Magicien', type: CardType.Class, classId: 'wizard', image: '/cards/porte_038.jpg',
    classFleeBoostByDiscard: true, classCharmMonster: true,
    effect: 'Sort de vol : après avoir jeté le dé pour déguerpir, vous pouvez défausser jusqu\'à 3 cartes pour +1 chacune. Sort de charme : défaussez toute votre main (minimum 3 cartes) pour charmer un Monstre — prenez son Trésor sans gagner de niveau.',
  },
  {
    id: 'd-075', name: 'Prêtre', type: CardType.Class, classId: 'cleric', image: '/cards/porte_075.jpg',
    classResurrection: true, classTurning: true,
    effect: 'Résurrection: quand vous devez tirer des cartes face visible, vous pouvez choisir de tirer à la place le même nombre de carte de la défausse appropriée (Trésor ou Donjon). Vous devez ensuite défausser une carte de votre main pour chaque carte que vous avez tirée ainsi. Renvoi vous pouvez défausser jusqu\'à 3 cartes en combat contre une créature de type Mort-vivant. Chaque carte défausséc vous donne un bonus de +3.',
  },
  {
    id: 'd-076', name: 'Prêtre', type: CardType.Class, classId: 'cleric', image: '/cards/porte_076.jpg',
    classResurrection: true, classTurning: true,
    effect: 'Résurrection: quand vous devez tirer des cartes face visible, vous pouvez choisir de tirer à la place le même nombre de carte de la défausse appropriée (Trésor ou Donjon). Vous devez ensuite défausser une carte de votre main pour chaque carte que vous avez tirée ainsi. Renvoi vous pouvez défausser jusqu\'à 3 cartes en combat contre une créature de type Mort-vivant. Chaque carte défausséc vous donne un bonus de +3.',
  },
  {
    id: 'd-077', name: 'Prêtre', type: CardType.Class, classId: 'cleric', image: '/cards/porte_077.jpg',
    classResurrection: true, classTurning: true,
    effect: 'Résurrection: quand vous devez tirer des cartes face visible, vous pouvez choisir de tirer à la place le même nombre de carte de la défausse appropriée (Trésor ou Donjon). Vous devez ensuite défausser une carte de votre main pour chaque carte que vous avez tirée ainsi. Renvoi vous pouvez défausser jusqu\'à 3 cartes en combat contre une créature de type Mort-vivant. Chaque carte défausséc vous donne un bonus de +3.',
  },
  {
    id: 'd-093', name: 'Voleur', type: CardType.Class, classId: 'thief', image: '/cards/porte_093.jpg',
    effect: 'Vol à la tire : défaussez une carte, lancez le dé (4+ = volez un petit objet porté). Coup dans le dos : défaussez une carte pour infliger -2 à un joueur en combat.',
  },
  {
    id: 'd-094', name: 'Voleur', type: CardType.Class, classId: 'thief', image: '/cards/porte_094.jpg',
    effect: 'Vol à la tire : défaussez une carte, lancez le dé (4+ = volez un petit objet porté). Coup dans le dos : défaussez une carte pour infliger -2 à un joueur en combat.',
  },
  {
    id: 'd-095', name: 'Voleur', type: CardType.Class, classId: 'thief', image: '/cards/porte_095.jpg',
    effect: 'Vol à la tire : défaussez une carte, lancez le dé (4+ = volez un petit objet porté). Coup dans le dos : défaussez une carte pour infliger -2 à un joueur en combat.',
  },

  // ── Races (3 exemplaires chacune) ─────────────────────────────────────────
  {
    id: 'd-011', name: 'Elfe', type: CardType.Race, raceId: 'elf', image: '/cards/porte_011.jpg',
    fleeBonus: 1, raceHelperGainsLevelPerMonster: true,
    effect: '+1 pour Déguerpir Vous gagnez un niveau pour chaque monstre que vous avez aidé à tuer.',
  },
  {
    id: 'd-012', name: 'Elfe', type: CardType.Race, raceId: 'elf', image: '/cards/porte_012.jpg',
    fleeBonus: 1, raceHelperGainsLevelPerMonster: true,
    effect: '+1 pour Déguerpir Vous gagnez un niveau pour chaque monstre que vous avez aidé à tuer.',
  },
  {
    id: 'd-013', name: 'Elfe', type: CardType.Race, raceId: 'elf', image: '/cards/porte_013.jpg',
    fleeBonus: 1, raceHelperGainsLevelPerMonster: true,
    effect: '+1 pour Déguerpir Vous gagnez un niveau pour chaque monstre que vous avez aidé à tuer.',
  },
  {
    id: 'd-028', name: 'Halfelin', type: CardType.Race, raceId: 'halfling', image: '/cards/porte_028.jpg',
    raceFleeRetry: true, raceDoubleSellFirst: true,
    effect: 'Vous pouvez vendre un objet par tour au double de son prix (les autres objets sont au prix normal). Si vous ratez votre première tentative pour déguerpir, vous pouvez défausser une carte pour réessayer une fois.',
  },
  {
    id: 'd-029', name: 'Halfelin', type: CardType.Race, raceId: 'halfling', image: '/cards/porte_029.jpg',
    raceFleeRetry: true, raceDoubleSellFirst: true,
    effect: 'Vous pouvez vendre un objet par tour au double de son prix (les autres objets sont au prix normal). Si vous ratez votre première tentative pour déguerpir, vous pouvez défausser une carte pour réessayer une fois.',
  },
  {
    id: 'd-030', name: 'Halfelin', type: CardType.Race, raceId: 'halfling',
    raceFleeRetry: true, raceDoubleSellFirst: true,
    effect: 'Vous pouvez vendre un objet par tour au double de son prix (les autres objets sont au prix normal). Si vous ratez votre première tentative pour déguerpir, vous pouvez défausser une carte pour réessayer une fois.',
  },
  {
    id: 'd-065', name: 'Nain', type: CardType.Race, raceId: 'dwarf', image: '/cards/porte_065.jpg',
    effect: 'Peut porter un nombre illimité de gros objets. Peut avoir jusqu\'à 6 cartes en main.',
  },
  {
    id: 'd-066', name: 'Nain', type: CardType.Race, raceId: 'dwarf', image: '/cards/porte_066.jpg',
    effect: 'Peut porter un nombre illimité de gros objets. Peut avoir jusqu\'à 6 cartes en main.',
  },
  {
    id: 'd-067', name: 'Nain', type: CardType.Race, raceId: 'dwarf',
    effect: 'Peut porter un nombre illimité de gros objets. Peut avoir jusqu\'à 6 cartes en main.',
  },

  // ── Cartes spéciales (porte) ───────────────────────────────────────────────
  {
    id: 'd-025', name: 'Illusion', type: CardType.Special, image: '/cards/porte_025.jpg',
    effect: 'Pendant n\'importe quel combat : défaussez un monstre (et ses modificateurs) et remplacez-le par un monstre de votre main.',
  },
  {
    id: 'd-026', name: 'Intervention Divine', type: CardType.Special, image: '/cards/porte_026.jpg',
    effect: 'Jouez immédiatement à la pioche : tous les Prêtres en jeu gagnent 1 niveau (peut permettre de gagner la partie).',
  },
  {
    id: 'd-059', name: 'Monstre Errant', type: CardType.Special, addMonsterFromHand: true,
    effect: 'A jouer, ainsi qu\'un monstre de votre main, quand quelqu\'un (vous y compris) se bat. Votre monstre rejoint celui qui combat : leurs forces de combat s\'additionnent. Si le ou les personnages doivent Déguerpir, résolvez séparément les tentatives, dans l\'ordre choisi par les victimes.',
  },
  {
    id: 'd-060', name: 'Monstre Errant', type: CardType.Special, image: '/cards/porte_060.jpg',
    effect: 'Ajoute un monstre de votre main à un combat en cours ; leurs forces s\'additionnent.',
  },
  {
    id: 'd-061', name: 'Monstre Errant', type: CardType.Special, image: '/cards/porte_061.jpg',
    effect: 'Ajoute un monstre de votre main à un combat en cours ; leurs forces s\'additionnent.',
  },
  {
    id: 'd-070', name: 'Pause Déjeuner', type: CardType.Special, image: '/cards/porte_070.jpg',
    effect: 'Pendant n\'importe quel combat : les monstres font une pause, défaussez-les tous et tirez immédiatement 2 cartes trésor.',
  },
  {
    id: 'd-081', name: 'Sang-mêlé', type: CardType.Special, image: '/cards/porte_081.jpg',
    effect: 'Permet de posséder 2 cartes de Race simultanément (tous avantages et inconvénients, ou avantages seuls d\'une race au choix).',
  },
  {
    id: 'd-082', name: 'Sang-mêlé', type: CardType.Special, image: '/cards/porte_082.jpg',
    effect: 'Permet de posséder 2 cartes de Race simultanément (tous avantages et inconvénients, ou avantages seuls d\'une race au choix).',
  },
  {
    id: 'd-085', name: 'Super Munchkin', type: CardType.Special, image: '/cards/porte_085.jpg',
    isSuperMunchkin: true,
    effect: 'En tant que super munchkin, vous pouvez posséder 2 cartes de Classe, et disposer de tous les avantages et désavantages de chacune. Vous pouvez aussi choisir de n\'avoir qu\'une Classe et d\'avoir tous ses avantages mais aucun désavantage (par exemple, les monstres qui haissent les Prêtres n\'auront aucun bonus contre les super Prêtres). Vous perdez cette carte si vous perdez votre ou vos carte(s) de Classe.',
  },
  {
    id: 'd-086', name: 'Super Munchkin', type: CardType.Special, image: '/cards/porte_086.jpg',
    isSuperMunchkin: true,
    effect: 'En tant que super munchkin, vous pouvez posséder 2 cartes de Classe, et disposer de tous les avantages et désavantages de chacune. Vous pouvez aussi choisir de n\'avoir qu\'une Classe et d\'avoir tous ses avantages mais aucun désavantage (par exemple, les monstres qui haissent les Prêtres n\'auront aucun bonus contre les super Prêtres). Vous perdez cette carte si vous perdez votre ou vos carte(s) de Classe.',
  },
  {
    id: 'd-087', name: 'Tire-moi de là !', type: CardType.Special,
    effect: 'En combat : prenez un objet à n\'importe quel autre joueur si cela vous permet de gagner alors que vous ne le pouviez pas. Vous pouvez défausser un de vos objets avant.',
  },
  {
    id: 'd-088', name: 'Tricheur !', type: CardType.Special, image: '/cards/porte_088.jpg',
    bypassesItemRestrictions: true,
    effect: 'Vous pouvez posséder et utiliser 1 objet qui vous serait normalement interdit par les règles. Posez cette carte à côté de l\'objet que vous jouez de votre main ou que vous avez déjà en jeu. Si vous perdez cet objet, cette carte est défaussée avec.',
  },
];

// ---------------------------------------------------------------------------
// TRÉSORS — 73 cartes
// Valeurs issues de munchkin_base_v2.json (bonus_combat → power, valeur_or → goldValue).
// ---------------------------------------------------------------------------

const TREASURE_CARDS: readonly Card[] = [
  // ── Cartes "Montez d'un niveau" ───────────────────────────────────────────
  {
    id: 't-001', name: '1000 pièces d\'or', type: CardType.Treasure, image: '/cards/tresor_001.jpg',
    power: 1, levelUp: 1, goldValue: 1000,
    effect: '+1 en combat. Peut être défaussée pour gagner 1 niveau (hors combat, max niveau 9).',
  },
  {
    id: 't-026', name: 'Don de Chips Désintéressé au MJ', type: CardType.Treasure, image: '/cards/tresor_026.jpg',
    levelUp: 1,
    effect: 'Gagnez un niveau.',
  },
  {
    id: 't-034', name: 'Erreur de Calcul Avantageuse', type: CardType.Treasure, image: '/cards/tresor_034.jpg',
    power: 1, levelUp: 1,
    effect: '+1 en combat. Peut être défaussée pour gagner 1 niveau.',
  },
  {
    id: 't-037', name: 'Génocide de Fourmis à l\'Huile Bouillante', type: CardType.Treasure, image: '/cards/tresor_037.jpg',
    power: 1, levelUp: 1,
    effect: 'Oh que c\'est mesquin... Gagnez un niveau',
  },
  {
    id: 't-042', name: 'Invocation de Règles Obscures', type: CardType.Treasure, image: '/cards/tresor_042.jpg',
    power: 1, levelUp: 1,
    effect: '+1 en combat. Peut être défaussée pour gagner 1 niveau.',
  },
  {
    id: 't-048', name: 'Mutiler les Cadavres', type: CardType.Treasure, image: '/cards/tresor_048.jpg',
    isOneShot: true, levelUp: 1, afterCombatOnly: true,
    effect: 'Cette carte ne peut être jouée qu\'après un combat, mais pas obligatoirement un combat que vous avez livré.',
  },
  {
    id: 't-052', name: 'Pleurer dans les Jupes du MJ', type: CardType.Treasure, image: '/cards/tresor_052.jpg',
    power: 1, levelUp: 1, blockedIfLeading: true,
    effect: 'Vous ne pouvez pas utiliser cette carte si vous êtes le joueur de plus haut niveau, ou ex-aequo avec celui-ci.',
  },
  {
    id: 't-057', name: 'Potion de Machisme Triomphant', type: CardType.Treasure, image: '/cards/tresor_057.jpg',
    power: 1, levelUp: 1,
    effect: 'Gagnez un niveau.',
  },
  {
    id: 't-072', name: 'Tuer le Fidèle Serviteur', type: CardType.Treasure, image: '/cards/tresor_072.jpg',
    levelUp: 1, requiresLoyalServantInPlay: true, discardLoyalServantOnPlay: true,
    effect: 'Jouable uniquement si le Fidèle Serviteur est en jeu. Le Fidèle Serviteur est défaussé. Gagnez un niveau.',
  },
  {
    id: 't-073', name: 'Vol de Niveau', type: CardType.Treasure, image: '/cards/tresor_073.jpg',
    isOneShot: true, stealLevel: true,
    effect: 'Choisissez un joueur auquel vous volez un niveau. Vous gagnez un niveau, et il en perd un.',
  },

  // ── Armes ─────────────────────────────────────────────────────────────────
  {
    id: 't-004', name: 'Arc Enrubanné', type: CardType.Treasure, image: '/cards/tresor_004.jpg',
    power: 4, handUsage: 2, requiredRace: 'elf', goldValue: 800,
    effect: 'Arme à 2 mains. Elfe uniquement.',
  },
  {
    id: 't-012', name: 'Bâton de Napalm', type: CardType.Treasure, image: '/cards/tresor_012.jpg',
    power: 5, handUsage: 1, requiredClass: 'wizard', goldValue: 800, itemTags: ['staff'],
    effect: 'Arme à 1 main. Magicien uniquement.',
  },
  {
    id: 't-017', name: 'Brochette de Rat', type: CardType.Treasure, image: '/cards/tresor_017.jpg',
    power: 1, handUsage: 1, autoFleeThreshold: 8, goldValue: 0,
    effect: 'Défaussez cette carte pour échapper automatiquement à n\'importe quel monstre de niveau 8 ou inférieur.',
  },
  {
    id: 't-025', name: 'Dague de Traîtrise', type: CardType.Treasure, image: '/cards/tresor_025.jpg',
    power: 3, handUsage: 1, requiredClass: 'thief', goldValue: 400,
    effect: 'Arme à 1 main. Voleur uniquement.',
  },
  {
    id: 't-029', name: 'Énorme Rocher', type: CardType.Treasure, image: '/cards/tresor_029.jpg',
    power: 3, handUsage: 2, goldValue: 0, isBigItem: true,
    effect: 'Gros objet à 2 mains.',
  },
  {
    id: 't-031', name: 'Épée (de) Bâtard(e)', type: CardType.Treasure, image: '/cards/tresor_031.jpg',
    power: 2, handUsage: 1, goldValue: 400,
    effect: 'Arme à 1 main.',
  },
  {
    id: 't-032', name: 'Épée de Féminisme Exacerbé', type: CardType.Treasure, image: '/cards/tresor_032.jpg',
    power: 3, handUsage: 1, goldValue: 400,
    effect: 'Réservé aux joueuses ( ou aux joueurs qui ont changé de sexe ).',
  },
  {
    id: 't-033', name: 'Épée Karaoké', type: CardType.Treasure, image: '/cards/tresor_033.jpg',
    power: 2, forbiddenClass: 'thief', goldValue: 400,
    effect: 'Arme. Tous sauf Voleur.',
  },
  {
    id: 't-040', name: 'Gourdin de Misogynie Fracassante', type: CardType.Treasure, image: '/cards/tresor_040.jpg',
    power: 3, handUsage: 1, goldValue: 400,
    effect: 'Réservé aux joueurs (ou aux joueuses qui ont changé de sexe ).',
  },
  {
    id: 't-041', name: 'Hallebarde Suisse Multifonctions', type: CardType.Treasure, image: '/cards/tresor_041.jpg',
    power: 4, handUsage: 2, goldValue: 600, requiredNoRace: true, isBigItem: true,
    effect: 'Gros objet à 2 mains (erratum officiel). Humain uniquement (sans race).',
  },
  {
    id: 't-044', name: 'Lance de 3,50 m', type: CardType.Treasure, image: '/cards/tresor_044.jpg',
    power: 1, handUsage: 2, goldValue: 200, itemTags: ['lance'],
    effect: 'Arme à 2 mains.',
  },
  {
    id: 't-045', name: 'Masse d\'Armes de Répartie Piquante', type: CardType.Treasure, image: '/cards/tresor_045.jpg',
    power: 4, handUsage: 1, requiredClass: 'cleric', goldValue: 600,
    effect: 'Arme à 1 main. Prêtre uniquement.',
  },
  {
    id: 't-046', name: 'Marteau des Rotules Douloureuses', type: CardType.Treasure, image: '/cards/tresor_046.jpg',
    power: 4, handUsage: 1, requiredRace: 'dwarf', goldValue: 600,
    effect: 'Arme à 1 main. Nain uniquement.',
  },
  {
    id: 't-047', name: 'Missile Magique', type: CardType.Treasure, image: '/cards/tresor_047.jpg',
    power: 5, goldValue: 300, isOneShot: true,
    effect: 'A jouer pendant n\'importe quel combat. Bonus de +5 accordé à un camp au choix. Usage unique.',
  },
  {
    id: 't-064', name: 'Râpe à Fromage de la Paix', type: CardType.Treasure, image: '/cards/tresor_064.jpg',
    power: 3, handUsage: 1, requiredClass: 'cleric', goldValue: 400,
    effect: 'Arme à 1 main. Prêtre uniquement.',
  },
  {
    id: 't-065', name: 'Rapière d\'Injustice Flagrante', type: CardType.Treasure, image: '/cards/tresor_065.jpg',
    power: 3, handUsage: 1, requiredRace: 'elf', goldValue: 600,
    effect: 'Arme à 1 main. Elfe uniquement.',
  },
  {
    id: 't-070', name: 'Tronçonneuse de la Mort', type: CardType.Treasure, image: '/cards/tresor_070.jpg',
    power: 3, handUsage: 2, goldValue: 600, isBigItem: true,
    effect: 'Gros objet à 2 mains.',
  },
  {
    id: 't-071', name: 'Tuba d\'Envoûtement', type: CardType.Treasure, image: '/cards/tresor_071.jpg',
    fleeBonus: 3, fleeDrawsTreasure: 1, handUsage: 1, goldValue: 300, isBigItem: true,
    effect: 'Ce délicat instrument subjugue vos ennemis vous conférant un bonus de +3 pour Déguerpir. Si vous réussissez à fuir, tirez une carte Trésor face cachée.',
  },

  // ── Armures ────────────────────────────────────────────────────────────────
  {
    id: 't-005', name: 'Armure de Cuir', type: CardType.Treasure, image: '/cards/tresor_005.jpg',
    power: 1, equipSlot: 'armor', goldValue: 200,
    effect: 'Armure.',
  },
  {
    id: 't-006', name: 'Armure de Flammes', type: CardType.Treasure, image: '/cards/tresor_006.jpg',
    power: 2, equipSlot: 'armor', goldValue: 400,
    effect: 'Armure.',
  },
  {
    id: 't-007', name: 'Armure de Mithril', type: CardType.Treasure, image: '/cards/tresor_007.jpg',
    power: 3, equipSlot: 'armor', forbiddenClass: 'wizard', goldValue: 600, isBigItem: true,
    effect: 'Gros objet. Armure. Interdite au Magicien.',
  },
  {
    id: 't-008', name: 'Armure Gluante', type: CardType.Treasure, image: '/cards/tresor_008.jpg',
    power: 1, equipSlot: 'armor', goldValue: 200,
    effect: 'Armure.',
  },
  {
    id: 't-009', name: 'Armure Trapue', type: CardType.Treasure, image: '/cards/tresor_009.jpg',
    power: 3, equipSlot: 'armor', requiredRace: 'dwarf', goldValue: 400,
    effect: 'Armure. Nain uniquement.',
  },
  {
    id: 't-020', name: 'Cape d\'Ombre', type: CardType.Treasure, image: '/cards/tresor_020.jpg',
    power: 4, requiredClass: 'thief', goldValue: 600,
    effect: 'Réservée aux voleurs.',
  },

  // ── Coiffes ────────────────────────────────────────────────────────────────
  {
    id: 't-011', name: 'Bandana de Gros Dur', type: CardType.Treasure, image: '/cards/tresor_011.jpg',
    power: 3, equipSlot: 'headgear', requiredNoRace: true, goldValue: 400,
    effect: 'Couvre-chef. Humain uniquement (sans race).',
  },
  {
    id: 't-018', name: 'Casque de Courage', type: CardType.Treasure, image: '/cards/tresor_018.jpg',
    power: 1, equipSlot: 'headgear', goldValue: 200,
    effect: 'Couvre-chef.',
  },
  {
    id: 't-019', name: 'Casque de Virilité Ostentatoire', type: CardType.Treasure, image: '/cards/tresor_019.jpg',
    power: 1, equipSlot: 'headgear', racePowerBonus: { elf: 3 }, goldValue: 600,
    effect: 'Couvre-chef. +1 en combat (+3 pour les Elfes).',
  },
  {
    id: 't-022', name: 'Chapeau Pointu de Thaumaturgie', type: CardType.Treasure, image: '/cards/tresor_022.jpg',
    power: 3, equipSlot: 'headgear', requiredClass: 'wizard', goldValue: 400,
    effect: 'Couvre-chef. Magicien uniquement.',
  },

  // ── Boucliers ──────────────────────────────────────────────────────────────
  {
    id: 't-014', name: 'Bouclier Surdimensionné', type: CardType.Treasure, image: '/cards/tresor_014.jpg',
    power: 4, handUsage: 1, goldValue: 600, requiredClass: 'warrior', isBigItem: true,
    effect: 'Gros objet à 1 main. Guerrier uniquement.',
  },
  {
    id: 't-068', name: 'Targe d\'Inconscience Suicidaire', type: CardType.Treasure, image: '/cards/tresor_068.jpg',
    power: 2, handUsage: 1, goldValue: 400,
    effect: 'Objet à 1 main.',
  },

  // ── Chaussures ────────────────────────────────────────────────────────────
  {
    id: 't-015', name: 'Bottes de Convocation d\'Hémorroïdes', type: CardType.Treasure, image: '/cards/tresor_015.jpg',
    power: 2, equipSlot: 'footwear', goldValue: 400,
    effect: 'Chaussures.',
  },
  {
    id: 't-016', name: 'Bottes de Déplacement Frénétique', type: CardType.Treasure, image: '/cards/tresor_016.jpg',
    power: 2, equipSlot: 'footwear', fleeBonus: 2, goldValue: 400,
    effect: 'Confèrent un bonus de +2 pour Déguerpir.',
  },
  {
    id: 't-066', name: 'Sandales de Protection', type: CardType.Treasure, image: '/cards/tresor_066.jpg',
    equipSlot: 'footwear', immuneToDoorCurse: true, goldValue: 700,
    effect: 'Les cartes de Malédiction que vous tirez en défonçant les portes n\'ont aucun effet. Les Malédictions lancées sur vous par d\'autres joueurs vous affectent cependant normalement.',
  },

  // ── Objets divers (équipables) ────────────────────────────────────────────
  {
    id: 't-023', name: 'Collants de Force de Géant', type: CardType.Treasure, image: '/cards/tresor_023.jpg',
    power: 3, goldValue: 600, forbiddenClass: 'warrior',
    effect: 'Interdit aux Guerriers.',
  },
  {
    id: 't-030', name: 'Escabeau', type: CardType.Treasure, image: '/cards/tresor_030.jpg',
    power: 3, goldValue: 400, requiredRace: 'halfling', isBigItem: true,
    effect: 'Gros objet. Halfelin uniquement.',
  },
  {
    id: 't-039', name: 'Genouillères Perforantes', type: CardType.Treasure, image: '/cards/tresor_039.jpg',
    power: 1, goldValue: 200,
  },
  {
    id: 't-050', name: 'Oh, Les Jolis Ballons !', type: CardType.Treasure, image: '/cards/tresor_050.jpg',
    power: 5, goldValue: 0, isOneShot: true,
    effect: 'A jouer pendant n\'importe quel combat pour distraire l\'ennemi. Bonus de +5 accordé à un camp au choix. Usage unique.',
  },
  {
    id: 't-069', name: 'Titre qui en Jette Vraiment Grave', type: CardType.Treasure, image: '/cards/tresor_069.jpg',
    power: 3, goldValue: 0,
    effect: 'Aucune valeur',
  },

  // ── Objets spéciaux ────────────────────────────────────────────────────────
  {
    id: 't-002', name: 'Anneau de Souhait', type: CardType.Treasure, image: '/cards/tresor_002.jpg',
    isOneShot: true, cancelsCurse: true, goldValue: 500,
    effect: 'Annule n\'importe quelle Malédiction. Peut être joué n\'importe quand. Usage unique.',
  },
  {
    id: 't-003', name: 'Anneau de Souhait', type: CardType.Treasure,
    isOneShot: true, goldValue: 500,
    effect: 'Annule n\'importe quelle malédiction, à tout moment. Usage unique.',
  },
  {
    id: 't-010', name: 'Baguette de Sourcier', type: CardType.Treasure, image: '/cards/tresor_010.jpg',
    isOneShot: true, searchDiscard: true, goldValue: 1100, itemTags: ['wand'],
    effect: 'Parcourez les défausses pour trouver la carte de votre choix. Prenez-la et défaussez la baguette de sourcier.',
  },
  {
    id: 't-027', name: 'Doppelganger', type: CardType.Treasure, image: '/cards/tresor_027.jpg',
    isOneShot: true, doublesPlayerStrength: true, goldValue: 300,
    effect: 'Crée votre double, qui combat à vos côtés : votre force de combat est doublée. Vous ne pouvez utiliser le Doppelganger que si vous êtes le seul joueur à participer au combat. Usage unique.',
  },
  {
    id: 't-028', name: 'Dé Pipé', type: CardType.Treasure, image: '/cards/tresor_028.jpg',
    isOneShot: true, chooseDiceAfterRoll: true, goldValue: 300,
    effect: 'A jouer après n\'importe quel jet de dé. Vous choisissez vous-même le résultat du jet de dé. Usage unique.',
  },
  {
    id: 't-035', name: 'Fidèle Serviteur', type: CardType.Treasure, image: '/cards/tresor_035.jpg',
    extraBigItemSlot: true, discardForAutoFlee: true, isLoyalServant: true,
    effect: 'Ce laquais qui vous suit et vous sert de porteur vous permet de porter et d\'utiliser un Gros objet supplémentaire, mais il ne se battra pas pour vous...si vous perdez votre serviteur, vous perdez aussi votre gros objet. Vous pouvez défausser votre serviteur pour vous permettre de fuir automatiquement contre n\'importe quel monstre.',
  },
  {
    id: 't-038', name: 'Genouillères de Séduction', type: CardType.Treasure, image: '/cards/tresor_038.jpg',
    isOneShot: true, forcedHelper: true, forbiddenClass: 'cleric', goldValue: 600,
    effect: 'Si vous demandez à quelqu\'un d\'un niveau supérieur au votre de vous aider à combattre un monstre, il ne peut ni refuser. ni exiger de paiement en retour. Vous ne pouvez pas gagner en montant de niveau dans un combat dans lequel vous avez été aidé grâce à vos Genouillères.',
  },

  // ── Cartes spéciales (trésor) ──────────────────────────────────────────────
  {
    id: 't-051', name: 'Pillaaaaaaage !', type: CardType.Treasure, image: '/cards/tresor_051.jpg',
    isOneShot: true, drawTreasuresOnPlay: 3,
    effect: 'Tirez immédiatement trois nouvelles cartes de trésor. Elles sont tirées face cachée si vous avez tiré cette carte face cachée, et face visible dans le cas contraire.',
  },

  // ── Objets à usage unique ─────────────────────────────────────────────────
  {
    id: 't-013', name: 'Boisson Énergisante Éventée', type: CardType.Treasure, image: '/cards/tresor_013.jpg',
    power: 2, isOneShot: true, goldValue: 200,
    effect: 'À jouer pendant n\'importe quel combat. Bonus de +2 accordé à un camp au choix. Usage unique.',
  },
  {
    id: 't-021', name: 'Champagne', type: CardType.Treasure, image: '/cards/tresor_021.jpg',
    isOneShot: true, requiredRace: 'elf', bonusPerAllyRace: { elf: 2 }, goldValue: 100,
    effect: 'À jouer pendant n\'importe quel combat. Utilisable une fois, et seulement sur les Elfes. Confère un bonus de +2 à chaque Elfe engagé dans la bataille.',
  },
  {
    id: 't-036', name: 'Flaque de Colle', type: CardType.Treasure, image: '/cards/tresor_036.jpg',
    isOneShot: true, rerollFlee: true, goldValue: 100,
    effect: 'À utiliser quand quelqu\'un reussi à fuir le combat pour quelque que raison que ce soit. la victime doit relancer les dés pour Déguerpir même s\'il s\'agissait d\'une réussite automatique la première fois.',
  },
  {
    id: 't-043', name: 'Lampe Merveilleuse', type: CardType.Treasure, image: '/cards/tresor_043.jpg',
    isOneShot: true, banishMonster: true, goldValue: 500,
    effect: 'Vous ne pouvez utiliser la Lampe qu\'à votre tour. Elle invoque un génie qui fait disparaitre un seul monstre, même s\'il était sur le point de vous attraper après un jet de Déguerpir raté. S\'il était seul contre vous, vous prenez son trésor mais sans gagner de niveau. Usage unique.',
  },
  {
    id: 't-049', name: 'Mur Instantané', type: CardType.Treasure, image: '/cards/tresor_049.jpg',
    isOneShot: true, goldValue: 300,
    effect: 'Usage unique : un ou deux joueurs consentants fuient automatiquement n\'importe quel combat.',
  },
  {
    id: 't-067', name: 'Sandwich Chocolat-Moules-Anchois', type: CardType.Treasure, image: '/cards/tresor_067.jpg',
    power: 3, isOneShot: true, requiredRace: 'halfling', goldValue: 400,
    effect: '+3 en combat. Usage unique. Halfelin uniquement.',
  },

  // ── Potions (usage unique) ────────────────────────────────────────────────
  {
    id: 't-024', name: 'Cotion de Ponfusion', type: CardType.Treasure, image: '/cards/tresor_024.jpg',
    power: 3, isOneShot: true, goldValue: 100,
    effect: 'A jouer pendant n\'imquorte pel combat. Bonus de +3 accordé à un champ au coix. Usige unaque.',
  },
  {
    id: 't-053', name: 'Potion Acide Radioactive et Électrique', type: CardType.Treasure,
    power: 5, isOneShot: true, goldValue: 200,
    effect: '+5 en combat pour le camp de votre choix. Usage unique.',
  },
  {
    id: 't-054', name: 'Potion d\'Invisibilité', type: CardType.Treasure, image: '/cards/tresor_054.jpg',
    isOneShot: true, autoFlee: true, goldValue: 200,
    effect: 'A défausser après avoir raté votre jet pour Déguerpir. Vous vous enfuyez automatiquement. Usage unique.',
  },
  {
    id: 't-055', name: 'Potion d\'Amitié', type: CardType.Treasure, image: '/cards/tresor_055.jpg',
    isOneShot: true, banishAndLoot: true, goldValue: 200,
    effect: 'A jouer pendant n\'importe quel combat. Défaussez tous les monstres combattus. Aucun trésor n\'est gagné, mais vous pouvez piller la pièce. Usage unique.',
  },
  {
    id: 't-056', name: 'Potion de Bravoure Hystérique', type: CardType.Treasure,
    power: 2, isOneShot: true, goldValue: 100,
    effect: 'A jouer pendant n\'importe quel combat. Bonus de +2 accordé à un camp au choix. Usage unique.',
  },
  {
    id: 't-058', name: 'Potion de Mauvaise Haleine', type: CardType.Treasure, image: '/cards/tresor_058.jpg',
    power: 2, isOneShot: true, instantKillMonsters: ['d-068'], goldValue: 100,
    effect: 'A jouer pendant n\'importe quel combat. Bonus de +2 accordé à un camp au choix, ou tue instantanément le nez flottant. Usage unique.',
  },
  {
    id: 't-059', name: 'Potion de Poison Enflammé', type: CardType.Treasure, image: '/cards/tresor_059.jpg',
    power: 3, isOneShot: true, goldValue: 100,
    effect: 'A jouer pendant n\'importe quel combat. Bonus de +3 accordé à un camp au choix. Usage unique.',
  },
  {
    id: 't-060', name: 'Potion de Polly-morphie', type: CardType.Treasure, image: '/cards/tresor_060.jpg',
    isOneShot: true, banishMonster: true, goldValue: 1300,
    effect: 'Utilisable une seule fois, pendant le combat. Transforme n\'importe quel monstre en joli perroquet appelé Polly, qui s\'envole en abandonnant son trésor. Usage unique.',
  },
  {
    id: 't-061', name: 'Potion de Sommeil', type: CardType.Treasure, image: '/cards/tresor_061.jpg',
    power: 2, isOneShot: true, goldValue: 100,
    effect: 'A jouer pendant n\'importe quel combat. Bonus de +2 accordé à un camp au choix. Usage unique.',
  },
  {
    id: 't-062', name: 'Potion de Transfert', type: CardType.Treasure, image: '/cards/tresor_062.jpg',
    isOneShot: true, transferCombat: true, goldValue: 300,
    effect: 'A jouer pendant n\'importe quel combat. Un autre joueur de votre choix combat le ou les monstres. Il peut demander de l\'aide normalement. et obtient le trésor et les niveaux s\'il l\'emporte. Le joueur qui combattait à l\'origine reprend alors son tour, et peut piller la pièce, que le combat ait été remporté ou perdu. Usage unique.',
  },
  {
    id: 't-063', name: 'Potion Glaciale Explosive', type: CardType.Treasure, image: '/cards/tresor_063.jpg',
    power: 3, isOneShot: true, goldValue: 100,
    effect: '+3 en combat pour le camp de votre choix. Usage unique.',

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
