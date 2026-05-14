import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  Filter, Calendar, Search, Users, ChevronDown, ChevronUp, Settings,
  Download, Plus, Trash2, Wallet, PieChart, Receipt, Pencil, Check, X as XIcon,
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

const EXPENSE_CATS = [
  'Materiais e Insumos',
  'Salários e Honorários',
  'Aluguel',
  'Contas (Água/Luz/Internet)',
  'Equipamentos',
  'Marketing',
  'Impostos e Taxas',
  'Outros',
];

const CAT_COLOR = {
  'Materiais e Insumos': '#06B6D4',
  'Salários e Honorários': '#8B5CF6',
  'Aluguel': '#F59E0B',
  'Contas (Água/Luz/Internet)': '#3B82F6',
  'Equipamentos': '#10B981',
  'Marketing': '#EC4899',
  'Impostos e Taxas': '#EF4444',
  'Outros': '#94A3B8',
};

const FORMA_COLOR = {
  PIX: '#00B4D8',
  Dinheiro: '#10B981',
  'Cartão de Crédito': '#8B5CF6',
  'Cartão de Débito': '#3B82F6',
  Boleto: '#F59E0B',
  Convênio: '#EC4899',
};

// ── mini bar chart ────────────────────────────────────────────────────────────
const formatChartVal = (val) => {
  if (val === 0) return '';
  if (val >= 1000) return `R$${(val / 1000).toFixed(1)}k`;
  return `R$${val.toFixed(0)}`;
};

const BarChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.valor), 1);
  const BAR_H = 90;
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', height: `${BAR_H}px`, alignItems: 'flex-end' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '3px' }}>
            <span style={{ fontSize: '0.6rem', color: d.atual ? 'var(--accent-cyan)' : d.valor > 0 ? 'var(--text-secondary)' : 'transparent', fontWeight: d.atual ? 700 : 400, whiteSpace: 'nowrap', lineHeight: 1 }}>
              {formatChartVal(d.valor)}
            </span>
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
                outline: d.selecionado ? '2px solid var(--accent-cyan)' : 'none',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: d.atual || d.selecionado ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: d.atual || d.selecionado ? 600 : 400 }}>{d.mes}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── donut chart ───────────────────────────────────────────────────────────────
