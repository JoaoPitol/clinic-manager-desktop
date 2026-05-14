import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Printer, ChevronDown, Copy, BookOpen, ChevronUp } from 'lucide-react';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow() {
  return { id: newId(), dente: '', tratamento: '', valor: '' };
}

function emptyTable(index) {
  return {
    id: newId(),
    titulo: `Orçamento ${index}`,
    rows: [emptyRow()],
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseValor(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildPrintHtml({ clinicNome, patientNome, tabelas }) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  let blocks = '';
  tabelas.forEach((t) => {
    const subtotal = (t.rows || []).reduce((s, r) => s + parseValor(r.valor), 0);
    let rowsHtml = (t.rows || [])
      .map(
        (r, idx) => {
          const bg = idx % 2 === 0 ? '#eeeeee' : '#ffffff';
          return `<tr style="background-color:${bg}"><td style="border:1px solid #333;padding:8px">${escapeHtml(r.dente)}</td><td style="border:1px solid #333;padding:8px">${escapeHtml(r.tratamento)}</td><td style="border:1px solid #333;padding:8px;text-align:right">${escapeHtml(formatMoney(parseValor(r.valor)))}</td></tr>`;
        }
      )
      .join('');
    if (!rowsHtml) {
      rowsHtml = '<tr style="background-color:#eeeeee"><td colspan="3" style="border:1px solid #333;padding:8px;color:#666">(sem linhas)</td></tr>';
    }
    blocks += `
      <section style="margin-bottom:28px;page-break-inside:avoid">
        <h2 style="font-size:13pt;margin:0 0 10px 0;border-bottom:1px solid #333;padding-bottom:4px">${escapeHtml(t.titulo || 'Sem título')}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11pt">
          <thead>
            <tr style="background:#f0f0f0">
              <th style="border:1px solid #333;padding:8px;text-align:left;width:14%">Dente</th>
              <th style="border:1px solid #333;padding:8px;text-align:left">Tratamento a ser realizado</th>
              <th style="border:1px solid #333;padding:8px;text-align:right;width:18%">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="border:1px solid #333;padding:8px;text-align:right;font-weight:bold">Total</td>
              <td style="border:1px solid #333;padding:8px;text-align:right;font-weight:bold">R$ ${escapeHtml(formatMoney(subtotal))}</td>
            </tr>
          </tfoot>
        </table>
      </section>`;
  });

  const textoAutorizacao =
    'Aceito o plano de tratamento acima. Entendo que em circunstâncias especiais, os valores, materiais e forma de tratamento propostos poderão sofrer alterações no seu desenrolar.';

  const blocoAutorizacao = `
  <section class="autorizacao" style="margin-top:36px;padding-top:22px;border-top:2px solid #222;page-break-inside:avoid">
    <h2 style="font-size:13pt;margin:0 0 14px 0">Autorização</h2>
    <p style="font-size:11pt;line-height:1.6;text-align:justify;margin:0 0 32px 0">${escapeHtml(textoAutorizacao)}</p>
    <div style="font-size:11pt;width:100%;display:flex;flex-wrap:wrap;gap:32px;align-items:flex-end">
      <div style="flex:1 1 240px;min-width:200px">
        <p style="margin:0 0 8px 0;font-weight:bold">Assinatura do paciente</p>
        <div style="border-bottom:1px solid #111;min-height:32px;width:100%"></div>
      </div>
      <div style="flex:0 0 180px;width:180px;max-width:100%">
        <p style="margin:0 0 8px 0;font-weight:bold">Data</p>
        <div style="border-bottom:1px solid #111;min-height:32px;width:100%"></div>
      </div>
    </div>
  </section>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Plano de tratamento — ${escapeHtml(patientNome)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; padding: 24px; color: #111; }
    .hdr { margin-bottom: 20px; border-bottom: 2px solid #222; padding-bottom: 12px; }
    .hdr h1 { font-size: 16pt; margin: 0 0 6px 0; }
    .hdr p { margin: 2px 0; font-size: 10pt; color: #444; }
    @media print { body { padding: 12px; } .autorizacao { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="hdr">
    <h1>Plano de tratamento / Orçamento</h1>
    ${clinicNome ? `<p><strong>Clínica:</strong> ${escapeHtml(clinicNome)}</p>` : ''}
    <p><strong>Paciente:</strong> ${escapeHtml(patientNome)}</p>
    <p><strong>Data:</strong> ${escapeHtml(hoje)}</p>
  </div>
  ${blocks}
  ${blocoAutorizacao}
</body>
</html>`;
}

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) {
    alert('Não foi possível abrir a janela de impressão. Verifique o bloqueio de pop-ups.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch (e) {
      console.error(e);
    }
  }, 250);
}

