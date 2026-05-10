/**
 * Gerador de PIX BR Code (padrão EMVCo MPM do Bacen)
 * Gera o payload "Copia e Cola" que qualquer app bancário consegue ler.
 * Referência: https://www.bcb.gov.br/content/estabilidadefinanceira/forumpireunioes/AnexoI-PadroesParaIniciacaodoPix.pdf
 */

// ─── CRC16-CCITT ─────────────────────────────────────────────────────────────
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ─── Field formatter (ID + Length + Value) ───────────────────────────────────
function f(id, value) {
  const v = String(value);
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

// ─── Limpa o nome para o padrão PIX (apenas ASCII, sem acentos) ──────────────
function sanitize(str, maxLen) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove diacritics
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .substring(0, maxLen);
}

/**
 * Gera o payload PIX BR Code (copia e cola / QR Code).
 *
 * @param {object} params
 * @param {string} params.chavePix   - Chave PIX (CPF, CNPJ, e-mail, telefone, EVP)
 * @param {string} params.nome       - Nome do beneficiário (até 25 chars)
 * @param {string} params.cidade     - Cidade do beneficiário (até 15 chars)
 * @param {number|string} params.valor - Valor da cobrança (opcional)
 * @param {string} params.descricao  - Descrição / identificador (opcional, até 72 chars)
 * @param {string} params.txid       - ID único da transação (opcional, até 25 chars)
 * @returns {string} Payload PIX BR Code
 */
export function generatePixBRCode({ chavePix, nome, cidade, valor, descricao, txid }) {
  // Merchant Account Information (tag 26)
  let merchantInfo = f('00', 'br.gov.bcb.pix');
  merchantInfo += f('01', chavePix.trim());
  if (descricao) {
    merchantInfo += f('02', sanitize(descricao, 72));
  }

  // Additional Data Field (tag 62) – txid obrigatório, pode ser "***" para estático
  const txidValue = sanitize(txid || '***', 25) || '***';
  const additionalData = f('05', txidValue);

  // Monta o payload sem o CRC
  let payload = '';
  payload += f('00', '01');                            // Payload Format Indicator
  payload += f('01', '11');                            // Static (11) — chave fixa
  payload += f('26', merchantInfo);                    // Merchant Account Info
  payload += f('52', '0000');                          // Merchant Category Code
  payload += f('53', '986');                           // BRL
  if (valor && parseFloat(valor) > 0) {
    payload += f('54', parseFloat(valor).toFixed(2));  // Amount
  }
  payload += f('58', 'BR');                            // Country Code
  payload += f('59', sanitize(nome, 25));              // Merchant Name
  payload += f('60', sanitize(cidade, 15));            // Merchant City
  payload += f('62', additionalData);                  // Additional Data
  payload += '6304';                                   // CRC placeholder

  return payload + crc16(payload);
}
