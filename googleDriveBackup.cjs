/**
 * Backup do arquivo clinic_database.json para Google Drive (OAuth2).
 * No Google Cloud Console: crie credenciais "App para computador",
 * adicione URI de redirecionamento: http://127.0.0.1:45213/oauth2callback
 * Escopo: drive.file (apenas arquivos criados por este app).
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { app, shell } = require('electron');
const { google } = require('googleapis');

const REDIRECT_PORT = 45213;
const REDIRECT_PATH = '/oauth2callback';
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}${REDIRECT_PATH}`;
const FOLDER_NAME = 'ClinicManagerBackups';
const BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000;

function clientConfigPath() {
  return path.join(app.getPath('userData'), 'google_oauth_client.json');
}

function tokenPath() {
  return path.join(app.getPath('userData'), 'google_drive_tokens.json');
}

function readClientConfig() {
  const p = clientConfigPath();
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j.clientId && j.clientSecret) return j;
    if (j.installed?.client_id) {
      return { clientId: j.installed.client_id, clientSecret: j.installed.client_secret };
    }
    if (j.web?.client_id) {
      return { clientId: j.web.client_id, clientSecret: j.web.client_secret };
    }
  } catch (_) {}
  return null;
}

function loadTokens() {
  const p = tokenPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function saveTokens(tokens) {
  const prev = loadTokens() || {};
  const merged = { ...prev, ...tokens };
  fs.writeFileSync(tokenPath(), JSON.stringify(merged, null, 2), 'utf8');
}

function setBackupMeta({ lastAt, error }) {
  const t = loadTokens() || {};
  if (lastAt) t.lastBackupAt = lastAt;
  if (error !== undefined) t.lastBackupError = error;
  fs.writeFileSync(tokenPath(), JSON.stringify(t, null, 2), 'utf8');
}

function createOAuthClient(cfg) {
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, REDIRECT_URI);
}

function getStatus() {
  const cfg = readClientConfig();
  const tok = loadTokens();
  return {
    clientConfigured: !!(cfg && cfg.clientId && cfg.clientSecret),
    connected: !!(tok && tok.refresh_token),
    lastBackupAt: tok?.lastBackupAt || null,
    lastBackupError: tok?.lastBackupError ?? null,
    redirectUri: REDIRECT_URI,
  };
}

function saveClientConfig({ clientId, clientSecret }) {
  fs.writeFileSync(
    clientConfigPath(),
    JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }, null, 2),
    'utf8'
  );
}

function disconnect() {
  const p = tokenPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return { success: true };
}

function connectGoogleDrive() {
  return new Promise((resolve) => {
    const cfg = readClientConfig();
    if (!cfg) {
      resolve({ success: false, error: 'Configure o Client ID e o Client Secret primeiro.' });
      return;
    }
    const oauth2Client = createOAuthClient(cfg);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent',
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        server.close();
      } catch (_) {}
      resolve({ success: false, error: 'Tempo esgotado. Tente conectar novamente.' });
    }, 10 * 60 * 1000);

    const server = http.createServer(async (req, res) => {
      if (!req.url || !req.url.startsWith(REDIRECT_PATH)) return;
      const url = new URL(req.url, `http://127.0.0.1:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      const errParam = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px">' +
          '<p>Autorização concluída. Pode fechar esta janela.</p></body></html>'
      );
      try {
        server.close();
      } catch (_) {}

      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (errParam) {
        resolve({ success: false, error: errParam });
        return;
      }
      if (!code) {
        resolve({ success: false, error: 'Código de autorização ausente.' });
        return;
      }
      try {
        const { tokens } = await oauth2Client.getToken(code);
        saveTokens(tokens);
        resolve({ success: true });
      } catch (e) {
        resolve({ success: false, error: e.message || String(e) });
      }
    });

    server.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        success: false,
        error:
          err.code === 'EADDRINUSE'
            ? `Porta ${REDIRECT_PORT} em uso. Feche o outro processo ou reinicie o app.`
            : err.message,
      });
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      shell.openExternal(authUrl);
    });
  });
}

async function getOrCreateBackupFolder(drive) {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME.replace(/'/g, "\\'")}' and trashed=false`;
  const list = await drive.files.list({
    q,
    fields: 'files(id,name)',
    spaces: 'drive',
  });
  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id;
  }
  const created = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  return created.data.id;
}

async function uploadBackupNow(db) {
  const cfg = readClientConfig();
  const tok = loadTokens();
  if (!cfg) return { success: false, error: 'Credenciais Google não configuradas.' };
  if (!tok?.refresh_token) return { success: false, error: 'Conta Google não conectada.' };

  const dbPath = db.getDatabaseFilePath();
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: 'Arquivo de banco não encontrado.' };
  }

  const oauth2Client = createOAuthClient(cfg);
  oauth2Client.setCredentials(tok);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const folderId = await getOrCreateBackupFolder(drive);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `clinic_database_backup_${stamp}.dat`;
    await drive.files.create({
      requestBody: { name, parents: [folderId] },
      media: {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(dbPath),
      },
      fields: 'id,name',
    });
    setBackupMeta({ lastAt: new Date().toISOString(), error: null });
    return { success: true };
  } catch (e) {
    const msg = e.message || String(e);
    const t = loadTokens();
    if (t) {
      t.lastBackupError = msg;
      fs.writeFileSync(tokenPath(), JSON.stringify(t, null, 2), 'utf8');
    }
    return { success: false, error: msg };
  }
}

let backupTimer = null;

function startBackupScheduler(db) {
  if (backupTimer) clearInterval(backupTimer);
  const run = () => {
    const st = getStatus();
    if (!st.connected) return;
    uploadBackupNow(db).catch((e) => console.error('[Drive backup]', e));
  };
  backupTimer = setInterval(run, BACKUP_INTERVAL_MS);
  setTimeout(run, 2 * 60 * 1000);
}

module.exports = {
  getStatus,
  saveClientConfig,
  connectGoogleDrive,
  disconnect,
  uploadBackupNow,
  startBackupScheduler,
  BACKUP_INTERVAL_MS,
};