export default function PlanoOrcamentoTabelas({
  patientId,
  patientNome,
  clinicSettings = {},
  tabelas: tabelasProp,
  proceduresLibrary = [],
  onPersist,
}) {
  const tabelasIniciais = Array.isArray(tabelasProp) && tabelasProp.length > 0
    ? tabelasProp.map((t) => ({
        ...t,
        id: t.id || newId(),
        titulo: t.titulo || 'Orçamento',
        rows: (t.rows && t.rows.length ? t.rows : [emptyRow()]).map((r) => ({
          id: r.id || newId(),
          dente: r.dente ?? '',
          tratamento: r.tratamento ?? '',
          valor: r.valor ?? '',
        })),
      }))
    : [];

  const [tabelas, setTabelas] = useState(tabelasIniciais);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  activeIdxRef.current = activeIdx;
  const [saving, setSaving] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [showProcPanel, setShowProcPanel] = useState(false);
  const printWrapRef = useRef(null);

  useEffect(() => {
    const incoming = Array.isArray(tabelasProp) && tabelasProp.length > 0
      ? tabelasProp.map((t) => ({
          ...t,
          id: t.id || newId(),
          titulo: t.titulo || 'Orçamento',
          rows: (t.rows && t.rows.length ? t.rows : [emptyRow()]).map((r) => ({
            id: r.id || newId(),
            dente: r.dente ?? '',
            tratamento: r.tratamento ?? '',
            valor: r.valor ?? '',
          })),
        }))
      : [];
    setTabelas(incoming);
    setActiveIdx((i) => (incoming.length ? Math.min(i, incoming.length - 1) : 0));
  }, [patientId, tabelasProp]);

  useEffect(() => {
    if (!printOpen) return;
    const close = (e) => {
      if (printWrapRef.current && !printWrapRef.current.contains(e.target)) {
        setPrintOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [printOpen]);

  const persist = useCallback(
    async (next) => {
      setSaving(true);
      try {
        await onPersist(next);
      } finally {
        setSaving(false);
      }
    },
    [onPersist]
  );

  const updateTabelas = useCallback(
    (updater) => {
      setTabelas((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const active = tabelas[activeIdx];
  const clinicNome = clinicSettings.nomeClinica || '';

  const totalAtiva = active
    ? active.rows.reduce((s, r) => s + parseValor(r.valor), 0)
    : 0;

  const handleNovaTabela = () => {
    updateTabelas((prev) => {
      const next = [...prev, emptyTable(prev.length + 1)];
      queueMicrotask(() => setActiveIdx(next.length - 1));
      return next;
    });
  };

  const handleRemoverTabela = (idx) => {
    if (!window.confirm('Remover esta tabela e todo o seu conteúdo?')) return;
    const cur = activeIdxRef.current;
    updateTabelas((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      queueMicrotask(() => {
        if (next.length === 0) setActiveIdx(0);
        else if (idx < cur) setActiveIdx(cur - 1);
        else if (idx === cur) setActiveIdx(Math.max(0, cur - 1));
        else setActiveIdx(cur);
      });
      return next;
    });
  };

  const handleTitulo = (titulo) => {
    if (!active) return;
    updateTabelas((prev) =>
      prev.map((t, i) => (i === activeIdx ? { ...t, titulo } : t))
    );
  };

  const handleRowChange = (rowId, field, value) => {
    if (!active) return;

    // Quando o campo "tratamento" muda e bate com um procedimento salvo,
    // auto-preenche o valor padrão (desde que o campo valor esteja vazio).
    if (field === 'tratamento' && proceduresLibrary.length) {
      const match = proceduresLibrary.find(
        (p) => p.nome.toLowerCase() === value.toLowerCase()
      );
      if (match && match.valorPadrao !== '') {
        const currentRow = active.rows.find((r) => r.id === rowId);
        const fillValor = !currentRow?.valor;
        updateTabelas((prev) =>
          prev.map((t, i) => {
            if (i !== activeIdx) return t;
            return {
              ...t,
              rows: t.rows.map((r) =>
                r.id === rowId
                  ? { ...r, tratamento: value, ...(fillValor ? { valor: String(match.valorPadrao) } : {}) }
                  : r
              ),
            };
          })
        );
        return;
      }
    }

    updateTabelas((prev) =>
      prev.map((t, i) => {
        if (i !== activeIdx) return t;
        return {
          ...t,
          rows: t.rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
        };
      })
    );
  };

  const addProcedureRow = (proc) => {
    if (!active) return;
    const newRow = {
      id: newId(),
      dente: '',
      tratamento: proc.nome,
      valor: proc.valorPadrao !== '' ? String(proc.valorPadrao) : '',
    };
    updateTabelas((prev) =>
      prev.map((t, i) =>
        i === activeIdx ? { ...t, rows: [...t.rows, newRow] } : t
      )
    );
  };

  const handleAddRow = () => {
    if (!active) return;
    updateTabelas((prev) =>
      prev.map((t, i) =>
        i === activeIdx ? { ...t, rows: [...t.rows, emptyRow()] } : t
      )
    );
  };

  const handleRemoveRow = (rowId) => {
    if (!active || active.rows.length <= 1) return;
    updateTabelas((prev) =>
      prev.map((t, i) =>
        i === activeIdx
          ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) }
          : t
      )
    );
  };

  const handleDuplicarTabela = () => {
    if (!active) return;
    const source = active;
    updateTabelas((prev) => {
      const copy = {
        id: newId(),
        titulo: `${source.titulo} (cópia)`,
        rows: source.rows.map((r) => ({
          id: newId(),
          dente: r.dente,
          tratamento: r.tratamento,
          valor: r.valor,
        })),
      };
      const next = [...prev, copy];
      queueMicrotask(() => setActiveIdx(next.length - 1));
      return next;
    });
  };

  const imprimir = (modo) => {
    const lista =
      modo === 'todas'
        ? tabelas
        : active
          ? [active]
          : [];
    if (!lista.length) {
      alert('Não há tabela para imprimir.');
      return;
    }
    const html = buildPrintHtml({
      clinicNome,
      patientNome: patientNome || 'Paciente',
      tabelas: lista,
    });
    openPrintWindow(html);
    setPrintOpen(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <ClipboardList size={26} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h2 style={{ fontSize: '1.35rem', margin: '0 0 6px 0' }}>Tabelas de plano e orçamento</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.45 }}>
            Monte orçamentos à parte: várias tabelas, colunas Dente, Tratamento a ser realizado e Valor. Tudo é salvo nesta ficha.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }} ref={printWrapRef}>
            <button
              type="button"
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
              onClick={() => setPrintOpen((o) => !o)}
            >
              <Printer size={18} /> Impressão <ChevronDown size={16} />
            </button>
            {printOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  minWidth: '220px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                  zIndex: 50,
                  padding: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => imprimir('esta')}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: 'transparent', border: 'none', color: 'var(--text-primary)',
                    cursor: 'pointer', borderRadius: '6px', fontSize: '0.88rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Imprimir esta tabela
                </button>
                <button
                  type="button"
                  onClick={() => imprimir('todas')}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: 'transparent', border: 'none', color: 'var(--text-primary)',
                    cursor: 'pointer', borderRadius: '6px', fontSize: '0.88rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Imprimir todas as tabelas
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }} onClick={handleNovaTabela}>
            <Plus size={18} /> Nova tabela
          </button>
        </div>
      </div>

      {tabelas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Nenhuma tabela criada ainda.</p>
          <button type="button" className="btn-primary" onClick={() => { updateTabelas([emptyTable(1)]); setActiveIdx(0); }}>
            <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Criar primeira tabela
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            {tabelas.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: idx === activeIdx ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  background: idx === activeIdx ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: idx === activeIdx ? 600 : 400,
                }}
              >
                {t.titulo || `Tabela ${idx + 1}`}
              </button>
            ))}
          </div>

          {active && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 220px' }}>
                  <span className="input-label" style={{ fontSize: '0.75rem' }}>Título da tabela</span>
                  <input
                    type="text"
                    className="input-field"
                    value={active.titulo}
                    onChange={(e) => handleTitulo(e.target.value)}
                    placeholder="Ex.: Orçamento inicial, Revisão 2026…"
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }} onClick={handleDuplicarTabela}>
                    <Copy size={16} /> Duplicar tabela
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.35)' }}
                    onClick={() => handleRemoverTabela(activeIdx)}
                  >
                    <Trash2 size={16} /> Remover tabela
                  </button>
                </div>
              </div>

              {/* datalist para autocomplete dos procedimentos salvos */}
              {proceduresLibrary.length > 0 && (
                <datalist id="proc-lib-datalist">
                  {proceduresLibrary.map((p) => (
                    <option key={p.id} value={p.nome} />
                  ))}
                </datalist>
              )}

              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      <th style={{ padding: '12px 14px', width: '100px' }}>Dente</th>
                      <th style={{ padding: '12px 14px' }}>Tratamento a ser realizado</th>
                      <th style={{ padding: '12px 14px', width: '130px' }}>Valor (R$)</th>
                      <th style={{ padding: '12px 14px', width: '56px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {active.rows.map((r, idx) => (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          background: idx % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.11)',
                        }}
                      >
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            className="input-field"
                            style={{ padding: '8px 10px' }}
                            value={r.dente}
                            onChange={(e) => handleRowChange(r.id, 'dente', e.target.value)}
                            placeholder="Ex.: 16"
                          />
                        </td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            list={proceduresLibrary.length ? 'proc-lib-datalist' : undefined}
                            className="input-field"
                            style={{ padding: '8px 10px' }}
                            value={r.tratamento}
                            onChange={(e) => handleRowChange(r.id, 'tratamento', e.target.value)}
                            placeholder="Descrição do tratamento"
                          />
                        </td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input-field"
                            style={{ padding: '8px 10px' }}
                            value={r.valor}
                            onChange={(e) => handleRowChange(r.id, 'valor', e.target.value)}
                            placeholder="0,00"
                          />
                        </td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            title="Remover linha"
                            onClick={() => handleRemoveRow(r.id)}
                            disabled={active.rows.length <= 1}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: active.rows.length <= 1 ? 'var(--text-secondary)' : 'var(--error)',
                              cursor: active.rows.length <= 1 ? 'not-allowed' : 'pointer',
                              padding: '6px',
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(6, 182, 212, 0.08)' }}>
                      <td colSpan={2} style={{ padding: '14px', textAlign: 'right', fontWeight: 700 }}>
                        Total desta tabela
                      </td>
                      <td style={{ padding: '14px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        R$ {formatMoney(totalAtiva)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleAddRow}>
                    <Plus size={18} /> Adicionar linha vazia
                  </button>
                  {proceduresLibrary.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        borderColor: showProcPanel ? 'rgba(99,179,237,0.5)' : undefined,
                        background: showProcPanel ? 'rgba(99,179,237,0.1)' : undefined,
                        color: showProcPanel ? 'var(--accent-cyan)' : undefined,
                      }}
                      onClick={() => setShowProcPanel((v) => !v)}
                    >
                      <BookOpen size={16} />
                      Da lista de procedimentos
                      {showProcPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
                {saving && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Salvando…</span>}
              </div>

              {/* Painel de procedimentos salvos */}
              {showProcPanel && proceduresLibrary.length > 0 && (
                <div style={{
                  marginTop: '10px',
                  padding: '14px 16px',
                  background: 'rgba(99,179,237,0.06)',
                  border: '1px solid rgba(99,179,237,0.2)',
                  borderRadius: '10px',
                }}>
                  <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Clique em um procedimento para adicionar uma nova linha pré-preenchida nesta tabela:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {proceduresLibrary.map((proc) => (
                      <button
                        key={proc.id}
                        type="button"
                        onClick={() => addProcedureRow(proc)}
                        style={{
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(99,179,237,0.15)';
                          e.currentTarget.style.borderColor = 'rgba(99,179,237,0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                      >
                        <Plus size={13} />
                        <span>{proc.nome}</span>
                        {proc.valorPadrao !== '' && (
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                            R$ {parseFloat(proc.valorPadrao).toFixed(2)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
