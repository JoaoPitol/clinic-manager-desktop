import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import {
  formatDateBrInput,
  parseDateBrToIso,
  digitsToMaskedDate,
  formatMesAnoInput,
  parseMesAnoToYyyyMm,
  digitsToMaskedMesAno,
} from '../utils/dateBr';

/**
 * Campo de data DD/MM/AAAA com ícone de calendário que abre o picker nativo.
 * Valor externo em ISO YYYY-MM-DD (ou '').
 */
export function DateInputBr({
  value,
  onChange,
  className = '',
  style,
  disabled,
  required,
  name,
  id,
  placeholder = 'DD/MM/AAAA',
  'aria-label': ariaLabel,
}) {
  const [text, setText] = useState(() => formatDateBrInput(value));
  const focusedRef = useRef(false);
  const hiddenRef = useRef(null);

  useEffect(() => {
    if (!focusedRef.current) setText(formatDateBrInput(value));
  }, [value]);

  const commit = (rawText) => {
    const trimmed = String(rawText ?? '').trim();
    if (!trimmed) { onChange(''); setText(''); return; }
    const iso = parseDateBrToIso(trimmed);
    if (!iso) { setText(formatDateBrInput(value)); return; }
    onChange(iso);
    setText(formatDateBrInput(iso));
  };

  const handleHiddenChange = (e) => {
    const iso = e.target.value;
    if (iso) {
      onChange(iso);
      setText(formatDateBrInput(iso));
    }
  };

  const openPicker = () => {
    if (disabled) return;
    try { hiddenRef.current?.showPicker(); } catch { /* fallback: focus hidden */ hiddenRef.current?.focus(); }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: style?.width ?? '100%', minWidth: style?.minWidth ?? '130px' }}>
      <input
        type="text"
        name={name}
        id={id}
        className={className}
        style={{ ...style, width: '100%', minWidth: 0, paddingRight: '34px' }}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        value={text}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(e) => {
          const masked = digitsToMaskedDate(e.target.value);
          setText(masked);
          if (masked.length === 10) {
            const iso = parseDateBrToIso(masked);
            if (iso) onChange(iso);
          }
        }}
        onBlur={() => { focusedRef.current = false; commit(text); }}
      />

      {/* Ícone de calendário */}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        aria-label="Abrir calendário"
        style={{
          position: 'absolute',
          right: '8px',
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          color: 'var(--text-secondary)',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          opacity: disabled ? 0.4 : 0.7,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.7'; }}
      >
        <Calendar size={15} />
      </button>

      {/* Input nativo oculto — apenas dispara o picker */}
      <input
        ref={hiddenRef}
        type="date"
        value={value || ''}
        onChange={handleHiddenChange}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0,
          border: 'none',
          padding: 0,
        }}
      />
    </div>
  );
}

/**
 * Mês de referência MM/AAAA; valor externo YYYY-MM ou ''.
 */
export function MesAnoInputBr({
  value,
  onChange,
  className = '',
  style,
  disabled,
  placeholder = 'MM/AAAA',
  'aria-label': ariaLabel,
}) {
  const [text, setText] = useState(() => formatMesAnoInput(value));
  const focusedRef = useRef(false);
  const hiddenRef = useRef(null);

  useEffect(() => {
    if (!focusedRef.current) setText(formatMesAnoInput(value));
  }, [value]);

  const openPicker = () => {
    if (disabled) return;
    try { hiddenRef.current?.showPicker(); } catch { hiddenRef.current?.focus(); }
  };

  const handleHiddenChange = (e) => {
    const val = e.target.value; // YYYY-MM
    if (val) {
      onChange(val);
      setText(formatMesAnoInput(val));
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: style?.width ?? '100%', minWidth: style?.minWidth ?? '110px' }}>
      <input
        type="text"
        className={className}
        style={{ ...style, width: '100%', minWidth: 0, paddingRight: '34px' }}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel ?? 'Mês e ano de referência'}
        inputMode="numeric"
        autoComplete="off"
        maxLength={7}
        value={text}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(e) => {
          const masked = digitsToMaskedMesAno(e.target.value);
          setText(masked);
          if (masked.length === 7) {
            const ym = parseMesAnoToYyyyMm(masked);
            if (ym) onChange(ym);
          }
        }}
        onBlur={() => {
          focusedRef.current = false;
          const ym = parseMesAnoToYyyyMm(text);
          if (ym === '') { onChange(''); setText(''); }
          else if (ym) { onChange(ym); setText(formatMesAnoInput(ym)); }
          else { setText(formatMesAnoInput(value)); }
        }}
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        aria-label="Abrir seletor de mês"
        style={{
          position: 'absolute', right: '8px',
          background: 'transparent', border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          color: 'var(--text-secondary)', padding: '0',
          display: 'flex', alignItems: 'center',
          opacity: disabled ? 0.4 : 0.7, transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.7'; }}
      >
        <Calendar size={15} />
      </button>

      <input
        ref={hiddenRef}
        type="month"
        value={value || ''}
        onChange={handleHiddenChange}
        tabIndex={-1}
        style={{
          position: 'absolute', opacity: 0, pointerEvents: 'none',
          width: 0, height: 0, border: 'none', padding: 0,
        }}
      />
    </div>
  );
}

export default DateInputBr;
