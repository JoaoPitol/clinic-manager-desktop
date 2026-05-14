import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Palette, Building, Moon, Sun, MessageCircle, DollarSign, ListChecks, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

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

  // Tabela de Procedimentos
  const [proceduresList, setProceduresList] = useState([]);
  const [newProcNome, setNewProcNome] = useState('');
  const [newProcValor, setNewProcValor] = useState('');
  const [editingProcId, setEditingProcId] = useState(null);
  const [editProcNome, setEditProcNome] = useState('');
  const [editProcValor, setEditProcValor] = useState('');

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
        } catch {
          // Tema inválido no localStorage: ignora e mantém o tema atual.
        }
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
        setProceduresList(response.clinic.proceduresLibrary || []);
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
        settings: newSettings,
        proceduresLibrary: proceduresList,
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

  const handleAddProcedure = () => {
    const nome = newProcNome.trim();
    if (!nome) return;
    const newProc = {
      id: crypto.randomUUID(),
      nome,
      valorPadrao: newProcValor ? parseFloat(newProcValor) : '',
    };
    setProceduresList(prev => [...prev, newProc]);
    setNewProcNome('');
    setNewProcValor('');
  };

  const handleRemoveProcedure = (id) => {
    setProceduresList(prev => prev.filter(p => p.id !== id));
  };

  const handleStartEditProc = (proc) => {
    setEditingProcId(proc.id);
    setEditProcNome(proc.nome);
    setEditProcValor(proc.valorPadrao !== '' ? String(proc.valorPadrao) : '');
  };

  const handleConfirmEditProc = (id) => {
    const nome = editProcNome.trim();
    if (!nome) return;
    setProceduresList(prev => prev.map(p =>
      p.id === id ? { ...p, nome, valorPadrao: editProcValor ? parseFloat(editProcValor) : '' } : p
    ));
    setEditingProcId(null);
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
                  <label className="input-label">CNPJ (opcional)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={cnpj} 
                    placeholder="Deixe em branco se não tiver CNPJ"
                    onChange={(e) => setCnpj(e.target.value)} 
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

          {/* Tabela de Procedimentos */}
          <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <ListChecks size={24} color="var(--accent-cyan)" />
              <div>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>Tabela de Procedimentos</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Crie uma lista de procedimentos com valores padrão para usar como atalho no plano de tratamento dos pacientes.
                </p>
              </div>
            </div>

            {/* Formulário de adição */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px',
              alignItems: 'end', marginBottom: '20px', marginTop: '20px',
              padding: '16px', background: 'rgba(255,255,255,0.03)',
              borderRadius: '10px', border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.82rem' }}>Nome do Procedimento</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex: Extração simples, Clareamento, Restauração…"
                    value={newProcNome}
                    onChange={e => setNewProcNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddProcedure())}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.82rem' }}>Valor Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    placeholder="Opcional"
                    value={newProcValor}
                    onChange={e => setNewProcValor(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddProcedure())}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddProcedure}
                disabled={!newProcNome.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 18px', whiteSpace: 'nowrap' }}
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>

            {/* Lista de procedimentos */}
            {proceduresList.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px',
                background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                color: 'var(--text-secondary)', fontSize: '0.9rem',
              }}>
                Nenhum procedimento cadastrado ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {proceduresList.map((proc, idx) => (
                  <div
                    key={proc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                    }}
                  >
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'rgba(99,179,237,0.15)', color: 'var(--accent-cyan)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>

                    {editingProcId === proc.id ? (
                      <>
                        <input
                          type="text"
                          className="input-field"
                          value={editProcNome}
                          onChange={e => setEditProcNome(e.target.value)}
                          style={{ flex: 2, padding: '8px 12px' }}
                          autoFocus
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-field"
                          value={editProcValor}
                          onChange={e => setEditProcValor(e.target.value)}
                          placeholder="Valor"
                          style={{ flex: 1, padding: '8px 12px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmEditProc(proc.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: '4px' }}
                          title="Confirmar"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProcId(null)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
                          title="Cancelar"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 2, fontWeight: 500, color: 'var(--text-primary)' }}>{proc.nome}</span>
                        <span style={{
                          flex: 1, color: proc.valorPadrao !== '' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          fontWeight: proc.valorPadrao !== '' ? 600 : 400,
                        }}>
                          {proc.valorPadrao !== '' ? `R$ ${parseFloat(proc.valorPadrao).toFixed(2)}` : '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditProc(proc)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-cyan)', padding: '4px' }}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveProcedure(proc.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '4px' }}
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
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
