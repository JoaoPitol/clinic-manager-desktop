import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut, Plus, Search, Calendar as CalendarIcon, Settings, DollarSign } from 'lucide-react';
import api from '../services/api';

const Dashboard = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clinicName = localStorage.getItem('@ClinicManager:nome') || 'ClinicManager';

  useEffect(() => {
    document.title = clinicName;
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients');
      setPatients((response.data || []).filter((patient) => !patient._deleted));
    } catch (error) {
      console.error('Erro ao buscar pacientes', error);
      if (error.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI?.logoutClinic();
    } catch (error) {
      console.warn('Falha ao sincronizar no logout:', error);
    }
    localStorage.removeItem('@ClinicManager:token');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: '260px', margin: '16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
            {clinicName}
          </h2>
        </div>

        <nav style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--accent-cyan)',
            cursor: 'pointer'
          }}>
            <Users size={20} />
            <span style={{ fontWeight: 500 }}>Pacientes</span>
          </div>

          <div onClick={() => navigate('/schedule')} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'background 0.2s'
          }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            <CalendarIcon size={20} />
            <span style={{ fontWeight: 500 }}>Agenda</span>
          </div>

          <div onClick={() => navigate('/financeiro')} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'background 0.2s'
          }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            <DollarSign size={20} />
            <span style={{ fontWeight: 500 }}>Financeiro</span>
          </div>

          <div onClick={() => navigate('/settings')} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'background 0.2s'
          }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            <Settings size={20} />
            <span style={{ fontWeight: 500 }}>Configurações</span>
          </div>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s'
          }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--error)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
            <LogOut size={20} />
            <span>Sair do sistema</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px 32px 32px 16px', overflowY: 'auto' }}>
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Gestão de Pacientes</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Visualize e gerencie todos os pacientes.</p>
            </div>
            <button onClick={() => navigate('/new-patient')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} />
              <span>Novo Paciente</span>
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '24px', minHeight: '400px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }} />
                <input type="text" className="input-field" placeholder="Buscar paciente por nome ou CPF..." style={{ paddingLeft: '44px' }} />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando dados...</div>
            ) : patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Users size={32} opacity={0.5} />
                </div>
                <p>Nenhum paciente cadastrado ainda.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <th style={{ padding: '16px' }}>Nome Completo</th>
                    <th style={{ padding: '16px' }}>CPF/RG</th>
                    <th style={{ padding: '16px' }}>Telefone</th>
                    <th style={{ padding: '16px' }}>Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/patient/${p.id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px', fontWeight: 500 }}>{p.nomeCompleto}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{p.cpfOuCi}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{p.fone || '-'}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{p.cidade || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
