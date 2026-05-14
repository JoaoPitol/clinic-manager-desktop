import React, { useCallback, useRef, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import api from '../services/api';
import DateInputBr from './DateInputBr';
import { todayIso } from '../utils/dateBr';

function newRowId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fe_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ficha de evolução: tabela editável (Data + Tratamento realizado) por consulta.
 * Dados em patient.fichaEvolucao: { id, data, tratamentoRealizado }[]
 */
export default function FichaEvolucao({ patientId, rows, onRowsUpdated }) {
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const persist = useCallback(
    async (nextRows) => {
      try {
        await api.put(`/patients/${patientId}`, { fichaEvolucao: nextRows });
        onRowsUpdated(nextRows);
      } catch (err) {
        console.error('Erro ao salvar ficha de evolução', err);
        alert('Não foi possível salvar a ficha de evolução.');
      }
    },
    [patientId, onRowsUpdated]
  );

  const debounceRef = useRef(null);
  const schedulePersistTratamento = useCallback(
    (rowId, tratamentoRealizado) => {
      const base = rowsRef.current || [];
      const next = base.map((r) =>
        r.id === rowId ? { ...r, tratamentoRealizado } : r
      );
      rowsRef.current = next;
      onRowsUpdated(next);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persist(next);
      }, 450);
    },
    [onRowsUpdated, persist]
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleAddRow = () => {
    const today = todayIso();
    const next = [...(rowsRef.current || []), { id: newRowId(), data: today, tratamentoRealizado: '' }];
    rowsRef.current = next;
    persist(next);
  };

  const handleDataChange = (rowId, data) => {
    const next = (rowsRef.current || []).map((r) => (r.id === rowId ? { ...r, data } : r));
    rowsRef.current = next;
    persist(next);
  };

  const handleTratamentoChange = (rowId, value) => {
    schedulePersistTratamento(rowId, value);
  };

  const handleTratamentoBlur = (rowId, value) => {
    clearTimeout(debounceRef.current);
    const next = (rowsRef.current || []).map((r) =>
      r.id === rowId ? { ...r, tratamentoRealizado: value } : r
    );
    rowsRef.current = next;
    persist(next);
  };

  const handleDelete = (rowId) => {
    if (!window.confirm('Remover este registro da ficha de evolução?')) return;
    const next = (rowsRef.current || []).filter((r) => r.id !== rowId);
    rowsRef.current = next;
    persist(next);
  };

  const moveRow = (index, dir) => {
    const list = [...(rowsRef.current || [])];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    rowsRef.current = list;
    persist(list);
  };

  const list = rows || [];

  return (
    <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '10px' }}>
        <ClipboardList size={26} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 6px' }}>Ficha de evolução</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, lineHeight: 1.45 }}>
            Registre a <strong>data</strong> e o <strong>tratamento realizado</strong> após cada consulta. Adicione linhas
            conforme necessário; a ordem pode ser ajustada com as setas.
          </p>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '520px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              <th style={{ padding: '10px 8px', width: '44px' }} aria-label="Ordem" />
              <th style={{ padding: '10px 12px', width: '160px' }}>Data</th>
              <th style={{ padding: '10px 12px' }}>Tratamento realizado</th>
              <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)' }}>
                  Nenhum registro ainda. Use &quot;Adicionar consulta&quot; para criar a primeira linha.
                </td>
              </tr>
            ) : (
              list.map((row, index) => (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        type="button"
                        title="Mover para cima"
                        onClick={() => moveRow(index, -1)}
                        disabled={index === 0}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          color: index === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                          padding: '2px',
                          opacity: index === 0 ? 0.35 : 1,
                        }}
                      >
                        <ChevronUp size={18} />
                      </button>
                      <button
                        type="button"
                        title="Mover para baixo"
                        onClick={() => moveRow(index, 1)}
                        disabled={index === list.length - 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: index === list.length - 1 ? 'not-allowed' : 'pointer',
                          color: index === list.length - 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                          padding: '2px',
                          opacity: index === list.length - 1 ? 0.35 : 1,
                        }}
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <DateInputBr
                      className="input-field"
                      value={row.data || ''}
                      onChange={(iso) => handleDataChange(row.id, iso)}
                      style={{ width: '100%', minWidth: '130px' }}
                      required
                    />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="Descreva o que foi feito nesta consulta (ex.: remoção de cárie 36, profilaxia, orientações…)"
                      value={row.tratamentoRealizado ?? ''}
                      onChange={(e) => handleTratamentoChange(row.id, e.target.value)}
                      onBlur={(e) => handleTratamentoBlur(row.id, e.target.value)}
                      style={{ width: '100%', resize: 'vertical', minHeight: '72px', fontFamily: 'inherit' }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      type="button"
                      title="Remover linha"
                      onClick={() => handleDelete(row.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        color: 'var(--error)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAddRow}
        className="btn-secondary"
        style={{
          marginTop: '16px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
        }}
      >
        <Plus size={18} />
        Adicionar consulta
      </button>
    </div>
  );
}
