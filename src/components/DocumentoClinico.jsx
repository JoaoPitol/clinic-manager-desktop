import React, { useState, useEffect } from 'react';
import { Plus, FileText, Trash2, Eye, Shield, X, ChevronRight, PenLine } from 'lucide-react';
import SignaturePad from './SignaturePad';
import api from '../services/api';

const TIPOS = [
  { id: 'termo_consentimento', emoji: '📋', label: 'Termo de Consentimento', desc: 'Autorização informada para procedimentos' },
  { id: 'contrato_tratamento', emoji: '📝', label: 'Contrato de Tratamento', desc: 'Contrato de prestação de serviços' },
  { id: 'evolucao_clinica',    emoji: '🩺', label: 'Evolução Clínica',       desc: 'Registro de sessão e procedimentos' },
  { id: 'anamnese',            emoji: '📊', label: 'Anamnese',               desc: 'Ficha de saúde (usa assinatura do cadastro)' },
];

async function gerarHash(txt) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return 'SHA256:' + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  } catch { return 'HASH:' + Math.abs([...txt].reduce((h,c)=>Math.imul(31,h)+c.charCodeAt(0)|0,0)).toString(16); }
}

function template(tipo, p, clinica) {
  const dt = new Date().toLocaleDateString('pt-BR');
  const nome = p.nomeCompleto||''; const cpf = p.cpfOuCi||'';
  const end = [p.enderecoResidencial,p.cidade,p.estado].filter(Boolean).join(', ');

  if (tipo==='termo_consentimento') return `TERMO DE CONSENTIMENTO INFORMADO\n\nEu, ${nome}, CPF ${cpf}, declaro ter sido informado(a) sobre os procedimentos odontológicos a realizar, seus riscos, benefícios e alternativas.\n\nCompreendo que:\n• Procedimentos odontológicos estão sujeitos a riscos inerentes;\n• Posso retirar este consentimento a qualquer momento por escrito;\n• Devo seguir as recomendações pós-operatórias;\n• Devo informar alterações no meu estado de saúde.\n\nAutorizo a realização dos procedimentos conforme plano de tratamento apresentado.\n\nClínica: ${clinica}\nData: ${dt}`;

  if (tipo==='contrato_tratamento') return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS\n\nCONTRATANTE: ${nome} — CPF: ${cpf}\nEndereço: ${end}\nCONTRATADA: ${clinica}\n\nCLÁUSULA 1 — DO OBJETO\nA CONTRATADA realizará os procedimentos odontológicos do plano de tratamento acordado.\n\nCLÁUSULA 2 — DOS HONORÁRIOS\nOs valores e pagamentos seguirão o plano de tratamento acordado entre as partes.\n\nCLÁUSULA 3 — OBRIGAÇÕES DO CONTRATANTE\na) Comparecer nos horários agendados;\nb) Cancelamentos com mínimo 24h de antecedência;\nc) Seguir orientações pós-operatórias;\nd) Informar alterações de saúde.\n\nCLÁUSULA 4 — OBRIGAÇÕES DA CONTRATADA\na) Realizar procedimentos com ética e técnica;\nb) Manter sigilo das informações do paciente;\nc) Emitir documentação dos procedimentos.\n\nCLÁUSULA 5 — RESCISÃO\nPode ser rescindido por mútuo acordo ou descumprimento.\n\n${clinica}, ${dt}`;

  if (tipo==='evolucao_clinica') return `EVOLUÇÃO CLÍNICA\n\nPaciente: ${nome}\nData da Sessão: ${dt}\n\n${'─'.repeat(40)}\n\nQUEIXA / MOTIVO DA CONSULTA:\n\n\nPROCEDIMENTOS REALIZADOS:\n\n\nACHADOS CLÍNICOS:\n\n\nPRESCRIÇÕES / ORIENTAÇÕES:\n\n\nPRÓXIMA CONSULTA:\n\n${'─'.repeat(40)}`;

  if (tipo==='anamnese') {
    const sim = (v) => v==='SIM'?'Sim':'Não';
    return `ANAMNESE — FICHA DE SAÚDE\n\nPaciente: ${nome} | CPF: ${cpf}\nData Nasc.: ${p.dataNascimento?new Date(p.dataNascimento).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'-'} | Sexo: ${p.sexo||'-'}\nTelefone: ${p.fone||'-'}\nEndereço: ${end}\n\nQUEIXA PRINCIPAL: ${p.queixaPrincipal||'-'}\nQUEIXA ATUAL: ${p.queixaAtual||'-'}\nHISTÓRIA PREGRESSA: ${p.historiaPregressa||'-'}\n\nQUESTIONÁRIO DE SAÚDE\nSob cuidado médico: ${sim(p.qsSobCuidadoMedico)} | Medicamentos: ${sim(p.qsTomandoMedicamentos)}\nAlérgico: ${sim(p.qsAlergico)} | Diabético: ${sim(p.qsDiabetico)}\nHipertensão: ${sim(p.qsPressaoAltaBaixa)} | Cardíaco: ${sim(p.qsEnfermidadesCardiacas)}\nHIV: ${sim(p.qsHivPositivo)} | Hepatite: ${sim(p.qsHepatite)}\nGrávida: ${sim(p.qsGravida)} | Epilepsia: ${sim(p.qsEpilepsia)}\n\nAssinado por: ${p.assinaturaNome||'-'}\nData da assinatura: ${p.assinaturaData?new Date(p.assinaturaData).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'-'}`;
  }
  return '';
}

const badgeColor = { termo_consentimento:'#3B82F6', contrato_tratamento:'#8B5CF6', evolucao_clinica:'#10B981', anamnese:'#F59E0B' };

export default function DocumentoClinico({ patient, patientId }) {
  const [docs, setDocs]             = useState(patient.documentos || []);
  const [step, setStep]             = useState('list'); // list|type|edit|signP|signD|view
  const [tipo, setTipo]             = useState('');
  const [titulo, setTitulo]         = useState('');
  const [conteudo, setConteudo]     = useState('');
  const [patSig, setPatSig]         = useState(null);
  const [dentNome, setDentNome]     = useState('');
  const [dentCro, setDentCro]       = useState('');
  const [dentSig, setDentSig]       = useState(null);
  const [viewDoc, setViewDoc]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [showPad, setShowPad]       = useState(false);
  const clinicId = localStorage.getItem('@ClinicManager:token');
  const clinicNome = localStorage.getItem('@ClinicManager:nome') || 'Clínica';

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getClinic(clinicId).then(r => {
        if (r.success) { setDentCro(r.clinic.cro||''); }
      }).catch(()=>{});
    }
  }, []);

  const startCreate = (t) => {
    setTipo(t);
    const tp = TIPOS.find(x=>x.id===t);
    setTitulo(tp?.label||'');
    setConteudo(template(t, patient, clinicNome));
    setPatSig(null); setDentSig(null);
    setStep('edit');
  };

  const afterPatSig = (b64) => { setPatSig(b64); setStep('signD'); };
  const afterDentSig = async (b64) => {
    if (!dentNome.trim()) { alert('Informe o nome do dentista.'); return; }
    setDentSig(b64);
    setSaving(true);
    const hash = await gerarHash(conteudo);
    const now = new Date().toISOString();
    const patAssinatura = tipo==='anamnese'
      ? { tipo:'texto', nome:patient.assinaturaNome||patient.nomeCompleto, data:patient.assinaturaData||now, cpf:patient.cpfOuCi }
      : { tipo:'canvas', base64:patSig, nome:patient.nomeCompleto, cpf:patient.cpfOuCi, assinadoEm:now };
    const novo = {
      id: Date.now().toString(), tipo, titulo, conteudo, criadoEm: now,
      hashDocumento: hash,
      assinaturaPaciente: patAssinatura,
      assinaturaDentista: { base64:b64, nome:dentNome, cro:dentCro, assinadoEm:now },
    };
    const updated = [...docs, novo];
    try {
      await api.put(`/patients/${patientId}`, { documentos: updated });
      setDocs(updated);
      setStep('list');
    } catch(e) { alert('Erro ao salvar: '+e.message); }
    setSaving(false);
  };

  const deletar = async (id) => {
    if (!window.confirm('Remover este documento?')) return;
    const updated = docs.filter(d=>d.id!==id);
    await api.put(`/patients/${patientId}`, { documentos: updated });
    setDocs(updated);
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '-';
  const tipoLabel = (t) => TIPOS.find(x=>x.id===t)?.label || t;

  // ── LIST ──────────────────────────────────────────────────────────────────────
  if (step==='list') return (
    <div className="glass-panel" style={{ padding:'28px', marginBottom:'32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <div>
          <h2 style={{ fontSize:'1.4rem', margin:0, marginBottom:'4px' }}>📄 Documentos e Assinaturas</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem', margin:0 }}>
            Assinaturas eletrônicas com validade jurídica (Lei 14.063/2020)
          </p>
        </div>
        <button onClick={()=>setStep('type')} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 18px' }}>
          <Plus size={16}/> Novo Documento
        </button>
      </div>

      {docs.length===0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'var(--text-secondary)', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
          Nenhum documento assinado ainda.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {docs.map(d=>(
            <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <span style={{ fontSize:'1.4rem' }}>{TIPOS.find(t=>t.id===d.tipo)?.emoji||'📄'}</span>
                <div>
                  <div style={{ fontWeight:600, marginBottom:'3px' }}>{d.titulo}</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                    <span style={{ background:badgeColor[d.tipo]+'22', color:badgeColor[d.tipo], padding:'2px 7px', borderRadius:'4px', marginRight:'8px', fontSize:'0.75rem' }}>{tipoLabel(d.tipo)}</span>
                    {fmtDate(d.criadoEm)}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <Shield size={14} color="#10B981"/><span style={{ fontSize:'0.75rem', color:'#10B981', marginRight:'8px' }}>Assinado</span>
                <button onClick={()=>{setViewDoc(d);setStep('view');}} title="Visualizar" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent-cyan)', padding:'6px' }}><Eye size={16}/></button>
                <button onClick={()=>deletar(d.id)} title="Remover" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--error)', padding:'6px' }}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── TYPE SELECT ───────────────────────────────────────────────────────────────
  if (step==='type') return (
    <div className="glass-panel" style={{ padding:'28px', marginBottom:'32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <h2 style={{ margin:0 }}>Selecione o Tipo de Documento</h2>
        <button onClick={()=>setStep('list')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)' }}><X size={22}/></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        {TIPOS.map(t=>(
          <div key={t.id} onClick={()=>startCreate(t.id)} style={{ padding:'20px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-cyan)';e.currentTarget.style.background='rgba(6,182,212,0.06)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.background='rgba(255,255,255,0.04)';}}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>{t.emoji}</div>
            <div style={{ fontWeight:600, marginBottom:'4px' }}>{t.label}</div>
            <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>{t.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── EDIT ──────────────────────────────────────────────────────────────────────
  if (step==='edit') return (
    <div className="glass-panel" style={{ padding:'28px', marginBottom:'32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ margin:0 }}>Revisar Conteúdo</h2>
        <button onClick={()=>setStep('type')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)' }}><X size={22}/></button>
      </div>
      <div style={{ marginBottom:'14px' }}>
        <label className="input-label">Título do Documento</label>
        <input className="input-field" value={titulo} onChange={e=>setTitulo(e.target.value)} />
      </div>
      <div style={{ marginBottom:'20px' }}>
        <label className="input-label">Conteúdo {tipo==='anamnese'&&'(somente leitura)'}</label>
        <textarea className="input-field" value={conteudo} onChange={e=>tipo!=='anamnese'&&setConteudo(e.target.value)}
          readOnly={tipo==='anamnese'} rows={14}
          style={{ resize:'vertical', fontFamily:'monospace', fontSize:'0.85rem', lineHeight:1.7, opacity: tipo==='anamnese'?0.8:1 }} />
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px' }}>
        <button onClick={()=>setStep('type')} className="btn-secondary">Voltar</button>
        <button onClick={()=>setStep(tipo==='anamnese'?'signD':'signP')} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <PenLine size={15}/> {tipo==='anamnese'?'Assinar (Dentista)':'Próximo: Assinatura do Paciente'} <ChevronRight size={15}/>
        </button>
      </div>
    </div>
  );

  // ── PATIENT SIGN ──────────────────────────────────────────────────────────────
  if (step==='signP') return (
    <SignaturePad
      title={`Assinatura do Paciente — ${patient.nomeCompleto}`}
      onConfirm={afterPatSig}
      onCancel={()=>setStep('edit')}
    />
  );

  // ── DENTIST INFO + SIGN ───────────────────────────────────────────────────────
  if (step==='signD') {
    return (
      <>
        <div style={{ position:'fixed', inset:0, zIndex:1500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)' }}>
          <div style={{ background:'var(--bg-secondary)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px', padding:'28px', width:'440px', boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }}>
            <h3 style={{ margin:'0 0 18px', color:'#A78BFA' }}>Assinatura do Dentista Responsável</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
              <div>
                <label className="input-label" style={{ fontSize:'0.8rem' }}>Nome do Dentista *</label>
                <input className="input-field" placeholder="Dr(a). Nome" value={dentNome} onChange={e=>setDentNome(e.target.value)} />
              </div>
              <div>
                <label className="input-label" style={{ fontSize:'0.8rem' }}>CRO</label>
                <input className="input-field" placeholder="12345-SP" value={dentCro} onChange={e=>setDentCro(e.target.value)} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px' }}>
              <button onClick={()=>setStep(tipo==='anamnese'?'edit':'signP')} className="btn-secondary" style={{ padding:'8px 16px', fontSize:'0.85rem' }}>Voltar</button>
              <button onClick={()=>{ if(!dentNome.trim()){alert('Informe o nome do dentista.');return;} setShowPad(true); }}
                className="btn-primary" style={{ padding:'8px 18px', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:'6px' }}>
                <PenLine size={14}/> Abrir Área de Assinatura
              </button>
            </div>
          </div>
        </div>
        {showPad && (
          <SignaturePad
            title={`Assinatura — ${dentNome || 'Dentista'}`}
            onConfirm={saving?()=>{}:afterDentSig}
            onCancel={()=>setShowPad(false)}
          />
        )}
      </>
    );
  }

  // ── VIEW ──────────────────────────────────────────────────────────────────────
  if (step==='view' && viewDoc) {
    const d = viewDoc;
    return (
      <div style={{ position:'fixed', inset:0, zIndex:2000, overflowY:'auto', background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)', display:'flex', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ background:'var(--bg-secondary)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px', width:'700px', padding:'36px', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', height:'fit-content' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
            <div>
              <h2 style={{ margin:0, marginBottom:'4px' }}>{d.titulo}</h2>
              <span style={{ fontSize:'0.78rem', background:badgeColor[d.tipo]+'22', color:badgeColor[d.tipo], padding:'3px 8px', borderRadius:'4px' }}>{tipoLabel(d.tipo)}</span>
            </div>
            <button onClick={()=>setStep('list')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)' }}><X size={22}/></button>
          </div>

          {/* Conteúdo */}
          <pre style={{ fontFamily:'monospace', fontSize:'0.83rem', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'20px', whiteSpace:'pre-wrap', lineHeight:1.7, marginBottom:'24px', maxHeight:'300px', overflowY:'auto' }}>{d.conteudo}</pre>

          {/* Assinaturas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            {/* Paciente */}
            <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:'10px', padding:'16px' }}>
              <div style={{ fontSize:'0.75rem', color:'var(--accent-cyan)', fontWeight:700, marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.06em' }}>Assinatura do Paciente</div>
              {d.assinaturaPaciente?.tipo==='canvas'
                ? <img src={d.assinaturaPaciente.base64} alt="Assinatura" style={{ width:'100%', maxHeight:'80px', objectFit:'contain', background:'#fff', borderRadius:'6px', marginBottom:'8px' }}/>
                : <div style={{ fontFamily:'Georgia, serif', fontSize:'1.1rem', fontStyle:'italic', textAlign:'center', padding:'12px', background:'#fff', color:'#111', borderRadius:'6px', marginBottom:'8px' }}>{d.assinaturaPaciente?.nome}</div>
              }
              <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                <div>{d.assinaturaPaciente?.nome} — CPF: {d.assinaturaPaciente?.cpf}</div>
                <div>{fmtDate(d.assinaturaPaciente?.assinadoEm || d.assinaturaPaciente?.data)}</div>
              </div>
            </div>

            {/* Dentista */}
            <div style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'10px', padding:'16px' }}>
              <div style={{ fontSize:'0.75rem', color:'#A78BFA', fontWeight:700, marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.06em' }}>Assinatura do Dentista</div>
              <img src={d.assinaturaDentista?.base64} alt="Assinatura" style={{ width:'100%', maxHeight:'80px', objectFit:'contain', background:'#fff', borderRadius:'6px', marginBottom:'8px' }}/>
              <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                <div>{d.assinaturaDentista?.nome} — CRO: {d.assinaturaDentista?.cro}</div>
                <div>{fmtDate(d.assinaturaDentista?.assinadoEm)}</div>
              </div>
            </div>
          </div>

          {/* Certificado */}
          <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:'10px', padding:'14px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
              <Shield size={16} color="#10B981"/>
              <span style={{ fontWeight:600, color:'#10B981', fontSize:'0.85rem' }}>Certificado de Autenticidade</span>
            </div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
              <div>Documento criado em: {fmtDate(d.criadoEm)}</div>
              <div style={{ wordBreak:'break-all' }}>Hash: {d.hashDocumento}</div>
              <div style={{ marginTop:'4px', fontStyle:'italic' }}>Assinatura Eletrônica Simples — Lei 14.063/2020 | ClinicManager</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
