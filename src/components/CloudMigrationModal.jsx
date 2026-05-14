import React, { useState } from 'react';
import { Cloud, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';

/**
 * CloudMigrationModal — exibido uma única vez quando a clínica faz login
 * com dados locais que ainda não foram sincronizados com a nuvem.
 *
 * Props:
 *   onConfirm()   — usuário aceita a migração (dispara sync inicial)
 *   onDismiss()   — usuário recusa (não pergunta novamente)
 */
const CloudMigrationModal = ({ onConfirm, onDismiss }) => {
  const [state, setState] = useState('idle'); // idle | syncing | done | error

  const handleConfirm = async () => {
    setState('syncing');
    try {
      await onConfirm();
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px', width: '100%', padding: '36px',
        borderRadius: '16px', position: 'relative',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Fechar sem migrar */}
        {state === 'idle' && (
          <button
            onClick={onDismiss}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
          >
            <X size={18} />
          </button>
        )}

        {/* Ícone */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '14px',
          background: state === 'done' ? 'rgba(16,185,129,0.15)' : state === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(6,182,212,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          {state === 'idle'    && <Cloud size={28} style={{ color: 'var(--accent-cyan)' }} />}
          {state === 'syncing' && <Loader size={28} style={{ color: 'var(--accent-cyan)', animation: 'spin 1s linear infinite' }} />}
          {state === 'done'    && <CheckCircle size={28} style={{ color: 'var(--success)' }} />}
          {state === 'error'   && <AlertCircle size={28} style={{ color: '#EF4444' }} />}
        </div>

        {/* Conteúdo por estado */}
        {state === 'idle' && (
          <>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Enviar dados para a nuvem</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Seus dados estão salvos <strong>localmente</strong> neste computador. Enviá-los para a nuvem permite:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Backup automático — sem risco de perder dados',
                'Acesso de qualquer computador com o app instalado',
                'Sincronização contínua em segundo plano',
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <CheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '24px' }}>
              Seus dados locais <strong>não serão apagados</strong>. A sincronização ocorre em paralelo.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleConfirm}>
                Sincronizar agora
              </button>
              <button className="btn-secondary" style={{ padding: '12px 18px' }} onClick={onDismiss}>
                Agora não
              </button>
            </div>
          </>
        )}

        {state === 'syncing' && (
          <>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Sincronizando…</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Enviando seus dados para a nuvem. Isso pode levar alguns segundos.
            </p>
          </>
        )}

        {state === 'done' && (
          <>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '10px', color: 'var(--success)' }}>Sincronizado!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Seus dados foram enviados para a nuvem com sucesso. De agora em diante, a sincronização ocorre automaticamente.
            </p>
            <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={onDismiss}>
              Entendido
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '10px', color: '#EF4444' }}>Erro na sincronização</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Não foi possível conectar à nuvem agora. Seus dados locais estão seguros. A sincronização será tentada novamente automaticamente.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleConfirm}>
                Tentar novamente
              </button>
              <button className="btn-secondary" style={{ padding: '12px 18px' }} onClick={onDismiss}>
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CloudMigrationModal;
