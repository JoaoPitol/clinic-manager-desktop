import React, { useState, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText, Image, File, ExternalLink, Film, Archive } from 'lucide-react';

const MAX_SIZE_MB = 20;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.doc,.docx,.xls,.xlsx,.txt,.zip,.mp4,.mov,.avi';

function getFileIcon(mimeType) {
  if (!mimeType) return <File size={28} color="var(--text-secondary)" />;
  if (mimeType.startsWith('image/'))       return <Image   size={28} color="var(--accent-cyan)" />;
  if (mimeType === 'application/pdf')       return <FileText size={28} color="#FF6B6B" />;
  if (mimeType.startsWith('video/'))        return <Film    size={28} color="#A78BFA" />;
  if (mimeType.includes('zip') || mimeType.includes('compressed'))
                                            return <Archive  size={28} color="#F59E0B" />;
  if (mimeType.includes('word') || mimeType.includes('document'))
                                            return <FileText size={28} color="#60A5FA" />;
  return <File size={28} color="var(--text-secondary)" />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const AnexosPaciente = ({ patient, patientId, clinicId, onAttachmentsChanged }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const attachments = patient?.attachments || [];

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);

    const updatedList = [...attachments];

    try {
      for (const file of files) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          alert(`"${file.name}" excede o limite de ${MAX_SIZE_MB} MB e foi ignorado.`);
          continue;
        }
        if (!file.path) {
          alert(`Não foi possível obter o caminho do arquivo "${file.name}".`);
          continue;
        }

        const result = await window.electronAPI.saveAttachment(clinicId, patientId, {
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          sourcePath: file.path,
        });

        if (result.success) {
          updatedList.push(result.attachment);
        } else {
          alert(`Erro ao salvar "${file.name}": ${result.error}`);
        }
      }
      onAttachmentsChanged(updatedList);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (att) => {
    if (!window.confirm(`Remover o anexo "${att.originalName}"? Esta ação não pode ser desfeita.`)) return;
    const result = await window.electronAPI.deleteAttachment(clinicId, patientId, att.id);
    if (result.success) {
      onAttachmentsChanged(attachments.filter(a => a.id !== att.id));
    } else {
      alert('Erro ao remover: ' + result.error);
    }
  };

  const handleOpen = async (att) => {
    const result = await window.electronAPI.openAttachment(clinicId, patientId, att.id);
    if (!result.success) alert('Não foi possível abrir o arquivo: ' + result.error);
  };

  return (
    <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Paperclip size={24} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Anexos</h2>
          {attachments.length > 0 && (
            <span style={{
              fontSize: '0.78rem', color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.07)', padding: '2px 10px', borderRadius: '12px'
            }}>
              {attachments.length} arquivo{attachments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem' }}
        >
          <Upload size={16} />
          {uploading ? 'Enviando…' : 'Adicionar Arquivo'}
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Estado vazio */}
      {attachments.length === 0 && (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
        >
          <Paperclip size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ margin: 0, fontWeight: 500 }}>Nenhum arquivo anexado</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
            Clique para adicionar radiografias, fotos, PDFs, laudos…
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', opacity: 0.6 }}>
            Limite de {MAX_SIZE_MB} MB por arquivo
          </p>
        </div>
      )}

      {/* Grade de anexos */}
      {attachments.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px',
        }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(99,179,237,0.45)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              {/* Ícone + nome */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flexShrink: 0, marginTop: '2px' }}>
                  {getFileIcon(att.mimeType)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0, fontWeight: 500, fontSize: '0.88rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={att.originalName}
                  >
                    {att.originalName}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {formatSize(att.size)}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: '0.73rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                    {formatDate(att.uploadedAt)}
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleOpen(att)}
                  className="btn-secondary"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '6px', padding: '7px 4px', fontSize: '0.8rem',
                  }}
                >
                  <ExternalLink size={13} /> Abrir
                </button>
                <button
                  onClick={() => handleDelete(att)}
                  title="Remover anexo"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    cursor: 'pointer',
                    color: 'var(--error)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Card de adicionar mais */}
          <div
            onClick={() => !uploading && inputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              minHeight: '110px',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <Upload size={22} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '0.82rem' }}>Adicionar</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnexosPaciente;
