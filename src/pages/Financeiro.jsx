import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  Filter, Calendar, Search, Users, ChevronDown, ChevronUp, Settings
} from 'lucide-react';
import api from '../services/api';
import { calcularStatusPagamento } from '../components/PagamentoModal';

// ── helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (val) =>
  parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const FORMAS = ['Todas', 'Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Convênio'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ── mini bar chart ────────────────────────────────────────────────────────────
const formatChartVal = (val) => {
  if (val === 0) return '';
  if (val >= 1000) return `R$${(val / 1000).toFixed(1)}k`;
  return `R$${val.toFixed(0)}`;
};

const BarChart = ({ data, label }) => {
  const max = Math.max(...data.map(d => d.valor), 1);
  const BAR_H = 90;
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', height: `${BAR_H}px`, alignItems: 'flex-end' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '3px' }}>
            {/* Value label */}
            <span style={{
              fontSize: '0.6rem',
              color: d.atual ? 'var(--accent-cyan)' : d.valor > 0 ? 'var(--text-secondary)' : 'transparent',
              fontWeight: d.atual ? 700 : 400,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}>
              {formatChartVal(d.valor)}
            </span>
            {/* Bar */}
            <div
              title={`${d.mes}: ${formatCurrency(d.valor)}`}
              style={{
                width: '100%',
                borderRadius: '4px 4px 0 0',
                height: `${Math.max((d.valor / max) * (BAR_H - 22), d.valor > 0 ? 4 : 2)}px`,
                background: d.atual
                  ? 'linear-gradient(180deg, var(--accent-cyan), var(--accent-blue))'
                  : d.valor > 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
                transition: 'height 0.6s ease',
                boxShadow: d.atual && d.valor > 0 ? '0 0 12px rgba(6,182,212,0.4)' : 'none',
              }}
            />
          </div>
        ))}
      </div>
      {/* Month labels */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontSize: '0.65rem',
              color: d.atual ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: d.atual ? 600 : 400,
            }}>{d.mes}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ treatment }) => {
  const s = calcularStatusPagamento(treatment);
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
    }}>
      {s.label}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
