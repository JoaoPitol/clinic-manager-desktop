// Este arquivo agora intercepta as requisições que iriam para o Axios
// E envia diretamente para o banco de dados local do Electron via IPC.

const api = {
  post: async (url, data) => {
    if (url === '/auth/login') {
       const res = await window.electronAPI.loginClinic(data);
       if (!res.success) throw new Error(res.error);
       return { data: { accessToken: res.clinicId, clinicName: res.nome, restoredFromCloud: !!res.restoredFromCloud } };
    }
    
    if (url === '/auth/register') {
       const res = await window.electronAPI.registerClinic(data);
       if (!res.success) throw new Error(res.error);
       return { data: 'Clínica registrada com sucesso' };
    }

    if (url === '/patients') {
       const clinicId = localStorage.getItem('@ClinicManager:token');
       const patientData = { ...data, clinicId };
       const res = await window.electronAPI.addPatient(patientData);
       if (!res.success) throw new Error('Erro ao salvar paciente');
       return { data: res };
    }
  },
  
  get: async (url) => {
    if (url === '/patients') {
       const clinicId = localStorage.getItem('@ClinicManager:token');
       const patients = await window.electronAPI.getPatients(clinicId);
       return { data: patients };
    }
    
    const match = url.match(/^\/patients\/(.+)$/);
    if (match) {
       const clinicId = localStorage.getItem('@ClinicManager:token');
       const patient = await window.electronAPI.getPatient(clinicId, match[1]);
       return { data: patient };
    }
  },

  put: async (url, data) => {
    const match = url.match(/^\/patients\/(.+)$/);
    if (match) {
       const clinicId = localStorage.getItem('@ClinicManager:token');
       const res = await window.electronAPI.updatePatient(clinicId, match[1], data);
       if (!res.success) throw new Error(res.error);
       return { data: res.patient };
    }
  },

  delete: async (url) => {
    const match = url.match(/^\/patients\/(.+)$/);
    if (match) {
       const clinicId = localStorage.getItem('@ClinicManager:token');
       const res = await window.electronAPI.deletePatient(clinicId, match[1]);
       if (!res.success) throw new Error(res.error);
       return { data: { success: true } };
    }
  }
};

export default api;
