import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, getToken, setToken, type ApiUser } from '../api'

type AuthCtx = {
  user: ApiUser | null
  ready: boolean // false tant qu'on vérifie le jeton enregistré
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

type AuthResponse = { token: string; user: ApiUser }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      return
    }
    try {
      setUser(await api<ApiUser>('/api/auth/me/'))
    } catch (e) {
      // jeton refusé : on se déconnecte ; serveur injoignable : on garde le jeton pour réessayer plus tard
      if (e instanceof ApiError && e.status === 401) {
        setToken(null)
        setUser(null)
      }
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setReady(true))
  }, [refresh])

  const authenticate = useCallback(async (path: string, username: string, password: string) => {
    const res = await api<AuthResponse>(path, { method: 'POST', body: { username, password } })
    setToken(res.token)
    setUser(res.user)
  }, [])

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      ready,
      refresh,
      login: (u, p) => authenticate('/api/auth/login/', u, p),
      register: (u, p) => authenticate('/api/auth/register/', u, p),
      logout: async () => {
        try {
          await api('/api/auth/logout/', { method: 'POST' })
        } catch {
          /* même si le serveur est injoignable, on oublie le jeton localement */
        }
        setToken(null)
        setUser(null)
      },
    }),
    [user, ready, refresh, authenticate]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
