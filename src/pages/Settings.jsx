import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Palette, Building, Moon, Sun, MessageCircle, DollarSign } from 'lucide-react';
import api from '../services/api';

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Clinic Info
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cro, setCro] = useState('');
  
  // Settings
  const [themeMode, setThemeMode] = useState('dark');
  const [accentColor, setAccentColor] = useState('blue');
  const [telefoneClinica, setTelefoneClinica] = useState('');
  const [whatsappRemindersEnabled, setWhatsappRemindersEnabled] = useState(false);
  const [whatsappMessageTemplate, setWhatsappMessageTemplate] = useState('Olá {nomePaciente}, lembramos da sua consulta hoje às {hora} na clínica {nomeClinica}. Dúvidas, contate {telefoneClinica}.');

  // Pagamentos PIX
  const [chavePix, setChavePix] = useState('');
  const [cidadeClinica, setCidadeClinica] = useState('');
  
  const colors = [
    { id: 'blue', name: 'Azul', hex: '#3B82F6' },
    { id: 'green', name: 'Verde', hex: '#10B981' },
    { id: 'purple', name: 'Roxo', hex: '#8B5CF6' },
    { id: 'orange', name: 'Laranja', hex: '#F97316' },
    { id: 'pink', name: 'Rosa', hex: '#EC4899' }
  ];

  useEffect(() => {
    fetchClinicInfo();
    
    // Cleanup ao sair da página
    return () => {
      const savedTheme = localStorage.getItem('@ClinicManager:theme');
      if (savedTheme) {
        try {
          applyThemeToDocument(JSON.parse(savedTheme), false);
        } catch (e) {}
      }
    };
  }, []);

  // Live preview effect
  useEffect(() => {
    if (!loading) {
      applyThemeToDocument({ themeMode, accentColor }, false);
    }
  }, [themeMode, accentColor, loading]);

  const fetchClinicInfo = async () => {
    try {
      const clinicId = localStorage.getItem('@ClinicManager:token');
      if (!clinicId || !window.electronAPI) return;
      
      const response = await window.electronAPI.getClinic(clinicId);
      if (response.success && response.clinic) {
        setNome(response.clinic.nome || '');
        setCnpj(response.clinic.cnpj || '');
        setCro(response.clinic.cro || '');
        
        if (response.clinic.settings) {
          setThemeMode(response.clinic.settings.themeMode || 'dark');
          setAccentColor(response.clinic.settings.accentColor || 'blue');
          setTelefoneClinica(response.clinic.settings.telefoneClinica || '');
          setWhatsappRemindersEnabled(response.clinic.settings.whatsappRemindersEnabled || false);
          if (response.clinic.settings.whatsappMessageTemplate) {
            setWhatsappMessageTemplate(response.clinic.settings.whatsappMessageTemplate);
          }
          setChavePix(response.clinic.settings.chavePix || '');
          setCidadeClinica(response.clinic.settings.cidadeClinica || '');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados da clínica', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const clinicId = localStorage.getItem('@ClinicManager:token');
      if (!clinicId || !window.electronAPI) return;
      
      const newSettings = { themeMode, accentColor, telefoneClinica, whatsappRemindersEnabled, whatsappMessageTemplate, chavePix, cidadeClinica };
      const updatedData = {
        nome,
        cnpj,
        cro,
        settings: newSettings
      };
      
      const response = await window.electronAPI.updateClinic(clinicId, updatedData);
      
      if (response.success) {
        applyThemeToDocument(newSettings, true);
        localStorage.setItem('@ClinicManager:nome', nome);
        document.title = nome;
        alert('Configurações salvas com sucesso!');
      } else {
        alert('Erro ao salvar: ' + response.error);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações', error);
      alert('Ocorreu um erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const applyThemeToDocument = (settings, saveToStorage = true) => {
    // Remove class anterior
    document.body.classList.remove('light-mode', 'dark-mode');
    colors.forEach(c => document.body.classList.remove(`theme-${c.id}`));
    
    // Adiciona nova
    if (settings.themeMode === 'light') {
      document.body.classList.add('light-mode');
    }
    document.body.classList.add(`theme-${settings.accentColor}`);
    
    // Salva no localStorage
    if (saveToStorage) {
      localStorage.setItem('@ClinicManager:theme', JSON.stringify(settings));
    }
  };

  if (loading) return <div style={{ color: 'var(--text-primary)', padding: '40px', textAlign: 'center' }}>Carregando configurações...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflowY: 'auto', padding: '32px' }}>
      <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '4px', color: 'var(--text-primary)' }}>Configurações</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Personalize as informações da clínica e a aparência do aplicativo</p>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* Informações da Clínica */}
          <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Building size={24} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Informações da Clínica</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div>
                <label className="input-label">Nome da Clínica</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={nome} 
                  onChange={(e) => setNome(e.target.value)} 
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">CNPJ</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={cnpj} 
                    onChange={(e) => setCnpj(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="input-label">CRO do Responsável</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={cro} 
                    onChange={(e) => setCro(e.target.value)} 
                    required 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Integração WhatsApp */}
          <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <MessageCircle size={24} color="#25D366" />
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Automação de WhatsApp</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              <div>
                <label className="input-label">Telefone Celular da Clínica (com DDD)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ex: 11999999999"
                  value={telefoneClinica} 
                  onChange={(e) => setTelefoneClinica(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="checkbox" 
                  id="whatsappToggle"
                  checked={whatsappRemindersEnabled} 
                  onChange={(e) => setWhatsappRemindersEnabled(e.target.checked)} 
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <label htmlFor="whatsappToggle" style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Ativar lembretes automáticos para pacientes (Envia 2h antes da consulta)
                </label>
              </div>

              {whatsappRemindersEnabled && (
                <div>
                  <label className="input-label">Modelo de Mensagem de Lembrete</label>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Variáveis disponíveis: {'{nomePaciente}'}, {'{hora}'}, {'{nomeClinica}'}, {'{telefoneClinica}'}
                  </p>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    value={whatsappMessageTemplate} 
                    onChange={(e) => setWhatsappMessageTemplate(e.target.value)} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Pagamentos PIX */}
          <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <DollarSign size={24} color="#00B4D8" />
              <div>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Pagamentos PIX</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Configure para gerar QR Codes PIX reais para cobranças de procedimentos.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div>
                <label className="input-label">Chave PIX da Clínica *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Esta chave será usada para receber os pagamentos via PIX diretamente no app do seu banco.
                </p>
              </div>
              <div>
                <label className="input-label">Cidade da Clínica *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: Curitiba"
                  value={cidadeClinica}
                  onChange={(e) => setCidadeClinica(e.target.value)}
                />
              </div>

              {chavePix && (
                <div style={{ background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: '10px', padding: '12px 16px' }}>
                  <p style={{ fontSize: '0.82rem', color: '#00B4D8' }}>
                    ✅ Chave PIX configurada. Os QR Codes gerados nas cobranças serão válidos e pagáveis por qualquer banco.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Aparência */}
          <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Palette size={24} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Aparência do Aplicativo</h2>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label className="input-label" style={{ marginBottom: '12px' }}>Modo de Cor</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: themeMode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)',
                    border: `2px solid ${themeMode === 'dark' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Moon size={20} /> Modo Escuro
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: themeMode === 'light' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)',
                    border: `2px solid ${themeMode === 'light' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sun size={20} /> Modo Claro
                </button>
              </div>
            </div>

            <div>
              <label className="input-label" style={{ marginBottom: '12px' }}>Cor de Destaque</label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {colors.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setAccentColor(color.id)}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: color.hex,
                      border: accentColor === color.id ? '4px solid white' : '4px solid transparent',
                      cursor: 'pointer',
                      outline: accentColor === color.id ? `2px solid ${color.hex}` : 'none',
                      transition: 'all 0.2s'
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px' }}
              disabled={saving}
            >
              <Save size={20} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default Settings;
