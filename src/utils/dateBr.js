/**
 * Formatação e parsing de datas no padrão brasileiro DD/MM/YYYY.
 * Valores persistidos em tratamentos, despesas e agendamentos seguem ISO YYYY-MM-DD.
 */

function isValidYmd(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Exibe data como DD/MM/YYYY. Aceita ISO (data ou datetime), Date, ou string já DD/MM/YYYY.
 * @param {unknown} value
 * @returns {string}
 */
export function formatDateBr(value) {
  if (value == null || value === '') return '-';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  const s = String(value).trim();
  if (!s) return '-';

  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;

  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  return s;
}

/** Igual a formatDateBr, mas string vazia em vez de '-' (para inputs). */
export function formatDateBrInput(isoOrEmpty) {
  if (isoOrEmpty == null || isoOrEmpty === '') return '';
  const s = String(isoOrEmpty).trim();
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return '';
}

/**
 * @param {string} str DD/MM/YYYY ou YYYY-MM-DD
 * @returns {string|null} YYYY-MM-DD ou null se inválido
 */
export function parseDateBrToIso(str) {
  if (str == null) return '';
  const t = String(str).trim();
  if (!t) return '';

  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const d = parseInt(br[1], 10);
    const mo = parseInt(br[2], 10);
    const y = parseInt(br[3], 10);
    if (!isValidYmd(y, mo, d)) return null;
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const mo = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    if (!isValidYmd(y, mo, d)) return null;
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

export function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Data e hora: DD/MM/AAAA · HH:mm (local). */
export function formatDateTimeBr(value) {
  if (value == null || value === '') return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const date = formatDateBr(d);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${hora}`;
}

/** Máscara durante digitação: até 8 dígitos → dd/mm/aaaa */
export function digitsToMaskedDate(inputValue) {
  const digits = String(inputValue).replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ── Mês/ano (MM/AAAA) ↔ YYYY-MM (filtro financeiro) ─────────────────────────

export function formatMesAnoInput(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(String(yyyyMm).trim())) return '';
  const [y, m] = String(yyyyMm).trim().split('-');
  return `${m}/${y}`;
}

export function parseMesAnoToYyyyMm(str) {
  const t = String(str ?? '').trim();
  if (!t) return '';
  const br = t.match(/^(\d{2})\/(\d{4})$/);
  if (br) {
    const mo = parseInt(br[1], 10);
    const y = parseInt(br[2], 10);
    if (mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}`;
  }
  const iso = t.match(/^(\d{4})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const mo = parseInt(iso[2], 10);
    if (mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}`;
  }
  const digits = t.replace(/\D/g, '');
  if (digits.length === 6) {
    const mo = parseInt(digits.slice(0, 2), 10);
    const y = parseInt(digits.slice(2), 10);
    if (mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}`;
  }
  return null;
}

export function digitsToMaskedMesAno(inputValue) {
  const digits = String(inputValue).replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
