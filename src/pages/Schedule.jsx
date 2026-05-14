import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, X, ArrowLeft, FilePlus, Settings, MessageCircle, DollarSign, CheckCircle, Pencil } from 'lucide-react';
import api from '../services/api';
import { formatDateBr } from '../utils/dateBr';

const Schedule = () => {
  // Navigation states
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'day'
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Tracks the month shown in the calendar
  const [selectedDate, setSelectedDate] = useState(new Date()); // Tracks the specifically selected day
  
  // Data states
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [completedAppointmentIds, setCompletedAppointmentIds] = useState(new Set());
  const [linkedAppointmentIds, setLinkedAppointmentIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalTime, setModalTime] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [notes, setNotes] = useState('');
  
  const navigate = useNavigate();
  const clinicId = localStorage.getItem('@ClinicManager:token');
  const clinicName = localStorage.getItem('@ClinicManager:nome') || 'ClinicManager';

  useEffect(() => {
    fetchPatients();
    fetchAllAppointments();
    fetchCompletedAppointments();
  }, []);

  // Fetch appointments only when looking at the day view
  useEffect(() => {
    if (viewMode === 'day') {
      fetchAppointments(selectedDate);
    }
  }, [viewMode, selectedDate]);

  const fetchPatients = async () => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.getPatients(clinicId);
        setPatients(data || []);
      } catch (error) {
        console.error('Erro ao buscar pacientes', error);
      }
    }
  };

  const fetchCompletedAppointments = async () => {
    try {
      const res = await api.get('/patients');
      const completed = new Set();
      const linked = new Set();
      (res.data || []).forEach(p => {
        (p.treatments || []).forEach(t => {
          if (t.appointmentId) {
            linked.add(String(t.appointmentId));
            if (t.status === 'Concluído') {
              completed.add(String(t.appointmentId));
            }
          }
        });
      });
      setCompletedAppointmentIds(completed);
      setLinkedAppointmentIds(linked);
    } catch (err) {
      console.error('Erro ao buscar tratamentos', err);
    }
  };

  const fetchAllAppointments = async () => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.getAllAppointments(clinicId);
        setAllAppointments(data || []);
      } catch (error) {
        console.error('Erro ao buscar todos os agendamentos', error);
      }
    }
  };

  const fetchAppointments = async (date) => {
    setLoading(true);
    if (window.electronAPI) {
      try {
        // Adjust for timezone offset to get correct YYYY-MM-DD
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];
        const data = await window.electronAPI.getAppointments(clinicId, dateStr);
        setAppointments(data || []);
      } catch (error) {
        console.error('Erro ao buscar agendamentos', error);
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('@ClinicManager:token');
    navigate('/login');
  };

  // --- Month Calendar Logic ---
  const prevMonth = () => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(prev);
  };

  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(next);
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
    setViewMode('day');
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday, etc.
  };

  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Empty slots for days before the 1st of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}></div>);
    }
    
    // The actual days
    const today = new Date();
    
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const currentDayDate = new Date(year, month, d);
      
      const offsetDate = new Date(currentDayDate.getTime() - (currentDayDate.getTimezoneOffset() * 60000));
      const dateStr = offsetDate.toISOString().split('T')[0];
      
      const dayAppointments = allAppointments.filter(a => a.date === dateStr);
      dayAppointments.sort((a, b) => a.time.localeCompare(b.time));
      
      days.push(
        <div 
          key={d} 
          onClick={() => handleDayClick(currentDayDate)}
          style={{ 
            padding: '12px', 
            background: isToday ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)', 
            border: isToday ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
            cursor: 'pointer',
            minHeight: '120px',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.2s',
            borderRadius: '8px'
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            if (!isToday) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            if (!isToday) e.currentTarget.style.border = '1px solid var(--border-color)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '1.2rem', 
              fontWeight: isToday ? 'bold' : 'normal',
              color: isToday ? 'var(--accent-cyan)' : 'var(--text-primary)'
            }}>
              {d}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
            {dayAppointments.map(appt => {
              const isConcluido = completedAppointmentIds.has(String(appt.id));
              return (
                <div 
                  key={appt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/patient/${appt.patientId}`);
                  }}
                  style={{
                    background: isConcluido ? 'rgba(16,185,129,0.15)' : 'rgba(59, 130, 246, 0.2)',
                    border: isConcluido ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  title={`Ver paciente: ${getPatientName(appt.patientId)}${isConcluido ? ' (Concluído)' : ''}`}
                  onMouseOver={e => e.currentTarget.style.background = isConcluido ? 'rgba(16,185,129,0.3)' : 'rgba(59, 130, 246, 0.4)'}
                  onMouseOut={e => e.currentTarget.style.background = isConcluido ? 'rgba(16,185,129,0.15)' : 'rgba(59, 130, 246, 0.2)'}
                >
                  <strong style={{ color: isConcluido ? 'var(--success)' : 'var(--accent-cyan)' }}>{appt.time}</strong> {getPatientName(appt.patientId)}
                  {isConcluido && <span style={{ marginLeft: '4px', fontSize: '0.65rem', opacity: 0.8 }}>✔</span>}
                </div>
              );
            })}
          </div>

          {dayAppointments.length === 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'auto', textAlign: 'center' }}>
              Livre
            </span>
          )}
        </div>
      );
    }
    
    return days;
  };

  // --- Day View Logic ---
  const openScheduleModal = (time) => {
    // Verificação: bloqueia abertura se o horário já está ocupado
    const slotOccupied = appointments.find(a => a.time === time);
    if (slotOccupied) {
      alert(`O horário ${time} já está ocupado por ${getPatientName(slotOccupied.patientId)}.\nEdite o agendamento existente ou escolha outro horário.`);
      return;
    }
    setModalTime(time);
    setSelectedPatientId('');
    setNotes('');
    setShowModal(true);
  };

  const closeScheduleModal = () => {
    setShowModal(false);
  };

  const handleSaveAppointment = async () => {
    if (!selectedPatientId) {
      alert('Selecione um paciente');
      return;
    }

    if (window.electronAPI) {
      const offsetDate = new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000));
      const dateStr = offsetDate.toISOString().split('T')[0];

      // Verificação final antes de salvar: checa conflito de horário
      const conflict = appointments.find(
        a => a.time === modalTime && a.patientId !== selectedPatientId
      );
      if (conflict) {
        alert(`Conflito de horário: ${getPatientName(conflict.patientId)} já está agendado(a) às ${modalTime}.\nNenhum agendamento foi criado.`);
        return;
      }

      const appointmentData = {
        clinicId,
        patientId: selectedPatientId,
        date: dateStr,
        time: modalTime,
        notes
      };

      const response = await window.electronAPI.addAppointment(appointmentData);
      if (response.success) {
        if (response.wasUpdated) {
          console.info(`[Agenda] Agendamento existente atualizado (${dateStr} ${modalTime})`);
        }
        fetchAppointments(selectedDate);
        fetchAllAppointments();
        closeScheduleModal();
      } else {
        alert('Erro ao salvar agendamento: ' + response.error);
      }
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (window.confirm('Deseja realmente cancelar este horário?')) {
      if (window.electronAPI) {
        const response = await window.electronAPI.deleteAppointment(clinicId, appointmentId);
        if (response.success) {
          fetchAppointments(selectedDate);
          fetchAllAppointments();
        } else {
          alert('Erro ao cancelar: ' + response.error);
        }
      }
    }
  };

  const handleSendWhatsApp = async (appointment) => {
    if (window.electronAPI) {
      const response = await window.electronAPI.sendWhatsAppReminder(clinicId, appointment.id);
      if (response.success) {
        fetchAppointments(selectedDate);
        fetchAllAppointments();
      } else {
        alert('Erro ao enviar WhatsApp: ' + response.error);
      }
    }
  };

  const handleCreateTreatment = (appointment) => {
    navigate(`/patient/${appointment.patientId}`, {
      state: {
        scrollToPlanoTratamento: true,
        prefillTreatment: {
          appointmentId: appointment.id,
          data: appointment.date,
          hora: appointment.time,
          procedimento: appointment.notes || '',
          valor: ''
        }
      }
    });
  };

  const timeSlots = [];
  for (let i = 8; i <= 18; i++) {
    timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
    if (i !== 18) {
      timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
    }
  }

  const getPatientName = (id) => {
    const p = patients.find(pat => pat.id === id);
    return p ? p.nomeCompleto : 'Paciente Desconhecido';
  };

  const formatMonthTitle = (date) => {
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  };
  
  const formatDateTitle = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
    const cap = wd.charAt(0).toUpperCase() + wd.slice(1);
    return `${cap} — ${formatDateBr(iso)}`;
  };
  const renderAppointmentCard = (appointment) => {
    const isConcluido = completedAppointmentIds.has(String(appointment.id));
    const hasLinked = linkedAppointmentIds.has(String(appointment.id));
    return (
      <div style={{
        background: isConcluido ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.1)',
        border: isConcluido ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(59,130,246,0.3)',
        borderRadius: '8px', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: '100%', opacity: isConcluido ? 0.85 : 1,
      }}>
        {/* Info side */}
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getPatientName(appointment.patientId)}
            {isConcluido ? (
              <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.2)', color: 'var(--success)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={11} /> Concluído
              </span>
            ) : appointment.reminderSent ? (
              <span style={{ fontSize: '0.7rem', background: '#25D366', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Lembrete Enviado</span>
            ) : null}
          </div>
          {appointment.notes && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{appointment.notes}</div>
          )}
        </div>

        {/* Buttons side */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isConcluido && (
            <>
              {/* WhatsApp */}
              <button onClick={() => handleSendWhatsApp(appointment)}
                style={{ background: 'transparent', border: 'none', color: '#25D366', cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                title="Disparar Lembrete WhatsApp">
                <MessageCircle size={18} />
              </button>

              {/* Criar tratamento OU Editar na ficha */}
              {!hasLinked ? (
                <button onClick={() => handleCreateTreatment(appointment)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                  title="Criar Plano de Tratamento a partir deste horário">
                  <FilePlus size={18} />
                </button>
              ) : (
                <button onClick={() => navigate(`/patient/${appointment.patientId}`, { state: { scrollToPlanoTratamento: true } })}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                  title="Ver/Editar Plano de Tratamento na Ficha do Paciente">
                  <Pencil size={18} />
                </button>
              )}
            </>
          )}

          {/* Deletar */}
          <button onClick={() => handleDeleteAppointment(appointment.id)}
            style={{ background: 'transparent', border: 'none', color: isConcluido ? 'var(--text-secondary)' : 'var(--error)', cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
            title="Cancelar Horário">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
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
          <div onClick={() => navigate('/dashboard')} style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
            borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'background 0.2s'
          }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            <Users size={20} />
            <span style={{ fontWeight: 500 }}>Pacientes</span>
          </div>

          <div onClick={() => setViewMode('month')} style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
            background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--accent-cyan)',
            cursor: 'pointer'
          }}>
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
        
        {viewMode === 'month' ? (
          /* MONTH VIEW */
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Calendário</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Selecione um dia para ver ou marcar horários.</p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '8px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <ChevronLeft size={20} />
                </button>
                <div style={{ minWidth: '200px', textAlign: 'center', fontWeight: 500, textTransform: 'capitalize', fontSize: '1.2rem' }}>
                  {formatMonthTitle(currentMonth)}
                </div>
                <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '8px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              {/* Weekday Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '16px', marginBottom: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              
              {/* Calendar Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '16px' }}>
                {renderCalendarDays()}
              </div>
            </div>
          </div>
        ) : (
          /* DAY VIEW */
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <button 
                  onClick={() => setViewMode('month')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', marginBottom: '12px', padding: 0 }}
                >
                  <ArrowLeft size={18} /> Voltar ao Calendário
                </button>
                <h1 style={{ fontSize: '2rem', marginBottom: '4px', textTransform: 'capitalize' }}>{formatDateTitle(selectedDate)}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Agenda de horários do dia.</p>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', minHeight: '500px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando agenda...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-color)' }}>
                  {timeSlots.map(time => {
                    const appointment = appointments.find(a => a.time === time);
                    
                    return (
                      <div key={time} style={{ 
                        display: 'flex', 
                        background: 'var(--bg-primary)', 
                        minHeight: '60px',
                        alignItems: 'stretch'
                      }}>
                        <div style={{ 
                          width: '80px', 
                          padding: '16px', 
                          borderRight: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          fontSize: '0.9rem'
                        }}>
                          {time}
                        </div>
                        
                        <div style={{ flex: 1, padding: '8px' }}>
                          {appointment
                            ? renderAppointmentCard(appointment)
                            : (
                            <div 
                              onClick={() => openScheduleModal(time)}
                              style={{ 
                                height: '100%',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 16px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: '1px dashed transparent'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                e.currentTarget.style.border = '1px dashed var(--border-color)';
                                e.currentTarget.style.color = 'var(--accent-cyan)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.border = '1px dashed transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                <Plus size={16} /> Horário Livre
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      {showModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Agendar Consulta - {modalTime}</h2>
              <button onClick={closeScheduleModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Paciente</label>
              <select 
                className="input-field" 
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">Selecione um paciente...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.nomeCompleto}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Procedimento / Observações</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ex: Avaliação, Limpeza, Retorno..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={closeScheduleModal} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveAppointment} className="btn-primary">Salvar Agendamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
