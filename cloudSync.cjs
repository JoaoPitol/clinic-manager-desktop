/**
 * cloudSync.cjs — camada de sincronização offline-first com o backend na nuvem.
 *
 * Suporta:
 *  - Backend Spring: /api/auth/login, /api/auth/register + GET /health ou /actuator/health
 *  - Backend Node:  /auth/login, /auth/register + GET /health
 *
 * URL padrão: defina CLINIC_CLOUD_URL se o deploy tiver outro host.
 */

const https = require('https');
const http = require('http');

const CLOUD_URL = (process.env.CLINIC_CLOUD_URL || 'https://clinic-manager-api-production.up.railway.app').replace(/\/$/, '');

const SYNC_TIMEOUT_MS = 15000;

/** 'spring' | 'node' | null — definido após login ou registro bem-sucedido na nuvem */
let _cloudApiKind = null;

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
 * Distingue "algum HTTP 200 qualquer" de "o nosso servidor a responder":
 * o nosso /health devolve { status: 'ok', service: 'clinic-manager-api' }.
 * Se o body não tiver o campo `service`, regista aviso mas ainda conta como online
 * (compatível com versões anteriores que só devolviam { status: 'ok' }).
 */
async function isOnline() {
  const paths = ['/health', '/actuator/health'];
  for (const path of paths) {
    try {
      const res = await request('GET', path, null, null);
      if (res.status !== 200) continue;
      const body = res.body;
      if (typeof body === 'object' && body !== null) {
        if (body.status === 'ok') return true;
        // Outro JSON 200 — provavelmente não é o nosso servidor
        console.warn('[cloudSync] /health devolveu JSON inesperado:', JSON.stringify(body).slice(0, 80));
        continue;
      }
      // Texto simples "OK" — não é o nosso servidor (Railway proxy / outro processo)
      console.warn('[cloudSync] /health devolveu texto simples, não JSON — servidor pode não estar a correr:', String(body).slice(0, 40));
    } catch {
      /* próximo */
    }
  }
  return false;
}

/**
 * Login na nuvem — Spring (/api/auth/login + accessToken) depois Node (/auth/login + token).
 */
function readApiErrorMessage(body) {
  if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 220);
  if (body && typeof body === 'object') {
    if (body.message) return String(body.message).slice(0, 220);
    if (body.error) return String(body.error).slice(0, 220);
    if (Array.isArray(body.errors)) {
      const parts = body.errors
        .map((e) => {
          if (typeof e === 'string') return e;
          const f = e.field || e.objectName || '';
          const m = e.defaultMessage || e.message || '';
          return f && m ? `${f}: ${m}` : m || f;
        })
        .filter(Boolean);
      if (parts.length) return parts.join('; ').slice(0, 220);
    }
  }
  return null;
}

async function cloudLogin(username, password) {
  const attempts = [
    { path: '/api/auth/login', kind: 'spring' },
    { path: '/auth/login', kind: 'node' },
  ];

  let lastStatus = null;
  let lastPath = null;
  let lastError = null;
  let lastMessage = null;

  for (const { path, kind } of attempts) {
    try {
      const res = await request('POST', path, { username, password }, null);
      lastStatus = res.status;
      lastPath = path;
      const body = typeof res.body === 'object' && res.body ? res.body : {};
      const token = body.token || body.accessToken;
      if (res.status === 200 && token) {
        _cloudApiKind = kind;
        return { ok: true, token, apiKind: kind };
      }
      const msg = readApiErrorMessage(res.body);
      if (msg) lastMessage = msg;
    } catch (e) {
      lastError = e.message;
      /* tenta próximo endpoint */
    }
  }
  return { ok: false, status: lastStatus, path: lastPath, error: lastError, message: lastMessage };
}

/**
 * Cria (ou recupera) a conta na nuvem e devolve o token.
 * Estratégia: tenta LOGIN primeiro; só regista se receber 401/404.
 * `profile`: { nome, cnpj, username, id?, cro?, settings? }
 */
