import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, FileText, CheckCircle, Clock, Trash2, Edit2, X, DollarSign } from 'lucide-react';
import api from '../services/api';
import Odontograma from '../components/Odontograma';
import DocumentoClinico from '../components/DocumentoClinico';
import PagamentoModal, { calcularStatusPagamento } from '../components/PagamentoModal';

const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHealthData, setShowHealthData] = useState(false);
  const [editingTreatmentId, setEditingTreatmentId] = useState(null);
  const [pagamentoTreatment, setPagamentoTreatment] = useState(null);
  const [clinicSettings, setClinicSettings] = useState({});

  // Tratamento Formulário
  const [novoTratamento, setNovoTratamento] = useState({
    data: new Date().toISOString().split('T')[0],
    hora: '',
    dente: '',
    procedimento: '',
    valor: '',
    status: 'Planejado'
  });

  useEffect(() => {
    fetchPatient();
    fetchClinicSettings();
  }, [id]);

  useEffect(() => {
    if (location.state?.prefillTreatment) {
      setNovoTratamento(prev => ({
        ...prev,
        ...location.state.prefillTreatment
      }));
      // Limpa o state do history para não repreencher ao recarregar a página
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchPatient = async () => {
    try {
      const response = await api.get(`/patients/${id}`);
      setPatient(response.data);
    } catch (error) {
      console.error('Erro ao buscar paciente', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicSettings = async () => {
    try {
      const clinicId = localStorage.getItem('@ClinicManager:token');
      if (clinicId && window.electronAPI) {
        const resp = await window.electronAPI.getClinic(clinicId);
        if (resp.success && resp.clinic) {
          setClinicSettings({
            ...resp.clinic.settings,
            nomeClinica: resp.clinic.nome,
            cnpj: resp.clinic.cnpj,
          });
        }
      }
    } catch (err) {
      console.error('Erro ao buscar configurações da clínica', err);
    }
  };

  const handleAddTreatment = async (e) => {
    e.preventDefault();
    if (!novoTratamento.procedimento || !novoTratamento.valor) {
      alert("Preencha o Procedimento e o Valor.");
      return;
    }

    try {
      const tratamentosAtuais = patient.treatments || [];
      let updatedTreatments;

      if (editingTreatmentId) {
        const existingTreatment = tratamentosAtuais.find(t => String(t.id) === String(editingTreatmentId));
        let currentAppointmentId = existingTreatment?.appointmentId;

        if (currentAppointmentId && window.electronAPI) {
            const clinicId = localStorage.getItem('@ClinicManager:token');
            if (novoTratamento.hora) {
                await window.electronAPI.updateAppointment(clinicId, currentAppointmentId, {
                    date: novoTratamento.data,
                    time: novoTratamento.hora,
                    notes: novoTratamento.procedimento
                });
            } else {
                await window.electronAPI.deleteAppointment(clinicId, currentAppointmentId);
                currentAppointmentId = null;
            }
        } else if (!currentAppointmentId && novoTratamento.hora && window.electronAPI) {
            const clinicId = localStorage.getItem('@ClinicManager:token');
            const response = await window.electronAPI.addAppointment({
                clinicId,
                patientId: id,
                date: novoTratamento.data,
                time: novoTratamento.hora,
                notes: novoTratamento.procedimento
            });
            if (response.success) {
                currentAppointmentId = response.appointment.id;
            }
        }

        updatedTreatments = tratamentosAtuais.map(t =>
          String(t.id) === String(editingTreatmentId) ? { ...t, ...novoTratamento, appointmentId: currentAppointmentId } : t
        );
      } else {
        let newAppointmentId = novoTratamento.appointmentId || null;
        
        if (newAppointmentId && window.electronAPI) {
            const clinicId = localStorage.getItem('@ClinicManager:token');
            if (!novoTratamento.hora) {
                await window.electronAPI.deleteAppointment(clinicId, newAppointmentId);
                newAppointmentId = null;
            } else {
                await window.electronAPI.updateAppointment(clinicId, newAppointmentId, {
                    date: novoTratamento.data,
                    time: novoTratamento.hora,
                    notes: novoTratamento.procedimento
                });
            }
        } else if (!newAppointmentId && novoTratamento.hora && window.electronAPI) {
          const clinicId = localStorage.getItem('@ClinicManager:token');
          const response = await window.electronAPI.addAppointment({
            clinicId,
            patientId: id,
            date: novoTratamento.data,
            time: novoTratamento.hora,
            notes: novoTratamento.procedimento
          });
          if (response.success) {
            newAppointmentId = response.appointment.id;
          }
        }

        const treatmentToSave = {
          ...novoTratamento,
          id: Date.now().toString(),
          appointmentId: newAppointmentId
        };
        updatedTreatments = [...tratamentosAtuais, treatmentToSave];
      }

      const updatedData = { treatments: updatedTreatments };
      await api.put(`/patients/${id}`, updatedData);

      setPatient({ ...patient, treatments: updatedData.treatments });

      setNovoTratamento({
        data: new Date().toISOString().split('T')[0],
        hora: '', dente: '', procedimento: '', valor: '', status: 'Planejado'
      });
      setEditingTreatmentId(null);
    } catch (err) {
      console.error('Erro ao salvar tratamento', err);
      alert('Ocorreu um erro ao salvar: ' + err.message);
    }
  };

  const handleEditTreatment = (treatment) => {
    setNovoTratamento({
      data: treatment.data || new Date().toISOString().split('T')[0],
      hora: treatment.hora || '',
      dente: treatment.dente || '',
      procedimento: treatment.procedimento || '',
      valor: treatment.valor || '',
      status: treatment.status || 'Planejado'
    });
    setEditingTreatmentId(treatment.id);
  };

  const handleDeleteTreatment = async (treatmentId) => {
    if (window.confirm('Tem certeza que deseja remover este procedimento?')) {
      try {
        const treatment = patient.treatments.find(t => t.id === treatmentId);
        if (treatment && treatment.appointmentId && window.electronAPI) {
             const clinicId = localStorage.getItem('@ClinicManager:token');
             await window.electronAPI.deleteAppointment(clinicId, treatment.appointmentId);
        }

        const updatedTreatments = patient.treatments.filter(t => t.id !== treatmentId);
        await api.put(`/patients/${id}`, { treatments: updatedTreatments });
        setPatient({ ...patient, treatments: updatedTreatments });
      } catch (err) {
        console.error('Erro ao remover tratamento', err);
      }
    }
  };

  const handleDeletePatient = async () => {
    if (window.confirm('Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita e removerá todos os agendamentos e prontuários dele.')) {
      try {
        await api.delete(`/patients/${id}`);
        navigate('/dashboard');
      } catch (err) {
        console.error('Erro ao excluir paciente', err);
        alert('Erro ao excluir paciente.');
      }
    }
  };

  const handleUpdateTreatmentStatus = async (treatmentId, newStatus) => {
    try {
      const updatedTreatments = patient.treatments.map(t =>
        t.id === treatmentId ? { ...t, status: newStatus } : t
      );
      await api.put(`/patients/${id}`, { treatments: updatedTreatments });
      setPatient({ ...patient, treatments: updatedTreatments });
    } catch (err) {
      console.error('Erro ao atualizar status', err);
    }
  };

  const handleSavePayments = async (treatmentId, updatedPayments) => {
    try {
      const updatedTreatments = patient.treatments.map(t =>
        t.id === treatmentId ? { ...t, payments: updatedPayments } : t
      );
      await api.put(`/patients/${id}`, { treatments: updatedTreatments });
      setPatient({ ...patient, treatments: updatedTreatments });
    } catch (err) {
      console.error('Erro ao salvar pagamentos', err);
      alert('Erro ao salvar pagamento: ' + err.message);
    }
  };

  const formatDataBr = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  if (loading) return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Carregando dados do paciente...</div>;
  if (!patient) return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Paciente não encontrado.</div>;

  const tratamentos = patient.treatments || [];
  const totalPlanejado = tratamentos.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
  const totalConcluido = tratamentos.filter(t => t.status === 'Concluído').reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
  const totalPago = tratamentos.reduce((acc, t) => acc + (t.payments || []).reduce((b, p) => b + parseFloat(p.valor || 0), 0), 0);
  const saldoDevedor = Math.max(0, totalPlanejado - totalPago);

  return (
    <>
    {pagamentoTreatment && (
      <PagamentoModal
        treatment={pagamentoTreatment}
        patient={patient}
        clinicSettings={clinicSettings}
        onClose={() => setPagamentoTreatment(null)}
        onSave={(updatedPayments) => handleSavePayments(pagamentoTreatment.id, updatedPayments)}
      />
    )}
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflowY: 'auto', padding: '32px' }}>
      <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>{patient.nomeCompleto}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>CPF: {patient.cpfOuCi} | Fone: {patient.fone}</p>
          </div>
          <button onClick={handleDeletePatient} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)' }} title="Remover Paciente">
            <Trash2 size={20} /> <span style={{ display: 'none' }} className="hidden-mobile">Remover Paciente</span>
          </button>
        </div>

        {/* Resumo de Saúde (Accordion) */}
        <div className="glass-panel" style={{ marginBottom: '32px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div
            onClick={() => setShowHealthData(!showHealthData)}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText size={24} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Ficha Médica e Questionário de Saúde</h3>
            </div>
            {showHealthData ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>

          {showHealthData && (
            <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', animation: 'fadeIn 0.3s ease' }}>

              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Dados Pessoais e Contato</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px', fontSize: '0.95rem' }}>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Nome:</strong> {patient.nomeCompleto}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>CPF/RG:</strong> {patient.cpfOuCi}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Data Nasc.:</strong> {patient.dataNascimento ? new Date(patient.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Sexo:</strong> {patient.sexo || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Estado Civil:</strong> {patient.estadoCivil || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Profissão:</strong> {patient.profissao || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Naturalidade:</strong> {patient.naturalidade || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Responsável:</strong> {patient.responsavel || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Telefone:</strong> {patient.fone || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Endereço:</strong> {patient.enderecoResidencial || '-'} - {patient.cidade}/{patient.estado} ({patient.cep})</p>
              </div>

              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>História Clínica</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '24px', fontSize: '0.95rem' }}>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Queixa Principal:</strong> {patient.queixaPrincipal || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Queixa Atual:</strong> {patient.queixaAtual || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>História Pregressa:</strong> {patient.historiaPregressa || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>História Familiar:</strong> {patient.historiaFamiliar || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>História Pessoal/Local:</strong> {patient.historiaPessoal || '-'}</p>
              </div>

              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Questionário de Saúde Completo</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', fontSize: '0.95rem' }}>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Médico:</strong> {patient.qsMedicoNome || '-'} | {patient.qsMedicoEndereco || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Último Exame:</strong> {patient.qsUltimoExame || '-'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Sob Cuidado Médico:</strong> <span style={{ color: patient.qsSobCuidadoMedico === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsSobCuidadoMedico || 'NÃO'} {patient.qsSobCuidadoMedico === 'SIM' && `(Desde: ${patient.qsSobCuidadoDesde} - ${patient.qsSobCuidadoMotivo})`}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Tomando Medicamentos:</strong> <span style={{ color: patient.qsTomandoMedicamentos === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsTomandoMedicamentos || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Substâncias (Afetam Saúde):</strong> <span style={{ color: patient.qsSubstanciasAfetemSaude === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsSubstanciasAfetemSaude || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Alérgico:</strong> <span style={{ color: patient.qsAlergico === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsAlergico || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Prob. Penicilina/Anestésicos:</strong> <span style={{ color: patient.qsProblemaMedicamentos === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsProblemaMedicamentos || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Sensível a Metais/Látex:</strong> <span style={{ color: patient.qsSensivelMetaisLatex === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsSensivelMetaisLatex || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Grávida:</strong> <span style={{ color: patient.qsGravida === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsGravida || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Anticoncepcional:</strong> {patient.qsAnticoncepcional || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Enfermidades Cardíacas:</strong> <span style={{ color: patient.qsEnfermidadesCardiacas === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsEnfermidadesCardiacas || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Marcapasso/Válvula:</strong> <span style={{ color: patient.qsMarcapassoValvula === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsMarcapassoValvula || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Febre Reumática:</strong> <span style={{ color: patient.qsFebreReumatica === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsFebreReumatica || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Sopro no Coração:</strong> <span style={{ color: patient.qsSoproCoracao === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsSoproCoracao || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Operação Grave:</strong> <span style={{ color: patient.qsEnfermidadeOperacaoGrave === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsEnfermidadeOperacaoGrave || 'NÃO'} {patient.qsEnfermidadeOperacaoGrave === 'SIM' && `(${patient.qsEnfermidadeOperacaoExplique})`}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Tratamento Radiação/Quimio:</strong> <span style={{ color: patient.qsTratamentoRadiacao === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsTratamentoRadiacao || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Pressão Alta/Baixa:</strong> <span style={{ color: patient.qsPressaoAltaBaixa === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsPressaoAltaBaixa || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Doenças Inflamatórias:</strong> <span style={{ color: patient.qsInflamatorias === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsInflamatorias || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Articulações/Prótese:</strong> {patient.qsArticulacoesProtese || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Alterações no Sangue:</strong> <span style={{ color: patient.qsAlteracoesSangue === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsAlteracoesSangue || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Sangrou Excessivamente:</strong> <span style={{ color: patient.qsSangrouExcessivamente === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsSangrouExcessivamente || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Problemas Renais:</strong> <span style={{ color: patient.qsProblemasRenais === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsProblemasRenais || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Problemas Hepáticos:</strong> <span style={{ color: patient.qsProblemasHepaticos === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsProblemasHepaticos || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Diabético:</strong> <span style={{ color: patient.qsDiabetico === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsDiabetico || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Asma:</strong> <span style={{ color: patient.qsAsma === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsAsma || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Epilepsia:</strong> <span style={{ color: patient.qsEpilepsia === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsEpilepsia || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Doença Venérea:</strong> <span style={{ color: patient.qsDoencaVenerea === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsDoencaVenerea || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>HIV Positivo:</strong> <span style={{ color: patient.qsHivPositivo === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsHivPositivo || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>AIDS:</strong> <span style={{ color: patient.qsAids === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsAids || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Hepatite:</strong> <span style={{ color: patient.qsHepatite === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsHepatite || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Tuberculose:</strong> <span style={{ color: patient.qsTuberculose === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsTuberculose || 'NÃO'}</span></p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Fuma/Tabaco:</strong> {patient.qsFumaTabaco || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Álcool:</strong> {patient.qsAlcool || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Substâncias Controladas:</strong> {patient.qsSubstanciasControladas || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Tratamento Psiquiátrico:</strong> {patient.qsTratamentoPsiquiatrico || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Problema Estomacal:</strong> {patient.qsProblemaEstomacal || 'NÃO'}</p>
                <p><strong style={{ color: 'var(--text-secondary)' }}>Outra Enfermidade:</strong> <span style={{ color: patient.qsOutraEnfermidade === 'SIM' ? 'var(--accent-cyan)' : 'inherit' }}>{patient.qsOutraEnfermidade || 'NÃO'} {patient.qsOutraEnfermidade === 'SIM' && `(${patient.qsOutraEnfermidadeExplique})`}</span></p>
                <p style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>Algo Não Perguntado:</strong> {patient.qsAlgoNaoPerguntado || '-'}</p>
                <p style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>Falar Confidencialmente:</strong> <span style={{ color: patient.qsFalarConfidencialmente === 'SIM' ? 'var(--error)' : 'inherit' }}>{patient.qsFalarConfidencialmente || 'NÃO'}</span></p>

                <p style={{ gridColumn: '1 / -1', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Termo de Veracidade:</strong> Assinado por <strong>{patient.assinaturaNome}</strong> em {patient.assinaturaData ? new Date(patient.assinaturaData).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Odontograma */}
        <Odontograma
          initialData={patient.odontograma || {}}
          patientId={id}
          onDentesSelecionados={(dentes) => {
            if (dentes.length > 0) {
              setNovoTratamento(prev => ({ ...prev, dente: dentes.join(', ') }));
            }
          }}
        />

        {/* Documentos e Assinaturas */}
        <DocumentoClinico patient={patient} patientId={id} />

        {/* Plano de Tratamento */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.5rem' }}>Plano de Tratamento</h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.9rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 14px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Orçado:</span> <strong style={{ color: 'var(--text-primary)' }}>R$ {totalPlanejado.toFixed(2)}</strong>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px 14px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--success)' }}>Pago:</span> <strong style={{ color: 'var(--success)' }}>R$ {totalPago.toFixed(2)}</strong>
              </div>
              <div style={{ background: saldoDevedor > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.05)', padding: '8px 14px', borderRadius: '8px' }}>
                <span style={{ color: saldoDevedor > 0 ? '#F59E0B' : 'var(--success)' }}>Saldo:</span> <strong style={{ color: saldoDevedor > 0 ? '#F59E0B' : 'var(--success)' }}>R$ {saldoDevedor.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Lista de Tratamentos */}
          <div style={{ marginBottom: '32px' }}>
            {tratamentos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                Nenhum procedimento registrado ainda.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <th style={{ padding: '12px' }}>Data</th>
                    <th style={{ padding: '12px' }}>Dente/Região</th>
                    <th style={{ padding: '12px' }}>Procedimento</th>
                    <th style={{ padding: '12px' }}>Valor (R$)</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Pagamento</th>
                    <th style={{ padding: '12px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tratamentos.map(t => {
                    const pgStatus = calcularStatusPagamento(t);
                    return (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{formatDataBr(t.data)}</td>
                      <td style={{ padding: '12px' }}>{t.dente || '-'}</td>
                      <td style={{ padding: '12px', fontWeight: 500 }}>{t.procedimento}</td>
                      <td style={{ padding: '12px' }}>R$ {parseFloat(t.valor).toFixed(2)}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                          background: t.status === 'Concluído' ? 'rgba(16, 185, 129, 0.1)' : t.status === 'Em Andamento' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                          color: t.status === 'Concluído' ? 'var(--success)' : t.status === 'Em Andamento' ? 'var(--accent-blue)' : 'var(--text-secondary)'
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => setPagamentoTreatment(t)}
                          title="Gerenciar Pagamento"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: pgStatus.bg, border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: pgStatus.color, fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          <DollarSign size={14} />
                          {pgStatus.label}
                        </button>
                      </td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                        {t.status !== 'Concluído' && (
                          <button onClick={() => handleUpdateTreatmentStatus(t.id, 'Concluído')} title="Marcar como Concluído" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--success)' }}>
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {t.status === 'Planejado' && (
                          <button onClick={() => handleUpdateTreatmentStatus(t.id, 'Em Andamento')} title="Iniciar Tratamento" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)' }}>
                            <Clock size={18} />
                          </button>
                        )}
                        <button onClick={() => handleEditTreatment(t)} title="Editar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-cyan)' }}>
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteTreatment(t.id)} title="Remover" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Adicionar Novo Tratamento */}
          <form onSubmit={handleAddTreatment} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Adicionar Procedimento</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Data</label>
                <input type="date" className="input-field" value={novoTratamento.data} onChange={e => setNovoTratamento({ ...novoTratamento, data: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Hora</label>
                <select className="input-field" value={novoTratamento.hora} onChange={e => setNovoTratamento({ ...novoTratamento, hora: e.target.value })}>
                  <option value="">Nenhuma</option>
                  {[...Array(11)].map((_, idx) => {
                    const hour = idx + 10;
                    const options = [];
                    options.push(<option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>{`${hour.toString().padStart(2, '0')}:00`}</option>);
                    if (hour !== 18) {
                      options.push(<option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>{`${hour.toString().padStart(2, '0')}:30`}</option>);
                    }
                    return options;
                  })}
                </select>
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Dente/Reg.</label>
                <input type="text" className="input-field" placeholder="Ex: 21" value={novoTratamento.dente} onChange={e => setNovoTratamento({ ...novoTratamento, dente: e.target.value })} />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Procedimento *</label>
                <input type="text" className="input-field" placeholder="Ex: Limpeza, Restauração" value={novoTratamento.procedimento} onChange={e => setNovoTratamento({ ...novoTratamento, procedimento: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Valor (R$) *</label>
                <input type="number" step="0.01" className="input-field" placeholder="Ex: 150.00" value={novoTratamento.valor} onChange={e => setNovoTratamento({ ...novoTratamento, valor: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Status</label>
                <select className="input-field" value={novoTratamento.status} onChange={e => setNovoTratamento({ ...novoTratamento, status: e.target.value })}>
                  <option value="Planejado">Planejado</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={handleAddTreatment} className="btn-primary" style={{ padding: '12px' }} title={editingTreatmentId ? "Salvar Edição" : "Adicionar Procedimento"}>
                  {editingTreatmentId ? <CheckCircle size={20} /> : <Plus size={20} />}
                </button>
                {editingTreatmentId && (
                  <button type="button" className="btn-secondary" onClick={() => {
                    setEditingTreatmentId(null);
                    setNovoTratamento({
                      data: new Date().toISOString().split('T')[0],
                      hora: '', dente: '', procedimento: '', valor: '', status: 'Planejado'
                    });
                  }} style={{ padding: '12px' }} title="Cancelar Edição">
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
    </>  
  );
};

export default PatientDetails;
