const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

// O Electron nos dá uma pasta segura e persistente em qualquer PC (ex: AppData no Windows)
const dataPath = path.join(app.getPath('userData'), 'clinic_database.json');

function getDatabaseFilePath() {
    return dataPath;
}

const ENCRYPTION_KEY = crypto.scryptSync('ClinicManagerMasterKey_SuperSecret!2026', 'salt', 32);
const IV_LENGTH = 16;

// Iterações PBKDF2 atuais. Hashes antigos (1000 iter, formato salt:hash) são
// atualizados automaticamente para este valor no próximo login bem-sucedido.
const PBKDF2_ITERATIONS = 600000;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    // Formato: salt:iterations:hash  (3 partes)
    return `${salt}:${PBKDF2_ITERATIONS}:${hash}`;
}

// Retorna { ok: boolean, needsRehash: boolean }
function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') return { ok: false, needsRehash: false };

    const parts = storedHash.split(':');

    if (parts.length === 3) {
        // Formato atual: salt:iterations:hash
        const [salt, iterStr, key] = parts;
        const iterations = parseInt(iterStr, 10);
        if (isNaN(iterations) || iterations <= 0) return { ok: false, needsRehash: false };
        const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
        const keyBuf  = Buffer.from(key,  'hex');
        const hashBuf = Buffer.from(hash, 'hex');
        if (keyBuf.length !== hashBuf.length) return { ok: false, needsRehash: false };
        const ok = crypto.timingSafeEqual(keyBuf, hashBuf);
        return { ok, needsRehash: ok && iterations < PBKDF2_ITERATIONS };
    }

    if (parts.length === 2) {
        // Formato legado: salt:hash (1000 iterações, sem texto plano)
        const [salt, key] = parts;
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        const keyBuf  = Buffer.from(key,  'hex');
        const hashBuf = Buffer.from(hash, 'hex');
        if (keyBuf.length !== hashBuf.length) return { ok: false, needsRehash: false };
        const ok = crypto.timingSafeEqual(keyBuf, hashBuf);
        return { ok, needsRehash: ok };
    }

    // Hashes sem formato reconhecido (ex: texto plano) são rejeitados
    return { ok: false, needsRehash: false };
}

// Estrutura inicial do banco caso seja a primeira vez abrindo
const defaultData = {
    clinics: [],
    patients: [],
    appointments: []
};

function readDB() {
    if (!fs.existsSync(dataPath)) {
        writeDB(defaultData);
        return { ...defaultData };
    }
    const raw = fs.readFileSync(dataPath, 'utf8');
    if (raw.trim().startsWith('{')) {
        // Banco antigo em texto plano (migração suave)
        return JSON.parse(raw);
    }
    // Se a descriptografia falhar, lança erro — o chamador deve tratar.
    // Nunca sobrescrevemos um banco existente com dados vazios silenciosamente.
    const decrypted = decrypt(raw);
    return JSON.parse(decrypted);
}

function writeDB(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const encryptedStr = encrypt(jsonStr);
    // Escrita atômica: escreve em arquivo temporário e renomeia.
    // Garante que uma queda de energia não corrompa o banco original.
    const tmpPath = dataPath + '.tmp';
    fs.writeFileSync(tmpPath, encryptedStr, { encoding: 'utf8' });
    fs.renameSync(tmpPath, dataPath);
}

