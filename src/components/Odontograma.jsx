import React, { useState, useCallback } from 'react';
import { Save, RotateCcw, MessageSquare, X, CheckCircle } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const CONDITIONS = [
  { id: 'sadio',       label: 'Hígido',             color: 'transparent',          border: 'rgba(255,255,255,0.25)' },
  { id: 'carie',       label: 'Cárie',               color: '#EF4444',              border: '#EF4444' },
  { id: 'restauracao', label: 'Restauração',          color: '#3B82F6',              border: '#3B82F6' },
  { id: 'coroa',       label: 'Coroa / Prótese',      color: '#F59E0B',              border: '#F59E0B' },
  { id: 'endodontia',  label: 'Endodontia',           color: '#10B981',              border: '#10B981' },
  { id: 'implante',    label: 'Implante',             color: '#8B5CF6',              border: '#8B5CF6' },
  { id: 'extracao',    label: 'Extração Indicada',    color: '#F97316',              border: '#F97316' },
  { id: 'ausente',     label: 'Dente Ausente',        color: '#374151',              border: '#6B7280' },
  { id: 'planejar',    label: 'A Tratar',             color: '#06B6D4',              border: '#06B6D4' },
];

const FACE_LABELS = { vestibular: 'V', lingual: 'L', mesial: 'M', distal: 'D', oclusal: 'O' };

// FDI layout
const ADULT_UPPER   = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const ADULT_LOWER   = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const DEC_UPPER     = [55,54,53,52,51,61,62,63,64,65];
const DEC_LOWER     = [85,84,83,82,81,71,72,73,74,75];

const getColor = (id) => (CONDITIONS.find(c => c.id === id)?.color ?? 'transparent');

// ─── Tooth SVG ───────────────────────────────────────────────────────────────

const S = 46; // tooth canvas size
const I = 12; // inner margin for the 5-face design

const POLYGONS = {
  vestibular: `0,0 ${S},0 ${S-I},${I} ${I},${I}`,
  lingual:    `0,${S} ${S},${S} ${S-I},${S-I} ${I},${S-I}`,
  mesial:     `0,0 0,${S} ${I},${S-I} ${I},${I}`,
  distal:     `${S},0 ${S},${S} ${S-I},${S-I} ${S-I},${I}`,
  oclusal:    `${I},${I} ${S-I},${I} ${S-I},${S-I} ${I},${S-I}`,
};

