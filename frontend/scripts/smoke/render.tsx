// Test de fumée : rend chaque page (FR et EN) côté serveur et vérifie qu'il n'y a ni erreur, ni clé de traduction brute.
// Lancer avec : npm run smoke   (compile avec vite en mode SSR puis exécute le résultat)
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../../src/i18n'
import { AuthProvider } from '../../src/auth/AuthContext'
import Home from '../../src/pages/home'
import VsIA from '../../src/pages/vsia'
import IAvsIA from '../../src/pages/iavsia'
import Training007 from '../../src/pages/training007'
import Tutorial from '../../src/pages/tutorial'
import Online from '../../src/pages/online'

const store: Record<string, string> = {}
const g = globalThis as unknown as { localStorage: Storage }
g.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage

const pages: [string, React.ReactElement][] = [
  ['/', <Home />],
  ['/vs-ia', <VsIA />],
  ['/ia-vs-ia', <IAvsIA />],
  ['/007', <Training007 />],
  ['/entrainement', <Tutorial />],
  ['/online', <Online />],
]

let failures = 0
for (const lang of ['fr', 'en']) {
  for (const level of ['easy', 'normal', 'hard']) {
    store.lang = lang
    store.aiLevel = level
    store.aiLevelBlue = level
    store.aiLevelRed = level === 'hard' ? 'easy' : 'hard'
    for (const [path, element] of pages) {
      try {
        const html = renderToString(
          <LanguageProvider>
            <AuthProvider>
              <MemoryRouter initialEntries={[path]}>
                <Routes>
                  <Route path={path} element={element} />
                </Routes>
              </MemoryRouter>
            </AuthProvider>
          </LanguageProvider>
        )
        const text = html.replace(/<[^>]+>/g, ' ')
        const rawKey = text.match(/\b(?:ai|hud|menu|duel|rules|tut|ia|online|auth|room|btn|shop|train)\.[A-Za-z0-9_.]+/)
        const placeholder = text.match(/\{[A-Za-z]+\}/)
        if (rawKey || placeholder) {
          failures++
          console.log(`✗ ${lang}/${level} ${path} : texte non traduit → ${rawKey?.[0] ?? placeholder?.[0]}`)
        } else if (level === 'normal') {
          console.log(`✓ ${lang} ${path} (${html.length} octets)`)
        }
      } catch (e) {
        failures++
        console.log(`✗ ${lang}/${level} ${path} : ${(e as Error).message}`)
      }
    }
  }
}
console.log(failures === 0 ? 'Tout est bon.' : `${failures} problème(s).`)
process.exit(failures === 0 ? 0 : 1)