const Financeiro = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroForma, setFiltroForma] = useState('Todas');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [expandedPatient, setExpandedPatient] = useState(null);

  const clinicName = localStorage.getItem('@ClinicManager:nome') || 'ClinicManager';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await api.get('/patients');
        setPatients(res.data);
      } catch (err) {
        console.error('Erro ao buscar pacientes', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── flatten all treatments with patient info ──────────────────────────────
  const allTreatments = useMemo(() => {
    const result = [];
    patients.forEach(p => {
      (p.treatments || []).forEach(t => {
        result.push({ ...t, patientName: p.nomeCompleto, patientId: p.id });
      });
    });
    return result;
  }, [patients]);

  // ── all individual payments ───────────────────────────────────────────────
  const allPayments = useMemo(() => {
    const result = [];
    allTreatments.forEach(t => {
      (t.payments || []).forEach(p => {
        result.push({
          ...p,
          procedimento: t.procedimento,
          dente: t.dente,
          patientName: t.patientName,
          patientId: t.patientId,
        });
      });
    });
    return result;
  }, [allTreatments]);

  // ── filtered payments ─────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return allPayments.filter(p => {
      if (filtroForma !== 'Todas' && p.formaPagamento !== filtroForma) return false;
      if (filtroMes && !p.data?.startsWith(filtroMes)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.patientName?.toLowerCase().includes(q) && !p.procedimento?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allPayments, filtroForma, filtroMes, searchQuery]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalOrcado = allTreatments.reduce((a, t) => a + parseFloat(t.valor || 0), 0);
    const totalRecebido = allPayments.reduce((a, p) => a + parseFloat(p.valor || 0), 0);
    const inadimplencia = totalOrcado - totalRecebido;

    const quitados = allTreatments.filter(t => calcularStatusPagamento(t).label === 'Quitado').length;
    const pendentes = allTreatments.filter(t => calcularStatusPagamento(t).label === 'Pendente').length;
    const parciais  = allTreatments.filter(t => calcularStatusPagamento(t).label === 'Parcial').length;

    return { totalOrcado, totalRecebido, inadimplencia, quitados, pendentes, parciais };
  }, [allTreatments, allPayments]);

  // ── monthly chart data (last 6 months) — responde ao filtro de Forma ─────
  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const valor = allPayments
        .filter(p => {
          if (filtroForma !== 'Todas' && p.formaPagamento !== filtroForma) return false;
          return (p.data || '').startsWith(key);
        })
        .reduce((a, p) => a + parseFloat(p.valor || 0), 0);
      return { mes: MESES[d.getMonth()], valor, atual: i === 5 };
    });
  }, [allPayments, filtroForma]);

  // ── per-patient summary — responde a todos os filtros ───────────────────
  const patientSummaries = useMemo(() => {
    return patients.map(p => {
      const ts = p.treatments || [];
      const orcado = ts.reduce((a, t) => a + parseFloat(t.valor || 0), 0);
      // Aplica filtros de forma e mês aos pagamentos
      const pago = ts.reduce((a, t) => {
        const pagsFiltrados = (t.payments || []).filter(pay => {
          if (filtroForma !== 'Todas' && pay.formaPagamento !== filtroForma) return false;
          if (filtroMes && !(pay.data || '').startsWith(filtroMes)) return false;
          return true;
        });
        return a + pagsFiltrados.reduce((b, pay) => b + parseFloat(pay.valor || 0), 0);
      }, 0);
      const saldo = Math.max(0, orcado - pago);
      const status = saldo === 0 && orcado > 0 ? 'Quitado' : pago > 0 ? 'Parcial' : 'Pendente';
      return { ...p, orcado, pago, saldo, status };
    }).filter(p => {
      if (filtroStatus !== 'Todos' && p.status !== filtroStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.nomeCompleto?.toLowerCase().includes(q)) return false;
      }
      return p.orcado > 0;
    });
  }, [patients, filtroStatus, searchQuery, filtroForma, filtroMes]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: '260px', margin: '16px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{clinicName}</h2>
        </div>
        <nav style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'Pacientes', path: '/dashboard', icon: <Users size={20} /> },
            { label: 'Agenda', path: '/schedule', icon: <Calendar size={20} /> },
            { label: 'Financeiro', path: '/financeiro', icon: <DollarSign size={20} />, active: true },
            { label: 'Configura\u00e7\u00f5es', path: '/settings', icon: <Settings size={20} /> },
          ].map(item => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                background: item.active ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: item.active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
              onMouseOver={e => { if (!item.active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
              onMouseOut={e => { if (!item.active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              {item.icon}
              <span style={{ fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 32px 16px' }}>
        <div className="animate-fade-in">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Financeiro</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Controle de receitas e pagamentos da clínica.</p>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>Carregando dados financeiros...</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {[
                  { label: 'Total Orçado', value: formatCurrency(kpis.totalOrcado), icon: <DollarSign size={22} />, color: 'var(--accent-cyan)', bg: 'rgba(6,182,212,0.1)' },
                  { label: 'Total Recebido', value: formatCurrency(kpis.totalRecebido), icon: <TrendingUp size={22} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' },
                  { label: 'A Receber', value: formatCurrency(kpis.inadimplencia), icon: <TrendingDown size={22} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                  { label: 'Quitados', value: kpis.quitados, icon: <AlertCircle size={22} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)', subtitle: 'procedimentos' },
                  { label: 'Pendentes', value: kpis.pendentes, icon: <AlertCircle size={22} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', subtitle: 'procedimentos' },
                  { label: 'Parciais', value: kpis.parciais, icon: <AlertCircle size={22} />, color: '#38BDF8', bg: 'rgba(56,189,248,0.1)', subtitle: 'procedimentos' },
                ].map((k, i) => (
                  <div key={i} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
                      {k.icon}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{k.label}</p>
                    <p style={{ fontWeight: 700, fontSize: '1.3rem', color: k.color }}>{k.value}</p>
                    {k.subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '-4px' }}>{k.subtitle}</p>}
                  </div>
                ))}
              </div>

              {/* Chart + Filters row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '28px' }}>
                {/* Bar Chart */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>Receitas — Últimos 6 meses</h3>
                  <BarChart data={chartData} />
                </div>

                {/* Filtros rápidos */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Filtros</h3>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.8rem' }}>Mês</label>
                    <input
                      type="month"
                      className="input-field"
                      value={filtroMes}
                      onChange={e => setFiltroMes(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.8rem' }}>Forma de Pagamento</label>
                    <select className="input-field" value={filtroForma} onChange={e => setFiltroForma(e.target.value)}>
                      {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.8rem' }}>Status Paciente</label>
                    <select className="input-field" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                      {['Todos', 'Pendente', 'Parcial', 'Quitado'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '8px' }} onClick={() => { setFiltroForma('Todas'); setFiltroMes(''); setFiltroStatus('Todos'); setSearchQuery(''); }}>
                    Limpar Filtros
                  </button>
                </div>
              </div>

              {/* Busca */}
              <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Buscar por paciente ou procedimento..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '44px' }}
                />
              </div>

              {/* Por Paciente */}
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Resumo por Paciente</h3>
                {patientSummaries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Nenhum paciente com financeiro registrado.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {patientSummaries.map(p => {
                      const isExpanded = expandedPatient === p.id;
                      const statusColor = p.status === 'Quitado' ? 'var(--success)' : p.status === 'Parcial' ? '#38BDF8' : '#F59E0B';
                      const statusBg = p.status === 'Quitado' ? 'rgba(16,185,129,0.1)' : p.status === 'Parcial' ? 'rgba(56,189,248,0.1)' : 'rgba(245,158,11,0.1)';
                      return (
                        <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: '12px' }}
                            onClick={() => setExpandedPatient(isExpanded ? null : p.id)}
                          >
                            <div style={{ flex: 1 }}>
                              <span
                                style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent-cyan)', textDecoration: 'none' }}
                                onClick={e => { e.stopPropagation(); navigate(`/patient/${p.id}`); }}
                              >
                                {p.nomeCompleto}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.9rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Orçado</p>
                                <p style={{ fontWeight: 600 }}>{formatCurrency(p.orcado)}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ color: 'var(--success)', fontSize: '0.75rem' }}>Pago</p>
                                <p style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(p.pago)}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ color: '#F59E0B', fontSize: '0.75rem' }}>Saldo</p>
                                <p style={{ fontWeight: 600, color: '#F59E0B' }}>{formatCurrency(p.saldo)}</p>
                              </div>
                              <span style={{ background: statusBg, color: statusColor, padding: '4px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
                                {p.status}
                              </span>
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 18px' }}>
                              {(p.treatments || []).filter(t => parseFloat(t.valor || 0) > 0).map(t => {
                                const s = calcularStatusPagamento(t);
                                const tPago = (t.payments || []).reduce((a, pay) => a + parseFloat(pay.valor || 0), 0);
                                return (
                                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.88rem' }}>
                                    <div>
                                      <span style={{ fontWeight: 500 }}>{t.procedimento}</span>
                                      {t.dente && <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>Dente {t.dente}</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(t.valor)}</span>
                                      <span style={{ color: 'var(--success)' }}>pago {formatCurrency(tPago)}</span>
                                      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Histórico de pagamentos */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>
                  Histórico de Pagamentos
                  {filteredPayments.length > 0 && (
                    <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.07)', padding: '2px 10px', borderRadius: '20px' }}>
                      {filteredPayments.length} registro{filteredPayments.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                {filteredPayments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Nenhum pagamento encontrado com os filtros selecionados.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          <th style={{ padding: '10px 12px' }}>Data</th>
                          <th style={{ padding: '10px 12px' }}>Paciente</th>
                          <th style={{ padding: '10px 12px' }}>Procedimento</th>
                          <th style={{ padding: '10px 12px' }}>Forma</th>
                          <th style={{ padding: '10px 12px' }}>Observação</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredPayments]
                          .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                          .map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.88rem', transition: 'background 0.15s' }}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{formatDate(p.data)}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                                <span
                                  style={{ color: 'var(--accent-cyan)', cursor: 'pointer' }}
                                  onClick={() => navigate(`/patient/${p.patientId}`)}
                                >
                                  {p.patientName}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>{p.procedimento} {p.dente ? `(D.${p.dente})` : ''}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 10px', borderRadius: '10px', fontSize: '0.8rem' }}>
                                  {p.formaPagamento}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{p.observacao || '-'}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                {formatCurrency(p.valor)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                          <td colSpan={5} style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Total filtrado</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>
                            {formatCurrency(filteredPayments.reduce((a, p) => a + parseFloat(p.valor || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Financeiro;
