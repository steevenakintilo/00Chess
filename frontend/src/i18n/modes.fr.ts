// Textes des modes de jeu (français).
export const frModes: Record<string, string> = {
  'gm.title': 'Mode de jeu',
  'gm.winner': 'Le gagnant joue',
  'gm.turns': 'Tour par tour',
  'gm.winner.desc': 'Le gagnant du 007 joue sur le plateau (si le duel est nul, personne ne joue).',
  'gm.turns.desc':
    "Les deux joueurs jouent à chaque round, l'un après l'autre. Le 007 rapporte toujours autant d'argent : un meilleur joueur de 007 finit plus riche.",
  'gm.current': 'Mode : {mode}',
  'rules.modes.title': 'Modes de jeu',
  'rules.modes.winner': "**Le gagnant joue** : seul le gagnant du duel 007 joue sur le plateau (une seule action). Si le duel est nul, personne ne joue. Gagner plusieurs duels de suite permet de jouer plusieurs fois de suite : le 007 reste la base du jeu.",
  'rules.modes.turns':
    "**Tour par tour** : à chaque round, les deux joueurs jouent une action, l'un après l'autre (le premier change à chaque round). Le 007 ne décide plus qui joue, mais il rapporte toujours autant d'argent : un meilleur joueur de 007 gagne plus d'argent et finit statistiquement devant.",
}