function ToothSVG({ number, data, onFaceClick }) {
  const [hov, setHov] = useState(null);
  const faces  = data?.faces  || {};
  const absent = data?.ausente || false;
  const clipId = `clip-${number}`;

  const faceColor = (face) => {
    if (absent) return 'rgba(55,65,81,0.6)';
    const c = faces[face] || 'sadio';
    const col = getColor(c);
    return col === 'transparent' ? 'rgba(20,30,50,0.5)' : col;
  };

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={clipId}>
          <rect x="1" y="1" width={S-2} height={S-2} rx="6" />
        </clipPath>
      </defs>

      {/* base */}
      <rect x="1" y="1" width={S-2} height={S-2} rx="6"
        fill="rgba(15,23,42,0.7)"
        stroke={hov && !absent ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.18)'}
        strokeWidth="1.5"
      />

      {/* faces */}
      <g clipPath={`url(#${clipId})`}>
        {Object.entries(POLYGONS).map(([face, pts]) => (
          <polygon
            key={face}
            points={pts}
            fill={faceColor(face)}
            fillOpacity={hov === face && !absent ? 0.65 : 1}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
            onMouseEnter={() => !absent && setHov(face)}
            onMouseLeave={() => setHov(null)}
            onClick={(e) => { e.stopPropagation(); if (!absent) onFaceClick(number, face); }}
            style={{ cursor: absent ? 'not-allowed' : 'pointer', transition: 'fill-opacity .15s' }}
          />
        ))}
      </g>

      {/* face label tooltip */}
      {hov && !absent && (
        <text x={S/2} y={S/2 + 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.9)" fontWeight="700" pointerEvents="none"
          style={{ textShadow: '0 1px 3px #000' }}>
          {FACE_LABELS[hov]}
        </text>
      )}

      {/* absent X */}
      {absent && (
        <>
          <line x1="8" y1="8" x2={S-8} y2={S-8} stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
          <line x1={S-8} y1="8" x2="8" y2={S-8} stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// ─── Annotation Modal ─────────────────────────────────────────────────────────

function AnnotationModal({ number, currentText, onSave, onClose }) {
  const [text, setText] = useState(currentText || '');
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '24px', width: '360px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
            Anotação — Dente {number}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ex: Sensibilidade ao frio, cárie incipiente na face oclusal…"
          rows={4}
          style={{
            width: '100%', borderRadius: '8px', padding: '12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem',
            resize: 'vertical', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            Cancelar
          </button>
          <button onClick={() => onSave(text)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={15} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tooth Column (number + svg + annotation dot) ─────────────────────────────

function ToothColumn({ number, data, onFaceClick, onAnnotationClick, isUpper }) {
  const hasNote = data?.anotacao?.trim();
  const numStyle = {
    fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)',
    textAlign: 'center', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px',
    transition: 'color .2s', userSelect: 'none',
    position: 'relative',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      {/* number above for upper teeth */}
      {isUpper && (
        <div
          style={{ ...numStyle, ...(hasNote ? { color: '#F59E0B' } : {}) }}
          onClick={() => onAnnotationClick(number)}
          title={hasNote ? `Anotação: ${data.anotacao}` : 'Adicionar anotação'}
        >
          {number}
          {hasNote && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: 7, height: 7, background: '#F59E0B', borderRadius: '50%',
            }} />
          )}
        </div>
      )}

      <ToothSVG number={number} data={data} onFaceClick={onFaceClick} />

      {/* number below for lower teeth */}
      {!isUpper && (
        <div
          style={{ ...numStyle, ...(hasNote ? { color: '#F59E0B' } : {}) }}
          onClick={() => onAnnotationClick(number)}
          title={hasNote ? `Anotação: ${data.anotacao}` : 'Adicionar anotação'}
        >
          {number}
          {hasNote && (
            <span style={{
              position: 'absolute', bottom: -4, right: -6,
              width: 7, height: 7, background: '#F59E0B', borderRadius: '50%',
            }} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Row of teeth ─────────────────────────────────────────────────────────────

function TeethRow({ teeth, odontData, onFaceClick, onAnnotationClick, isUpper }) {
  const mid = Math.floor(teeth.length / 2);
  const leftGroup  = teeth.slice(0, mid);
  const rightGroup = teeth.slice(mid);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', justifyContent: 'center' }}>
        {/* left quadrant */}
        <div style={{ display: 'flex', gap: '3px', paddingRight: '8px', borderRight: '1px dashed rgba(255,255,255,0.15)' }}>
          {leftGroup.map(n => (
            <ToothColumn key={n} number={n} data={odontData[n]}
              onFaceClick={onFaceClick} onAnnotationClick={onAnnotationClick} isUpper={isUpper} />
          ))}
        </div>
        {/* right quadrant */}
        <div style={{ display: 'flex', gap: '3px', paddingLeft: '8px' }}>
          {rightGroup.map(n => (
            <ToothColumn key={n} number={n} data={odontData[n]}
              onFaceClick={onFaceClick} onAnnotationClick={onAnnotationClick} isUpper={isUpper} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Odontograma({ initialData = {}, patientId, onDentesSelecionados, onSaved }) {
  const [odontData, setOdontData]           = useState(initialData);
  const [selectedCondition, setCondition]   = useState('carie');
  const [dentition, setDentition]           = useState('adult'); // 'adult' | 'decidua'
  const [annotationModal, setAnnotationModal] = useState(null); // tooth number or null
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);

  const upperTeeth = dentition === 'adult' ? ADULT_UPPER : DEC_UPPER;
  const lowerTeeth = dentition === 'adult' ? ADULT_LOWER : DEC_LOWER;

  // Apply condition to a face
  const handleFaceClick = useCallback((toothNum, face) => {
    setOdontData(prev => {
      const tooth = prev[toothNum] || { faces: {}, ausente: false, anotacao: '' };

      // Special: "ausente" marks whole tooth
      if (selectedCondition === 'ausente') {
        const newAbsent = !tooth.ausente;
        return { ...prev, [toothNum]: { ...tooth, ausente: newAbsent } };
      }

      const currentFace = tooth.faces[face] || 'sadio';
      const newCondition = currentFace === selectedCondition ? 'sadio' : selectedCondition;
      const newFaces = { ...tooth.faces, [face]: newCondition };

      // Notify parent of "planejar" teeth for treatment form prefill
      if (onDentesSelecionados) {
        const allSelected = Object.entries({ ...prev, [toothNum]: { ...tooth, faces: newFaces } })
          .filter(([, t]) => Object.values(t.faces || {}).includes('planejar'))
          .map(([num]) => num);
        onDentesSelecionados(allSelected);
      }

      return { ...prev, [toothNum]: { ...tooth, faces: newFaces } };
    });
    setSaved(false);
  }, [selectedCondition, onDentesSelecionados]);

  const handleAnnotationSave = useCallback((text) => {
    const num = annotationModal;
    setOdontData(prev => ({
      ...prev,
      [num]: { ...(prev[num] || { faces: {}, ausente: false }), anotacao: text },
    }));
    setAnnotationModal(null);
    setSaved(false);
  }, [annotationModal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { default: api } = await import('../services/api');
      await api.put(`/patients/${patientId}`, { odontograma: odontData });
      onSaved?.(odontData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Erro ao salvar odontograma', err);
      alert('Erro ao salvar odontograma.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Limpar todo o odontograma? Esta ação não pode ser desfeita.')) {
      setOdontData({});
      setSaved(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', margin: 0, marginBottom: '4px' }}>🦷 Odontograma</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Clique nas faces do dente para registrar a condição selecionada. Clique no número para anotações.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Dentition toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {['adult', 'decidua'].map(d => (
              <button key={d} onClick={() => setDentition(d)} style={{
                background: dentition === d ? 'var(--accent-blue)' : 'transparent',
                color: dentition === d ? '#fff' : 'var(--text-secondary)',
                border: 'none', borderRadius: '6px', padding: '6px 12px',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                transition: 'all .2s',
              }}>
                {d === 'adult' ? 'Adulto' : 'Decídua'}
              </button>
            ))}
          </div>
          <button onClick={handleReset} style={{
            background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--error)', borderRadius: '8px', padding: '8px 14px',
            cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all .2s',
          }}>
            <RotateCcw size={14} /> Limpar
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{
            padding: '8px 18px', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: saved ? 'linear-gradient(135deg,#10B981,#34D399)' : undefined,
          }}>
            {saved ? <><CheckCircle size={15} /> Salvo!</> : saving ? 'Salvando…' : <><Save size={15} /> Salvar</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Chart area */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'visible', padding: '0 8px 8px' }}>
          <div
            style={{
              width: 'max-content',
              minWidth: '100%',
              margin: '0 auto',
            }}
          >
            {/* Quadrant labels */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                ◀ Direito do Paciente &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Esquerdo do Paciente ▶
              </span>
            </div>

            {/* SUPERIOR */}
            <div style={{ marginBottom: '2px' }}>
              <TeethRow teeth={upperTeeth} odontData={odontData} selectedCondition={selectedCondition}
                onFaceClick={handleFaceClick} onAnnotationClick={setAnnotationModal} isUpper={true} />
            </div>

            {/* Midline divider */}
            <div style={{ height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '90%', height: '1px', background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--bg-secondary)', padding: '0 8px',
                  fontSize: '9px', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap', top: '-8px'
                }}>—— linha média ——</span>
              </div>
            </div>

            {/* INFERIOR */}
            <div style={{ marginTop: '2px' }}>
              <TeethRow teeth={lowerTeeth} odontData={odontData} selectedCondition={selectedCondition}
                onFaceClick={handleFaceClick} onAnnotationClick={setAnnotationModal} isUpper={false} />
            </div>

            {/* Face legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
              {Object.entries(FACE_LABELS).map(([k, v]) => (
                <span key={k} style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{v}</strong> = {k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Condition Picker */}
        <div style={{ width: '190px', flexShrink: 0 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Condição
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {CONDITIONS.map(c => (
              <button
                key={c.id}
                onClick={() => setCondition(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: selectedCondition === c.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: selectedCondition === c.id ? `1.5px solid ${c.border}` : '1.5px solid transparent',
                  borderRadius: '8px', padding: '7px 10px', cursor: 'pointer',
                  color: 'var(--text-primary)', fontSize: '0.82rem', textAlign: 'left',
                  transition: 'all .18s',
                  boxShadow: selectedCondition === c.id ? `0 0 10px ${c.border}40` : 'none',
                }}
              >
                <span style={{
                  width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                  background: c.color === 'transparent' ? 'rgba(255,255,255,0.06)' : c.color,
                  border: `1.5px solid ${c.border}`,
                  boxShadow: c.color !== 'transparent' ? `0 0 6px ${c.color}80` : 'none',
                }} />
                {c.label}
              </button>
            ))}
          </div>

          {/* Annotation helper note */}
          <div style={{
            marginTop: '16px', padding: '10px', borderRadius: '8px',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <MessageSquare size={13} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Clique no <strong style={{ color: '#F59E0B' }}>número</strong> do dente para adicionar anotações clínicas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Annotation Modal */}
      {annotationModal !== null && (
        <AnnotationModal
          number={annotationModal}
          currentText={odontData[annotationModal]?.anotacao || ''}
          onSave={handleAnnotationSave}
          onClose={() => setAnnotationModal(null)}
        />
      )}
    </div>
  );
}
