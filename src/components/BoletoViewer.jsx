import React, { useMemo } from 'react';
import { X, Printer, AlertTriangle } from 'lucide-react';
import { formatDateBr } from '../utils/dateBr';

// ── Interleaved 2 of 5 barcode renderer (ITF-25) ─────────────────────────────
// Usado em boletos Febraban. Gera barras baseadas no código numérico.
const NARROW = 2;
const WIDE = 5;
const BAR_HEIGHT = 60;

const ITF_ENCODING = {
  '0': [false, false, false, true, true],
  '1': [true, false, false, false, true],
  '2': [false, true, false, false, true],
  '3': [true, true, false, false, false],
  '4': [false, false, true, false, true],
  '5': [true, false, true, false, false],
  '6': [false, true, true, false, false],
  '7': [false, false, false, true, true],  // reuse for rendering
  '8': [true, false, false, true, false],
  '9': [false, true, false, true, false],
};

const Barcode = ({ code }) => {
  const bars = useMemo(() => {
    const result = [];
    // Start: narrow bar, narrow space, narrow bar, narrow space
    result.push({ dark: true, width: NARROW });
    result.push({ dark: false, width: NARROW });
    result.push({ dark: true, width: NARROW });
    result.push({ dark: false, width: NARROW });

    const padded = code.length % 2 !== 0 ? '0' + code : code;
    for (let i = 0; i < padded.length; i += 2) {
      const barDigit = padded[i];
      const spaceDigit = padded[i + 1];
      const barBits = ITF_ENCODING[barDigit] || ITF_ENCODING['0'];
      const spaceBits = ITF_ENCODING[spaceDigit] || ITF_ENCODING['0'];

      for (let b = 0; b < 5; b++) {
        result.push({ dark: true, width: barBits[b] ? WIDE : NARROW });
        result.push({ dark: false, width: spaceBits[b] ? WIDE : NARROW });
      }
    }

    // Stop: wide bar, narrow space, narrow bar
    result.push({ dark: true, width: WIDE });
    result.push({ dark: false, width: NARROW });
    result.push({ dark: true, width: NARROW });
    return result;
  }, [code]);

  const totalWidth = bars.reduce((a, b) => a + b.width, 0);

  return (
    <svg width="100%" viewBox={`0 0 ${totalWidth} ${BAR_HEIGHT}`} preserveAspectRatio="none"
      style={{ display: 'block', height: `${BAR_HEIGHT}px` }}>
      {bars.reduce((acc, bar, i) => {
        const x = bars.slice(0, i).reduce((s, b) => s + b.width, 0);
        if (bar.dark) {
          acc.push(<rect key={i} x={x} y={0} width={bar.width} height={BAR_HEIGHT} fill="#000" />);
        }
        return acc;
      }, [])}
    </svg>
  );
};

// ── Formatação ────────────────────────────────────────────────────────────────
const formatCurrency = (val) =>
  parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatBarcode = (code) =>
  code.replace(/(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d)(\d{14})/, '$1.$2 $3.$4 $5.$6 $7 $8');

// ── Gerador de linha digitável fictícia (formato Febraban) ────────────────────
// ATENÇÃO: Este código é meramente ilustrativo e não pode ser pago em banco.
function generateBoletoCode(valor, vencimento, docNum) {
  const banco = '001'; // Código fictício
  const moeda = '9';
  const valor_cents = String(Math.round(parseFloat(valor || 0) * 100)).padStart(10, '0');
  const doc = String(docNum).padStart(10, '0').substring(0, 10);
  const venc = vencimento ? vencimento.replace(/-/g, '') : '00000000';
  // Constrói um código de 47 dígitos fictício, mas visualmente realista
  const raw = `${banco}${moeda}${doc}${venc}${valor_cents}0000000000000`;
  return raw.substring(0, 47).padEnd(47, '0');
}

