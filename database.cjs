const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

// O Electron nos dá uma pasta segura e persistente em qualquer PC (ex: AppData no Windows)
const dataPath = path.join(app.getPath('userData'), 'clinic_database.json');

const ENCRYPTION_KEY = crypto.scryptSync('ClinicManagerMasterKey_SuperSecret!2026', 'salt', 32);
const IV_LENGTH = 16;

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
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return [salt, hash].join(':');
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) {
        // Fallback para senhas antigas em texto plano (migração suave)
        return password === storedHash;
    }
    const [salt, key] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return key === hash;
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
        return defaultData;
    }
    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        if (raw.trim().startsWith('{')) {
            // Banco antigo em texto plano (migração suave)
            return JSON.parse(raw);
        }
        const decrypted = decrypt(raw);
        return JSON.parse(decrypted);
    } catch (e) {
        console.error("Erro ao descriptografar banco de dados:", e);
        return defaultData;
    }
}

function writeDB(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const encryptedStr = encrypt(jsonStr);
    fs.writeFileSync(dataPath, encryptedStr);
}

function registerClinic(data) {
    const db = readDB();
    if (db.clinics.find(c => c.username === data.username)) {
        return { success: false, error: 'Usuário já existe' };
    }

    const newClinic = {
        id: Date.now().toString(),
        nome: data.nome,
        cnpj: data.cnpj,
        cro: data.cro,
        username: data.username,
        password: hashPassword(data.password),
        settings: {
            themeMode: 'dark', // 'dark' ou 'light'
            accentColor: 'blue', // 'blue', 'green', 'purple', 'orange', 'pink'
            telefoneClinica: '',
            whatsappRemindersEnabled: false,
            whatsappMessageTemplate: 'Olá {nomePaciente}, lembramos da sua consulta hoje às {hora} na clínica {nomeClinica}. Dúvidas, contate {telefoneClinica}.'
        }
    };

    db.clinics.push(newClinic);
    writeDB(db);
    return { success: true };
}

function loginClinic(data) {
    const db = readDB();
    const clinic = db.clinics.find(c => c.username === data.username && verifyPassword(data.password, c.password));
    if (clinic) {
        return { success: true, clinicId: clinic.id, nome: clinic.nome };
    }
    return { success: false, error: 'Credenciais inválidas' };
}

function getClinic(clinicId) {
    const db = readDB();
    const clinic = db.clinics.find(c => c.id === clinicId);
    if (clinic) {
        // Não retornar a senha!
        const { password, ...clinicData } = clinic;
        return { success: true, clinic: clinicData };
    }
    return { success: false, error: 'Clínica não encontrada' };
}

function updateClinic(clinicId, data) {
    const db = readDB();
    const index = db.clinics.findIndex(c => c.id === clinicId);
    if (index !== -1) {
        db.clinics[index] = { ...db.clinics[index], ...data };
        writeDB(db);
        const { password, ...clinicData } = db.clinics[index];
        return { success: true, clinic: clinicData };
    }
    return { success: false, error: 'Clínica não encontrada' };
}

function addPatient(data) {
    const db = readDB();
    const newPatient = {
        id: Date.now().toString(),
        ...data
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
        db.patients[index] = { ...db.patients[index], ...data };
        writeDB(db);
        return { success: true, patient: db.patients[index] };
    }
    return { success: false, error: 'Paciente não encontrado' };
}

function deletePatient(clinicId, patientId) {
    const db = readDB();
    const index = db.patients.findIndex(p => p.clinicId === clinicId && p.id === patientId);
    if (index !== -1) {
        db.patients.splice(index, 1);
        
        // Remove appointments of this patient too
        if (db.appointments) {
            db.appointments = db.appointments.filter(a => !(a.clinicId === clinicId && a.patientId === patientId));
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
        // Preserva o id e atualiza os demais campos
        db.appointments[existingIndex] = {
            ...db.appointments[existingIndex],
            ...data
        };
        writeDB(db);
        return { success: true, appointment: db.appointments[existingIndex], wasUpdated: true };
    }
    // ─────────────────────────────────────────────────────────────────────────

    const newAppointment = {
        id: Date.now().toString(),
        ...data
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

function deleteAppointment(clinicId, appointmentId) {
    const db = readDB();
    if (!db.appointments) return { success: false, error: 'Tabela não existe' };
    const index = db.appointments.findIndex(a => a.clinicId === clinicId && a.id === appointmentId);
    if (index !== -1) {
        db.appointments.splice(index, 1);
        writeDB(db);
        return { success: true };
    }
    return { success: false, error: 'Agendamento não encontrado' };
}

function updateAppointment(clinicId, appointmentId, data) {
    const db = readDB();
    if (!db.appointments) return { success: false, error: 'Tabela não existe' };
    const index = db.appointments.findIndex(a => a.clinicId === clinicId && a.id === appointmentId);
    if (index !== -1) {
        db.appointments[index] = { ...db.appointments[index], ...data };
        writeDB(db);
        return { success: true, appointment: db.appointments[index] };
    }
    return { success: false, error: 'Agendamento não encontrado' };
}

function markAppointmentReminderSent(clinicId, appointmentId) {
    const db = readDB();
    if (!db.appointments) return { success: false, error: 'Tabela não existe' };
    const index = db.appointments.findIndex(a => a.clinicId === clinicId && a.id === appointmentId);
    if (index !== -1) {
        db.appointments[index].reminderSent = true;
        writeDB(db);
        return { success: true };
    }
    return { success: false, error: 'Agendamento não encontrado' };
}

function getAllClinics() {
    return readDB().clinics || [];
}

module.exports = {
    registerClinic,
    loginClinic,
    getClinic,
    getAllClinics,
    updateClinic,
    addPatient,
    getPatients,
    getPatient,
    updatePatient,
    deletePatient,
    addAppointment,
    getAppointments,
    getAllAppointments,
    updateAppointment,
    deleteAppointment,
    markAppointmentReminderSent
};
