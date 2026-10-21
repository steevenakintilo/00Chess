import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type ApiRoomState } from '../api'
import type { NetEvent } from './replay'

const POLL_MS = 1000

// Interroge le serveur chaque seconde et accumule les événements publics de la partie, dans l'ordre.
export function useRoomSync(code: string, enabled: boolean) {
  const [events, setEvents] = useState<NetEvent[]>([])
  const [meta, setMeta] = useState<ApiRoomState | null>(null)
  const [closed, setClosed] = useState(false) // salle introuvable : fermée ou expirée
  const [offline, setOffline] = useState(false) // serveur injoignable (on réessaie tout seul)
  const lastSeq = useRef(0)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const res = await api<ApiRoomState>(`/api/rooms/${code}/state/?after=${lastSeq.current}`)
      const fresh = res.events.filter(e => e.seq > lastSeq.current)
      if (fresh.length) {
        lastSeq.current = fresh[fresh.length - 1].seq
        setEvents(prev => [...prev, ...fresh])
      }
      setMeta(res)
      setOffline(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setClosed(true)
      else setOffline(true)
    } finally {
      busy.current = false
    }
  }, [code])

  useEffect(() => {
    if (!enabled || closed) return
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      await refresh()
      if (!stop) timer = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [enabled, closed, refresh])

  return { events, meta, closed, offline, refresh }
}
