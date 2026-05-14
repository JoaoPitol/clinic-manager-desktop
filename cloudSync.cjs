/**
 * cloudSync.cjs — camada de sincronização offline-first com o backend na nuvem.
 *
 * Backend: Node.js /auth/* + GET /health
 * URL padrão: defina CLINIC_CLOUD_URL se o deploy tiver outro host.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ── Criptografia de dados clínicos (AES-256-GCM) ─────────────────────────────
// Versão do esquema — permite migração futura sem quebrar dados antigos.
const ENC_VERSION = 'cm1';

/**
 * Username canónico para API e para derivação de chave (deve coincidir com provisionCloudAccount).
 */
function normalizeCloudUsername(raw) {
  const rawUsername = String(raw ?? '').trim();
  if (!rawUsername) return '';
  return rawUsername
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._@\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .slice(0, 50);
}

/**
 * Deriva uma chave AES-256 a partir das credenciais da clínica.
 * O material de username é sempre o valor normalizado (igual ao enviado em /auth/login e /auth/register).
 */
function deriveEncryptionKey(password, username) {
  const user = normalizeCloudUsername(username);
  return crypto.scryptSync(
    `${user}\x00${password}`,
    'clinic-manager-patient-data:v1',
    32 // 256 bits
  );
}

/** Comportamento antigo: username tal como na UI / BD local (sem normalização). Só para decriptar dados antigos. */
function deriveEncryptionKeyLegacy(password, username) {
  return crypto.scryptSync(
    `${username}\x00${password}`,
    'clinic-manager-patient-data:v1',
    32
  );
}

/**
 * Par (canónica, legado) para sync: legado só quando o username local difere do normalizado.
 */
function buildEncryptionKeyPair(password, username) {
  const raw = username == null ? '' : String(username);
  const norm = normalizeCloudUsername(username);
  const key = deriveEncryptionKey(password, username);
  if (norm === raw) return { key, legacy: null };
  return { key, legacy: deriveEncryptionKeyLegacy(password, username) };
}

/**
 * Encripta os campos sensíveis de um registo antes de enviar para a nuvem.
 * Mantém id, clinicId, updatedAt e _deleted em claro (necessários pelo servidor
 * para resolução de conflitos e consultas SQL), encripta todo o resto.
 */
