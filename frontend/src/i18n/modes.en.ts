// Texts for the game modes (English).
export const enModes: Record<string, string> = {
  'gm.title': 'Game mode',
  'gm.winner': 'Winner plays',
  'gm.turns': 'Turn by turn',
  'gm.winner.desc': 'The 007 winner plays on the board (if the duel is a draw, nobody plays).',
  'gm.turns.desc':
    'Both players play every round, one after the other. The 007 still earns the same money: a better 007 player ends up richer.',
  'gm.classic': 'Classic',
  'gm.classic.desc':
    'Closer to chess: no 007, no money. Purchases are free (the per-piece limits still apply), with no queen or Tsar Bomba, and both players play one action every round. Only available against the AI.',
  'gm.current': 'Mode: {mode}',
  'pace.title': 'Game length',
  'pace.blitz': 'Blitz',
  'pace.normal': 'Normal',
  'pace.blitz.desc': 'Quick game: it stops after 50 rounds (the more damaged king loses, then the poorer player).',
  'pace.normal.desc': 'No round limit: the game goes on until a player wins (dead king, K.O., forfeit).',
  'pace.current': 'Length: {pace}',
  'rules.modes.title': 'Game modes',
  'rules.modes.winner': '**Winner plays**: only the winner of the 007 duel plays on the board (a single action). If the duel is a draw, nobody plays. Winning several duels in a row lets you play several times in a row: the 007 remains the core of the game.',
  'rules.modes.turns':
    '**Turn by turn**: every round, both players play one action, one after the other (the player who goes first changes every round). The 007 no longer decides who plays, but it still earns the same money: a better 007 player earns more money and statistically finishes ahead.',
  'rules.modes.classic':
    '**Classic**: a mode closer to chess. There is no 007 duel and no money: pieces are bought for free (within each piece\'s limit), with no queen or Tsar Bomba, and, every round, both players play one action, one after the other (the player who goes first changes every round). This mode is only available against the AI.',
}
