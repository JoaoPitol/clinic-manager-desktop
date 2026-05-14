const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const db = require('./database.cjs');
const driveBackup = require('./googleDriveBackup.cjs');
const cloudSync = require('./cloudSync.cjs');

// Auto-updater: só verifica em produção
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Tokens de sessão vivem apenas na memória do processo main.
// Mapa: sessionToken (hex 32 bytes) → clinicId
const activeSessions = new Map();

// Mapa: clinicId → cloudJWT (obtido após cloudLogin bem-sucedido)
const cloudTokens = new Map();

// Mapa: clinicId → Buffer(32) — chave AES-256 derivada das credenciais do utilizador.
// Nunca sai da memória do processo main; não é persistida em disco nem enviada à rede.
const cloudEncryptionKeys = new Map();
/** Chave derivada com username local bruto (antes da normalização) — só para decriptar dados antigos. */
const cloudEncryptionKeysLegacy = new Map();

function rememberCloudEncryptionPairs(clinicId, password, username) {
  const { key, legacy } = cloudSync.buildEncryptionKeyPair(password, username);
  cloudEncryptionKeys.set(clinicId, key);
  if (legacy) cloudEncryptionKeysLegacy.set(clinicId, legacy);
  else cloudEncryptionKeysLegacy.delete(clinicId);
}

// Intervalo de sync periódico (5 minutos)
let syncInterval = null;

function validateSession(sessionToken, clinicId) {
  if (!sessionToken || !clinicId) return false;
  return activeSessions.get(sessionToken) === clinicId;
}

function checkWhatsAppReminders() {
  let clinics;
  try {
    clinics = db.getAllClinics();
  } catch (e) {
    console.error('checkWhatsAppReminders: erro ao ler banco:', e);
    return;
  }
  const now = new Date();
  
  clinics.forEach(clinic => {
    if (clinic.settings && clinic.settings.whatsappRemindersEnabled) {
      const template = clinic.settings.whatsappMessageTemplate || '';
      if (!template) return;
      
      const clinicPhone = clinic.settings.telefoneClinica || '';
      
      // Ajustar fuso para pegar data correta
      const offsetDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
      const todayStr = offsetDate.toISOString().split('T')[0];
      
      const appointments = db.getAppointments(clinic.id, todayStr) || [];
      const patients = db.getPatients(clinic.id) || [];
      
      appointments.forEach(appt => {
        if (appt.reminderSent) return;
        
        // Verifica a hora. Ex: "14:30"
        if (appt.time) {
          const [hours, minutes] = appt.time.split(':').map(Number);
          const apptTime = new Date(now);
          apptTime.setHours(hours, minutes, 0, 0);
          
          const diffMs = apptTime.getTime() - now.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);
          
          // Se a consulta é em 120 minutos (2 horas) e até 115 min (para garantir que pega no intervalo)
          if (diffMinutes <= 120 && diffMinutes > 115) {
            const patient = patients.find(p => p.id === appt.patientId);
            if (patient && patient.fone) {
              // Format phone: remove non-numeric
              const phone = patient.fone.replace(/\D/g, '');
              if (phone.length >= 10) {
                let msg = template
                  .replace('{nomePaciente}', patient.nomeCompleto || 'Paciente')
                  .replace('{hora}', appt.time)
                  .replace('{nomeClinica}', clinic.nome || 'Nossa Clínica')
                  .replace('{telefoneClinica}', clinicPhone);
                  
                const encodedMsg = encodeURIComponent(msg);
                const url = `whatsapp://send?phone=55${phone}&text=${encodedMsg}`;
                
                shell.openExternal(url);
                db.markAppointmentReminderSent(clinic.id, appt.id);
              }
            }
          }
        }
      });
    }
  });
}