// ── Componente principal ──────────────────────────────────────────────────────
const BoletoViewer = ({ treatment, patient, clinicSettings, onClose }) => {
  const docNum = useMemo(() => Math.floor(Math.random() * 9000000) + 1000000, []);
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 5);
  const vencStr = vencimento.toISOString().split('T')[0];

  const boletoCode = generateBoletoCode(treatment.valor, vencStr, docNum);
  const nomeClinica = clinicSettings?.nomeClinica || 'Clínica';
  const cnpjClinica = clinicSettings?.cnpj || '--';

  const handlePrint = () => window.print();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', overflowY: 'auto', animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{ width: '100%', maxWidth: '680px', position: 'relative' }}>

        {/* Aviso de simulação */}
        <div style={{
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '12px', padding: '12px 18px', marginBottom: '16px',
          display: 'flex', gap: '10px', alignItems: 'flex-start'
        }}>
          <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.82rem', color: '#F59E0B', lineHeight: '1.5' }}>
            <strong>Boleto de Cobrança Interna</strong> — Este documento serve como comprovante de cobrança formal
            e controle interno. Para emissão de boleto bancário real pagável em qualquer agência, utilize um gateway de pagamento (Asaas, Mercado Pago, etc.).
          </p>
        </div>

        {/* Boleto */}
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', color: '#000', fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>

          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #000', padding: '10px 16px', gap: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '18px', borderRight: '2px solid #000', paddingRight: '16px', minWidth: '120px' }}>
              {nomeClinica}
            </div>
            <div style={{ borderRight: '2px solid #000', paddingRight: '16px', flex: 1 }}>
              <p style={{ fontSize: '11px', color: '#555' }}>Banco do Brasil</p>
              <strong style={{ fontSize: '16px' }}>001-9</strong>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold', minWidth: '180px' }}>
              {formatBarcode(boletoCode)}
            </div>
          </div>

          {/* Instruções + dados */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: '1px solid #ccc' }}>
            <div style={{ padding: '8px 16px', borderRight: '1px solid #ccc' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Local de Pagamento</p>
              <p>Pagável apenas como controle interno da clínica</p>
            </div>
            <div style={{ padding: '8px 16px', minWidth: '160px' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Vencimento</p>
              <strong style={{ fontSize: '14px' }}>{formatDateBr(vencStr)}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: '1px solid #ccc' }}>
            <div style={{ padding: '8px 16px', borderRight: '1px solid #ccc' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Beneficiário</p>
              <strong>{nomeClinica}</strong>
              <span style={{ marginLeft: '12px', fontSize: '11px', color: '#555' }}>CNPJ: {cnpjClinica}</span>
            </div>
            <div style={{ padding: '8px 16px', minWidth: '160px' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Agência / Código Beneficiário</p>
              <p>3293-8 / 0001283-6</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', borderBottom: '1px solid #ccc' }}>
            <div style={{ padding: '8px 16px', borderRight: '1px solid #ccc' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Data do Documento</p>
              <p>{formatDateBr(treatment.data)}</p>
            </div>
            <div style={{ padding: '8px 16px', borderRight: '1px solid #ccc' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Nº do Documento</p>
              <p>{docNum}</p>
            </div>
            <div style={{ padding: '8px 16px', borderRight: '1px solid #ccc' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Espécie Doc.</p>
              <p>DS</p>
            </div>
            <div style={{ padding: '8px 16px', minWidth: '160px' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Valor do Documento</p>
              <strong style={{ fontSize: '14px' }}>{formatCurrency(treatment.valor)}</strong>
            </div>
          </div>

          {/* Instruções */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: '1px solid #ccc' }}>
            <div style={{ padding: '8px 16px', borderRight: '1px solid #ccc', minHeight: '60px' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '4px' }}>Instruções (Texto de responsabilidade do beneficiário)</p>
              <p>Referente: <strong>{treatment.procedimento}</strong>{treatment.dente ? ` — Dente ${treatment.dente}` : ''}</p>
              <p style={{ marginTop: '4px', color: '#c00', fontSize: '11px' }}>
                ⚠ DOCUMENTO DE CONTROLE INTERNO — NÃO PAGAR EM BANCO
              </p>
            </div>
            <div style={{ padding: '8px 16px', minWidth: '160px' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>(-) Desconto / Abatimentos</p>
              <p style={{ marginBottom: '8px' }}>&nbsp;</p>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>(=) Valor Cobrado</p>
              <strong>{formatCurrency(treatment.valor)}</strong>
            </div>
          </div>

          {/* Pagador */}
          <div style={{ padding: '8px 16px', borderBottom: '2px dashed #aaa' }}>
            <p style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>Pagador</p>
            <p><strong>{patient?.nomeCompleto || 'Paciente'}</strong> — CPF/RG: {patient?.cpfOuCi || '--'}</p>
            <p style={{ color: '#555' }}>{patient?.enderecoResidencial || ''} {patient?.cidade ? `— ${patient.cidade}/${patient.estado}` : ''}</p>
          </div>

          {/* Recibo do sacado */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
            <span>Recibo do Pagador</span>
            <span>Autenticação Mecânica</span>
          </div>

          {/* Código de barras */}
          <div style={{ padding: '16px 16px 8px' }}>
            <Barcode code={boletoCode} />
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginTop: '6px', fontFamily: 'monospace', letterSpacing: '1px' }}>
              {boletoCode}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button onClick={handlePrint} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Printer size={18} /> Imprimir / Salvar PDF
          </button>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <X size={18} /> Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoletoViewer;
