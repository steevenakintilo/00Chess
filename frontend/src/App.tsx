import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/home'
import VsIA from './pages/vsia'
import IAvsIA from './pages/iavsia'
import Training007 from './pages/training007'
import Tutorial from './pages/tutorial'
import Online from './pages/online'
import Room from './pages/room'
import { AuthProvider } from './auth/AuthContext'
import { LanguageProvider, LanguageSwitcher } from './i18n'

export default function App() {
  return (
    <LanguageProvider>
      <LanguageSwitcher />
      <AuthProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vs-ia" element={<VsIA />} />
        <Route path="/ia-vs-ia" element={<IAvsIA />} />
        <Route path="/007" element={<Training007 />} />
        <Route path="/entrainement" element={<Tutorial />} />
        <Route path="/online" element={<Online />} />
        <Route path="/online/room/:code" element={<Room />} />
        {/* anciennes adresses */}
        <Route path="/test" element={<Navigate to="/vs-ia" replace />} />
        <Route path="/ia" element={<Navigate to="/ia-vs-ia" replace />} />
      </Routes>
      </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}
