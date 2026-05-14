import React, { useState } from 'react';
import { X, Plus, Trash2, DollarSign, CheckCircle, AlertCircle, Clock, Smartphone, FileText, Printer } from 'lucide-react';
import PixModal from './PixModal';
import BoletoViewer from './BoletoViewer';

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildReceiptHtml({ treatment, patient, clinicSettings, pagamento }) {
  const dataPag = pagamento.data
    ? pagamento.data.split('-').reverse().join('/')
    : new Date().toLocaleDateString('pt-BR');
  const hoje = new Date().toLocaleDateString('pt-BR');
  const valorFmt = parseFloat(pagamento.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Recibo — ${escapeHtml(patient?.nomeCompleto || 'Paciente')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, "Times New Roman", serif; padding: 48px; color: #111; max-width: 680px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 28px; }
    .header h1 { font-size: 22pt; margin-bottom: 4px; }
    .header p { font-size: 10pt; color: #555; margin-top: 4px; }
    .badge { display: inline-block; border: 2px solid #222; padding: 6px 24px; border-radius: 4px; font-size: 10pt; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 28px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 32px; margin-bottom: 28px; font-size: 11pt; }
    .grid .lbl { color: #666; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; }
    .destaque { text-align: center; font-size: 26pt; font-weight: bold; border: 3px solid #111; border-radius: 6px; padding: 18px; margin-bottom: 28px; letter-spacing: .02em; }
    .footer { border-top: 1px solid #aaa; padding-top: 20px; margin-top: 32px; display: flex; justify-content: space-between; font-size: 9pt; color: #666; }
    .assin { text-align: center; }
    .assin-line { border-bottom: 1px solid #555; width: 220px; margin: 32px auto 6px; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(clinicSettings?.nomeClinica || 'Clínica')}</h1>
    ${clinicSettings?.cnpj ? `<p>CNPJ: ${escapeHtml(clinicSettings.cnpj)}</p>` : ''}
  </div>

  <div style="text-align:center;margin-bottom:24px">
    <span class="badge">Recibo de Pagamento</span>
  </div>

  <div class="grid">
    <div><p class="lbl">Paciente</p><p><strong>${escapeHtml(patient?.nomeCompleto || '-')}</strong></p></div>
    <div><p class="lbl">Data do Pagamento</p><p><strong>${escapeHtml(dataPag)}</strong></p></div>
    <div><p class="lbl">Procedimento</p><p>${escapeHtml(treatment.procedimento || '-')}${treatment.dente ? ` — Dente ${escapeHtml(treatment.dente)}` : ''}</p></div>
    <div><p class="lbl">Forma de Pagamento</p><p>${escapeHtml(pagamento.formaPagamento || '-')}</p></div>
    ${pagamento.observacao ? `<div style="grid-column:1/-1"><p class="lbl">Observação</p><p>${escapeHtml(pagamento.observacao)}</p></div>` : ''}
  </div>

  <div class="destaque">${escapeHtml(valorFmt)}</div>

  <div class="assin">
    <div class="assin-line"></div>
    <p>${escapeHtml(clinicSettings?.nomeClinica || 'Responsável pela Clínica')}</p>
  </div>

  <div class="footer">
    <span>Emitido em: ${escapeHtml(hoje)}</span>
    <span>Documento não tem valor fiscal</span>
  </div>
</body>
</html>`;
}

function openReceipt(html) {
  const w = window.open('', '_blank', 'width=720,height=560');
  if (!w) { alert('Bloqueio de pop-up impediu a impressão.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 280);
}

const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Convênio'];

export const calcularStatusPagamento = (treatment) => {
  const valorTotal = parseFloat(treatment.valor || 0);
  if (valorTotal === 0) return { label: 'Sem Valor', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' };
  const pagamentos = treatment.payments || [];
  const totalPago = pagamentos.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);
  if (totalPago <= 0) return { label: 'Pendente', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
  if (totalPago >= valorTotal) return { label: 'Quitado', color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' };
  return { label: 'Parcial', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' };
};

const PagamentoModal = ({ treatment, patient, clinicSettings, onClose, onSave }) => {
  const pagamentos = treatment.payments || [];
  const valorTotal = parseFloat(treatment.valor || 0);
  const totalPago = pagamentos.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);
  const saldoDevedor = Math.max(0, valorTotal - totalPago);
  const status = calcularStatusPagamento(treatment);

  const [novoPagamento, setNovoPagamento] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: saldoDevedor > 0 ? saldoDevedor.toFixed(2) : '',
    formaPagamento: 'PIX',
    observacao: '',
  });

  const [saving, setSaving] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [showBoleto, setShowBoleto] = useState(false);

  const handleAddPagamento = async () => {
    const valor = parseFloat(novoPagamento.valor);
    if (!valor || valor <= 0) {
      alert('Informe um valor válido para o pagamento.');
      return;
    }
    setSaving(true);
    const novoPag = {
      id: crypto.randomUUID(),
      data: novoPagamento.data,
      valor: valor,
      formaPagamento: novoPagamento.formaPagamento,
      observacao: novoPagamento.observacao,
    };
    const updatedPayments = [...pagamentos, novoPag];
    await onSave(updatedPayments);
    setSaving(false);
    onClose();
  };

  const handleDeletePagamento = async (pagId) => {
    if (!window.confirm('Remover este pagamento?')) return;
    const updatedPayments = pagamentos.filter(p => p.id !== pagId);
    await onSave(updatedPayments);
    onClose();
  };

  const handlePixConfirmed = async () => {
    // Auto-registra o pagamento PIX pelo valor total pendente
    const valor = saldoDevedor;
    if (valor <= 0) return;
    setSaving(true);
    const novoPag = {
      id: crypto.randomUUID(),
      data: new Date().toISOString().split('T')[0],
      valor,
      formaPagamento: 'PIX',
      observacao: 'Confirmado via QR Code',
    };
    const updatedPayments = [...pagamentos, novoPag];
    await onSave(updatedPayments);
    setSaving(false);
    setShowPix(false);
    onClose();
  };

  const formatCurrency = (val) =>
    parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  return (
    <>
    {showPix && (
      <PixModal
        treatment={treatment}
        patient={patient}
        clinicSettings={clinicSettings}
        onClose={() => setShowPix(false)}
        onConfirmPaid={handlePixConfirmed}
      />
    )}
    {showBoleto && (
      <BoletoViewer
        treatment={treatment}
        patient={patient}
        clinicSettings={clinicSettings}
        onClose={() => setShowBoleto(false)}
      />
    )}
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.2s ease'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '560px', maxHeight: '90vh',
        overflowY: 'auto', padding: '32px', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={20} color="white" />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>Controle de Pagamento</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {treatment.procedimento} {treatment.dente ? `• Dente ${treatment.dente}` : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {/* Resumo financeiro */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
            <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCurrency(valorTotal)}</p>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.15)' }}>
            <p style={{ color: 'var(--success)', fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pago</p>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }}>{formatCurrency(totalPago)}</p>
          </div>
          <div style={{ background: saldoDevedor > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.05)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `1px solid ${saldoDevedor > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.1)'}` }}>
            <p style={{ color: saldoDevedor > 0 ? '#F59E0B' : 'var(--success)', fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo</p>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: saldoDevedor > 0 ? '#F59E0B' : 'var(--success)' }}>{formatCurrency(saldoDevedor)}</p>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <span style={{ background: status.bg, color: status.color, padding: '6px 18px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {status.label === 'Quitado' && <CheckCircle size={14} />}
            {status.label === 'Pendente' && <AlertCircle size={14} />}
            {status.label === 'Parcial' && <Clock size={14} />}
            {status.label}
          </span>
        </div>

        {/* Gerar cobrança */}
        {saldoDevedor > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            <button
              onClick={() => setShowPix(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: 'linear-gradient(135deg, #0077B6, #00B4D8)',
                border: 'none', borderRadius: '10px', color: 'white',
                padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                transition: 'opacity 0.2s', fontFamily: 'Outfit, sans-serif'
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              <Smartphone size={18} />
              Gerar QR PIX
            </button>
            <button
              onClick={() => setShowBoleto(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)',
                padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                transition: 'background 0.2s', fontFamily: 'Outfit, sans-serif'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            >
              <FileText size={18} />
              Emitir Boleto
            </button>
          </div>
        )}

        {/* Histórico de pagamentos */}
        {pagamentos.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Histórico</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pagamentos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatCurrency(p.valor)}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {formatDate(p.data)} · {p.formaPagamento} {p.observacao ? `· ${p.observacao}` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      onClick={() => openReceipt(buildReceiptHtml({ treatment, patient, clinicSettings, pagamento: p }))}
                      title="Imprimir recibo"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', transition: 'color 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.color = 'var(--accent-cyan)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      onClick={() => handleDeletePagamento(p.id)}
                      title="Remover pagamento"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', transition: 'color 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulário novo pagamento */}
        {saldoDevedor > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>Registrar Pagamento</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Data *</label>
                <input
                  type="date"
                  className="input-field"
                  value={novoPagamento.data}
                  onChange={e => setNovoPagamento({ ...novoPagamento, data: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={novoPagamento.valor}
                  onChange={e => setNovoPagamento({ ...novoPagamento, valor: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Forma de Pagamento</label>
                <select
                  className="input-field"
                  value={novoPagamento.formaPagamento}
                  onChange={e => setNovoPagamento({ ...novoPagamento, formaPagamento: e.target.value })}
                >
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Observação</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Opcional"
                  value={novoPagamento.observacao}
                  onChange={e => setNovoPagamento({ ...novoPagamento, observacao: e.target.value })}
                />
              </div>
            </div>
            <button
              onClick={handleAddPagamento}
              className="btn-primary"
              disabled={saving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Plus size={18} />
              {saving ? 'Salvando...' : 'Registrar Pagamento'}
            </button>
          </div>
        )}

        {saldoDevedor === 0 && pagamentos.length > 0 && (
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.08)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle size={28} color="var(--success)" style={{ marginBottom: '8px' }} />
            <p style={{ color: 'var(--success)', fontWeight: 600 }}>Procedimento totalmente quitado!</p>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.9rem', padding: '10px 24px' }}>Fechar</button>
        </div>
      </div>
    </div>
    </>
  );
};

export default PagamentoModal;
