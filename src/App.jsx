import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewPatient from './pages/NewPatient'
import PatientDetails from './pages/PatientDetails'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Financeiro from './pages/Financeiro'

function App() {
  // Aplicar tema e nome no carregamento inicial
  const clinicName = localStorage.getItem('@ClinicManager:nome');
  if (clinicName) {
    document.title = clinicName;
  }

  const savedTheme = localStorage.getItem('@ClinicManager:theme');
  if (savedTheme) {
    try {
      const settings = JSON.parse(savedTheme);
      document.body.classList.remove('light-mode', 'dark-mode');
      ['blue', 'green', 'purple', 'orange', 'pink'].forEach(c => document.body.classList.remove(`theme-${c}`));
      
      if (settings.themeMode === 'light') {
        document.body.classList.add('light-mode');
      }
      if (settings.accentColor) {
        document.body.classList.add(`theme-${settings.accentColor}`);
      }
    } catch (e) {
      console.error('Erro ao ler tema inicial', e);
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/new-patient" element={<NewPatient />} />
      <Route path="/patient/:id" element={<PatientDetails />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/financeiro" element={<Financeiro />} />
    </Routes>
  )
}

export default App
