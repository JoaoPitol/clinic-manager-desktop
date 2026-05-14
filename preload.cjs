const { contextBridge, ipcRenderer } = require('electron');

// Token de sessão em closure — inacessível ao JavaScript do renderer
let _sessionToken = null;

contextBridge.exposeInMainWorld('electronAPI', {
  registerClinic: (data) => ipcRenderer.invoke('register-clinic', data),

  loginClinic: async (data) => {
    const result = await ipcRenderer.invoke('login-clinic', data);
    if (result && result.success) {
      _sessionToken = result.sessionToken;
    }
    // Não repassa sessionToken ao renderer
    const { sessionToken: _t, ...safeResult } = result ?? {};
    return safeResult;
  },

  logoutClinic: async () => {
    const result = await ipcRenderer.invoke('logout-clinic', _sessionToken);
    _sessionToken = null;
    return result;
  },

  getClinic: (clinicId) => ipcRenderer.invoke('get-clinic', _sessionToken, clinicId),
  updateClinic: (clinicId, data) => ipcRenderer.invoke('update-clinic', _sessionToken, clinicId, data),
  addPatient: (data) => ipcRenderer.invoke('add-patient', _sessionToken, data),
  getPatients: (clinicId) => ipcRenderer.invoke('get-patients', _sessionToken, clinicId),
  getPatient: (clinicId, patientId) => ipcRenderer.invoke('get-patient', _sessionToken, clinicId, patientId),
  updatePatient: (clinicId, patientId, data) => ipcRenderer.invoke('update-patient', _sessionToken, clinicId, patientId, data),
  deletePatient: (clinicId, patientId) => ipcRenderer.invoke('delete-patient', _sessionToken, clinicId, patientId),
  addAppointment: (data) => ipcRenderer.invoke('add-appointment', _sessionToken, data),
  getAppointments: (clinicId, dateStr) => ipcRenderer.invoke('get-appointments', _sessionToken, clinicId, dateStr),
  getAllAppointments: (clinicId) => ipcRenderer.invoke('get-all-appointments', _sessionToken, clinicId),
  updateAppointment: (clinicId, appointmentId, data) => ipcRenderer.invoke('update-appointment', _sessionToken, clinicId, appointmentId, data),
  deleteAppointment: (clinicId, appointmentId) => ipcRenderer.invoke('delete-appointment', _sessionToken, clinicId, appointmentId),
  sendWhatsAppReminder: (clinicId, appointmentId) => ipcRenderer.invoke('send-whatsapp-reminder', _sessionToken, clinicId, appointmentId),
  addExpense: (clinicId, data) => ipcRenderer.invoke('add-expense', _sessionToken, clinicId, data),
  getExpenses: (clinicId) => ipcRenderer.invoke('get-expenses', _sessionToken, clinicId),
  deleteExpense: (clinicId, expenseId) => ipcRenderer.invoke('delete-expense', _sessionToken, clinicId, expenseId),
  updateExpense: (clinicId, expenseId, data) => ipcRenderer.invoke('update-expense', _sessionToken, clinicId, expenseId, data),
  saveAttachment: (clinicId, patientId, fileData) => ipcRenderer.invoke('save-attachment', _sessionToken, clinicId, patientId, fileData),
  deleteAttachment: (clinicId, patientId, attachmentId) => ipcRenderer.invoke('delete-attachment', _sessionToken, clinicId, patientId, attachmentId),
  openAttachment: (clinicId, patientId, attachmentId) => ipcRenderer.invoke('open-attachment', _sessionToken, clinicId, patientId, attachmentId),
  // ── Cloud sync ──────────────────────────────────────────────────────────────
  syncNow: (clinicId) => ipcRenderer.invoke('sync-now', _sessionToken, clinicId),
  cloudStatus: (clinicId) => ipcRenderer.invoke('cloud-status', _sessionToken, clinicId),
  onSyncStatus: (callback) => {
    ipcRenderer.on('sync-status', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('sync-status');
  },

  // ── Auto-update ─────────────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },
  // ────────────────────────────────────────────────────────────────────────────

  googleDriveStatus: () => ipcRenderer.invoke('google-drive-status'),
  googleDriveSaveClient: (data) => ipcRenderer.invoke('google-drive-save-client', data),
  googleDriveConnect: () => ipcRenderer.invoke('google-drive-connect'),
  googleDriveDisconnect: () => ipcRenderer.invoke('google-drive-disconnect'),
  googleDriveBackupNow: () => ipcRenderer.invoke('google-drive-backup-now'),
});
