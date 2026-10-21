import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Msg } from '../utils/msg'
import { fr } from './fr'
import { en } from './en'
import { frOnline } from './online.fr'
import { enOnline } from './online.en'
import { frAi } from './ai.fr'
import { enAi } from './ai.en'
import { frModes } from './modes.fr'
import { enModes } from './modes.en'

export type Lang = 'fr' | 'en'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
]

type Params = Record<string, string | number>
export type Names = { p1: string; p2: string }
const dicts: Record<Lang, Record<string, string>> = { fr: { ...fr, ...frOnline, ...frAi, ...frModes }, en: { ...en, ...enOnline, ...enAi, ...enModes } }

// Traduit une clé : remplace {nom} par les paramètres. Un paramètre qui commence par "@" est lui-même une clé.
export function translate(lang: Lang, key: string, params?: Params, names?: Names | null): string {
  if (names) {
    // partie en ligne : on affiche les vrais pseudos à la place de « Toi » / « IA »
    if (key === 'who.p1') return names.p1
    if (key === 'who.p2') return names.p2
    if (key === 'king.p1') return translate(lang, 'king.named', { name: names.p1 }, null)
    if (key === 'king.p2') return translate(lang, 'king.named', { name: names.p2 }, null)
  }
  const text = dicts[lang][key] ?? dicts.fr[key]
  if (text === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${key}`)
    return key
  }
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params?.[name]
    if (v === undefined) return `{${name}}`
    return typeof v === 'string' && v.startsWith('@') ? translate(lang, v.slice(1), undefined, names) : String(v)
  })
}

// Met en gras ce qui est entre ** **.
export function rich(text: string): ReactNode {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))
}

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Params) => string
  msg: (m: Msg | null | undefined) => string
  setNames: (n: Names | null) => void // pseudos des joueurs (partie en ligne)
  tr: (key: string, params?: Params) => ReactNode // comme t, avec le gras **...**
}

const I18nContext = createContext<Ctx | null>(null)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* stockage indisponible */
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [names, setNames] = useState<Names | null>(null)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('lang', l)
    } catch {
      /* ignoré */
    }
  }, [])

  const value = useMemo<Ctx>(() => {
    const t = (key: string, params?: Params) => translate(lang, key, params, names)
    return {
      lang,
      setLang,
      setNames,
      t,
      msg: m => (m ? t(m.k, m.p) : ''),
      tr: (key, params) => rich(t(key, params)),
    }
  }, [lang, setLang, names])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n doit être utilisé dans <LanguageProvider>')
  return ctx
}

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map(l => (
        <button
          key={l.code}
          className={`btn-game${lang === l.code ? ' btn-game--active' : ''}`}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