function registerClinic(data, options = {}) {
    const skipInvite = options.skipInviteCheck === true;
    const inviteTrim = typeof data.inviteCode === 'string' ? data.inviteCode.trim() : '';
    if (!skipInvite && !inviteTrim) {
        return { success: false, error: 'Código de convite é obrigatório. Peça um convite ao administrador.' };
    }

    const db = readDB();
    if (db.clinics.find(c => c.username === data.username)) {
        return { success: false, error: 'Usuário já existe' };
    }

    const defaultSettings = {
        themeMode: 'dark',
        accentColor: 'blue',
        telefoneClinica: '',
        whatsappRemindersEnabled: false,
        whatsappMessageTemplate: 'Olá {nomePaciente}, lembramos da sua consulta hoje às {hora} na clínica {nomeClinica}. Dúvidas, contate {telefoneClinica}.'
    };

    const newClinic = {
        id: data.id || crypto.randomUUID(),
        nome: data.nome,
        cnpj: data.cnpj,
        cro: data.cro,
        username: data.username,
        password: hashPassword(data.password),
        settings: (() => {
            const base = data.settings ? { ...defaultSettings, ...data.settings } : { ...defaultSettings };
            if (!skipInvite && inviteTrim) base.pendingInviteToken = inviteTrim;
            return base;
        })(),
    };

    db.clinics.push(newClinic);
    writeDB(db);
    return { success: true, clinicId: newClinic.id };
}

function loginClinic(data) {
    const db = readDB();
    const clinic = db.clinics.find(c => c.username === data.username);
    if (!clinic) return { success: false, error: 'Credenciais inválidas' };

    const { ok, needsRehash } = verifyPassword(data.password, clinic.password);
    if (!ok) return { success: false, error: 'Credenciais inválidas' };

    // Migração automática: atualiza hash legado para iterações atuais
    if (needsRehash) {
        const index = db.clinics.findIndex(c => c.id === clinic.id);
        db.clinics[index].password = hashPassword(data.password);
        writeDB(db);
    }

    return { success: true, clinicId: clinic.id, nome: clinic.nome };
}

function getClinic(clinicId) {
    const db = readDB();
    const clinic = db.clinics.find(c => c.id === clinicId);
    if (clinic) {
        // Não retornar a senha!
        const { password, ...clinicData } = clinic;
        if (clinicData.settings && typeof clinicData.settings === 'object' && 'pendingInviteToken' in clinicData.settings) {
            const { pendingInviteToken: _p, ...restSettings } = clinicData.settings;
            clinicData.settings = restSettings;
        }
        return { success: true, clinic: clinicData };
    }
    return { success: false, error: 'Clínica não encontrada' };
}

/** Só para o processo main (convite para registo na nuvem); não expor ao renderer. */
function getPendingCloudInvite(clinicId) {
    const db = readDB();
    const clinic = db.clinics.find(c => c.id === clinicId);
    const t = clinic?.settings?.pendingInviteToken;
    return typeof t === 'string' && t.trim() ? t.trim() : null;
}

function clearPendingCloudInvite(clinicId) {
    const db = readDB();
    const index = db.clinics.findIndex(c => c.id === clinicId);
    if (index === -1) return;
    const s = { ...(db.clinics[index].settings || {}) };
    if (!('pendingInviteToken' in s)) return;
    delete s.pendingInviteToken;
    db.clinics[index] = { ...db.clinics[index], settings: s };
    writeDB(db);
}

function updateClinic(clinicId, data) {
    const db = readDB();
    const index = db.clinics.findIndex(c => c.id === clinicId);
    if (index !== -1) {
        // Campos sensíveis nunca são alterados por esta função
        const { password: _p, id: _id, username: _u, ...safeData } = data;
        if (safeData.settings && typeof safeData.settings === 'object' && 'pendingInviteToken' in safeData.settings) {
            const { pendingInviteToken: _r, ...rest } = safeData.settings;
            safeData.settings = rest;
        }
        db.clinics[index] = { ...db.clinics[index], ...safeData };
        writeDB(db);
        let { password, ...clinicData } = db.clinics[index];
        if (clinicData.settings && typeof clinicData.settings === 'object' && 'pendingInviteToken' in clinicData.settings) {
            const { pendingInviteToken: _p, ...restSettings } = clinicData.settings;
            clinicData = { ...clinicData, settings: restSettings };
        }
        return { success: true, clinic: clinicData };
    }
    return { success: false, error: 'Clínica não encontrada' };
}

function addPatient(data) {
    const db = readDB();
    const newPatient = {
        id: crypto.randomUUID(),
        ...data,
        updatedAt: new Date().toISOString(),
        pendingSync: true,
    };
    db.patients.push(newPatient);
    writeDB(db);
    return { success: true };
}

