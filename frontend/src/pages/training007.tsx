import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Duel007 from '../components/Duel007'
import RulesButton from '../components/Rules'
import { GameButton } from '../components/GameButtons'
import { useI18n } from '../i18n'
import LevelPicker, { useStoredLevel } from '../components/LevelPicker'
import { newAiMemory, type AiMemory, type Outcome } from '../utils/game007'

type Score = { win: number; lose: number; draw: number }

export default function Training007() {
  const { t } = useI18n()
  const [score, setScore] = useState<Score>({ win: 0, lose: 0, draw: 0 })
  const [duel, setDuel] = useState(1) // change à chaque duel pour repartir de zéro
  const [level, setLevel] = useStoredLevel('aiLevel')
  // l'IA Difficile se souvient de tes habitudes d'un duel à l'autre
  const aiMemory = useRef<AiMemory>(newAiMemory())

  function onFinish(outcome: Outcome) {
    setScore(s => ({
      win: s.win + (outcome === 'p1' ? 1 : 0),
      lose: s.lose + (outcome === 'p2' ? 1 : 0),
      draw: s.draw + (outcome === 'draw' ? 1 : 0),
    }))
    setDuel(d => d + 1)
  }

  const played = score.win + score.lose + score.draw
  const rate = played ? Math.round((100 * score.win) / played) : 0

  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      <div className="d-flex gap-2 align-self-start">
        <Link to="/" className="btn-game btn-game--sm text-decoration-none">
          {t('common.menu')}
        </Link>
        <RulesButton />
      </div>

      <h1 className="h3 m-0 fw-bold">{t('menu.train007')}</h1>
      <p className="text-secondary text-center m-0" style={{ maxWidth: 520 }}>
        {t('train.intro')}
      </p>

      <LevelPicker
        value={level}
        onChange={l => {
          aiMemory.current = newAiMemory()
          setLevel(l)
        }}
      />

      <div className="hud" style={{ position: 'static' }}>
        <div className="hud__row">
          <Stat label={t('train.wins')} value={score.win} />
          <Stat label={t('train.losses')} value={score.lose} />
          <Stat label={t('train.draws')} value={score.draw} />
          <Stat label={t('train.rate')} value={`${rate} %`} />
        </div>
        <div className="hud__foot">
          <span>{t('train.played', { n: played })}</span>
        </div>
      </div>

      <Duel007 key={duel} training level={level} memory={level === 'hard' ? aiMemory.current : undefined} onFinish={onFinish} />

      {played > 0 && (
        <GameButton
          onClick={() => {
            aiMemory.current = newAiMemory()
            setScore({ win: 0, lose: 0, draw: 0 })
          }}
        >
          {t('train.reset')}
        </GameButton>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="hud__stat">
      <span className="hud__label">{label}</span>
      <span className="hud__value">{value}</span>
    </span>
  )
}
