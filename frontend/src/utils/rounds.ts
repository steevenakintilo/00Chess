// Modes de jeu : qui joue sur le plateau après chaque duel 007.
//  - « winner » (Le gagnant joue) : seul le gagnant du duel joue ; si le duel est nul, personne ne joue.
//  - « turns » (Tour par tour) : les deux joueurs jouent à chaque round, l'un après l'autre ; le premier change à chaque round.
//    Le 007 ne décide plus qui joue, mais il rapporte toujours autant d'argent : un meilleur joueur de 007 finit plus riche.
import { other, type PlayerId } from './engine'

export type GameMode = 'winner' | 'turns'
export const GAME_MODES: GameMode[] = ['winner', 'turns']
export const DEFAULT_GAME_MODE: GameMode = 'winner'

export function actorsAfterDuel(mode: GameMode, outcome: 'p1' | 'p2' | 'draw', round: number): PlayerId[] {
  if (mode === 'winner') return outcome === 'draw' ? [] : [outcome]
  const first: PlayerId = round % 2 === 1 ? 'p1' : 'p2'
  return [first, other(first)]
}
