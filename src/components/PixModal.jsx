import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, CheckCircle, Info, Smartphone } from 'lucide-react';
import { generatePixBRCode } from '../utils/pixBRCode';

const PixModal = ({ treatment, clinicSettings, onClose, onConfirmPaid }) => {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const [qrError, setQrError] = useState('');

  const valorFormatado = parseFloat(treatment.valor || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const chavePix = clinicSettings?.chavePix || '';
  const nomeClinica = clinicSettings?.nomeClinica || 'Clinica';
  const cidadeClinica = clinicSettings?.cidadeClinica || 'Brasil';

  useEffect(() => {
    if (!chavePix) {
      setQrError('Configure a Chave PIX nas Configurações antes de gerar cobranças PIX.');
      return;
    }

    try {
      const payload = generatePixBRCode({
        chavePix,
        nome: nomeClinica,
        cidade: cidadeClinica,
        valor: treatment.valor,
        descricao: treatment.procedimento,
        txid: `RPP${treatment.id?.substring(0, 20) || 'COBRANCA'}`,
      });
      setPixPayload(payload);

      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, payload, {
          width: 260,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'M',
        });
      }
    } catch (err) {
      setQrError('Erro ao gerar QR Code: ' + err.message);
      console.error(err);
    }
  }, [chavePix, treatment]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = pixPayload;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.2s ease'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '460px', padding: '32px',
        position: 'relative', textAlign: 'center'
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'
        }}>
          <X size={22} />
        </button>

        {/* Header */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #00B4D8, #0077B6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Smartphone size={28} color="white" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>Pagar com PIX</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
          {treatment.procedimento} {treatment.dente ? `• Dente ${treatment.dente}` : ''}
        </p>
        <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00B4D8', marginBottom: '24px' }}>
          {valorFormatado}
        </p>

        {qrError ? (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px', padding: '20px', marginBottom: '20px'
          }}>
            <Info size={20} color="var(--error)" style={{ marginBottom: '8px' }} />
            <p style={{ color: 'var(--error)', fontSize: '0.9rem' }}>{qrError}</p>
            <button onClick={onClose} className="btn-secondary" style={{ marginTop: '16px', fontSize: '0.85rem' }}
              onClick={() => { onClose(); setTimeout(() => window.location.href = '/settings', 100); }}>
              Ir para Configurações
            </button>
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div style={{
              background: 'white', borderRadius: '16px', padding: '16px',
              display: 'inline-block', marginBottom: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
            }}>
              <canvas ref={canvasRef} />
            </div>

            {/* Instruções */}
            <div style={{
              background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)',
              borderRadius: '12px', padding: '14px', marginBottom: '20px', textAlign: 'left'
            }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Como pagar:</strong><br />
                1. Abra o app do seu banco<br />
                2. Acesse <strong>PIX → Ler QR Code</strong><br />
                3. Aponte a câmera para o código acima<br />
                4. Confirme o pagamento
              </p>
            </div>

            {/* Copia e Cola */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Ou use o PIX <strong>Copia e Cola</strong>:
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 14px',
                fontSize: '0.7rem', color: 'var(--text-secondary)', wordBreak: 'break-all',
                fontFamily: 'monospace', maxHeight: '60px', overflow: 'hidden',
                border: '1px solid var(--border-color)', marginBottom: '8px'
              }}>
                {pixPayload}
              </div>
              <button
                onClick={handleCopy}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'var(--border-color)'}`,
                  borderRadius: '8px', color: copied ? 'var(--success)' : 'var(--text-primary)',
                  padding: '10px', cursor: 'pointer', transition: 'all 0.3s', fontSize: '0.88rem', fontWeight: 500
                }}
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar código PIX'}
              </button>
            </div>

            {/* Confirmar pagamento */}
            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '12px', padding: '14px', marginBottom: '16px'
            }}>
              <p style={{ fontSize: '0.82rem', color: '#F59E0B', marginBottom: '12px' }}>
                <strong>Após confirmar o recebimento no seu app bancário:</strong>
              </p>
              <button
                onClick={onConfirmPaid}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <CheckCircle size={18} />
                Confirmar Pagamento Recebido
              </button>
            </div>
          </>
        )}

        <button onClick={onClose} className="btn-secondary" style={{ width: '100%', fontSize: '0.88rem', padding: '10px' }}>
          Fechar
        </button>
      </div>
    </div>
  );
};

export default PixModal;
