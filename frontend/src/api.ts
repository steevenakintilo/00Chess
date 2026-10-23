// Petit client pour l'API Django (backend/). L'adresse se règle avec VITE_API_URL (voir .env.example).
export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000').replace(/\/$/, '')

const TOKEN_KEY = 'token'

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* stockage indisponible : la session ne survivra pas au rechargement */
  }
}

export type ApiUser = { id: number; username: string; trophies: number; wins: number; draws: number; losses: number }
export type SiteStats = { games_played: number; players: number }
export type RoomPhase = 'lobby' | 'duel' | 'action' | 'over'
export type ApiRoom = {
  code: string
  host: ApiUser
  guest: ApiUser | null
  is_full: boolean
  phase: RoomPhase
  round: number
  exchange: number
  actor: 'host' | 'guest' | null
  mode: 'winner' | 'turns' | 'onehp'
  pace: 'blitz' | 'normal' // blitz : 50 rounds max ; normal : pas de limite
}
// Réponse de /api/rooms/<code>/state/ : l'état de la salle + les nouveaux événements publics de la partie.
export type ApiRoomState = {
  room: ApiRoom
  side: 'host' | 'guest'
  events: { seq: number; kind: string; payload: Record<string, unknown> }[]
  my_move_sent: boolean
  opponent_move_sent: boolean
  opponent_seen_ago: number | null
}

// Partie terminée, revoyable avec son code (/api/replays/<code>/).
export type ApiReplay = {
  code: string
  host: string
  guest: string
  trophies: { host: number; guest: number }
  created_at: string
  events: { seq: number; kind: string; payload: Record<string, unknown> }[]
}
export type ApiReplayItem = Omit<ApiReplay, 'events'>

// status 0 = serveur injoignable. data = corps JSON de l'erreur (codes stables, ex. { username: ['taken'] }).
export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    super(`API ${status}`)
    this.status = status
    this.data = data
  }

  // Premier code d'erreur lisible : "invalid_credentials", "taken", "room_full"...
  get code(): string {
    if (this.status === 0) return 'network'
    if (this.status === 429) return 'throttled'
    const d = this.data as Record<string, unknown> | null
    if (d && typeof d.detail === 'string') return d.detail
    if (d) {
      for (const value of Object.values(d)) {
        if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
      }
    }
    return 'unknown'
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, null)
  }
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
