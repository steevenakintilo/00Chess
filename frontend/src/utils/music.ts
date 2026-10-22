import { useSyncExternalStore } from 'react'

// Sons du jeu : tous les fichiers audio sont dans src/assets/sounds/ (mp3, ogg, wav, m4a).
//  - theme.* : la musique de fond, en boucle sur toutes les pages ;
//  - les autres : des effets, nommés d'après leur fichier (voir SfxName), joués une seule fois par action.
// Un seul bouton (MusicToggle) coupe tout. Un fichier manquant n'est pas une erreur : il n'y a juste pas de son.
const files = import.meta.glob('../assets/sounds/*.{mp3,ogg,wav,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const urlOf = (name: string): string | null => {
  const key = Object.keys(files).find(k => k.split('/').pop()!.replace(/\.[^.]+$/, '') === name)
  return key ? files[key] : null
}

export type SfxName =
  | 'game_over'
  | 'king_loose_hp'
  | 'tower_bought'
  | 'tower_moove'
  | 'tower_death'
  | 'heal'
  | 'bomb'
  | 'tsar_bomb'

const musicSrc = urlOf('theme')
export const hasMusic = Object.keys(files).length > 0 // le bouton existe dès qu'il y a au moins un son

const STORAGE_KEY = 'musicOn'
const MUSIC_VOLUME = 0.3
const SFX_VOLUME = 0.25

const readOn = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true // stockage indisponible : son activé par défaut
  }
}

let on = readOn()
let music: HTMLAudioElement | null = null
const listeners = new Set<() => void>()

function playMusic() {
  if (!musicSrc || !on) return
  if (!music) {
    music = new Audio(musicSrc)
    music.loop = true
    music.volume = MUSIC_VOLUME
  }
  music.play().catch(() => {
    /* le navigateur bloque le son tant que la page n'a pas reçu un clic : on réessaie au premier clic */
  })
}

export function setMusicOn(value: boolean) {
  on = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignoré */
  }
  if (value) playMusic()
  else music?.pause()
  listeners.forEach(l => l())
}

// Un effet sonore, joué une fois (rien si le son est coupé ou si le fichier n'existe pas).
export function playSfx(name: SfxName) {
  const src = urlOf(name)
  if (!on || !src) return
  const a = new Audio(src)
  a.volume = SFX_VOLUME
  a.play().catch(() => {
    /* bloqué par le navigateur (pas encore de clic) : on ignore */
  })
}

// Plusieurs actions d'un coup (ton coup + la réponse de l'IA) : un son par action, l'un après l'autre.
export function playSfxSequence(names: SfxName[], gapMs = 700) {
  names.forEach((n, i) => (i === 0 ? playSfx(n) : setTimeout(() => playSfx(n), i * gapMs)))
}

// Les navigateurs interdisent de lancer un son avant la première interaction : on démarre au premier clic ou à la première touche.
if (typeof window !== 'undefined' && musicSrc) {
  playMusic()
  const start = () => {
    playMusic()
    window.removeEventListener('pointerdown', start)
    window.removeEventListener('keydown', start)
  }
  window.addEventListener('pointerdown', start)
  window.addEventListener('keydown', start)
}

export function useMusicOn(): boolean {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => on
  )
}
