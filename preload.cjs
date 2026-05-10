const { contextBridge, ipcRenderer } = require('electron');

// Expõe métodos seguros para a interface React utilizar
contextBridge.exposeInMainWorld('electronAPI', {
  registerClinic: (data) => ipcRenderer.invoke('register-clinic', data),
  loginClinic: (data) => ipcRenderer.invoke('login-clinic', data),
  getClinic: (clinicId) => ipcRenderer.invoke('get-clinic', clinicId),
  updateClinic: (clinicId, data) => ipcRenderer.invoke('update-clinic', clinicId, data),
  addPatient: (data) => ipcRenderer.invoke('add-patient', data),
  getPatients: (clinicId) => ipcRenderer.invoke('get-patients', clinicId),
  getPatient: (clinicId, patientId) => ipcRenderer.invoke('get-patient', clinicId, patientId),
  updatePatient: (clinicId, patientId, data) => ipcRenderer.invoke('update-patient', clinicId, patientId, data),
  deletePatient: (clinicId, patientId) => ipcRenderer.invoke('delete-patient', clinicId, patientId),
  addAppointment: (data) => ipcRenderer.invoke('add-appointment', data),
  getAppointments: (clinicId, dateStr) => ipcRenderer.invoke('get-appointments', clinicId, dateStr),
  getAllAppointments: (clinicId) => ipcRenderer.invoke('get-all-appointments', clinicId),
  updateAppointment: (clinicId, appointmentId, data) => ipcRenderer.invoke('update-appointment', clinicId, appointmentId, data),
  deleteAppointment: (clinicId, appointmentId) => ipcRenderer.invoke('delete-appointment', clinicId, appointmentId),
  sendWhatsAppReminder: (clinicId, appointmentId) => ipcRenderer.invoke('send-whatsapp-reminder', clinicId, appointmentId)
});