async function provisionCloudAccount(profile, password) {
  const nome = (profile.nome || '').trim();
  const cnpjDigits = (profile.cnpj || '').replace(/\D/g, '');
  const username = (profile.username || '').trim();
  const pass = (password || '').trim();

  console.log('[cloudSync] provisionCloudAccount:', {
    username,
    nomeOk: !!nome,
    cnpjDigits,
    passOk: !!pass,
    cloudUrl: CLOUD_URL,
  });

  if (!nome || !cnpjDigits || !username || !pass) {
    const missing = [!nome && 'nome', !cnpjDigits && 'CNPJ', !username && 'username', !pass && 'senha']
      .filter(Boolean).join(', ');
    return {
      ok: false,
      message: `Campos obrigatórios em falta: ${missing}. Confira em Configurações da clínica.`,
    };
  }

  if (cnpjDigits.length !== 14) {
    return {
      ok: false,
      message: `CNPJ deve ter 14 dígitos (recebido: ${cnpjDigits.length}). Corrija em Configurações da clínica.`,
    };
  }

  // ── 1. Tenta login primeiro ──────────────────────────────────────────────
  const loginResult = await cloudLogin(username, pass);
  if (loginResult.ok) {
    console.log('[cloudSync] provision: login OK sem precisar de registo');
    return loginResult;
  }
  console.log('[cloudSync] provision: login falhou, tenta registo —', loginResult.status, loginResult.message);

  // ── 2. Tenta registo (Spring → Node) ────────────────────────────────────
  const springBody = { nome, cnpj: cnpjDigits, username, password: pass };
  // Só envia `id` se for UUID válido — IDs antigos (timestamp numérico) são rejeitados pelo Postgres
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const nodeId = profile.id && UUID_RE.test(String(profile.id)) ? profile.id : undefined;

  const nodeBody = {
    ...(nodeId ? { id: nodeId } : {}),
    nome, cnpj: profile.cnpj,
    cro: profile.cro || '', username, password: pass, settings: profile.settings || {},
  };

  const registerAttempts = [
    { path: '/api/auth/register', body: springBody, kind: 'spring' },
    { path: '/auth/register', body: nodeBody, kind: 'node' },
  ];

  let lastMessage = loginResult.message || null;

  for (const { path, body, kind } of registerAttempts) {
    try {
      const res = await request('POST', path, body, null);
      const tokenFromBody = typeof res.body === 'object' && res.body
        ? (res.body.token || res.body.accessToken)
        : null;

      console.log('[cloudSync] register', kind, path, '→', res.status,
        typeof res.body === 'string' ? res.body.slice(0, 120) : JSON.stringify(res.body).slice(0, 120));

      // Sucesso com token direto (Node backend)
      if (res.status === 201 && tokenFromBody) {
        _cloudApiKind = kind;
        return { ok: true, token: tokenFromBody, apiKind: kind };
      }

      // Spring: 201 com body string → faz login
      if (res.status === 201) {
        _cloudApiKind = kind;
        const afterReg = await cloudLogin(username, pass);
        if (afterReg.ok) return afterReg;
        lastMessage = afterReg.message || `Registo OK na ${kind} mas login falhou (${afterReg.status})`;
        continue;
      }

      // 400 / 409 / 422 — conta já existe ou dados inválidos → tenta login
      if (res.status === 400 || res.status === 409 || res.status === 422) {
        const errText = readApiErrorMessage(res.body);
        if (errText) lastMessage = errText;
        console.warn('[cloudSync] register recusado', kind, res.status, errText || '');
        const afterLogin = await cloudLogin(username, pass);
        if (afterLogin.ok) return afterLogin;
        if (errText) lastMessage = errText;
        continue;
      }

      // 5xx ou outro erro
      const errText = readApiErrorMessage(res.body);
      lastMessage = errText
        ? `Erro ${res.status} em ${kind}: ${errText}`
        : `Erro ${res.status} ao chamar ${path} (${kind})`;
      console.error('[cloudSync] register HTTP', res.status, path, errText || res.body);

    } catch (e) {
      lastMessage = `Falha de rede ao contactar ${path}: ${e.message}`;
      console.warn('[cloudSync] register exception', path, e.message);
    }
  }

  return {
    ok: false,
    message: lastMessage || `Registo na nuvem falhou. URL: ${CLOUD_URL}`,
  };
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
    },
    password
  );
}

/**
 * Sincronização em lote (somente API Node com POST /auth/sync).
 */
async function syncClinic(db, clinicId, token) {
  if (!token) return { synced: false, reason: 'sem-token', online: false, cloudAuth: false };

  if (!await isOnline()) return { synced: false, reason: 'offline', online: false, cloudAuth: true };

  if (_cloudApiKind === 'spring') {
    console.warn('[cloudSync] API Spring: sem POST /auth/sync — dados só locais.');
    return { synced: false, reason: 'no-sync-endpoint', online: true, cloudAuth: true };
  }

  try {
    const localDB = db.readDBForSync(clinicId);
    const lastSyncAt = localDB.lastSyncAt || null;

    // pendingSync !== false: inclui registros novos (true) e legados (undefined)
    // mas exclui os já confirmados pela nuvem (false)
    const pendingPatients = localDB.patients.filter((p) => p.pendingSync !== false);
    const pendingAppointments = localDB.appointments.filter((a) => a.pendingSync !== false);
    const pendingExpenses = localDB.expenses.filter((e) => e.pendingSync !== false);

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

    db.applySyncResult(clinicId, {
      patients: remote.patients || [],
      appointments: remote.appointments || [],
      expenses: remote.expenses || [],
      syncedAt: remote.syncedAt,
    });

    console.log(`[cloudSync] Sync OK @ ${remote.syncedAt}`);
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
  syncClinic,
  CLOUD_URL,
};
