import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, Cloud, CloudOff, CheckCircle } from 'lucide-react';

/**
 * UpdateBanner — exibido no topo da aplicação quando há atualizações disponíveis
 * e/ou para mostrar o status de sincronização com a nuvem.
 */
const UpdateBanner = ({ clinicId }) => {
  const [updateState, setUpdateState] = useState(null); // null | 'available' | 'downloaded'
  const [updateVersion, setUpdateVersion] = useState('');
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [syncState, setSyncState] = useState(null); // { synced, online, cloudAuth, syncedAt, noBulkSync, hint }
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubUpdate = window.electronAPI.onUpdateAvailable?.((data) => {
      setUpdateState('available');
      setUpdateVersion(data?.version || '');
      setDismissed(false);
    });

    const unsubDownloaded = window.electronAPI.onUpdateDownloaded?.((data) => {
      setUpdateState('downloaded');
      setUpdateVersion(data?.version || '');
      setDismissed(false);
    });

    const unsubSync = window.electronAPI.onSyncStatus?.((data) => {
      setSyncState((prev) => ({ ...prev, ...data }));
    });

    return () => {
      unsubUpdate?.();
      unsubDownloaded?.();
      unsubSync?.();
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    await window.electronAPI?.installUpdate();
  };

  const handleSyncNow = async () => {
    if (!clinicId || syncing) return;
    setSyncing(true);
    try {
      const result = await window.electronAPI?.syncNow(clinicId);
      setSyncState({
        synced: !!result?.success,
        online: result?.online !== false,
        cloudAuth: result?.cloudAuth !== false,
        syncedAt: result?.success ? new Date().toISOString() : undefined,
        noBulkSync: !!result?.noBulkSync,
        hint: result?.hint ?? (result?.reason === 'offline' ? 'offline' : null),
        detail: result?.detail ?? null,
      });
    } finally {
      setSyncing(false);
    }
  };

  const formatSyncTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const syncLabel = () => {
    if (!syncState) return '';
    if (syncState.restoredFromCloud) return `Dados restaurados da nuvem${syncState.syncedAt ? ` às ${formatSyncTime(syncState.syncedAt)}` : ''} ✓`;
    if (!syncState.online) return syncState.detail || 'Offline — API inacessível, sem rede ou servidor parado';
    if (syncState.cloudAuth === false) {
      const base =
        syncState.hint === 'nuvem-auth-falhou'
          ? 'API online — não entrou na nuvem (cadastre na API ou confira usuário/senha).'
          : 'API online — sessão na nuvem inválida ou negada (saia e entre de novo).';
      if (syncState.detail) return `${base} Detalhe: ${syncState.detail}`;
      return base;
    }
    if (syncState.noBulkSync) return 'Nuvem: conectada (API sem sync em lote — dados locais)';
    if (syncState.synced && syncState.syncedAt) return `Sincronizado às ${formatSyncTime(syncState.syncedAt)}`;
    if (syncState.cloudAuth) return 'Nuvem conectada';
    return 'Nuvem: verificando…';
  };

  const syncBarDegraded = syncState && (!syncState.online || syncState.cloudAuth === false);

  // Nada para mostrar
  if (dismissed && !syncState) return null;

  const showUpdateBanner = !dismissed && (updateState === 'available' || updateState === 'downloaded');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 0, pointerEvents: 'none' }}>
      {/* ── Sync status bar (sempre visível, discreto) ─────────────────────── */}
      {syncState !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          padding: '4px 18px',
          background: syncBarDegraded
            ? 'rgba(245,158,11,0.08)'
            : 'rgba(16,185,129,0.08)',
          borderBottom: `1px solid ${syncBarDegraded ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}`,
          pointerEvents: 'auto',
        }}>
          {!syncState.online
            ? <CloudOff size={12} style={{ color: '#F59E0B' }} />
            : syncState.cloudAuth === false
              ? <Cloud size={12} style={{ color: '#F59E0B' }} />
              : <Cloud size={12} style={{ color: 'var(--success)' }} />
          }
          <span style={{ fontSize: '0.72rem', color: syncBarDegraded ? '#F59E0B' : 'var(--success)' }}>
            {syncLabel()}
          </span>
          {syncState.online && syncState.cloudAuth !== false && (
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              title="Sincronizar agora"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--success)', padding: '2px', display: 'flex', alignItems: 'center',
                opacity: syncing ? 0.5 : 1,
              }}
            >
              <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>
      )}

      {/* ── Update banner ─────────────────────────────────────────────────── */}
      {showUpdateBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 18px',
          background: updateState === 'downloaded'
            ? 'linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
            : 'linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
          borderBottom: `1px solid ${updateState === 'downloaded' ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)'}`,
          pointerEvents: 'auto',
        }}>
          {updateState === 'downloaded'
            ? <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
            : <Download size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          }
          <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {updateState === 'downloaded'
              ? `Atualização ${updateVersion ? `v${updateVersion}` : ''} baixada e pronta para instalar.`
              : `Nova versão ${updateVersion ? `v${updateVersion}` : ''} disponível — baixando em segundo plano…`
            }
          </span>
          {updateState === 'downloaded' && (
            <button
              onClick={handleInstall}
              disabled={installing}
              style={{
                background: 'var(--success)', border: 'none', cursor: 'pointer',
                color: '#fff', padding: '6px 16px', borderRadius: '6px',
                fontSize: '0.82rem', fontWeight: 600, flexShrink: 0,
                opacity: installing ? 0.7 : 1,
              }}
            >
              {installing ? 'Reiniciando…' : 'Reiniciar e Atualizar'}
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateBanner;