function encryptRecord(record, key) {
  if (!key || !record) return record;
  const { id, clinicId, updatedAt, updated_at, _deleted, pendingSync, ...sensitive } = record;
  const iv = crypto.randomBytes(12); // 96 bits — tamanho recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(sensitive), 'utf8');
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes de autenticação
  return {
    id,
    ...(clinicId !== undefined ? { clinicId } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(updated_at !== undefined ? { updated_at } : {}),
    ...(typeof _deleted !== 'undefined' ? { _deleted } : {}),
    _enc: ENC_VERSION,
    _iv: iv.toString('base64'),
    _ct: Buffer.concat([ct, tag]).toString('base64'),
  };
}

/**
 * Decripta um registo recebido da nuvem.
 * Se o registo não tiver _enc (dados legados em claro), retorna-o intacto.
 * Retorna null se a autenticação GCM falhar (dados corrompidos ou chave errada).
 */
function tryDecryptRecord(record, key) {
  const iv = Buffer.from(record._iv, 'base64');
  const ctWithTag = Buffer.from(record._ct, 'base64');
  const tag = ctWithTag.slice(-16);
  const ct = ctWithTag.slice(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  const sensitive = JSON.parse(plain.toString('utf8'));
  const { _enc: _e, _iv: _i, _ct: _c, ...meta } = record;
  return { ...meta, ...sensitive };
}

function decryptRecord(record, key, keyLegacy = null) {
  if (!record) return null;
  if (record._enc !== ENC_VERSION) return record; // dado legado — em claro
  if (!key) {
    console.warn('[cloudSync] Registo encriptado recebido mas sem chave disponível');
    return record; // devolve envelope sem decriptar
  }
  try {
    return tryDecryptRecord(record, key);
  } catch (e) {
    if (keyLegacy && Buffer.compare(key, keyLegacy) !== 0) {
      try {
        return tryDecryptRecord(record, keyLegacy);
      } catch (e2) {
        console.error('[cloudSync] Falha na decriptação AES-GCM (legado):', e2.message);
        return null;
      }
    }
    console.error('[cloudSync] Falha na decriptação AES-GCM:', e.message);
    return null;
  }
}

const CLOUD_URL = (process.env.CLINIC_CLOUD_URL || 'https://clinic-manager-api-production.up.railway.app').replace(/\/$/, '');

const SYNC_TIMEOUT_MS = 15000;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${CLOUD_URL}/`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: SYNC_TIMEOUT_MS,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Verifica se o servidor Clinic Manager está activo.
 * O nosso /health devolve { status: 'ok', service: 'clinic-manager-api' }.
 */
async function isOnline() {
  try {
    const res = await request('GET', '/health', null, null);
    if (res.status !== 200) return false;
    const body = res.body;
    if (typeof body === 'object' && body !== null && body.status === 'ok') return true;
    console.warn('[cloudSync] /health devolveu resposta inesperada:', JSON.stringify(body).slice(0, 80));
  } catch {
    /* offline */
  }
  return false;
}

function readApiErrorMessage(body) {
  if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 220);
  if (body && typeof body === 'object') {
    if (body.message) return String(body.message).slice(0, 220);
    if (body.error) return String(body.error).slice(0, 220);
  }
  return null;
}

async function cloudLogin(username, password) {
  try {
    const u = normalizeCloudUsername(username);
    if (!u) {
      return { ok: false, status: 400, message: 'Username inválido' };
    }
    const res = await request('POST', '/auth/login', { username: u, password }, null);
    const body = typeof res.body === 'object' && res.body ? res.body : {};
    const token = body.token;
    if (res.status === 200 && token) {
      return { ok: true, token };
    }
    const message = readApiErrorMessage(res.body);
    return { ok: false, status: res.status, message };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Cria (ou recupera) a conta na nuvem e devolve o token.
 * Estratégia: tenta LOGIN primeiro; só regista se receber 401/404.
 * `profile`: { nome, cnpj, username, id?, cro?, settings?, inviteToken? } — `inviteToken` obrigatório para registo na nuvem (login falhou).
 */
async function provisionCloudAccount(profile, password) {
  const nome = (profile.nome || '').trim();
  const cnpjDigits = (profile.cnpj || '').replace(/\D/g, '');
  const rawUsername = (profile.username || '').trim();
  const username = normalizeCloudUsername(profile.username);
  const pass = (password || '').trim();

  if (rawUsername !== username) {
    console.log(`[cloudSync] username normalizado: "${rawUsername}" → "${username}"`);
  }

  console.log('[cloudSync] provisionCloudAccount:', {
    username,
    nomeOk: !!nome,
    cnpjDigits: cnpjDigits.length,
    passOk: !!pass,
    cloudUrl: CLOUD_URL,
    hasInvite: !!(profile.inviteToken && String(profile.inviteToken).trim()),
  });

  if (!nome || !username || !pass) {
    const missing = [!nome && 'nome', !username && 'username', !pass && 'senha']
      .filter(Boolean).join(', ');
    return {
      ok: false,
      message: `Campos obrigatórios em falta: ${missing}. Confira em Configurações da clínica.`,
    };
  }

  if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
    return {
      ok: false,
      message: 'CNPJ deve ter 14 dígitos ou ficar em branco. Corrija em Configurações da clínica.',
    };
  }

  // ── 1. Tenta login primeiro ──────────────────────────────────────────────
  const loginResult = await cloudLogin(username, pass);
  if (loginResult.ok) {
    console.log('[cloudSync] provision: login OK sem precisar de registo');
    return loginResult;
  }
  console.log('[cloudSync] provision: login falhou, tenta registo —', loginResult.status, loginResult.message);

  const inviteToken = (profile.inviteToken && String(profile.inviteToken).trim()) || '';
  const rawSt = profile.settings || {};
  const { pendingInviteToken: _omit, ...settingsForCloud } = rawSt;

  // ── 2. Tenta registo ────────────────────────────────────────────────────
  if (!inviteToken) {
    return {
      ok: false,
      message: 'É necessário um convite válido para criar a conta na nuvem. Use o código enviado pelo administrador ou conclua o cadastro com o convite recebido.',
    };
  }

  // Só envia `id` se for UUID válido — IDs antigos (timestamp numérico) são rejeitados pelo Postgres
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const nodeId = profile.id && UUID_RE.test(String(profile.id)) ? profile.id : undefined;

  const registerBody = {
    ...(nodeId ? { id: nodeId } : {}),
    nome, cnpj: profile.cnpj,
    cro: profile.cro || '', username, password: pass, settings: settingsForCloud,
    inviteToken,
  };

  let lastMessage = loginResult.message || null;

  try {
    const res = await request('POST', '/auth/register', registerBody, null);
    const tokenFromBody = typeof res.body === 'object' && res.body ? res.body.token : null;

    console.log('[cloudSync] register node /auth/register →', res.status,
      JSON.stringify(res.body).slice(0, 120));

    if (res.status === 201 && tokenFromBody) {
      return { ok: true, token: tokenFromBody };
    }

    // 400 / 409 — conta já existe ou dados inválidos → tenta login novamente
    if (res.status === 400 || res.status === 403 || res.status === 409 || res.status === 422) {
      const errText = readApiErrorMessage(res.body);
      if (errText) lastMessage = errText;
      console.warn('[cloudSync] register recusado', res.status, errText || '');
      const afterLogin = await cloudLogin(username, pass);
      if (afterLogin.ok) return afterLogin;
      if (errText) lastMessage = errText;
    } else {
      const errText = readApiErrorMessage(res.body);
      lastMessage = errText || `Erro ${res.status} ao registar`;
      console.error('[cloudSync] register HTTP', res.status, errText || res.body);
    }
  } catch (e) {
    lastMessage = `Falha de rede: ${e.message}`;
    console.warn('[cloudSync] register exception', e.message);
  }

  return {
    ok: false,
    message: lastMessage || `Registo na nuvem falhou. URL: ${CLOUD_URL}`,
  };
}

/**
 * Obtém o perfil da clínica autenticada na nuvem (GET /auth/me).
 * Retorna { ok, clinic } onde clinic = { id, username, nome, cnpj, cro, settings }.
 */
async function getCloudProfile(token) {
  if (!token) return { ok: false };
  try {
    const res = await request('GET', '/auth/me', null, token);
    if (res.status === 200 && res.body?.clinic) {
      return { ok: true, clinic: res.body.clinic };
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function cloudRegister(clinicData, password) {
  return provisionCloudAccount(
    {
      nome: clinicData.nome,
      cnpj: clinicData.cnpj,
      username: clinicData.username,
      id: clinicData.id,
      cro: clinicData.cro,
      settings: clinicData.settings,
      inviteToken: clinicData.inviteToken,
    },
    password
  );
}

/**
 * Sincronização em lote (somente API Node com POST /auth/sync).
 * @param {object} db - instância do banco local
 * @param {string} clinicId - UUID da clínica
 * @param {string} token - JWT de autenticação na nuvem
 * @param {Buffer|null} encryptionKey - chave AES-256 derivada (username normalizado);
 *   se null, dados são enviados sem criptografia (legado / primeiro login)
 * @param {Buffer|null} [encryptionKeyLegacy] - tentativa de decriptação se a chave canónica falhar
 */
async function syncClinic(db, clinicId, token, encryptionKey = null, encryptionKeyLegacy = null) {
  if (!token) return { synced: false, reason: 'sem-token', online: false, cloudAuth: false };

  if (!await isOnline()) return { synced: false, reason: 'offline', online: false, cloudAuth: true };

  try {
    const localDB = db.readDBForSync(clinicId);
    const lastSyncAt = localDB.lastSyncAt || null;

    // pendingSync !== false: inclui registros novos (true) e legados (undefined)
    // mas exclui os já confirmados pela nuvem (false)
    const pendingPatients = localDB.patients
      .filter((p) => p.pendingSync !== false)
      .map((p) => encryptionKey ? encryptRecord(p, encryptionKey) : p);
    const pendingAppointments = localDB.appointments
      .filter((a) => a.pendingSync !== false)
      .map((a) => encryptionKey ? encryptRecord(a, encryptionKey) : a);
    const pendingExpenses = localDB.expenses
      .filter((e) => e.pendingSync !== false)
      .map((e) => encryptionKey ? encryptRecord(e, encryptionKey) : e);

    const res = await request(
      'POST',
      '/auth/sync',
      {
        clinicId,
        patients: pendingPatients,
        appointments: pendingAppointments,
        expenses: pendingExpenses,
        lastSyncAt,
      },
      token
    );

    if (res.status === 404) {
      return { synced: false, reason: 'no-sync-endpoint', online: true, cloudAuth: true };
    }

    if (res.status === 401 || res.status === 403) {
      return { synced: false, reason: `http-${res.status}`, online: true, cloudAuth: false };
    }

    if (res.status !== 200) {
      console.error('Sync: resposta inesperada', res.status, res.body);
      return { synced: false, reason: `http-${res.status}`, online: true, cloudAuth: true };
    }

    const remote = res.body;

    // Decripta registros recebidos da nuvem antes de armazenar localmente
    const decryptList = (list) => (list || [])
      .map((r) => (encryptionKey ? decryptRecord(r, encryptionKey, encryptionKeyLegacy) : r))
      .filter(Boolean); // filtra registros que falharam na decriptação

    db.applySyncResult(clinicId, {
      patients: decryptList(remote.patients),
      appointments: decryptList(remote.appointments),
      expenses: decryptList(remote.expenses),
      syncedAt: remote.syncedAt,
    });

    console.log(`[cloudSync] Sync OK @ ${remote.syncedAt}${encryptionKey ? ' (encriptado)' : ''}`);
    return { synced: true, online: true, cloudAuth: true };
  } catch (err) {
    console.error('[cloudSync] Erro na sincronização:', err.message);
    return { synced: false, reason: err.message, online: true, cloudAuth: true };
  }
}

module.exports = {
  isOnline,
  cloudLogin,
  cloudRegister,
  provisionCloudAccount,
  getCloudProfile,
  syncClinic,
  normalizeCloudUsername,
  deriveEncryptionKey,
  buildEncryptionKeyPair,
  CLOUD_URL,
};
