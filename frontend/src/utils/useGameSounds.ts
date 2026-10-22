import { useEffect, useRef } from 'react'
import type { GameState } from './engine'
import { playSfx, playSfxSequence, type SfxName } from './music'

// Quel son pour quelle entrée du journal (une entrée = une action). Les entrées sans son (passer, argent, duel...) ne sont pas listées.
const SFX_OF_LOG: Record<string, SfxName> = {
  'log.genki': 'bomb',
  'log.tsar': 'tsar_bomb',
  'log.queen': 'heal',
  'log.kamikaze': 'king_loose_hp', // le roi perd des PV
  'log.shieldHp': 'king_loose_hp', // PV perdus à cause du spam de bouclier au 007
  'log.snipe': 'tower_death',
  'log.moveEat': 'tower_death',
  'log.placeEat': 'tower_death',
  'log.place': 'tower_bought',
  'log.move': 'tower_moove',
  'log.swap': 'tower_moove',
}

// Joue les sons des actions apparues depuis le rendu précédent : une action = un son, une seule fois.
// Fin de partie : seul « game_over » joue. Le premier état reçu (ouverture de la page, reconnexion) ne joue rien.
export function useGameSounds(game: GameState) {
  const prev = useRef<{ count: number; over: boolean } | null>(null)
  useEffect(() => {
    const count = game.logCount ?? 0
    const over = !!game.result
    const before = prev.current
    prev.current = { count, over }
    if (!before || count < before.count) return // premier état, ou nouvelle partie : on repart de zéro sans bruit
    if (over && !before.over) {
      playSfx('game_over')
      return
    }
    const added = Math.min(count - before.count, game.log.length)
    if (added <= 0) return
    const names = game.log
      .slice(game.log.length - added)
      .map(m => SFX_OF_LOG[m.k])
      .filter((n): n is SfxName => !!n)
    if (names.length > 0) playSfxSequence(names)
  }, [game])
}
