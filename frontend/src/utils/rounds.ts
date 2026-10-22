// Modes de jeu : qui joue sur le plateau après chaque duel 007.
//  - « winner » (Le gagnant joue) : seul le gagnant du duel joue ; si le duel est nul, personne ne joue.
//  - « turns » (Tour par tour) : les deux joueurs jouent à chaque round, l'un après l'autre ; le premier change à chaque round.
//    Le 007 ne décide plus qui joue, mais il rapporte toujours autant d'argent : un meilleur joueur de 007 finit plus riche.
//  - « classic » (Classique) : plus proche des échecs. Pas de 007, pas d'économie : argent infini (achats gratuits, limites de
//    pièces conservées), les deux joueurs jouent à chaque round, toujours dans le même ordre (bleu puis rouge).
import { other, type PlayerId } from './engine'

export type GameMode = 'winner' | 'turns' | 'classic'
export const GAME_MODES: GameMode[] = ['winner', 'turns', 'classic']
export const DUEL_MODES: GameMode[] = ['winner', 'turns'] // modes avec 007 (seuls ceux-là existent en ligne et en IA contre IA)
export const DEFAULT_GAME_MODE: GameMode = 'winner'
export const hasDuel = (mode: GameMode) => mode !== 'classic'

export function actorsAfterDuel(mode: GameMode, outcome: 'p1' | 'p2' | 'draw', round: number): PlayerId[] {
  if (mode === 'winner') return outcome === 'draw' ? [] : [outcome]
  // « Classique » : le bleu joue toujours en premier. Sans duel entre deux rounds, alterner le premier joueur ferait jouer
  // la même personne deux fois de suite (fin d'un round, début du suivant), ce qui n'est pas possible dans un jeu au tour par tour.
  if (mode === 'classic') return ['p1', 'p2']
  const first: PlayerId = round % 2 === 1 ? 'p1' : 'p2'
  return [first, other(first)]
}
