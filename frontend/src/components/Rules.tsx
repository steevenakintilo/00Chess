import { useState, type ReactNode } from 'react'
import Modal from './Modal'
import { MenuButton } from './GameButtons'
import { useI18n } from '../i18n'
import { shopItems } from '../utils/shop'
import { KING_HP, HP_VALUE, MAX_ROUNDS, SNIPE_UNLOCK_ROUND, COLLECTOR_INCOME, TSAR_SELF_DAMAGE } from '../utils/engine'
import { PTS, SHIELD_LIMIT, WIN_REWARDS } from '../utils/game007'

const BookIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z" />
    <path d="M12 6v13" />
  </svg>
)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="h5 border-bottom border-2 border-dark pb-1">{title}</h3>
      {children}
    </section>
  )
}

function RulesContent() {
  const { t, tr } = useI18n()
  const P = {
    hp: KING_HP,
    maxHp: KING_HP - 1,
    rounds: MAX_ROUNDS,
    hpValue: HP_VALUE,
    shield: SHIELD_LIMIT,
    shieldWarn: SHIELD_LIMIT - 1,
    snipeRound: SNIPE_UNLOCK_ROUND,
    shot: PTS.shot,
    big: PTS.big,
    swap: PTS.swap,
    swapFail: PTS.swapFail,
    bonus: PTS.bonus,
    gShot: WIN_REWARDS[PTS.shot],
    gBig: WIN_REWARDS[PTS.big],
    gSwap: WIN_REWARDS[PTS.swap],
    gBonus: WIN_REWARDS[PTS.bonus],
    inc1: COLLECTOR_INCOME[1],
    inc2: COLLECTOR_INCOME[2],
    inc3: COLLECTOR_INCOME[3],
    tsar: TSAR_SELF_DAMAGE,
  }
  const p = (key: string) => <p>{tr(key, P)}</p>

  return (
    <div className="text-start" style={{ fontSize: '0.95rem' }}>
      <p className="text-secondary">{t('rules.intro')}</p>

      <Section title={t('rules.goal.title')}>
        {p('rules.goal.p1')}
        {p('rules.goal.p2')}
      </Section>

      <Section title={t('rules.board.title')}>
        {p('rules.board.p1')}
        {p('rules.board.p2')}
      </Section>

      <Section title={t('rules.modes.title')}>
        <ul>
          <li>{tr('rules.modes.winner', P)}</li>
          <li>{tr('rules.modes.turns', P)}</li>
        </ul>
      </Section>

      <Section title={t('rules.duel.title')}>
        <ul>
          {['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].map(k => (
            <li key={k}>{tr(`rules.duel.${k}`, P)}</li>
          ))}
        </ul>
      </Section>

      <Section title={t('rules.money.title')}>{p('rules.money.p1')}</Section>

      <Section title={t('rules.shop.title')}>
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{t('rules.shop.piece')}</th>
              <th>{t('rules.shop.price')}</th>
              <th>{t('rules.shop.max')}</th>
            </tr>
          </thead>
          <tbody>
            {shopItems.map(i => (
              <tr key={i.key}>
                <td>{t(`piece.${i.key}`)}</td>
                <td>{i.price} $</td>
                <td>{i.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p('rules.shop.p1')}
      </Section>

      <Section title={t('rules.pieces.title')}>
        {['Soldier', 'Sergeant', 'Archbishop', 'Dabbaba', 'Berolina', 'Duck'].map(k => (
          <div key={k}>
            <h4 className="h6">{t(`piece.${k}`)}</h4>
            {p(`rules.p.${k}`)}
          </div>
        ))}
      </Section>

      <Section title={t('rules.snipes.title')}>
        <ul>
          {['l1', 'l2', 'l3', 'l4'].map(k => (
            <li key={k}>{tr(`rules.snipes.${k}`, P)}</li>
          ))}
        </ul>
      </Section>

      <Section title={t('rules.special.title')}>
        {p('rules.special.p1')}
        {p('rules.special.p2')}
      </Section>
    </div>
  )
}

export default function RulesButton({ variant = 'small' }: { variant?: 'menu' | 'small' }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'menu' ? (
        <MenuButton icon={BookIcon} onClick={() => setOpen(true)}>
          {t('rules.button')}
        </MenuButton>
      ) : (
        <button className="btn-game btn-game--sm" onClick={() => setOpen(true)}>
          {t('rules.button')}
        </button>
      )}
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h4 m-0">{t('rules.title')}</h2>
            <button className="btn-game btn-game--sm" onClick={() => setOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          <RulesContent />
        </Modal>
      )}
    </>
  )
}
