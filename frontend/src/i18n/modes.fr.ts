// Textes des modes de jeu (français).
export const frModes: Record<string, string> = {
  'gm.title': 'Mode de jeu',
  'gm.winner': 'Le gagnant joue',
  'gm.turns': 'Tour par tour',
  'gm.winner.desc': 'Le gagnant du 007 joue sur le plateau (si le duel est nul, personne ne joue).',
  'gm.turns.desc':
    "Les deux joueurs jouent à chaque round, l'un après l'autre. Le 007 rapporte toujours autant d'argent : un meilleur joueur de 007 finit plus riche.",
  'gm.onehp': 'Roi 1 PV',
  'gm.onehp.desc':
    "Les rois n'ont qu'un seul PV : le premier qui touche le roi adverse gagne. Le gagnant du 007 joue, sans reine ni Genkidama. Pas de trophées en ligne.",
  'gm.classic': 'Classique',
  'gm.classic.desc':
    "Plus proche des échecs : pas de 007, pas d'argent. Les achats sont gratuits (les limites par pièce restent), sans reine ni Tsar Bomba, et les deux joueurs jouent une action à chaque round.",
  'gm.current': 'Mode : {mode}',
  'pace.title': 'Durée de la partie',
  'pace.blitz': 'Blitz',
  'pace.normal': 'Normal',
  'pace.blitz.desc': "Partie rapide : elle s'arrête au bout de 50 rounds (le roi le plus abîmé perd, puis le moins riche).",
  'pace.normal.desc': "Pas de limite de rounds : la partie continue jusqu'à ce qu'un joueur gagne (roi mort, K.O., abandon).",
  'pace.current': 'Durée : {pace}',
  'rules.modes.title': 'Modes de jeu',
  'rules.modes.winner': "**Le gagnant joue** : seul le gagnant du duel 007 joue sur le plateau (une seule action). Si le duel est nul, personne ne joue. Gagner plusieurs duels de suite permet de jouer plusieurs fois de suite : le 007 reste la base du jeu.",
  'rules.modes.turns':
    "**Tour par tour** : à chaque round, les deux joueurs jouent une action, l'un après l'autre (le premier change à chaque round). Le 007 ne décide plus qui joue, mais il rapporte toujours autant d'argent : un meilleur joueur de 007 gagne plus d'argent et finit statistiquement devant.",
  'rules.modes.onehp':
    "**Roi 1 PV** : comme « Le gagnant joue », mais chaque roi n'a qu'un seul PV : le premier coup qui touche le roi adverse gagne la partie. La reine et la Genkidama ne sont pas disponibles. Cette variante ne rapporte pas de trophées en ligne.",
  'rules.modes.classic':
    "**Classique** : un mode plus proche des échecs. Il n'y a ni duel 007 ni argent : les pièces s'achètent gratuitement (dans la limite de chaque pièce), sans reine ni Tsar Bomba, et, à chaque round, les deux joueurs jouent une action, l'un après l'autre, toujours dans le même ordre. En ligne, un tirage au sort au début de la partie décide qui joue en premier (pas d'avantage), et ce mode ne rapporte pas de trophées. Contre l'IA, le bleu joue en premier.",
}
