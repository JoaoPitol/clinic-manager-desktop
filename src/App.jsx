import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewPatient from './pages/NewPatient'
import PatientDetails from './pages/PatientDetails'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Financeiro from './pages/Financeiro'
import UpdateBanner from './components/UpdateBanner'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('@ClinicManager:token');
  return token ? children : <Navigate to="/login" replace />;
}

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

  const clinicId = localStorage.getItem('@ClinicManager:token');

  return (
    <>
      <UpdateBanner clinicId={clinicId} />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard"    element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/new-patient"  element={<PrivateRoute><NewPatient /></PrivateRoute>} />
        <Route path="/patient/:id"  element={<PrivateRoute><PatientDetails /></PrivateRoute>} />
        <Route path="/schedule"     element={<PrivateRoute><Schedule /></PrivateRoute>} />
        <Route path="/settings"     element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/financeiro"   element={<PrivateRoute><Financeiro /></PrivateRoute>} />
      </Routes>
    </>
  )
}

export default App
