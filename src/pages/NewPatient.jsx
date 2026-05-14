import React, { useState } from 'react';
import DateInputBr from '../components/DateInputBr';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../services/api';

const NewPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    cpfOuCi: '',
    dataNascimento: '',
    estadoCivil: '',
    sexo: '',
    naturalidade: '',
    profissao: '',
    fone: '',
    cep: '',
    cidade: '',
    estado: '',
    enderecoResidencial: '',
    responsavel: '',
    enderecoResponsavel: '',
    queixaPrincipal: '',
    queixaAtual: '',
    historiaPregressa: '',
    historiaFamiliar: '',
    historiaPessoal: '',
    qsMedicoNome: '',
    qsMedicoEndereco: '',
    qsUltimoExame: '',
    qsSobCuidadoMedico: '',
    qsSobCuidadoDesde: '',
    qsSobCuidadoMotivo: '',
    qsTomandoMedicamentos: '',
    qsSubstanciasAfetemSaude: '',
    qsAlergico: '',
    qsProblemaMedicamentos: '',
    qsSensivelMetaisLatex: '',
    qsGravida: '',
    qsAnticoncepcional: '',
    qsEnfermidadesCardiacas: '',
    qsMarcapassoValvula: '',
    qsFebreReumatica: '',
    qsSoproCoracao: '',
    qsEnfermidadeOperacaoGrave: '',
    qsEnfermidadeOperacaoExplique: '',
    qsTratamentoRadiacao: '',
    qsPressaoAltaBaixa: '',
    qsInflamatorias: '',
    qsArticulacoesProtese: '',
    qsAlteracoesSangue: '',
    qsSangrouExcessivamente: '',
    qsProblemaEstomacal: '',
    qsProblemasRenais: '',
    qsProblemasHepaticos: '',
    qsDiabetico: '',
    qsAsma: '',
    qsEpilepsia: '',
    qsDoencaVenerea: '',
    qsHivPositivo: '',
    qsAids: '',
    qsHepatite: '',
    qsTuberculose: '',
    qsFumaTabaco: '',
    qsAlcool: '',
    qsSubstanciasControladas: '',
    qsTratamentoPsiquiatrico: '',
    qsOutraEnfermidade: '',
    qsOutraEnfermidadeExplique: '',
    qsAlgoNaoPerguntado: '',
    qsFalarConfidencialmente: '',
    assinaturaNome: '',
    assinaturaData: '',
    assinaturaConcorda: false
  });

  const formatCpf = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value) => {
    let v = value.replace(/\D/g, '');
    if (v.length <= 10) {
      return v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 14);
    } else {
      return v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);
    }
  };

  const formatCEP = (value) => {
    return value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  };

  const handleChange = (e) => {
    let { name, value } = e.target;
    
    // Aplica as máscaras
    if (name === 'cpfOuCi') value = formatCpf(value);
    if (name === 'fone') value = formatPhone(value);
    if (name === 'cep') value = formatCEP(value);

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/patients', formData);
      navigate('/dashboard'); // Volta para a listagem
    } catch {
      setError('Erro ao cadastrar paciente. Verifique os dados e tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflowY: 'auto', padding: '32px' }}>
      <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Cadastrar Paciente</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Preencha os dados abaixo para registrar um novo paciente na clínica.</p>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', color: 'var(--accent-cyan)' }}>Dados Pessoais</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Nome Completo *</label>
              <input type="text" name="nomeCompleto" className="input-field" required value={formData.nomeCompleto} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">CPF ou RG *</label>
              <input type="text" name="cpfOuCi" className="input-field" required value={formData.cpfOuCi} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">Data de Nascimento (DD/MM/AAAA)</label>
              <DateInputBr
                className="input-field"
                value={formData.dataNascimento}
                onChange={(iso) => setFormData({ ...formData, dataNascimento: iso })}
              />
            </div>
            <div>
              <label className="input-label">Telefone / Celular</label>
              <input type="text" name="fone" className="input-field" value={formData.fone} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">Sexo</label>
              <select name="sexo" className="input-field" value={formData.sexo} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="input-label">Estado Civil</label>
              <input type="text" name="estadoCivil" className="input-field" value={formData.estadoCivil} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">Profissão</label>
              <input type="text" name="profissao" className="input-field" value={formData.profissao} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">Naturalidade</label>
              <input type="text" name="naturalidade" className="input-field" placeholder="Ex: São Paulo, SP" value={formData.naturalidade} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">Responsável (Se menor de idade)</label>
              <input type="text" name="responsavel" className="input-field" placeholder="Nome do Responsável" value={formData.responsavel} onChange={handleChange} />
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', color: 'var(--accent-cyan)' }}>Endereço e Contato</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Endereço Residencial</label>
              <input type="text" name="enderecoResidencial" className="input-field" value={formData.enderecoResidencial} onChange={handleChange} />
            </div>
            <div>
              <label className="input-label">Cidade</label>
              <input type="text" name="cidade" className="input-field" value={formData.cidade} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Estado (UF)</label>
                <input type="text" name="estado" className="input-field" maxLength="2" value={formData.estado} onChange={handleChange} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label">CEP</label>
                <input type="text" name="cep" className="input-field" value={formData.cep} onChange={handleChange} />
              </div>
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', color: 'var(--accent-cyan)' }}>História Clínica</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '40px' }}>
            <div>
              <label className="input-label">Queixa Principal</label>
              <textarea name="queixaPrincipal" className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.queixaPrincipal} onChange={handleChange}></textarea>
            </div>
            <div>
              <label className="input-label">Queixa Atual</label>
              <textarea name="queixaAtual" className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.queixaAtual} onChange={handleChange}></textarea>
            </div>
            <div>
              <label className="input-label">História Pregressa</label>
              <textarea name="historiaPregressa" className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.historiaPregressa} onChange={handleChange}></textarea>
            </div>
            <div>
              <label className="input-label">História Familiar</label>
              <textarea name="historiaFamiliar" className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.historiaFamiliar} onChange={handleChange}></textarea>
            </div>
            <div>
              <label className="input-label">História Pessoal / Local</label>
              <textarea name="historiaPessoal" className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.historiaPessoal} onChange={handleChange}></textarea>
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', color: 'var(--accent-cyan)' }}>Questionário de Saúde</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Nome do médico</label>
              <input type="text" name="qsMedicoNome" className="input-field" value={formData.qsMedicoNome} onChange={handleChange} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Endereço do médico</label>
              <input type="text" name="qsMedicoEndereco" className="input-field" value={formData.qsMedicoEndereco} onChange={handleChange} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Quando foi seu último exame físico completo?</label>
              <input type="text" name="qsUltimoExame" className="input-field" value={formData.qsUltimoExame} onChange={handleChange} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
              <label className="input-label">Você está sob cuidado médico?</label>
              <select name="qsSobCuidadoMedico" className="input-field" value={formData.qsSobCuidadoMedico} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option value="SIM">SIM</option>
                <option value="NÃO">NÃO</option>
              </select>
              {formData.qsSobCuidadoMedico === 'SIM' && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="input-label">Desde quando?</label>
                    <input type="text" name="qsSobCuidadoDesde" className="input-field" value={formData.qsSobCuidadoDesde} onChange={handleChange} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label className="input-label">Por quê?</label>
                    <input type="text" name="qsSobCuidadoMotivo" className="input-field" value={formData.qsSobCuidadoMotivo} onChange={handleChange} />
                  </div>
                </div>
              )}
            </div>

            {[
              { name: 'qsTomandoMedicamentos', label: 'Você está tomando medicamentos?' },
              { name: 'qsSubstanciasAfetemSaude', label: 'Toma periodicamente substâncias que afetem a saúde?' },
              { name: 'qsAlergico', label: 'É alérgico a algum medicamento ou substância?' },
              { name: 'qsProblemaMedicamentos', label: 'Tem algum problema com a penicilina, os antibióticos, os anestésicos ou com outros medicamentos?' },
              { name: 'qsSensivelMetaisLatex', label: 'É sensível aos metais ou ao latéx?' },
              { name: 'qsGravida', label: 'Se você é mulher: está grávida ou crê que possa estar?' },
              { name: 'qsAnticoncepcional', label: 'Utiliza algum anticoncepcional?' },
              { name: 'qsEnfermidadesCardiacas', label: 'Está sendo tratado para enfermidades cardíacas ou lhe foi dito que poderia padecer delas?' },
              { name: 'qsMarcapassoValvula', label: 'Usa marcapasso ou válvula cardíaca artificial?' },
              { name: 'qsFebreReumatica', label: 'Teve febre reumática?' },
              { name: 'qsSoproCoracao', label: 'Sofre de sopro no coração?' },
            ].map(q => (
              <div key={q.name}>
                <label className="input-label" style={{ minHeight: '40px' }}>{q.label}</label>
                <select name={q.name} className="input-field" value={formData[q.name]} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                </select>
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
              <label className="input-label">Teve alguma enfermidade ou operação grave?</label>
              <select name="qsEnfermidadeOperacaoGrave" className="input-field" value={formData.qsEnfermidadeOperacaoGrave} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option value="SIM">SIM</option>
                <option value="NÃO">NÃO</option>
              </select>
              {formData.qsEnfermidadeOperacaoGrave === 'SIM' && (
                <div style={{ marginTop: '8px' }}>
                  <label className="input-label">Se sim, explique:</label>
                  <input type="text" name="qsEnfermidadeOperacaoExplique" className="input-field" value={formData.qsEnfermidadeOperacaoExplique} onChange={handleChange} />
                </div>
              )}
            </div>

            {[
              { name: 'qsTratamentoRadiacao', label: 'Esteve sob tratamento com radiação ou quimioterapia para combater tumor, neoplasia ou outra condição?' },
              { name: 'qsPressaoAltaBaixa', label: 'Tem pressão alta ou pressão baixa?' },
              { name: 'qsInflamatorias', label: 'Sofre de enfermidades inflamatórias, como artrite ou reumatismo?' },
              { name: 'qsArticulacoesProtese', label: 'Tem articulações artificiais ou usa prótese?' },
              { name: 'qsAlteracoesSangue', label: 'Tem alterações no sangue, como anemia, leucemia, etc?' },
              { name: 'qsSangrouExcessivamente', label: 'Sangrou excessivamente depois de cortar-se ou ferir-se?' },
              { name: 'qsProblemaEstomacal', label: 'Tem algum problema estomacal?' }
            ].map(q => (
              <div key={q.name}>
                <label className="input-label" style={{ minHeight: '40px' }}>{q.label}</label>
                <select name={q.name} className="input-field" value={formData[q.name]} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                </select>
              </div>
            ))}

            {[
              { name: 'qsProblemasRenais', label: 'Tem problemas renais?' },
              { name: 'qsProblemasHepaticos', label: 'Tem problemas hepáticos?' },
              { name: 'qsDiabetico', label: 'É diabético?' },
              { name: 'qsAsma', label: 'Sofre de asma?' },
              { name: 'qsEpilepsia', label: 'Tem epilepsia ou ataques nervosos?' },
              { name: 'qsDoencaVenerea', label: 'Tem ou teve alguma doença venérea?' },
              { name: 'qsHivPositivo', label: 'Foi-lhe diagnosticado ser HIV positivo?' },
              { name: 'qsAids', label: 'Tem AIDS?' },
              { name: 'qsHepatite', label: 'Teve hepatite ou tem anticorpos contra esta enfermidade?' },
              { name: 'qsTuberculose', label: 'Teve ou tem tuberculose?' },
              { name: 'qsFumaTabaco', label: 'Fuma, mastiga tabaco, usa rapé ou consome outra variedade do tabaco?' },
              { name: 'qsAlcool', label: 'Consome bebidas alcoólicas?' },
              { name: 'qsSubstanciasControladas', label: 'Utiliza habitualmente substâncias controladas?' },
              { name: 'qsTratamentoPsiquiatrico', label: 'Está sob tratamento psiquiátrico?' },
            ].map(q => (
              <div key={q.name}>
                <label className="input-label" style={{ minHeight: '40px' }}>{q.label}</label>
                <select name={q.name} className="input-field" value={formData[q.name]} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                </select>
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
              <label className="input-label">Tem alguma enfermidade, condição ou problema não mencionado aqui?</label>
              <select name="qsOutraEnfermidade" className="input-field" value={formData.qsOutraEnfermidade} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option value="SIM">SIM</option>
                <option value="NÃO">NÃO</option>
              </select>
              {formData.qsOutraEnfermidade === 'SIM' && (
                <div style={{ marginTop: '8px' }}>
                  <label className="input-label">Se sim, explique:</label>
                  <input type="text" name="qsOutraEnfermidadeExplique" className="input-field" value={formData.qsOutraEnfermidadeExplique} onChange={handleChange} />
                </div>
              )}
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Há algo que devamos saber sobre sua saúde e que não tenhamos perguntado neste formulário?</label>
              <textarea name="qsAlgoNaoPerguntado" className="input-field" style={{ minHeight: '60px', resize: 'vertical' }} value={formData.qsAlgoNaoPerguntado} onChange={handleChange}></textarea>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label" style={{ minHeight: '40px' }}>Gostaria de falar confidencialmente com o dentista sobre algum problema?</label>
              <select name="qsFalarConfidencialmente" className="input-field" value={formData.qsFalarConfidencialmente} onChange={handleChange} style={{ maxWidth: '50%' }}>
                <option value="">Selecione...</option>
                <option value="SIM">SIM</option>
                <option value="NÃO">NÃO</option>
              </select>
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', marginTop: '20px', color: 'var(--accent-cyan)' }}>Assinatura e Termo de Veracidade</h3>
          
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px', border: '1px solid var(--border-color)', background: 'rgba(59, 130, 246, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <input type="checkbox" name="assinaturaConcorda" id="assinaturaConcorda" checked={formData.assinaturaConcorda} onChange={(e) => setFormData({...formData, assinaturaConcorda: e.target.checked})} style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent-cyan)' }} />
              <label htmlFor="assinaturaConcorda" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                Certifico que as informações prestadas neste questionário são exatas e verdadeiras.
              </label>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', opacity: formData.assinaturaConcorda ? 1 : 0.5, pointerEvents: formData.assinaturaConcorda ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <div>
                <label className="input-label">Assinatura Eletrônica (Digite o Nome Completo)</label>
                <input type="text" name="assinaturaNome" className="input-field" placeholder="Nome do Paciente ou Responsável" value={formData.assinaturaNome} onChange={handleChange} required={formData.assinaturaConcorda} />
              </div>
              <div>
                <label className="input-label">Data (DD/MM/AAAA)</label>
                <DateInputBr
                  className="input-field"
                  value={formData.assinaturaData}
                  onChange={(iso) => setFormData({ ...formData, assinaturaData: iso })}
                  required={formData.assinaturaConcorda}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
            <button type="button" onClick={() => navigate('/dashboard')} className="input-field" style={{ width: 'auto', background: 'transparent', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={loading}>
              <Save size={18} />
              {loading ? 'Salvando...' : 'Salvar Paciente'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default NewPatient;