// Inicia verificação a cada 1 minuto
setInterval(checkWhatsAppReminders, 60 * 1000);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Clinic Manager',
    backgroundColor: '#1E1E1E', // Tema escuro inicial
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Em desenvolvimento: carrega o Vite em 127.0.0.1 (evita IPv6 localhost no Windows).
  // Se o Vite não estiver rodando, mostra instruções ou tenta dist/ se existir build.
  if (process.env.NODE_ENV === 'development') {
    const devUrl = 'http://127.0.0.1:5173/';
    let devFailHandled = false;
    mainWindow.webContents.on('did-fail-load', (event, _code, _desc, validatedURL, isMainFrame) => {
      if (!isMainFrame || devFailHandled) return;
      const u = String(validatedURL || '');
      if (!u.includes('5173')) return;
      devFailHandled = true;
      const distPath = path.join(__dirname, 'dist', 'index.html');
      if (fs.existsSync(distPath)) {
        console.warn('[Electron] Vite indisponível — usando dist/index.html');
        void mainWindow.loadFile(distPath);
        return;
      }
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Clinic Manager</title><style>body{font-family:Segoe UI,system-ui,sans-serif;padding:32px;max-width:640px;margin:0 auto;background:#1a1a1a;color:#eee;line-height:1.55}code{background:#333;padding:2px 8px;border-radius:4px}h1{color:#38bdf8;font-size:1.25rem}</style></head><body><h1>Servidor Vite não encontrado</h1><p>O app tentou abrir <code>http://127.0.0.1:5173</code> e não obteve resposta.</p><p><strong>Faça assim:</strong> feche esta janela e rode na pasta do projeto:</p><pre style="background:#111;padding:16px;border-radius:8px;color:#86efac">npm run electron:dev</pre><p>Ou em dois terminais: primeiro <code>npm run dev</code>, depois <code>npm run electron:start</code>.</p></body></html>`;
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    });
    mainWindow.loadURL(devUrl);

    // Em desenvolvimento abre DevTools por defeito (erros do React aparecem aqui).
    // Desative: ELECTRON_OPEN_DEVTOOLS=0 npm run electron:dev:local
    if (process.env.ELECTRON_OPEN_DEVTOOLS !== '0') {
      mainWindow.webContents.once('dom-ready', () => {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      });
    }

    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const prefix = `[renderer:${level}]`;
      if (level >= 2) console.error(prefix, message, sourceId && line != null ? `${sourceId}:${line}` : '');
      else console.log(prefix, message);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[Electron] render-process-gone:', details);
    });
  } else {
    // Em produção carrega do arquivo buildado
    const loadPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Loading production path:', loadPath);
    mainWindow.loadFile(loadPath).catch(err => console.error('Failed to load file:', err));
    
    // Habilitar DevTools temporariamente para diagnosticar a tela preta
    // mainWindow.webContents.openDevTools();
  }

  // Limpa tokens de sessão do localStorage ao carregar a janela.
  // Garante que após reiniciar o app o utilizador é sempre enviado para login
  // (evita estado inválido: localStorage com token mas preload sem _sessionToken).
  // Apenas em produção: em dev o Vite faz hot reload e limparia a sessão continuamente.
  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        localStorage.removeItem('@ClinicManager:token');
        localStorage.removeItem('@ClinicManager:nome');
      `).catch(() => {});
    });
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  });

  // ── Auto-update ─────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.on('update-available', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', { version: info.version });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', { version: info.version });
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('autoUpdater error:', err.message);
    });

    // Checa por atualizações 5 segundos após a janela estar pronta
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Erro ao checar atualizações:', err.message);
      });
    }, 5000);
  }
  // ────────────────────────────────────────────────────────────────────────────

  // Sync periódico a cada 5 minutos para todas as sessões ativas
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(async () => {
    for (const [sessionToken, clinicId] of activeSessions) {
      const token = cloudTokens.get(clinicId) || db.getCloudToken(clinicId);
      if (!token) continue;
      const encKey = cloudEncryptionKeys.get(clinicId) || null;
      const encLegacy = cloudEncryptionKeysLegacy.get(clinicId) || null;
      const result = await cloudSync.syncClinic(db, clinicId, token, encKey, encLegacy).catch(() => ({
        synced: false,
        online: false,
        reason: 'erro',
        cloudAuth: true,
      }));
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-status', {
          synced: result.synced,
          online: result.online !== false,
          cloudAuth: result.cloudAuth !== false,
          syncedAt: result.synced ? new Date().toISOString() : undefined,
          noBulkSync: result.reason === 'no-sync-endpoint',
          hint: null,
          detail: null,
        });
      }
    }
  }, 5 * 60 * 1000);
}

app.on('ready', () => {
  // Registrando canais de comunicação com o banco local
  ipcMain.handle('register-clinic', async (event, data) => {
    const result = db.registerClinic(data);
    if (!result.success || !result.clinicId) {
      return result;
    }

    try {
      rememberCloudEncryptionPairs(result.clinicId, data.password, data.username);
    } catch (e) {
      console.error('[main] Falha ao derivar chave de criptografia:', e.message);
    }

    let online = false;
    try {
      online = await cloudSync.isOnline();
    } catch {
      online = false;
    }

    const profile = {
      id: result.clinicId,
      nome: data.nome,
      cnpj: data.cnpj,
      cro: data.cro,
      username: data.username,
      settings: {},
      inviteToken: String(data.inviteCode || '').trim(),
    };

    if (!online) {
      cloudSync.provisionCloudAccount(profile, data.password)
        .then((prov) => {
          if (prov.ok) db.clearPendingCloudInvite(result.clinicId);
        })
        .catch((err) => console.error('[cloudSync] provision pós-cadastro:', err));
      return result;
    }

    const prov = await cloudSync.provisionCloudAccount(profile, data.password);
    if (!prov.ok) {
      cloudEncryptionKeys.delete(result.clinicId);
      cloudEncryptionKeysLegacy.delete(result.clinicId);
      const del = db.deleteClinicById(result.clinicId);
      if (!del.success) {
        console.error('[main] rollback cadastro local falhou:', del.error);
      }
      return {
        success: false,
        error:
          prov.message
          || 'Não foi possível validar o convite na nuvem. Verifique o código e tente novamente.',
      };
    }

    db.clearPendingCloudInvite(result.clinicId);
    return result;
  });

  ipcMain.handle('login-clinic', async (event, data) => {
    let result = db.loginClinic(data);

    // ── Restauro automático da nuvem (PC novo / base local apagada) ──────────
    if (!result.success && await cloudSync.isOnline()) {
      const cloudResult = await cloudSync.cloudLogin(data.username, data.password);
      if (cloudResult.ok) {
        const profileRes = await cloudSync.getCloudProfile(cloudResult.token);
        if (profileRes.ok) {
          const c = profileRes.clinic;
          const regResult = db.registerClinic({
            id: c.id,                         // mesmo UUID da nuvem — essencial para sync
            nome: c.nome || data.username,
            cnpj: c.cnpj || '',
            cro: c.cro || '',
            username: data.username,
            password: data.password,
            settings: c.settings || {},       // restaura configurações da clínica
          }, { skipInviteCheck: true });
          if (regResult.success) {
            result = db.loginClinic(data);
            if (result.success) {
              const sessionToken = crypto.randomBytes(32).toString('hex');
              activeSessions.set(sessionToken, result.clinicId);
              cloudTokens.set(result.clinicId, cloudResult.token);
              db.setCloudToken(result.clinicId, cloudResult.token);
              // Derivar e armazenar chave de criptografia
              try {
                rememberCloudEncryptionPairs(result.clinicId, data.password, data.username);
              } catch (e) {
                console.error('[main] Falha ao derivar chave no restore:', e.message);
              }
              const encKey = cloudEncryptionKeys.get(result.clinicId) || null;
              const encLegacy = cloudEncryptionKeysLegacy.get(result.clinicId) || null;
              // Puxa todos os dados da nuvem (decriptados automaticamente)
              const syncResult = await cloudSync.syncClinic(db, result.clinicId, cloudResult.token, encKey, encLegacy);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('sync-status', {
                  synced: syncResult.synced,
                  online: true,
                  cloudAuth: true,
                  syncedAt: syncResult.synced ? new Date().toISOString() : undefined,
                  noBulkSync: syncResult.reason === 'no-sync-endpoint',
                  hint: null,
                  detail: null,
                  restoredFromCloud: true,
                });
              }
              return { ...result, sessionToken, restoredFromCloud: true };
            }
          }
        }
      }
    }

    if (result.success) {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      activeSessions.set(sessionToken, result.clinicId);

      // Derivar e armazenar chave de criptografia em memória
      try {
        rememberCloudEncryptionPairs(result.clinicId, data.password, data.username);
      } catch (e) {
        console.error('[main] Falha ao derivar chave de criptografia no login:', e.message);
      }

      // Tenta login na nuvem; se o Postgres estiver vazio (401), cria a conta via /api/auth/register e loga de novo.
      cloudSync.cloudLogin(data.username, data.password).then(async (cloudResult) => {
        let final = cloudResult;
        let detail = cloudResult.message || null;
        if (!cloudResult.ok) {
          const apiUp = await cloudSync.isOnline();
          if (apiUp) {
            const clin = db.getClinic(result.clinicId);
            if (clin.success) {
              const c = clin.clinic;
              const pendingInv = db.getPendingCloudInvite(result.clinicId);
              const prov = await cloudSync.provisionCloudAccount({
                id: c.id,
                nome: c.nome,
                cnpj: c.cnpj,
                cro: c.cro,
                username: c.username,
                settings: c.settings || {},
                inviteToken: pendingInv || undefined,
              }, data.password);
              if (prov.ok) db.clearPendingCloudInvite(result.clinicId);
              if (prov.message) detail = prov.message;
              if (prov.ok) final = prov;
            }
          }
        }

        if (final.ok) {
          cloudTokens.set(result.clinicId, final.token);
          db.setCloudToken(result.clinicId, final.token);
          const encKey = cloudEncryptionKeys.get(result.clinicId) || null;
          const encLegacy = cloudEncryptionKeysLegacy.get(result.clinicId) || null;
          const syncResult = await cloudSync.syncClinic(db, result.clinicId, final.token, encKey, encLegacy);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sync-status', {
              synced: syncResult.synced,
              online: syncResult.online !== false,
              cloudAuth: true,
              syncedAt: syncResult.synced ? new Date().toISOString() : undefined,
              noBulkSync: syncResult.reason === 'no-sync-endpoint',
              hint: null,
              detail: null,
            });
          }
        } else {
          const apiUp = await cloudSync.isOnline();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sync-status', {
              synced: false,
              online: apiUp,
              cloudAuth: false,
              hint: apiUp ? 'nuvem-auth-falhou' : 'offline',
              noBulkSync: false,
              detail: detail || null,
            });
          }
        }
      }).catch(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-status', { synced: false, online: false, cloudAuth: false, hint: 'offline' });
        }
      });

      return { ...result, sessionToken };
    }
    return result;
  });

  ipcMain.handle('logout-clinic', async (event, sessionToken) => {
    const clinicId = activeSessions.get(sessionToken);
    // Sync final antes de deslogar
    if (clinicId) {
      const token = cloudTokens.get(clinicId) || db.getCloudToken(clinicId);
      if (token) {
        const encKey = cloudEncryptionKeys.get(clinicId) || null;
        const encLegacy = cloudEncryptionKeysLegacy.get(clinicId) || null;
        cloudSync.syncClinic(db, clinicId, token, encKey, encLegacy).catch(() => {});
      }
      cloudTokens.delete(clinicId);
      cloudEncryptionKeys.delete(clinicId); // remover chave da memória ao deslogar
      cloudEncryptionKeysLegacy.delete(clinicId);
    }
    activeSessions.delete(sessionToken);
    return { success: true };
  });

  // Sync manual disparado pelo renderer
  ipcMain.handle('sync-now', async (event, sessionToken, clinicId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    const token = cloudTokens.get(clinicId) || db.getCloudToken(clinicId);
    if (!token) return { success: false, error: 'Não autenticado na nuvem' };
    const encKey = cloudEncryptionKeys.get(clinicId) || null;
    const encLegacy = cloudEncryptionKeysLegacy.get(clinicId) || null;
    const result = await cloudSync.syncClinic(db, clinicId, token, encKey, encLegacy);
    const hint =
      result.online === false
        ? 'offline'
        : result.cloudAuth === false
          ? 'nuvem-auth-falhou'
          : null;
    return {
      success: result.synced,
      online: result.online,
      cloudAuth: result.cloudAuth !== false,
      reason: result.reason,
      hint,
      noBulkSync: result.reason === 'no-sync-endpoint',
    };
  });

  ipcMain.handle('cloud-status', async (event, sessionToken, clinicId) => {
    if (!validateSession(sessionToken, clinicId)) return { online: false };
    const online = await cloudSync.isOnline();
    const hasToken = !!(cloudTokens.get(clinicId) || db.getCloudToken(clinicId));
    return { online, hasToken };
  });

  ipcMain.handle('get-clinic', async (event, sessionToken, clinicId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.getClinic(clinicId);
  });
  ipcMain.handle('update-clinic', async (event, sessionToken, clinicId, data) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.updateClinic(clinicId, data);
  });
  ipcMain.handle('add-patient', async (event, sessionToken, data) => {
    if (!validateSession(sessionToken, data?.clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.addPatient(data);
  });
  ipcMain.handle('get-patients', async (event, sessionToken, clinicId) => {
    if (!validateSession(sessionToken, clinicId)) return [];
    return db.getPatients(clinicId);
  });
  ipcMain.handle('get-patient', async (event, sessionToken, clinicId, patientId) => {
    if (!validateSession(sessionToken, clinicId)) return null;
    return db.getPatient(clinicId, patientId);
  });
  ipcMain.handle('update-patient', async (event, sessionToken, clinicId, patientId, data) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.updatePatient(clinicId, patientId, data);
  });
  ipcMain.handle('delete-patient', async (event, sessionToken, clinicId, patientId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.deletePatient(clinicId, patientId);
  });
  ipcMain.handle('add-appointment', async (event, sessionToken, data) => {
    if (!validateSession(sessionToken, data?.clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.addAppointment(data);
  });
  ipcMain.handle('get-appointments', async (event, sessionToken, clinicId, dateStr) => {
    if (!validateSession(sessionToken, clinicId)) return [];
    return db.getAppointments(clinicId, dateStr);
  });
  ipcMain.handle('get-all-appointments', async (event, sessionToken, clinicId) => {
    if (!validateSession(sessionToken, clinicId)) return [];
    return db.getAllAppointments(clinicId);
  });
  ipcMain.handle('update-appointment', async (event, sessionToken, clinicId, appointmentId, data) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.updateAppointment(clinicId, appointmentId, data);
  });
  ipcMain.handle('delete-appointment', async (event, sessionToken, clinicId, appointmentId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.deleteAppointment(clinicId, appointmentId);
  });
  ipcMain.handle('send-whatsapp-reminder', async (event, sessionToken, clinicId, appointmentId) => {
    try {
      if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
      const clinicResp = db.getClinic(clinicId);
      if (!clinicResp.success) return { success: false, error: 'Clínica não encontrada' };
      const clinic = clinicResp.clinic;
      
      const template = clinic.settings?.whatsappMessageTemplate || '';
      if (!template) return { success: false, error: 'Template de mensagem não configurado nas configurações.' };
      
      const clinicPhone = clinic.settings?.telefoneClinica || '';
      
      const allAppts = db.getAllAppointments(clinicId);
      const appt = allAppts.find(a => a.id === appointmentId);
      if (!appt) return { success: false, error: 'Agendamento não encontrado' };
      
      const patient = db.getPatient(clinicId, appt.patientId);
      if (!patient || !patient.fone) return { success: false, error: 'Paciente sem telefone cadastrado.' };
      
      const phone = patient.fone.replace(/\D/g, '');
      if (phone.length < 10) return { success: false, error: 'Telefone do paciente é inválido.' };
      
      let msg = template
        .replace('{nomePaciente}', patient.nomeCompleto || 'Paciente')
        .replace('{hora}', appt.time || '')
        .replace('{nomeClinica}', clinic.nome || 'Nossa Clínica')
        .replace('{telefoneClinica}', clinicPhone);
        
      const encodedMsg = encodeURIComponent(msg);
      const url = `whatsapp://send?phone=55${phone}&text=${encodedMsg}`;
      
      shell.openExternal(url);
      db.markAppointmentReminderSent(clinicId, appointmentId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Despesas da clínica ───────────────────────────────────────────────────
  ipcMain.handle('add-expense', async (event, sessionToken, clinicId, data) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.addExpense(clinicId, data);
  });
  ipcMain.handle('get-expenses', async (event, sessionToken, clinicId) => {
    if (!validateSession(sessionToken, clinicId)) return [];
    return db.getExpenses(clinicId);
  });
  ipcMain.handle('delete-expense', async (event, sessionToken, clinicId, expenseId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.deleteExpense(clinicId, expenseId);
  });
  ipcMain.handle('update-expense', async (event, sessionToken, clinicId, expenseId, data) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    return db.updateExpense(clinicId, expenseId, data);
  });
  // ──────────────────────────────────────────────────────────────────────────

  // ── Anexos de pacientes ────────────────────────────────────────────────────
  ipcMain.handle('save-attachment', async (event, sessionToken, clinicId, patientId, fileData) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    try {
      const attachDir = path.join(app.getPath('userData'), 'attachments', clinicId, patientId);
      fs.mkdirSync(attachDir, { recursive: true });

      const id = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(fileData.originalName).toLowerCase();
      const filename = `${id}${ext}`;
      const destPath = path.join(attachDir, filename);

      // fileData.sourcePath é o path real fornecido pelo Electron no renderer
      fs.copyFileSync(fileData.sourcePath, destPath);

      const metadata = {
        id,
        filename,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType || 'application/octet-stream',
        size: fileData.size,
        uploadedAt: new Date().toISOString(),
      };
      return db.addAttachmentToPatient(clinicId, patientId, metadata);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-attachment', async (event, sessionToken, clinicId, patientId, attachmentId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    try {
      const patient = db.getPatient(clinicId, patientId);
      if (!patient) return { success: false, error: 'Paciente não encontrado' };
      const att = (patient.attachments || []).find(a => a.id === attachmentId);
      if (!att) return { success: false, error: 'Anexo não encontrado' };

      const filePath = path.join(app.getPath('userData'), 'attachments', clinicId, patientId, att.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      return db.removeAttachmentFromPatient(clinicId, patientId, attachmentId);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('open-attachment', async (event, sessionToken, clinicId, patientId, attachmentId) => {
    if (!validateSession(sessionToken, clinicId)) return { success: false, error: 'Sessão inválida' };
    try {
      const patient = db.getPatient(clinicId, patientId);
      if (!patient) return { success: false, error: 'Paciente não encontrado' };
      const att = (patient.attachments || []).find(a => a.id === attachmentId);
      if (!att) return { success: false, error: 'Anexo não encontrado' };

      const filePath = path.join(app.getPath('userData'), 'attachments', clinicId, patientId, att.filename);
      const errMsg = await shell.openPath(filePath);
      if (errMsg) return { success: false, error: errMsg };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  // ── Auto-update IPC ─────────────────────────────────────────────────────────
  ipcMain.handle('check-for-updates', async () => {
    if (process.env.NODE_ENV === 'development') return { checking: false, dev: true };
    try {
      await autoUpdater.checkForUpdates();
      return { checking: true };
    } catch (err) {
      return { checking: false, error: err.message };
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });
  // ────────────────────────────────────────────────────────────────────────────

  ipcMain.handle('google-drive-status', () => driveBackup.getStatus());
  ipcMain.handle('google-drive-save-client', (event, data) => {
    try {
      driveBackup.saveClientConfig(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('google-drive-connect', () => driveBackup.connectGoogleDrive());
  ipcMain.handle('google-drive-disconnect', () => driveBackup.disconnect());
  ipcMain.handle('google-drive-backup-now', () => driveBackup.uploadBackupNow(db));

  driveBackup.startBackupScheduler(db);

  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