const DonutChart = ({ data, total, centerLabel = 'total' }) => {
  if (!total || data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0', fontSize: '0.85rem' }}>Sem dados para o período</div>;
  }
  const R = 50, CX = 70, CY = 70, SW = 22;
  const circumference = 2 * Math.PI * R;
  let cumAngle = -90;
  const segments = data.map(d => {
    const pct = d.valor / total;
    const angle = cumAngle;
    cumAngle += pct * 360;
    return { ...d, pct, angle, dasharray: `${pct * circumference} ${circumference}` };
  });
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={SW} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeDasharray={s.dasharray}
            style={{ transform: `rotate(${s.angle}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: 'stroke-dasharray 0.6s' }}
          />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700" fontFamily="Outfit, sans-serif">
          {total >= 1000 ? `R$${(total / 1000).toFixed(1)}k` : formatCurrency(total)}
        </text>
        <text x={CX} y={CY + 11} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="Outfit, sans-serif">
          {centerLabel}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: 0 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.forma || s.categoria}</span>
            <span style={{ fontWeight: 600, color: s.color, flexShrink: 0 }}>{(s.pct * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
const Financeiro = () => {
  const navigate = useNavigate();
  const clinicId = localStorage.getItem('@ClinicManager:token');
  const [patients, setPatients] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('receitas');

  // filters (shared)
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroForma, setFiltroForma] = useState('Todas');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [expandedPatient, setExpandedPatient] = useState(null);

  // expense form
  const [novaCategoria, setNovaCategoria] = useState(EXPENSE_CATS[0]);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaDataExp, setNovaDataExp] = useState(new Date().toISOString().split('T')[0]);
  const [novoValorExp, setNovoValorExp] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [expSearchQuery, setExpSearchQuery] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);

  const clinicName = localStorage.getItem('@ClinicManager:nome') || 'ClinicManager';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [pRes, expRes] = await Promise.all([
          api.get('/patients'),
          window.electronAPI?.getExpenses(clinicId) ?? Promise.resolve([]),
        ]);
        setPatients(pRes.data);
        setExpenses(Array.isArray(expRes) ? expRes : []);
      } catch (err) {
        console.error('Erro ao buscar dados financeiros', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [clinicId]);

  // ── derived data ─────────────────────────────────────────────────────────
  const allTreatments = useMemo(() => {
    const result = [];
    patients.forEach(p => {
      (p.treatments || []).forEach(t => {
        result.push({ ...t, patientName: p.nomeCompleto, patientId: p.id });
      });
    });
    return result;
  }, [patients]);

  const allPayments = useMemo(() => {
    const result = [];
    allTreatments.forEach(t => {
      (t.payments || []).forEach(p => {
        result.push({ ...p, procedimento: t.procedimento, dente: t.dente, patientName: t.patientName, patientId: t.patientId });
      });
    });
    return result;
  }, [allTreatments]);

  // Per-patient status map (unfiltered) — used to consistently apply filtroStatus to history
  const patientStatusMap = useMemo(() => {
    const map = {};
    patients.forEach(p => {
      const ts = p.treatments || [];
      const orcado = ts.reduce((a, t) => a + parseFloat(t.valor || 0), 0);
      const pago = ts.reduce((a, t) => (t.payments || []).reduce((b, pay) => b + parseFloat(pay.valor || 0), 0) + a, 0);
      const saldo = Math.max(0, orcado - pago);
      map[p.id] = saldo === 0 && orcado > 0 ? 'Quitado' : pago > 0 ? 'Parcial' : 'Pendente';
    });
    return map;
  }, [patients]);

  // ── fixed filteredPayments — applies ALL filters including filtroStatus ──
  const filteredPayments = useMemo(() => {
    return allPayments.filter(p => {
      if (filtroForma !== 'Todas' && p.formaPagamento !== filtroForma) return false;
      if (filtroMes && !p.data?.startsWith(filtroMes)) return false;
      if (filtroStatus !== 'Todos' && patientStatusMap[p.patientId] !== filtroStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.patientName?.toLowerCase().includes(q) && !p.procedimento?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allPayments, filtroForma, filtroMes, filtroStatus, searchQuery, patientStatusMap]);

  // ── fixed KPIs — A Receber exclui tratamentos Planejados ─────────────────
  const kpis = useMemo(() => {
    const totalOrcado = allTreatments.reduce((a, t) => a + parseFloat(t.valor || 0), 0);
    const totalRecebido = allPayments.reduce((a, p) => a + parseFloat(p.valor || 0), 0);
    // A Receber: somente tratamentos Em Andamento ou Concluído
    const totalDevido = allTreatments
      .filter(t => t.status === 'Em Andamento' || t.status === 'Concluído')
      .reduce((a, t) => a + parseFloat(t.valor || 0), 0);
    const aReceber = Math.max(0, totalDevido - totalRecebido);
    const quitados = allTreatments.filter(t => calcularStatusPagamento(t).label === 'Quitado').length;
    const pendentes = allTreatments.filter(t => calcularStatusPagamento(t).label === 'Pendente').length;
    const parciais  = allTreatments.filter(t => calcularStatusPagamento(t).label === 'Parcial').length;
    return { totalOrcado, totalRecebido, aReceber, quitados, pendentes, parciais };
  }, [allTreatments, allPayments]);

  // ── period KPIs (based on filtroMes or current month) ────────────────────
  const periodKpis = useMemo(() => {
    const period = filtroMes || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const despesasPeriodo = expenses
      .filter(e => (e.data || '').startsWith(period))
      .reduce((a, e) => a + parseFloat(e.valor || 0), 0);
    const receitasPeriodo = allPayments
      .filter(p => (p.data || '').startsWith(period))
      .reduce((a, p) => a + parseFloat(p.valor || 0), 0);
    return { despesasPeriodo, receitasPeriodo, lucroLiquido: receitasPeriodo - despesasPeriodo };
  }, [expenses, allPayments, filtroMes]);

  // ── monthly chart data — highlights selected month if in range ────────────
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
      const selecionado = filtroMes === key;
      return { mes: MESES[d.getMonth()], valor, atual: i === 5 && !filtroMes, selecionado };
    });
  }, [allPayments, filtroForma, filtroMes]);

  // ── payment method distribution ───────────────────────────────────────────
  const paymentDistribution = useMemo(() => {
    const map = {};
    filteredPayments.forEach(p => {
      const key = p.formaPagamento || 'Outros';
      map[key] = (map[key] || 0) + parseFloat(p.valor || 0);
    });
    const total = Object.values(map).reduce((a, v) => a + v, 0);
    return {
      total,
      items: Object.entries(map)
        .map(([forma, valor]) => ({ forma, valor, color: FORMA_COLOR[forma] || '#94A3B8' }))
        .sort((a, b) => b.valor - a.valor),
    };
  }, [filteredPayments]);

  // ── per-patient summary ───────────────────────────────────────────────────
  const patientSummaries = useMemo(() => {
    return patients.map(p => {
      const ts = p.treatments || [];
      const orcado = ts.reduce((a, t) => a + parseFloat(t.valor || 0), 0);
      const pago = ts.reduce((a, t) => {
        const pags = (t.payments || []).filter(pay => {
          if (filtroForma !== 'Todas' && pay.formaPagamento !== filtroForma) return false;
          if (filtroMes && !(pay.data || '').startsWith(filtroMes)) return false;
          return true;
        });
        return a + pags.reduce((b, pay) => b + parseFloat(pay.valor || 0), 0);
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

  // ── filtered expenses ─────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (filtroMes && !(e.data || '').startsWith(filtroMes)) return false;
      if (expSearchQuery) {
        const q = expSearchQuery.toLowerCase();
        if (!e.descricao?.toLowerCase().includes(q) && !e.categoria?.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [expenses, filtroMes, expSearchQuery]);

  const expenseDistribution = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      const key = e.categoria || 'Outros';
      map[key] = (map[key] || 0) + parseFloat(e.valor || 0);
    });
    const total = Object.values(map).reduce((a, v) => a + v, 0);
    return {
      total,
      items: Object.entries(map)
        .map(([categoria, valor]) => ({ categoria, valor, color: CAT_COLOR[categoria] || '#94A3B8' }))
        .sort((a, b) => b.valor - a.valor),
    };
  }, [filteredExpenses]);

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Data', 'Paciente', 'Procedimento', 'Dente', 'Forma', 'Observação', 'Valor'];
    const rows = [...filteredPayments]
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .map(p => [
        formatDate(p.data),
        p.patientName || '',
        p.procedimento || '',
        p.dente || '',
        p.formaPagamento || '',
        p.observacao || '',
        parseFloat(p.valor || 0).toFixed(2).replace('.', ','),
      ]);
    const BOM = '\uFEFF';
    const content = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receitas_${filtroMes || new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportExpensesCSV = () => {
    const headers = ['Data', 'Categoria', 'Descrição', 'Valor'];
    const rows = filteredExpenses.map(e => [
      formatDate(e.data),
      e.categoria || '',
      e.descricao || '',
      parseFloat(e.valor || 0).toFixed(2).replace('.', ','),
    ]);
    const BOM = '\uFEFF';
    const content = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despesas_${filtroMes || new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── expense CRUD ──────────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    const valor = parseFloat(novoValorExp.replace(',', '.'));
    if (!valor || valor <= 0) { alert('Informe um valor válido.'); return; }
    if (!novaDescricao.trim()) { alert('Informe uma descrição.'); return; }
    setSavingExpense(true);
    try {
      const result = await window.electronAPI.addExpense(clinicId, {
        data: novaDataExp,
        categoria: novaCategoria,
        descricao: novaDescricao.trim(),
        valor,
      });
      if (result?.success) {
        setExpenses(prev => [...prev, result.expense]);
        setNovaDescricao('');
        setNovoValorExp('');
        setNovaDataExp(new Date().toISOString().split('T')[0]);
      }
    } catch (err) {
      console.error('Erro ao adicionar despesa', err);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Remover esta despesa?')) return;
    const result = await window.electronAPI.deleteExpense(clinicId, expenseId);
    if (result?.success) setExpenses(prev => prev.filter(e => e.id !== expenseId));
  };

  const handleSaveEditExpense = async () => {
    if (!editingExpense) return;
    const valor = parseFloat(String(editingExpense.valor).replace(',', '.'));
    if (!valor || valor <= 0) { alert('Valor inválido.'); return; }
    const result = await window.electronAPI.updateExpense(clinicId, editingExpense.id, {
      ...editingExpense, valor,
    });
    if (result?.success) {
      setExpenses(prev => prev.map(e => e.id === result.expense.id ? result.expense : e));
      setEditingExpense(null);
    }
  };

  // ── shared sidebar + filters ──────────────────────────────────────────────
  const Sidebar = (
    <aside className="glass-panel" style={{ width: '260px', margin: '16px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{clinicName}</h2>
      </div>
      <nav style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { label: 'Pacientes', path: '/dashboard', icon: <Users size={20} /> },
          { label: 'Agenda', path: '/schedule', icon: <Calendar size={20} /> },
          { label: 'Financeiro', path: '/financeiro', icon: <DollarSign size={20} />, active: true },
          { label: 'Configurações', path: '/settings', icon: <Settings size={20} /> },
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
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      {Sidebar}

      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 32px 16px' }}>
        <div className="animate-fade-in">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Financeiro</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Controle completo de receitas, despesas e resultado da clínica.</p>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>Carregando dados financeiros...</div>
          ) : (
            <>
              {/* KPI row 1 — totais gerais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                {[
                  { label: 'Total Orçado', value: formatCurrency(kpis.totalOrcado), icon: <DollarSign size={20} />, color: 'var(--accent-cyan)', bg: 'rgba(6,182,212,0.1)' },
                  { label: 'Total Recebido', value: formatCurrency(kpis.totalRecebido), icon: <TrendingUp size={20} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' },
                  { label: 'A Receber', value: formatCurrency(kpis.aReceber), icon: <TrendingDown size={20} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', hint: 'Tratamentos em andamento ou concluídos com saldo pendente' },
                  { label: 'Quitados', value: kpis.quitados, icon: <AlertCircle size={20} />, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)', sub: 'procedimentos' },
                  { label: 'Pendentes', value: kpis.pendentes, icon: <AlertCircle size={20} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', sub: 'procedimentos' },
                  { label: 'Parciais', value: kpis.parciais, icon: <AlertCircle size={20} />, color: '#38BDF8', bg: 'rgba(56,189,248,0.1)', sub: 'procedimentos' },
                ].map((k, i) => (
                  <div key={i} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }} title={k.hint || ''}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{k.label}</p>
                    <p style={{ fontWeight: 700, fontSize: '1.25rem', color: k.color }}>{k.value}</p>
                    {k.sub && <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '-2px' }}>{k.sub}</p>}
                  </div>
                ))}
              </div>

              {/* KPI row 2 — período (receitas vs despesas) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: `Receitas ${filtroMes ? 'do mês' : '(mês atual)'}`, value: formatCurrency(periodKpis.receitasPeriodo), color: 'var(--success)', bg: 'rgba(16,185,129,0.1)', icon: <TrendingUp size={20} /> },
                  { label: `Despesas ${filtroMes ? 'do mês' : '(mês atual)'}`, value: formatCurrency(periodKpis.despesasPeriodo), color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: <Wallet size={20} /> },
                  {
                    label: `Lucro Líquido ${filtroMes ? 'do mês' : '(mês atual)'}`,
                    value: formatCurrency(periodKpis.lucroLiquido),
                    color: periodKpis.lucroLiquido >= 0 ? 'var(--success)' : '#EF4444',
                    bg: periodKpis.lucroLiquido >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    icon: <Receipt size={20} />,
                  },
                ].map((k, i) => (
                  <div key={i} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{k.label}</p>
                    <p style={{ fontWeight: 700, fontSize: '1.25rem', color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Filters panel */}
              <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.78rem' }}>Mês</label>
                    <input type="month" className="input-field" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ width: '160px' }} />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.78rem' }}>Forma de Pagamento</label>
                    <select className="input-field" value={filtroForma} onChange={e => setFiltroForma(e.target.value)} style={{ width: '180px' }}>
                      {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.78rem' }}>Status Paciente</label>
                    <select className="input-field" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: '140px' }}>
                      {['Todos', 'Pendente', 'Parcial', 'Quitado'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: '0.83rem', padding: '9px 16px', height: '42px' }} onClick={() => { setFiltroForma('Todas'); setFiltroMes(''); setFiltroStatus('Todos'); setSearchQuery(''); setExpSearchQuery(''); }}>
                    <Filter size={14} style={{ marginRight: '6px' }} />Limpar
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
                {[
                  { id: 'receitas', label: 'Receitas', icon: <TrendingUp size={15} /> },
                  { id: 'despesas', label: 'Despesas', icon: <Wallet size={15} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '9px 22px', borderRadius: '8px', border: 'none',
                      background: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                      color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400,
                      fontSize: '0.9rem', transition: 'all 0.2s',
                    }}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* ── TAB: RECEITAS ─────────────────────────────────────────── */}
              {activeTab === 'receitas' && (
                <>
                  {/* Chart + Donut row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '24px' }}>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
                        Receitas — Últimos 6 meses
                        {filtroForma !== 'Todas' && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>· {filtroForma}</span>}
                      </h3>
                      <BarChart data={chartData} />
                    </div>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PieChart size={16} /> Por Forma
                      </h3>
                      <DonutChart data={paymentDistribution.items} total={paymentDistribution.total} centerLabel="recebido" />
                    </div>
                  </div>

                  {/* Busca */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
                      <Search size={17} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-secondary)' }} />
                      <input type="text" className="input-field" placeholder="Buscar por paciente ou procedimento..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: '42px' }} />
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ padding: '9px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
                      onClick={exportCSV}
                      title="Exportar histórico filtrado como CSV"
                    >
                      <Download size={16} /> Exportar CSV
                    </button>
                  </div>

                  {/* Resumo por Paciente */}
                  <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Resumo por Paciente</h3>
                    {patientSummaries.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Nenhum paciente com financeiro registrado.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {patientSummaries.map(p => {
                          const isExpanded = expandedPatient === p.id;
                          const sc = p.status === 'Quitado' ? 'var(--success)' : p.status === 'Parcial' ? '#38BDF8' : '#F59E0B';
                          const sb = p.status === 'Quitado' ? 'rgba(16,185,129,0.1)' : p.status === 'Parcial' ? 'rgba(56,189,248,0.1)' : 'rgba(245,158,11,0.1)';
                          return (
                            <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: '12px' }} onClick={() => setExpandedPatient(isExpanded ? null : p.id)}>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent-cyan)' }} onClick={e => { e.stopPropagation(); navigate(`/patient/${p.id}`); }}>{p.nomeCompleto}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.9rem' }}>
                                  <div style={{ textAlign: 'right' }}><p style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>Orçado</p><p style={{ fontWeight: 600 }}>{formatCurrency(p.orcado)}</p></div>
                                  <div style={{ textAlign: 'right' }}><p style={{ color: 'var(--success)', fontSize: '0.73rem' }}>Pago</p><p style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(p.pago)}</p></div>
                                  <div style={{ textAlign: 'right' }}><p style={{ color: '#F59E0B', fontSize: '0.73rem' }}>Em Débito</p><p style={{ fontWeight: 600, color: '#F59E0B' }}>{formatCurrency(p.saldo)}</p></div>
                                  <span style={{ background: sb, color: sc, padding: '4px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>{p.status}</span>
                                  {isExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                                </div>
                              </div>
                              {isExpanded && (
                                <div style={{ borderTop: '1px solid var(--border-color)', padding: '14px 18px' }}>
                                  {(p.treatments || []).filter(t => parseFloat(t.valor || 0) > 0).map(t => {
                                    const s = calcularStatusPagamento(t);
                                    const tPago = (t.payments || []).reduce((a, pay) => a + parseFloat(pay.valor || 0), 0);
                                    return (
                                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem' }}>
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
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      Histórico de Pagamentos
                      {filteredPayments.length > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.07)', padding: '2px 10px', borderRadius: '20px' }}>
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
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
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
                                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem', transition: 'background 0.15s' }}
                                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{formatDate(p.data)}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                                    <span style={{ color: 'var(--accent-cyan)', cursor: 'pointer' }} onClick={() => navigate(`/patient/${p.patientId}`)}>{p.patientName}</span>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>{p.procedimento}{p.dente ? ` (D.${p.dente})` : ''}</td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span style={{ background: `${FORMA_COLOR[p.formaPagamento] || 'rgba(255,255,255,0.07)'}22`, color: FORMA_COLOR[p.formaPagamento] || 'var(--text-secondary)', border: `1px solid ${FORMA_COLOR[p.formaPagamento] || 'transparent'}44`, padding: '2px 10px', borderRadius: '10px', fontSize: '0.78rem' }}>
                                      {p.formaPagamento}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{p.observacao || '-'}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.valor)}</td>
                                </tr>
                              ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                              <td colSpan={5} style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.87rem' }}>Total filtrado</td>
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

              {/* ── TAB: DESPESAS ─────────────────────────────────────────── */}
              {activeTab === 'despesas' && (
                <>
                  {/* Add expense form */}
                  <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '18px' }}>Registrar Despesa</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 160px auto', gap: '12px', alignItems: 'flex-end' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.78rem' }}>Categoria</label>
                        <select className="input-field" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}>
                          {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.78rem' }}>Descrição</label>
                        <input className="input-field" type="text" placeholder="Ex: Resina composta A1" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddExpense()} />
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.78rem' }}>Data</label>
                        <input className="input-field" type="date" value={novaDataExp} onChange={e => setNovaDataExp(e.target.value)} />
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.78rem' }}>Valor (R$)</label>
                        <input className="input-field" type="number" placeholder="0,00" min="0" step="0.01" value={novoValorExp} onChange={e => setNovoValorExp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddExpense()} />
                      </div>
                      <button
                        className="btn-primary"
                        style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
                        onClick={handleAddExpense}
                        disabled={savingExpense}
                      >
                        <Plus size={17} /> {savingExpense ? 'Salvando...' : 'Adicionar'}
                      </button>
                    </div>
                  </div>

                  {/* Donut + search row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '24px' }}>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Search size={15} /> Buscar
                        </h3>
                        <button className="btn-secondary" style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={exportExpensesCSV}>
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Search size={17} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-secondary)' }} />
                        <input type="text" className="input-field" placeholder="Buscar por descrição ou categoria..." value={expSearchQuery} onChange={e => setExpSearchQuery(e.target.value)} style={{ paddingLeft: '42px' }} />
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.83rem' }}>
                        <span>{filteredExpenses.length} despesa{filteredExpenses.length !== 1 ? 's' : ''}</span>
                        <span style={{ fontWeight: 700, color: '#EF4444' }}>{formatCurrency(filteredExpenses.reduce((a, e) => a + parseFloat(e.valor || 0), 0))}</span>
                      </div>
                    </div>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PieChart size={16} /> Por Categoria
                      </h3>
                      <DonutChart data={expenseDistribution.items} total={expenseDistribution.total} centerLabel="despesas" />
                    </div>
                  </div>

                  {/* Expenses table */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Histórico de Despesas</h3>
                    {filteredExpenses.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                        <Wallet size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <p>Nenhuma despesa registrada{filtroMes ? ' neste período' : ''}.</p>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                              <th style={{ padding: '10px 12px' }}>Data</th>
                              <th style={{ padding: '10px 12px' }}>Categoria</th>
                              <th style={{ padding: '10px 12px' }}>Descrição</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor</th>
                              <th style={{ padding: '10px 12px', width: '80px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExpenses.map(e => (
                              <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem', transition: 'background 0.15s' }}
                                onMouseOver={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseOut={ev => ev.currentTarget.style.background = 'transparent'}
                              >
                                {editingExpense?.id === e.id ? (
                                  <>
                                    <td style={{ padding: '8px 12px' }}>
                                      <input type="date" className="input-field" style={{ padding: '4px 8px', fontSize: '0.82rem' }} value={editingExpense.data || ''} onChange={ev => setEditingExpense(p => ({ ...p, data: ev.target.value }))} />
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <select className="input-field" style={{ padding: '4px 8px', fontSize: '0.82rem' }} value={editingExpense.categoria || ''} onChange={ev => setEditingExpense(p => ({ ...p, categoria: ev.target.value }))}>
                                        {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <input type="text" className="input-field" style={{ padding: '4px 8px', fontSize: '0.82rem' }} value={editingExpense.descricao || ''} onChange={ev => setEditingExpense(p => ({ ...p, descricao: ev.target.value }))} />
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                      <input type="number" className="input-field" style={{ padding: '4px 8px', fontSize: '0.82rem', textAlign: 'right', width: '100px' }} value={editingExpense.valor || ''} onChange={ev => setEditingExpense(p => ({ ...p, valor: ev.target.value }))} />
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={handleSaveEditExpense} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--success)' }} title="Confirmar"><Check size={15} /></button>
                                        <button onClick={() => setEditingExpense(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Cancelar"><XIcon size={15} /></button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{formatDate(e.data)}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{ background: `${CAT_COLOR[e.categoria] || '#94A3B8'}22`, color: CAT_COLOR[e.categoria] || '#94A3B8', border: `1px solid ${CAT_COLOR[e.categoria] || '#94A3B8'}44`, padding: '2px 10px', borderRadius: '10px', fontSize: '0.78rem' }}>
                                        {e.categoria}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>{e.descricao || '-'}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>{formatCurrency(e.valor)}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={() => setEditingExpense({ ...e })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.15s' }} onMouseOver={ev => ev.currentTarget.style.color = 'var(--accent-cyan)'} onMouseOut={ev => ev.currentTarget.style.color = 'var(--text-secondary)'} title="Editar"><Pencil size={14} /></button>
                                        <button onClick={() => handleDeleteExpense(e.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.15s' }} onMouseOver={ev => ev.currentTarget.style.color = 'var(--error)'} onMouseOut={ev => ev.currentTarget.style.color = 'var(--text-secondary)'} title="Remover"><Trash2 size={14} /></button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                              <td colSpan={3} style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.87rem' }}>Total filtrado</td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#EF4444' }}>
                                {formatCurrency(filteredExpenses.reduce((a, e) => a + parseFloat(e.valor || 0), 0))}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Financeiro;