function getPatients(clinicId) {
    const db = readDB();
    return db.patients.filter(p => p.clinicId === clinicId);
}

function getPatient(clinicId, patientId) {
    const db = readDB();
    return db.patients.find(p => p.clinicId === clinicId && p.id === patientId);
}

function updatePatient(clinicId, patientId, data) {
    const db = readDB();
    const index = db.patients.findIndex(p => p.clinicId === clinicId && p.id === patientId);
    if (index !== -1) {
        db.patients[index] = {
            ...db.patients[index],
            ...data,
            updatedAt: new Date().toISOString(),
            pendingSync: true,
        };
        writeDB(db);
        return { success: true, patient: db.patients[index] };
    }
    return { success: false, error: 'Paciente não encontrado' };
}

function deletePatient(clinicId, patientId) {
    const db = readDB();
    const index = db.patients.findIndex(p => p.clinicId === clinicId && p.id === patientId);
    if (index !== -1) {
        // Soft-delete: marca como deletado para sincronizar com a nuvem
        db.patients[index]._deleted = true;
        db.patients[index].updatedAt = new Date().toISOString();
        db.patients[index].pendingSync = true;

        // Remove agendamentos do paciente também
        if (db.appointments) {
            db.appointments = db.appointments
                .filter(a => !(a.clinicId === clinicId && a.patientId === patientId))
                .concat(
                    db.appointments
                        .filter(a => a.clinicId === clinicId && a.patientId === patientId)
                        .map(a => ({ ...a, _deleted: true, updatedAt: new Date().toISOString(), pendingSync: true }))
                );
        }

        writeDB(db);
        return { success: true };
    }
    return { success: false, error: 'Paciente não encontrado' };
}

function addAppointment(data) {
    const db = readDB();
    if (!db.appointments) db.appointments = [];

    // ── Upsert: evita duplicatas no mesmo horário ─────────────────────────────
    // Se já existe um agendamento para a mesma clínica + data + hora,
    // atualiza o registro existente em vez de criar um novo.
    const existingIndex = db.appointments.findIndex(
        a => a.clinicId === data.clinicId &&
             a.date    === data.date &&
             a.time    === data.time
    );

    if (existingIndex !== -1) {
        db.appointments[existingIndex] = {
            ...db.appointments[existingIndex],
            ...data,
            updatedAt: new Date().toISOString(),
            pendingSync: true,
        };
        writeDB(db);
        return { success: true, appointment: db.appointments[existingIndex], wasUpdated: true };
    }
    // ─────────────────────────────────────────────────────────────────────────

    const newAppointment = {
        id: crypto.randomUUID(),
        ...data,
        updatedAt: new Date().toISOString(),
        pendingSync: true,
    };
    db.appointments.push(newAppointment);
    writeDB(db);
    return { success: true, appointment: newAppointment, wasUpdated: false };
}

function getAppointments(clinicId, dateStr) {
    const db = readDB();
    if (!db.appointments) return [];
    return db.appointments.filter(a => a.clinicId === clinicId && a.date === dateStr);
}

function getAllAppointments(clinicId) {
    const db = readDB();
    if (!db.appointments) return [];
    return db.appointments.filter(a => a.clinicId === clinicId);
}

function updateAppointment(clinicId, appointmentId, data) {
    const db = readDB();
    if (!db.appointments) return { success: false, error: 'Tabela não existe' };
    const index = db.appointments.findIndex(a => a.clinicId === clinicId && a.id === appointmentId);
    if (index !== -1) {
        db.appointments[index] = {
            ...db.appointments[index],
            ...data,
            updatedAt: new Date().toISOString(),
            pendingSync: true,
        };
        writeDB(db);
        return { success: true, appointment: db.appointments[index] };
    }
    return { success: false, error: 'Agendamento não encontrado' };
}

