import { useNavigate } from 'react-router-dom'
import Board from '../components/Board'
import { MenuButton, PersonIcon, GlobeIcon, LearnIcon, RobotIcon, TargetIcon } from '../components/GameButtons'
import RulesButton from '../components/Rules'
import { newGameState } from '../utils/engine'
import { useI18n } from '../i18n'

const startBoard = newGameState()

export default function Home() {
  const navigate = useNavigate()
  const { t } = useI18n()
  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3 gap-4">
      <h1 className="m-0 fw-bold">00Chess</h1>
      <Board game={startBoard} />
      <div className="d-flex flex-wrap justify-content-center gap-3">
        <MenuButton icon={PersonIcon} onClick={() => navigate('/vs-ia')}>
          {t('menu.vsIa')}
        </MenuButton>
        <MenuButton icon={RobotIcon} onClick={() => navigate('/ia-vs-ia')}>
          {t('menu.iaVsIa')}
        </MenuButton>
        <MenuButton icon={GlobeIcon} onClick={() => navigate('/online')}>
          {t('menu.online')}
        </MenuButton>
        <MenuButton icon={LearnIcon} onClick={() => navigate('/entrainement')}>
          {t('menu.learn')}
        </MenuButton>
        <MenuButton icon={TargetIcon} onClick={() => navigate('/007')}>
          {t('menu.train007')}
        </MenuButton>
        <RulesButton variant="menu" />
      </div>
    </div>
  )
}
