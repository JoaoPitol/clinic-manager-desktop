const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const db = require('./database.cjs');

function checkWhatsAppReminders() {
  const clinics = db.getAllClinics();
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

  // Em desenvolvimento (Vite dev server) carrega do localhost
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Abre o painel de desenvolvedor (opcional)
    // mainWindow.webContents.openDevTools();
  } else {
    // Em produção carrega do arquivo buildado
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Registrando canais de comunicação com o banco local
  ipcMain.handle('register-clinic', async (event, data) => db.registerClinic(data));
  ipcMain.handle('login-clinic', async (event, data) => db.loginClinic(data));
  ipcMain.handle('get-clinic', async (event, clinicId) => db.getClinic(clinicId));
  ipcMain.handle('update-clinic', async (event, clinicId, data) => db.updateClinic(clinicId, data));
  ipcMain.handle('add-patient', async (event, data) => db.addPatient(data));
  ipcMain.handle('get-patients', async (event, clinicId) => db.getPatients(clinicId));
  ipcMain.handle('get-patient', async (event, clinicId, patientId) => db.getPatient(clinicId, patientId));
  ipcMain.handle('update-patient', async (event, clinicId, patientId, data) => db.updatePatient(clinicId, patientId, data));
  ipcMain.handle('delete-patient', async (event, clinicId, patientId) => db.deletePatient(clinicId, patientId));
  ipcMain.handle('add-appointment', async (event, data) => db.addAppointment(data));
  ipcMain.handle('get-appointments', async (event, clinicId, dateStr) => db.getAppointments(clinicId, dateStr));
  ipcMain.handle('get-all-appointments', async (event, clinicId) => db.getAllAppointments(clinicId));
  ipcMain.handle('update-appointment', async (event, clinicId, appointmentId, data) => db.updateAppointment(clinicId, appointmentId, data));
  ipcMain.handle('delete-appointment', async (event, clinicId, appointmentId) => db.deleteAppointment(clinicId, appointmentId));
  ipcMain.handle('send-whatsapp-reminder', async (event, clinicId, appointmentId) => {
    try {
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

  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