function deleteAppointment(clinicId, appointmentId) {
    const db = readDB();
    if (!db.appointments) return { success: false, error: 'Tabela não existe' };
    const index = db.appointments.findIndex(a => a.clinicId === clinicId && a.id === appointmentId);
    if (index !== -1) {
        db.appointments[index]._deleted = true;
        db.appointments[index].updatedAt = new Date().toISOString();
        db.appointments[index].pendingSync = true;
        writeDB(db);
        return { success: true };
    }
    return { success: false, error: 'Agendamento não encontrado' };
}

function markAppointmentReminderSent(clinicId, appointmentId) {
    const db = readDB();
    if (!db.appointments) return { success: false, error: 'Tabela não existe' };
    const index = db.appointments.findIndex(a => a.clinicId === clinicId && a.id === appointmentId);
    if (index !== -1) {
        db.appointments[index].reminderSent = true;
        db.appointments[index].updatedAt = new Date().toISOString();
        db.appointments[index].pendingSync = true;
        writeDB(db);
        return { success: true };
    }
    return { success: false, error: 'Agendamento não encontrado' };
}

function getAllClinics() {
    return readDB().clinics || [];
}

// ── Despesas ──────────────────────────────────────────────────────────────────

function addExpense(clinicId, data) {
    const db = readDB();
    if (!db.expenses) db.expenses = [];
    const expense = {
        id: crypto.randomUUID(),
        clinicId,
        data: data.data,
        categoria: data.categoria || 'Outros',
        descricao: data.descricao || '',
        valor: parseFloat(data.valor) || 0,
        criadoEm: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pendingSync: true,
    };
    db.expenses.push(expense);
    writeDB(db);
    return { success: true, expense };
}

function getExpenses(clinicId) {
    const db = readDB();
    return (db.expenses || []).filter(e => e.clinicId === clinicId);
}

function deleteExpense(clinicId, expenseId) {
    const db = readDB();
    if (!db.expenses) return { success: false, error: 'Nenhuma despesa registrada' };
    const idx = db.expenses.findIndex(e => e.clinicId === clinicId && e.id === expenseId);
    if (idx === -1) return { success: false, error: 'Despesa não encontrada' };
    db.expenses[idx]._deleted = true;
    db.expenses[idx].updatedAt = new Date().toISOString();
    db.expenses[idx].pendingSync = true;
    writeDB(db);
    return { success: true };
}

function updateExpense(clinicId, expenseId, data) {
    const db = readDB();
    if (!db.expenses) return { success: false, error: 'Nenhuma despesa registrada' };
    const idx = db.expenses.findIndex(e => e.clinicId === clinicId && e.id === expenseId);
    if (idx === -1) return { success: false, error: 'Despesa não encontrada' };
    const { id: _id, clinicId: _cid, ...safeData } = data;
    db.expenses[idx] = {
        ...db.expenses[idx],
        ...safeData,
        updatedAt: new Date().toISOString(),
        pendingSync: true,
    };
    writeDB(db);
    return { success: true, expense: db.expenses[idx] };
}

// ─────────────────────────────────────────────────────────────────────────────

function addAttachmentToPatient(clinicId, patientId, metadata) {
    const db = readDB();
    const index = db.patients.findIndex(p => p.clinicId === clinicId && p.id === patientId);
    if (index === -1) return { success: false, error: 'Paciente não encontrado' };
    if (!db.patients[index].attachments) db.patients[index].attachments = [];
    db.patients[index].attachments.push(metadata);
    writeDB(db);
    return { success: true, attachment: metadata };
}

function removeAttachmentFromPatient(clinicId, patientId, attachmentId) {
    const db = readDB();
    const index = db.patients.findIndex(p => p.clinicId === clinicId && p.id === patientId);
    if (index === -1) return { success: false, error: 'Paciente não encontrado' };
    db.patients[index].attachments = (db.patients[index].attachments || []).filter(a => a.id !== attachmentId);
    writeDB(db);
    return { success: true };
}

// ── Sincronização com a nuvem ─────────────────────────────────────────────────

