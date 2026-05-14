import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import CloudMigrationModal from '../components/CloudMigrationModal';

// ─── Constantes ───────────────────────────────────────────────────────────────

const UFS_VALIDAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

// ─── Helpers de validação ─────────────────────────────────────────────────────

function calcularDigitoVerificadorCNPJ(cnpjArray, length) {
  const weights = length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = cnpjArray.slice(0, length).reduce((acc, num, i) => acc + num * weights[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function validarCNPJ(cnpj) {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  // Rejeita sequências repetidas (00000000000000, etc.)
  if (/^(\d)\1+$/.test(digits)) return false;
  const nums = digits.split('').map(Number);
  const d1 = calcularDigitoVerificadorCNPJ(nums, 12);
  const d2 = calcularDigitoVerificadorCNPJ(nums, 13);
  return nums[12] === d1 && nums[13] === d2;
}

function validarCRO(cro) {
  const croLimpo = cro.trim().toUpperCase();
  const match = croLimpo.match(/^(\d{1,6})-([A-Z]{2})$/);
  if (!match) return { valido: false, msg: 'Formato inválido. Use: 12345-SP' };
  const uf = match[2];
  if (!UFS_VALIDAS.includes(uf)) return { valido: false, msg: `UF inválida: ${uf}` };
  return { valido: true, msg: '' };
}

function formatarCNPJ(value) {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

function formatarCRO(value) {
  // Auto-formata: "12345SP" → "12345-SP"
  const limpo = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const nums = limpo.replace(/[A-Z]/g, '');
  const letras = limpo.replace(/[0-9]/g, '');
  if (letras.length > 0) return `${nums}-${letras}`.slice(0, 9);
  return nums.slice(0, 6);
}

// ─── Status de campo ─────────────────────────────────────────────────────────
// 'idle' | 'ok' | 'error' | 'warning' | 'checking'

const FieldStatus = ({ status, msg }) => {
  if (status === 'idle' || !msg) return null;

  const cfg = {
    ok:       { icon: <CheckCircle size={14} />,    color: 'var(--success)' },
    error:    { icon: <XCircle size={14} />,        color: 'var(--error)' },
    warning:  { icon: <AlertTriangle size={14} />,  color: '#F59E0B' },
    checking: { icon: <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />, color: 'var(--accent-cyan)' },
  };

  const { icon, color } = cfg[status] || cfg.error;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.8rem', color }}>
      {icon} {msg}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cro, setCro] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [pendingClinicId, setPendingClinicId] = useState(null);

  // Estados de validação por campo
  const [cnpjStatus, setCnpjStatus] = useState({ status: 'idle', msg: '' });
  const [croStatus,  setCroStatus]  = useState({ status: 'idle', msg: '' });

  const navigate = useNavigate();

  // ── Handlers de campo ────────────────────────────────────────────────────────

  const handleCnpjChange = (e) => {
    const formatted = formatarCNPJ(e.target.value);
    setCnpj(formatted);

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 0) {
      setCnpjStatus({ status: 'idle', msg: '' });
      return;
    }
    if (digits.length < 14) {
      setCnpjStatus({ status: 'idle', msg: '' });
      return;
    }

    if (!validarCNPJ(formatted)) {
      setCnpjStatus({ status: 'error', msg: 'CNPJ inválido (dígitos verificadores incorretos)' });
    } else {
      setCnpjStatus({ status: 'ok', msg: 'Formato válido — verificando na Receita Federal…' });
    }
  };

  const handleCnpjBlur = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length === 0) return;
    if (!validarCNPJ(cnpj)) return;
    await consultarCNPJReceita(cnpj);
  };

  const handleCroChange = (e) => {
    const formatted = formatarCRO(e.target.value);
    setCro(formatted);

    if (formatted.length < 4) {
      setCroStatus({ status: 'idle', msg: '' });
      return;
    }
    const { valido, msg } = validarCRO(formatted);
    setCroStatus(valido
      ? { status: 'ok',   msg: 'Formato de CRO válido' }
      : { status: 'error', msg }
    );
  };

  // ── Consulta BrasilAPI ────────────────────────────────────────────────────────

  const consultarCNPJReceita = async (cnpjValue) => {
    const digits = cnpjValue.replace(/\D/g, '');
    setCnpjStatus({ status: 'checking', msg: 'Consultando Receita Federal…' });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        // 404 = CNPJ não encontrado na Receita
        if (res.status === 404) {
          setCnpjStatus({ status: 'error', msg: 'CNPJ não encontrado na Receita Federal' });
          return false;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const situacao = (data.descricao_situacao_cadastral || data.situacao_cadastral || '').toUpperCase();
      const razaoSocial = data.razao_social || '';

      if (situacao === 'ATIVA') {
        setCnpjStatus({ status: 'ok', msg: `✓ Empresa ativa: ${razaoSocial}` });
        return true;
      } else {
        setCnpjStatus({
          status: 'error',
          msg: `CNPJ com situação "${situacao}" na Receita Federal — cadastro bloqueado`,
        });
        return false;
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('network')) {
        // Sem internet: avisa mas não bloqueia
        setCnpjStatus({
          status: 'warning',
          msg: 'Sem conexão com a Receita Federal — validação online indisponível. Prosseguindo com validação local.',
        });
        return true; // permissivo quando offline
      }
      setCnpjStatus({ status: 'warning', msg: 'Erro ao consultar Receita Federal — validação online indisponível.' });
      return true; // permissivo em caso de erro inesperado
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isRegistering) {
        const cnpjDigits = cnpj.replace(/\D/g, '');
        if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
          setError('CNPJ incompleto: use 14 dígitos ou deixe o campo em branco.');
          return;
        }

        if (cnpjDigits.length === 14) {
          if (!validarCNPJ(cnpj)) {
            setError('CNPJ inválido. Verifique os dígitos e tente novamente.');
            return;
          }
          const cnpjAprovado = await consultarCNPJReceita(cnpj);
          if (!cnpjAprovado) {
            setError('Cadastro bloqueado: o CNPJ informado está inativo ou não existe na Receita Federal.');
            return;
          }
        }

        // Valida CRO
        const { valido: croValido, msg: croMsg } = validarCRO(cro);
        if (!croValido) {
          setError(`CRO inválido: ${croMsg}`);
          return;
        }

        if (!inviteCode.trim()) {
          setError('Informe o código de convite enviado pelo administrador.');
          return;
        }

        // Regista
        await api.post('/auth/register', {
          nome,
          cnpj: cnpjDigits.length === 14 ? cnpj : '',
          cro,
          username,
          password,
          inviteCode: inviteCode.trim(),
        });
        setSuccessMsg('Clínica cadastrada com sucesso! Faça login.');
        setIsRegistering(false);
        setPassword('');
        setInviteCode('');
        setCnpj('');
        setCnpjStatus({ status: 'idle', msg: '' });
        setCroStatus({ status: 'idle', msg: '' });
      } else {
        const response = await api.post('/auth/login', { username, password });
        const clinicId = response.data.accessToken;
        localStorage.setItem('@ClinicManager:token', clinicId);
        if (response.data.clinicName) {
          localStorage.setItem('@ClinicManager:nome', response.data.clinicName);
          document.title = response.data.clinicName;
        }

        // PC novo: dados já restaurados da nuvem — não mostrar modal de migração
        if (response.data.restoredFromCloud) {
          localStorage.setItem('@ClinicManager:migrationDone', '1');
          navigate('/dashboard');
          return;
        }

        // Verifica se é a primeira sincronização (lastSyncAt não existe)
        const migrationDismissed = localStorage.getItem('@ClinicManager:migrationDone');
        if (!migrationDismissed) {
          setPendingClinicId(clinicId);
          setShowMigrationModal(true);
          navigate('/dashboard');
          return;
        }

        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Erro ao processar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setInviteCode('');
    setCnpj('');
    setCnpjStatus({ status: 'idle', msg: '' });
    setCroStatus({ status: 'idle', msg: '' });
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const cnpjDigitsOnly = cnpj.replace(/\D/g, '');
  const cnpjBlocking =
    (cnpjDigitsOnly.length > 0 && cnpjDigitsOnly.length < 14)
    || (cnpjDigitsOnly.length === 14 && (cnpjStatus.status === 'error' || cnpjStatus.status === 'checking'));

  const canSubmit = !loading && (!isRegistering || (
    !cnpjBlocking &&
    croStatus.status !== 'error'
  ));

  const borderColor = (status) => {
    if (status === 'ok')      return 'var(--success)';
    if (status === 'error')   return 'var(--error)';
    if (status === 'warning') return '#F59E0B';
    if (status === 'checking') return 'var(--accent-cyan)';
    return undefined;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Círculos decorativos */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '400px', height: '400px', background: 'var(--accent-blue)', borderRadius: '50%', filter: 'blur(150px)', opacity: 0.3, zIndex: -1 }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '300px', height: '300px', background: 'var(--accent-cyan)', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.2, zIndex: -1 }} />

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '15px', borderRadius: '50%' }}>
            <Activity color="var(--accent-cyan)" size={32} />
          </div>
        </div>

        <h2 style={{ marginBottom: '8px', fontSize: '1.8rem', fontWeight: 600 }}>ClinicManager</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
          {isRegistering ? 'Crie a conta do consultório com o código de convite que recebeu' : 'Faça login para gerenciar sua clínica'}
        </p>

        {error     && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.88rem', textAlign: 'left' }}>{error}</div>}
        {successMsg && <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.88rem' }}>{successMsg}</div>}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {isRegistering && (
            <>
              {/* Convite */}
              <div style={{ marginBottom: '18px' }}>
                <label className="input-label">Código de convite</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="cminv_…"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  O cadastro na nuvem só é possível com um convite válido enviado pelo dono do produto.
                </p>
              </div>

              {/* Nome */}
              <div style={{ marginBottom: '18px' }}>
                <label className="input-label">Nome da Clínica</label>
                <input type="text" className="input-field" placeholder="Ex: Clínica Sorriso" value={nome}
                  onChange={(e) => setNome(e.target.value)} required />
              </div>

              {/* CNPJ (opcional) */}
              <div style={{ marginBottom: '18px' }}>
                <label className="input-label">CNPJ (opcional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Deixe em branco se não tiver CNPJ"
                  value={cnpj}
                  onChange={handleCnpjChange}
                  onBlur={handleCnpjBlur}
                  style={borderColor(cnpjStatus.status) ? { borderColor: borderColor(cnpjStatus.status), boxShadow: `0 0 0 2px ${borderColor(cnpjStatus.status)}30` } : {}}
                />
                <FieldStatus {...cnpjStatus} />
              </div>

              {/* CRO */}
              <div style={{ marginBottom: '18px' }}>
                <label className="input-label">CRO do Responsável</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: 12345-SP"
                  value={cro}
                  onChange={handleCroChange}
                  required
                  style={borderColor(croStatus.status) ? { borderColor: borderColor(croStatus.status), boxShadow: `0 0 0 2px ${borderColor(croStatus.status)}30` } : {}}
                />
                <FieldStatus {...croStatus} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Formato: número seguido da UF (ex: 12345-SP). Validação de existência no CRO não está disponível via API pública.
                </p>
              </div>
            </>
          )}

          {/* Usuário */}
          <div style={{ marginBottom: '18px' }}>
            <label className="input-label">Usuário</label>
            <input type="text" className="input-field" placeholder="Digite seu usuário"
              value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          {/* Senha */}
          <div style={{ marginBottom: '28px' }}>
            <label className="input-label">Senha</label>
            <input type="password" className="input-field" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginBottom: '16px', opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            disabled={!canSubmit}
          >
            {loading
              ? (isRegistering ? 'Verificando...' : 'Aguarde...')
              : (isRegistering ? 'Cadastrar Clínica' : 'Entrar no Sistema')}
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
            </span>{' '}
            <span onClick={switchMode} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 500 }}>
              {isRegistering ? 'Faça Login' : 'Tenho um convite'}
            </span>
          </div>
        </form>
      </div>

      {showMigrationModal && (
        <CloudMigrationModal
          onConfirm={async () => {
            if (pendingClinicId) {
              await window.electronAPI?.syncNow(pendingClinicId);
            }
          }}
          onDismiss={() => {
            localStorage.setItem('@ClinicManager:migrationDone', '1');
            setShowMigrationModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Login;