/**
 * Retorna os dados necessários para o sync: pacientes, agendamentos e despesas
 * da clínica, incluindo pendentes. Também retorna o lastSyncAt armazenado.
 */
function readDBForSync(clinicId) {
    const db = readDB();
    return {
        patients:     (db.patients     || []).filter(p => p.clinicId === clinicId),
        appointments: (db.appointments || []).filter(a => a.clinicId === clinicId),
        expenses:     (db.expenses     || []).filter(e => e.clinicId === clinicId),
        lastSyncAt:   db.lastSyncAt || null,
    };
}

/**
 * Aplica o resultado de uma sincronização bem-sucedida:
 * - Registros novos/alterados recebidos da nuvem são mesclados ("last write wins")
 * - pendingSync é removido dos registros que foram confirmados
 * - lastSyncAt é atualizado
 */
function applySyncResult(clinicId, { patients, appointments, expenses, syncedAt }) {
    const db = readDB();

    function mergeRecords(localList, remoteList, idField = 'id') {
        const map = new Map();
        // Indexa locais
        for (const r of localList) map.set(r[idField], r);
        // Mescla remotos: ganha quem tem updatedAt mais recente
        for (const remote of remoteList) {
            const local = map.get(remote[idField]);
            const remoteTs = new Date(remote.updatedAt || 0).getTime();
            const localTs  = new Date(local?.updatedAt || 0).getTime();
            if (!local || remoteTs >= localTs) {
                map.set(remote[idField], { ...remote, pendingSync: false });
            }
        }
        // Remove pendingSync dos registros locais que agora estão confirmados
        for (const [id, record] of map) {
            if (!record.pendingSync) {
                map.set(id, { ...record, pendingSync: false });
            }
        }
        return Array.from(map.values());
    }

    // Aplica merge por tabela (apenas registros desta clínica)
    const otherPatients     = (db.patients     || []).filter(p => p.clinicId !== clinicId);
    const otherAppointments = (db.appointments || []).filter(a => a.clinicId !== clinicId);
    const otherExpenses     = (db.expenses     || []).filter(e => e.clinicId !== clinicId);

    const myPatients     = (db.patients     || []).filter(p => p.clinicId === clinicId);
    const myAppointments = (db.appointments || []).filter(a => a.clinicId === clinicId);
    const myExpenses     = (db.expenses     || []).filter(e => e.clinicId === clinicId);

    db.patients     = [...otherPatients,     ...mergeRecords(myPatients,     patients)];
    db.appointments = [...otherAppointments, ...mergeRecords(myAppointments, appointments)];
    db.expenses     = [...otherExpenses,     ...mergeRecords(myExpenses,     expenses)];
    db.lastSyncAt   = syncedAt || new Date().toISOString();

    writeDB(db);
}

/**
 * Retorna o token JWT armazenado para uma clínica (salvo após cloudLogin).
 */
function getCloudToken(clinicId) {
    const db = readDB();
    const clinic = db.clinics.find(c => c.id === clinicId);
    return clinic?.cloudToken || null;
}

/**
 * Armazena o token JWT da nuvem na entrada da clínica no banco local.
 */
function setCloudToken(clinicId, token) {
    const db = readDB();
    const index = db.clinics.findIndex(c => c.id === clinicId);
    if (index !== -1) {
        db.clinics[index].cloudToken = token;
        writeDB(db);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    getDatabaseFilePath,
    registerClinic,
    loginClinic,
    getClinic,
    getPendingCloudInvite,
    clearPendingCloudInvite,
    getAllClinics,
    updateClinic,
    addPatient,
    getPatients,
    getPatient,
    updatePatient,
    deletePatient,
    addExpense,
    getExpenses,
    deleteExpense,
    updateExpense,
    addAttachmentToPatient,
    removeAttachmentFromPatient,
    readDBForSync,
    applySyncResult,
    getCloudToken,
    setCloudToken,
    addAppointment,
    getAppointments,
    getAllAppointments,
    updateAppointment,
    deleteAppointment,
    markAppointmentReminderSent
};
