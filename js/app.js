import { database } from "./firebase.js";
import {
  ref,
  set,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const KEY = 'os_sys_v1';
let db = [];
let dbAnterior = [];

onValue(ref(database, "os"), (snapshot) => {
    const dados = snapshot.val();
    const novaLista = dados ? Object.values(dados) : [];

    // Detecta OS que acabaram de entrar em "assinando" (técnico finalizou e aguarda encaminhamento ao solicitante)
    novaLista.forEach(o => {
      const anterior = dbAnterior.find(a => a.id === o.id);
      const eraAssinando = anterior && anterior.status === 'assinando';
      if (o.status === 'assinando' && !eraAssinando) {
        notificarSupervisor(o);
      }
    });

    db = novaLista;
    dbAnterior = novaLista;

    renderPainel();
    renderOSList();
    renderTecSelect();
    abrirOSPeloLink();
    atualizarBadgeNotificacoes();
});

function abrirOSPeloLink() {
    const params = new URLSearchParams(window.location.search);
    const osId = params.get("os");
    const role = params.get("role") || 'tecnico';
    
    if (!osId) return;
    const os = db.find(o => o.id === osId);
    if (!os) return;

    goView("tec-link");
    const select = document.getElementById("tec-os-select");
    if (select) select.value = os.id;
    
    renderTecPage(os.id, role);

    document.body.classList.add("modo-tecnico");
    document.getElementById("sidebar").style.display = "none";
    document.getElementById("fab").style.display = "none";
}

let curStatus = 'aberto';
let curFilter = 'all';
let curTec = null;
let editId = null;
let curView = 'painel';

const TEC = {
  jhonatan: { label: 'Jhonatan', sub: 'Predial', av: 'av-j', initials: 'JH', phone: '5511985070553' },
  jorge: { label: 'Jorge F.', sub: 'Elétrica', av: 'av-jo', initials: 'JO', phone: '5511984610163' },
  hugo: { label: 'Zé Hugo', sub: 'Elétrica', av: 'av-zh', initials: 'ZH', phone: '5511912889240' }
};

const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Andamento', concluido: 'Concluído', assinando: 'Aguard. validação', fechado: 'Fechado' };
const PILL_CLASS = { aberto: 'p-aberto', andamento: 'p-andamento', concluido: 'p-concluido', assinando: 'p-assinando', fechado: 'p-fechado' };

let ssmaRespostas = { q1: null, q2: null, q3: null };
let pecas = [];

async function save(id, dados) {
    try {
        await set(ref(database, "os/" + id), dados);
        console.log("OS salva:", id);
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert(e.message);
    }
}

async function deleteOS(id) {
  const os = db.find(x => x.id === id);
  if (!os) return;
  const confirmado = confirm(`Excluir a OS ${os.chamado || os.id}? Essa ação não pode ser desfeita.`);
  if (!confirmado) return;
  try {
    await remove(ref(database, "os/" + id));
    toast('OS excluída');
  } catch (e) {
    console.error("Erro ao excluir:", e);
    alert(e.message);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

function goView(v) {
  localStorage.setItem('currentView', v);
  closeSidebar();
  curView = v;
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.getElementById('nav-' + v)?.classList.add('active');
  document.getElementById('fab').style.display = v === 'os' ? 'flex' : 'none';
  if (v === 'painel') renderPainel();
  if (v === 'os') renderOSList();
  if (v === 'tec-link') renderTecSelect();
}

function openDrawer(id) {
  editId = id || null; curTec = null; curStatus = 'aberto';
  document.getElementById('drawer-title').textContent = id ? 'Editar OS' : 'Nova OS';
  document.getElementById('ov1').classList.add('show');
  
  //  CORRIGIDO: Aponta diretamente para o id correto do seu HTML usando a sintaxe certa
  document.getElementById('drawer1')?.classList.add('open');
  
  if (id) {
    const o = db.find(x => x.id === id);
    document.getElementById('f-chamado').value = o.chamado || '';
    document.getElementById('f-problema').value = o.problema || '';
    document.getElementById('f-esp').value = o.esp || 'Predial';
    document.getElementById('f-data').value = o.data || '';
    document.getElementById('f-area').value = o.area || '';
    document.getElementById('f-solicitante').value = typeof o.solicitante === 'object' ? (o.solicitante.nome || '') : (o.solicitante || '');
    document.getElementById('f-desc').value = o.desc || '';
    curStatus = o.status || 'aberto';
    curTec = o.tec || null;
  } else {
    ['f-chamado', 'f-problema', 'f-area', 'f-solicitante', 'f-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-esp').value = 'Predial';
    document.getElementById('f-data').value = new Date().toISOString().slice(0, 10);
  }
  document.querySelectorAll('.tec-opt').forEach(e => e.classList.remove('sel'));
  if (curTec) {
    const map = { jhonatan: 'j', jorge: 'jo', hugo: 'zh' };
    document.getElementById('to-' + map[curTec])?.classList.add('sel');
  }
  document.querySelectorAll('.st').forEach(e => { e.className = 'st'; if (e.dataset.s === curStatus) e.classList.add('on-' + curStatus); });
}

function closeDrawer() {
  document.getElementById('ov1').classList.remove('show');
  

  document.getElementById('drawer1')?.classList.remove('open');
}

function selTec(t) {
  curTec = t;
  document.querySelectorAll('.tec-opt').forEach(e => e.classList.remove('sel'));
  const map = { jhonatan: 'j', jorge: 'jo', hugo: 'zh' };
  document.getElementById('to-' + map[t])?.classList.add('sel');
}

function selStatus(el) {
  curStatus = el.dataset.s;
  document.querySelectorAll('.st').forEach(e => e.className = 'st');
  el.classList.add('on-' + curStatus);
}

function saveOS() {
  const prob = document.getElementById('f-problema').value.trim();
  if (!prob) { alert('Informe o tipo de problema.'); return; }
  const solicitanteNome = document.getElementById('f-solicitante').value.trim();
  
  const data = {
    chamado: document.getElementById('f-chamado').value.trim(),
    problema: prob,
    esp: document.getElementById('f-esp').value,
    data: document.getElementById('f-data').value,
    area: document.getElementById('f-area').value.trim(),
    desc: document.getElementById('f-desc').value.trim(),
    tec: curTec,
    status: curStatus
  };

  if (editId) {
    const idx = db.findIndex(x => x.id === editId);
    const osAntiga = db[idx];
    const solAtualizado = typeof osAntiga.solicitante === 'object' 
      ? { ...osAntiga.solicitante, nome: solicitanteNome } 
      : { nome: solicitanteNome, validacao: null, aprovado: false };

    db[idx] = { ...osAntiga, ...data, solicitante: solAtualizado };
    save(editId, db[idx]);
    toast('OS atualizada');
  } else {
    const novaOS = {
        id: 'os_' + Date.now(),
        ...data,
        status: "aberto",
        tecnico: {
            id: curTec,
            nome: curTec ? TEC[curTec].label : "Técnico",
            telefone: curTec ? TEC[curTec].phone : "",
            token: crypto.randomUUID(),
            validacao: null
        },
        solicitante: {
            nome: solicitanteNome || "Solicitante",
            telefone: "",
            token: crypto.randomUUID(),
            aprovado: false,
            observacao: "",
            validacao: null
        },
        pecas: [],
        ssma: { q1: null, q2: null, q3: null },
        historico: [{ data: new Date().toISOString(), evento: "OS criada", usuario: "Administrador" }]
    };
    db.push(novaOS);
    save(novaOS.id, novaOS);
    toast('OS criada');
  }
  closeDrawer();
}

function makeWALink(os, papel = 'tecnico') {
    const tecObj = os.tec ? TEC[os.tec] : null;
    const phone = tecObj?.phone || "";
    const link = `${window.location.origin}${window.location.pathname}?os=${os.id}&role=${papel}`;
    
    let msg = "";
    if (papel === 'tecnico') {
        msg = `📋 *ORDEM DE SERVIÇO ${os.chamado || "S/N"}*\n\n🔧 Problema: ${os.problema}\n📍 Local: ${os.area || "—"}\n📅 Data: ${fmtDate(os.data)}\n\nAbra o link para executar:\n${link}`;
    } else {
        msg = `🔔 *SOLICITAÇÃO DE ACEITE - CHAMADO ${os.chamado || "S/N"}*\n\nO serviço foi finalizado pelo técnico. Clique no link para conferir o relatório e realizar a validação pelo seu aparelho:\n${link}`;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function obterNomeDispositivo(ua) {
    if (!ua) return "Dispositivo Móvel";
    if (/android/i.test(ua)) return "Dispositivo Android";
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "Dispositivo iOS (iPhone/iPad)";
    if (/Windows/.test(ua)) return "Computador (Windows)";
    if (/Macintosh/.test(ua)) return "Computador (Mac/OSX)";
    return "Dispositivo Móvel";
}

function obterNavegador(ua) {
    if (!ua) return "Navegador Web";
    if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) return "Chrome Mobile";
    if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return "Safari Mobile";
    if (/firefox|fxios/i.test(ua)) return "Firefox Mobile";
    return "Navegador Web";
}

async function gerarValidacao(){
    let gps = null;
    try { gps = await obterGPS(); } catch(e) {}
    
    const ua = navigator.userAgent;
    return {
        data: new Date().toISOString(),
        userAgent: ua,
        dispositivoFormatado: obterNomeDispositivo(ua),
        navegadorFormatado: obterNavegador(ua),
        plataforma: navigator.platform,
        idioma: navigator.language,
        tela: `${screen.width}x${screen.height}`,
        gps
    };
}

function obterGPS(){
    return new Promise((resolve,reject)=>{
        if(!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(pos => {
            resolve({ lat:pos.coords.latitude, lng:pos.coords.longitude, precisao:pos.coords.accuracy });
        }, () => resolve(null));
    });
}

// VERIFICAÇÃO DE SEGURANÇA POR PIN (últimos 4 dígitos do celular do técnico)
function verificarPinTecnico(tecId) {
  const tec = tecId ? TEC[tecId] : null;
  if (!tec || !tec.phone) return true; // sem técnico definido na OS, não bloqueia

  const pinCorreto = tec.phone.slice(-4);
  const pinDigitado = prompt(`🔒 Verificação de segurança\nDigite os 4 últimos dígitos do celular de ${tec.label} para confirmar sua identidade:`);

  if (pinDigitado === null) return false; // usuário cancelou
  if (pinDigitado.trim() !== pinCorreto) {
    alert('❌ PIN incorreto. Operação cancelada por segurança.');
    return false;
  }
  return true;
}

// NOVO FLUXO DE OPERAÇÃO DINÂMICO (INICIAR / FINALIZAR / ACEITE)
async function fecharOperacaoTecnico(id) {
  const os = db.find(x => x.id === id); 
  if (!os) { alert("Erro: Ordem de Serviço não encontrada."); return; }
  
  const params = new URLSearchParams(window.location.search);
  const papelAtual = params.get("role") || 'tecnico';

  // Blindagem dos objetos internos
  if (!os.tecnico) os.tecnico = { id: os.tec || "", nome: os.tec ? (TEC[os.tec]?.label || "Técnico") : "Técnico", validacao: null };
  if (!os.solicitante || typeof os.solicitante === "string") {
      os.solicitante = { nome: typeof os.solicitante === "string" ? os.solicitante : "Solicitante", validacao: null, aprovado: false };
  }

  // ETAPA 1: Se o técnico está iniciando a OS
  if (papelAtual === 'tecnico' && (os.status === 'aberto' || !os.status)) {
      if (!verificarPinTecnico(os.tec)) return;

      os.iniciada = new Date().toISOString().slice(0, 16); // Salva data/hora local atual
      os.status = 'andamento';
      if(!os.historico) os.historico = [];
      os.historico.push({ data: new Date().toISOString(), evento: "Serviço Iniciado pelo Técnico (PIN verificado)", usuario: os.tecnico.nome });
      
      await save(os.id, os);
      toast('Serviço iniciado com sucesso! 🚀');
      renderTecPage(os.id, papelAtual);
      return;
  }

  // ETAPA 2: Se o técnico está finalizando o conserto (Exige validações de preenchimento)
  if (papelAtual === 'tecnico' && os.status === 'andamento') {
      const servico = document.getElementById('tec-servico')?.value.trim() || '';
      if (!servico) { alert("⚠️ Erro: Você precisa descrever o Serviço Realizado no Relatório Técnico antes de finalizar."); return; }
      if (!ssmaRespostas.q1 || !ssmaRespostas.q2 || !ssmaRespostas.q3) { alert("⚠️ Erro: Responda as perguntas de SSMA/Segurança antes de finalizar."); return; }
      if (!verificarPinTecnico(os.tec)) return;

      const validacao = await gerarValidacao();
      os.tecnico.validacao = validacao;
      os.concluida = new Date().toISOString().slice(0, 16);
      os.status = 'assinando';

      // Captura demais dados preenchidos pelo técnico
      os.pecas = [...pecas];
      os.servicoRealizado = servico;
      os.tag = document.getElementById('tec-tag')?.value.trim() || '';
      os.descEquipamento = document.getElementById('tec-desc-equip')?.value.trim() || '';
      os.acoesSsma = document.getElementById('tec-acoes-ssma')?.value.trim() || '';
      os.ssma = { ...ssmaRespostas };

      if(!os.historico) os.historico = [];
      os.historico.push({ data: new Date().toISOString(), evento: "Relatório operacional finalizado pelo Técnico (PIN verificado)", usuario: os.tecnico.nome });

      await save(os.id, os);
      toast('Validação do técnico efetuada! ✔');
      alert('Relatório técnico salvo com sucesso! O supervisor foi notificado e fará o encaminhamento do aceite ao solicitante.');

      renderTecPage(os.id, papelAtual);
      return;
  }

  // ETAPA 3: Se o solicitante está efetuando o aceite digital final
  if (papelAtual === 'solicitante') {
      if (os.status === 'fechado') { alert("Esta ordem de serviço já foi encerrada e homologada!"); return; }
      
      const validacao = await gerarValidacao();
      os.solicitante.validacao = validacao;
      os.solicitante.aprovado = true;
      os.status = 'fechado';

      if(!os.historico) os.historico = [];
      os.historico.push({ data: new Date().toISOString(), evento: "Aceite homologado via Aparelho", usuario: os.solicitante.nome });

      await save(os.id, os);
      toast('Aceite registrado com sucesso! ✔');
      alert('Ordem de serviço encerrada e homologada por ambas as partes!');
      gerarPDF(os.id);
      renderTecPage(os.id, papelAtual);
  }
}

function renderTecPage(id, role = 'tecnico') {
  if (!id) return;
  const o = db.find(x => x.id === id);
  if (!o) return;
  
  const params = new URLSearchParams(window.location.search);
  const papelAtual = role || params.get("role") || 'tecnico';
  const isSol = papelAtual === 'solicitante';

  // Bloqueia campos se a OS ainda não foi iniciada ou se for o solicitante visualizando
const isDisabled = isSol || (papelAtual === 'tecnico' && (o.status === 'aberto' || !o.status));

  ssmaRespostas = o.ssma ? { ...o.ssma } : { q1: null, q2: null, q3: null };
  const wrap = document.getElementById('tec-page-wrap');
  const exibeNomeSol = typeof o.solicitante === 'object' ? (o.solicitante.nome || '—') : (o.solicitante || '—');

  // Definição dinâmica do texto e visual do botão principal
  let btnTexto = "✔ Salvar Registro";
  let btnCor = "#16a34a";
  if (papelAtual === 'tecnico') {
      if (o.status === 'aberto' || !o.status) { btnTexto = "🚀 Iniciar Serviço"; btnCor = "#2563eb"; }
      else if (o.status === 'andamento') { btnTexto = "🏁 Finalizar Serviço"; btnCor = "#ea580c"; }
      else { btnTexto = "🔒 Serviço Finalizado"; btnCor = "#64748b"; }
  } else if (isSol) {
      if (o.status === 'fechado') { btnTexto = "🔒 OS Homologada & Fechada"; btnCor = "#64748b"; }
      else { btnTexto = "✔ Registrar Aceite Digital"; btnCor = "#16a34a"; }
  }

  wrap.innerHTML = `<div class="tec-page" style="background:#fff; max-width:600px; margin:0 auto; font-family:inherit; color:#334155; position:relative;">    <header class="tec-header" style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:20px; border-radius:8px 8px 0 0;">
      <div class="tec-os-num" style="font-size:12px; font-weight:700; color:#1a4480; text-transform:uppercase; margin-bottom:4px;">Chamado ${o.chamado || 'S/N'} · ${o.esp}</div>
      <div class="tec-os-title" style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:6px;">${o.problema}</div>
      <div class="tec-os-sub" style="font-size:14px; color:#475569;">📍 Área: <strong>${o.area || '—'}</strong>  · Solicitante: <strong>${exibeNomeSol}</strong></div>
      <div style="margin-top:10px;"><span class="pill ${PILL_CLASS[o.status || 'aberto']}">${STATUS_LABEL[o.status || 'aberto']}</span></div>
      
      ${o.status === 'aberto' || !o.status ? `<div style="background:#fff9db; border:1px solid #ffe3e3; color:#b02a37; padding:12px; border-radius:6px; margin-top:14px; font-size:13px; font-weight:600; text-align:center;">👉 Clique em "🚀 Iniciar Serviço" abaixo para dar andamento na atividade.</div>` : ''}
      ${isSol && o.status !== 'fechado' ? `<div style="background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:12px; border-radius:6px; margin-top:14px; font-size:13px; font-weight:600; text-align:center;">📋 MODO DE ACEITE: Revise os dados abaixo fornecidos pelo técnico e clique em "Registrar Aceite Digital" para assinar.</div>` : ''}
    </header>

    <section class="tec-section" style="padding:16px;">
      <div class="tec-section-title" style="font-weight:700; font-size:14px; margin-bottom:10px; color:#1a4480; text-transform:uppercase; letter-spacing:0.5px;">Identificação do Equipamento</div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">
        <div class="field"><label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">TAG</label><input id="tec-tag" value="${o.tag || ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;" ${isDisabled ? 'disabled' : ''}></div>
        <div class="field"><label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Descrição do Equipamento</label><input id="tec-desc-equip" value="${o.descEquipamento || ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;" ${isDisabled ? 'disabled' : ''}></div>
      </div>
    </section>

    <section class="tec-section" style="padding:16px; border-top:1px solid #f1f5f9;">
      <div class="tec-section-title" style="font-weight:700; font-size:14px; margin-bottom:12px; color:#1a4480; text-transform:uppercase; letter-spacing:0.5px;">Preparativos de Segurança / SSMA</div>
      <div class="ssma-item" style="margin-bottom:12px;">
        <div class="ssma-text" style="font-size:13px; margin-bottom:6px; color:#1e293b;">1. Os preparativos de sinalização e bloqueio foram tomados?</div>
        <div class="ssma-buttons">
          <button class="ssma-btn yes" data-q="q1" data-v="SIM" onclick="${isDisabled ? '' : "setSSMA('q1','SIM')"}" style="${isDisabled ? 'pointer-events:none;' : ''}">SIM</button>
          <button class="ssma-btn no" data-q="q1" data-v="NÃO" onclick="${isDisabled ? '' : "setSSMA('q1','NÃO')"}" style="${isDisabled ? 'pointer-events:none;' : ''}">NÃO</button>
        </div>
      </div>
      <div class="ssma-item" style="margin-bottom:12px;">
        <div class="ssma-text" style="font-size:13px; margin-bottom:6px; color:#1e293b;">2. A área foi isolada/sinalizada corretamente com fita/cones?</div>
        <div class="ssma-buttons">
          <button class="ssma-btn yes" data-q="q2" data-v="SIM" onclick="${isDisabled ? '' : "setSSMA('q2','SIM')"}" style="${isDisabled ? 'pointer-events:none;' : ''}">SIM</button>
          <button class="ssma-btn no" data-q="q2" data-v="NÃO" onclick="${isDisabled ? '' : "setSSMA('q2','NÃO')"}" style="${isDisabled ? 'pointer-events:none;' : ''}">NÃO</button>
        </div>
      </div>
      <div class="ssma-item" style="margin-bottom:12px;">
        <div class="ssma-text" style="font-size:13px; margin-bottom:6px; color:#1e293b;">3. O equipamento foi devidamente desenergizado ou identificado com TAG?</div>
        <div class="ssma-buttons">
          <button class="ssma-btn yes" data-q="q3" data-v="SIM" onclick="${isDisabled ? '' : "setSSMA('q3','SIM')"}" style="${isDisabled ? 'pointer-events:none;' : ''}">SIM</button>
          <button class="ssma-btn no" data-q="q3" data-v="NÃO" onclick="${isDisabled ? '' : "setSSMA('q3','NÃO')"}" style="${isDisabled ? 'pointer-events:none;' : ''}">NÃO</button>
        </div>
      </div>
      <div class="field" style="margin-top:12px;">
        <label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Caso alguma das respostas tenha sido "não", indique quais as ações tomadas:</label>
        <textarea id="tec-acoes-ssma" style="width:100%; height:55px; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-family:inherit;" ${isDisabled ? 'disabled' : ''}>${o.acoesSsma || ''}</textarea>
      </div>
    </section>

    <section class="tec-section" style="padding:16px; border-top:1px solid #f1f5f9;">
      <div class="field">
        <label style="font-weight:700; font-size:14px; color:#1a4480; display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Relatório Técnico / Serviço Realizado</label>
        <textarea id="tec-servico" style="width:100%; height:80px; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-family:inherit;" ${isDisabled ? 'disabled' : ''} placeholder="${(o.status === 'aberto' || !o.status) ? 'Inicie o serviço para poder editar o relatório.' : 'Descreva o que foi realizado...'}">${o.servicoRealizado || ''}</textarea>
      </div>
    </section>

    <section class="tec-section" style="padding:16px; border-top:1px solid #f1f5f9;">
      <div class="tec-section-title" style="font-weight:700; font-size:14px; margin-bottom:10px; color:#1a4480; text-transform:uppercase; letter-spacing:0.5px;">Peças Utilizadas</div>
      <div class="pecas-list" id="pecas-list-tec"></div>
      ${isDisabled ? '' : `<button class="btn-add-peca" onclick="addPeca()" style="margin-top:8px; padding:6px 12px; background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer;">+ Adicionar Peça</button>`}
    </section>

    <footer style="display:flex; gap:10px; padding:20px; border-top:1px solid #f1f5f9;">
      <button class="btn btn-green" id="btn-principal-fluxo" style="flex:1; background:${btnCor}; color:#fff; font-weight:700; padding:12px; border:none; border-radius:6px; cursor:pointer;" onclick="fecharOperacaoTecnico('${o.id}')">${btnTexto}</button>
      <button class="btn btn-primary" style="flex:1; background:#1a4480; color:#fff; font-weight:700; padding:12px; border:none; border-radius:6px; cursor:pointer;" onclick="gerarPDF('${o.id}')">📄 Gerar PDF</button>
    </footer>

    ${o.status === 'fechado' ? `
    <div id="overlay-finalizado" style="position:absolute; inset:0; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); background:rgba(255,255,255,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:5; border-radius:8px; text-align:center; padding:24px;">
      <div style="font-size:52px; margin-bottom:10px;">✅</div>
      <div style="font-size:24px; font-weight:800; color:#166534; margin-bottom:6px;">Serviço Realizado</div>
      <div style="font-size:14px; color:#475569; margin-bottom:4px;">Chamado ${o.chamado || 'S/N'}</div>
      <div style="font-size:13px; color:#64748b; margin-bottom:20px;">Homologado e encerrado por técnico e solicitante.</div>
      <div style="display:flex; gap:10px;">
        <button onclick="document.getElementById('overlay-finalizado').style.display='none'" style="padding:10px 18px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; cursor:pointer; color:#334155;">👁 Ver detalhes</button>
        <button onclick="gerarPDF('${o.id}')" style="padding:10px 18px; background:#1a4480; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer;">📄 Gerar PDF</button>
      </div>
    </div>` : ''}
  </div>`;

  const selBox = document.getElementById("tec-os-select");
  if(selBox) selBox.style.display = "none";
  
  pecas = o.pecas ? [...o.pecas] : [];
  renderPecasList(isDisabled);
  
  if (ssmaRespostas.q1 !== null) setSSMA('q1', ssmaRespostas.q1);
  if (ssmaRespostas.q2 !== null) setSSMA('q2', ssmaRespostas.q2);
  if (ssmaRespostas.q3 !== null) setSSMA('q3', ssmaRespostas.q3);
}

function renderPainel() {
  const tot = db.length;
  const open = db.filter(o => o.status === 'aberto').length;
  const prog = db.filter(o => o.status === 'andamento').length;
  const done = db.filter(o => ['concluido', 'assinando', 'fechado'].includes(o.status)).length;
  
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-l">Total</div><div class="kpi-v">${tot}</div><div class="kpi-s">desde o início</div></div>
    <div class="kpi"><div class="kpi-l">Em aberto</div><div class="kpi-v" style="color:var(--amber)">${open}</div><div class="kpi-s">aguardando execução</div></div>
    <div class="kpi"><div class="kpi-l">Andamento</div><div class="kpi-v" style="color:var(--accent)">${prog}</div><div class="kpi-s">sendo executadas</div></div>
    <div class="kpi"><div class="kpi-l">Concluídas</div><div class="kpi-v" style="color:var(--green)">${done}</div><div class="kpi-s">finalizadas</div></div>
  `;
  
  const cnt = {}; db.forEach(o => { cnt[o.problema] = (cnt[o.problema] || 0) + 1; });
  const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  const colors = ['#1A4480', '#1A6B3A', '#B45309', '#B91C1C', '#6B21A8', '#0E7490'];
  
  document.getElementById('prob-n').textContent = Object.keys(cnt).length + ' tipos';
  document.getElementById('prob-rank').innerHTML = sorted.length ? sorted.map(([p, n], i) => `
    <div class="rank-row">
      <span class="rank-n">${i + 1}</span>
      <span class="rank-name" title="${p}">${p}</span>
      <div class="rank-bar-w"><div class="rank-bar-f" style="width:${Math.round(n / max * 100)}%;background:${colors[i % colors.length]}"></div></div>
      <span class="rank-cnt">${n}</span>
    </div>`).join('') : '<div class="empty"><p>Nenhuma OS ainda.</p></div>';

  const months = {}; const ml = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = d.getFullYear() + '-' + (d.getMonth() + 1);
    months[k] = { l: ml[d.getMonth()], n: 0, cur: i === 0 };
  }
  db.forEach(o => { if (!o.data) return; const d = new Date(o.data); const k = d.getFullYear() + '-' + (d.getMonth() + 1); if (months[k]) months[k].n++; });
  const mv = Object.values(months); const mmax = Math.max(...mv.map(v => v.n), 1);
  
  document.getElementById('month-chart').innerHTML = mv.map(v => `
    <div class="month-col">
      <span class="mn">${v.n || ''}</span>
      <div class="bar-w"><div class="bar${v.cur ? ' cur' : ''}" style="height:${Math.round(v.n / mmax * 56) + 4}px"></div></div>
      <span class="ml">${v.l}</span>
    </div>`).join('');

  const ult = db.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 5);
  document.getElementById('ultimas-list').innerHTML = ult.length ? ult.map(o => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="goView('os')">
      <span style="font-size:11px;font-weight:700;color:var(--accent);font-family:monospace">${o.chamado || '—'}</span>
      <span style="flex:1;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.problema}</span>
      <span class="pill ${PILL_CLASS[o.status || 'aberto']}">${STATUS_LABEL[o.status || 'aberto']}</span>
    </div>`).join('') : '<div class="empty"><p>Nenhuma OS ainda.</p></div>';
}

function renderOSList() {
  renderDatalist();
  const rows = db.filter(o => curFilter === 'aberto' || o.status === curFilter).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const wrap = document.getElementById('os-list');
  if (!rows.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">🔧</div><p>Nenhuma OS nesta categoria.</p></div>'; return; }
  
  wrap.innerHTML = rows.map(o => {
    const tec = o.tec ? TEC[o.tec] : null;
    const tecHtml = tec ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px"><div class="tav ${tec.av}" style="width:20px;height:20px;font-size:9px">${tec.initials}</div>${tec.label}</div>` : '<span style="font-size:11px;color:var(--muted2)">Sem técnico</span>';
    const waLink = makeWALink(o, 'tecnico');
    return `<div class="os-card" onclick="openDrawer('${o.id}')">
      <span class="os-num">${o.chamado || '—'}</span>
      <div class="os-info">
        <div class="os-desc">${o.problema}</div>
        <div class="os-meta">
          <span class="esp-tag">${o.esp}</span>
          <span>${o.area || '—'}</span>
          <span>${fmtDate(o.data)}</span>
          ${tecHtml}
        </div>
      </div>
      <div class="os-actions" onclick="event.stopPropagation()">
          <span class="pill ${PILL_CLASS[o.status || 'aberto']}">${STATUS_LABEL[o.status || 'aberto']}</span>
          ${o.tec ? `<a href="${waLink}" target="_blank" style="text-decoration:none"><button class="btn btn-sm" style="background:#25D366;color:#fff;border:none">📲 Tec</button></a>` : ''}
          <button class="btn btn-sm btn-primary" onclick="gerarPDF('${o.id}')">📄 PDF</button>
          <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border-color:var(--red)" onclick="deleteOS('${o.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function gerarPDF(id) {
  const os = db.find(x => x.id === id); if (!os) return;
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('Biblioteca de PDF carregando. Aguarde.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 12, cw = W - M * 2;

  function cell(x, y, w, h, text, opts = {}) {
    if (opts.fill) doc.setFillColor(...opts.fill);
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, opts.fill ? 'FD' : 'S');
    if (text === undefined || text === null || text === '') return;
    const fs = opts.fs || 8;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(fs); doc.setTextColor(...(opts.tc || [30,30,30]));
    const align = opts.align || 'left';
    let tx = align === 'center' ? x + w / 2 : (align === 'right' ? x + w - 2 : x + 2);
    const dim = doc.getTextDimensions(String(text));
    doc.text(String(text), tx, y + (h + dim.h) / 2 - 0.25, { align, maxWidth: w - 4 });
  }

  function hdr(x, y, w, h, text) { cell(x, y, w, h, text, { fill: [26,68,128], tc: [255,255,255], bold: true, fs: 8, align: 'center' }); }
  function lbl(x, y, w, h, text) { cell(x, y, w, h, text, { fill: [235, 240, 248], tc: [26, 68, 128], bold: true, fs: 7.5 }); }
  function val(x, y, w, h, text) { cell(x, y, w, h, text, { fs: 8 }); }

  let y = M;
  hdr(M, y, cw, 8, 'ORDEM DE SERVIÇO — F-ZZ-181B-0020'); y += 8;

  lbl(M, y, 30, 6, 'N° OS / Chamado'); val(M + 30, y, 35, 6, os.chamado || '—');
  lbl(M + 65, y, 30, 6, 'Tipo de Serviço'); val(M + 95, y, cw - 95, 6, 'CORRETIVA'); y += 6;
  lbl(M, y, 30, 6, 'Data de Abertura'); val(M + 30, y, 35, 6, fmtDate(os.data));
  lbl(M + 65, y, 30, 6, 'Especialidade'); val(M + 95, y, cw - 95, 6, os.esp || '—'); y += 6;
  lbl(M, y, 30, 6, 'Solicitante'); val(M + 30, y, cw - 30, 6, os.solicitante?.nome || os.solicitante || '—'); y += 6;
  lbl(M, y, 30, 6, 'Local / Área'); val(M + 30, y, cw - 30, 6, os.area || '—'); y += 6;
  lbl(M, y, 30, 6, 'Técnico'); val(M + 30, y, cw - 30, 6, os.tecnico?.nome || (os.tec ? TEC[os.tec].label : '—')); y += 8;

  hdr(M, y, cw, 6, 'TAG: Descrição do Equipamento'); y += 6;
  lbl(M, y, 20, 7, 'TAG:'); val(M + 20, y, 45, 7, os.tag || '—');
  lbl(M + 65, y, 35, 7, 'Desc. Equipamento:'); val(M + 100, y, cw - 100, 7, os.descEquipamento || '—'); y += 8;
  
  hdr(M, y, cw, 6, 'Motivo / Sintoma'); y += 6;
  val(M, y, cw, 7, os.problema || '—'); y += 8;

  hdr(M, y, cw, 6, 'Preparativos de Segurança / SSMA'); y += 6;
  const s = os.ssma || { q1: null, q2: null, q3: null };
  const chk = [
    { q: 'Os preparativos de sinalização e bloqueio foram tomados?', v: s.q1 },
    { q: 'A área foi isolada/sinalizada corretamente com fita/cones?', v: s.q2 },
    { q: 'O equipamento foi devidamente desenergizado ou identificado com TAG?', v: s.q3}
  ];
  chk.forEach(item => {
    lbl(M, y, cw - 30, 5.5, item.q);
    let txt = '[   ] SIM   [   ] NÃO';
    if (item.v === 'SIM') txt = '[ X ] SIM   [   ] NÃO';
    if (item.v === 'NÃO') txt = '[   ] SIM   [ X ] NÃO';
    cell(M + cw - 30, y, 30, 5.5, txt, { fs: 7.5, align: 'center', bold: true });
    y += 5.5;
  });
  
  lbl(M, y, cw, 5, 'Caso alguma das respostas tenha sido "não", indique quais as ações tomadas:'); y += 5;
  val(M, y, cw, 6.5, os.acoesSsma || '—'); y += 8.5;

  hdr(M, y, cw, 6, 'Descrição do Serviço a ser Realizado (Solicitação)'); y += 6;
  const dLines = doc.splitTextToSize(os.desc || 'Nenhuma descrição detalhada.', cw - 4);
  const dH = Math.max(12, dLines.length * 4 + 4); cell(M, y, cw, dH, '');
  doc.text(dLines, M + 2, y + 4); y += dH;

  hdr(M, y, cw, 6, 'Descrição do Serviço Efetivamente Realizado (Relatório Técnico)'); y += 6;
  const srLines = doc.splitTextToSize(os.servicoRealizado || 'Aguardando preenchimento do relatório técnico.', cw - 4);
  const srH = Math.max(12, srLines.length * 4 + 4); cell(M, y, cw, srH, '');
  doc.text(srLines, M + 2, y + 4); y += srH;

  hdr(M, y, cw, 6, 'Tempos de Execução e Ocorrência'); y += 6;
  lbl(M, y, 60, 5, 'Etapa'); lbl(M + 60, y, 63, 5, 'Data'); lbl(M + 123, y, 63, 5, 'Hora'); y += 5;
  const etapas = [
    { et: 'Início da Ocorrência', data: fmtDate(os.data), hora: '—' },
    { et: 'Início do Conserto', data: os.iniciada ? os.iniciada.slice(0, 10).split('-').reverse().join('/') : '—', hora: os.iniciada ? os.iniciada.slice(11, 16) : '—' },
    { et: 'Fim do Conserto', data: os.concluida ? os.concluida.slice(0, 10).split('-').reverse().join('/') : '—', hora: os.concluida ? os.concluida.slice(11, 16) : '—' },
  ];
  etapas.forEach(l => { lbl(M, y, 60, 5, l.et); val(M + 60, y, 63, 5, l.data); val(M + 123, y, 63, 5, l.hora); y += 5; });
  y += 2;

  hdr(M, y, cw, 6, 'Materiais e Peças Utilizadas'); y += 6;
  lbl(M, y, 35, 5, 'Código'); lbl(M + 35, y, cw - 60, 5, 'Descrição da Peça / Insumo'); lbl(M + cw - 25, y, 25, 5, 'Quantidade'); y += 5;
  const pecasArr = os.pecas && os.pecas.length ? os.pecas : [{ cod: '', desc: '', qtd: '' }, { cod: '', desc: '', qtd: '' }, { cod: '', desc: '', qtd: '' }];
  pecasArr.slice(0, 4).forEach(p => {
    val(M, y, 35, 5, p.cod || '—'); val(M + 35, y, cw - 60, 5, p.desc || '—'); val(M + cw - 25, y, 25, 5, p.qtd || '—'); y += 5;
  });
  y += 3;

  hdr(M, y, cw, 5.5, 'Assinatura Digital & Auditoria (Homologação via Hardware ID e Pin)'); y += 5.5;
  const sw = cw / 2;
  
  lbl(M, y, sw, 5, 'Executante / Técnico'); 
  lbl(M + sw, y, sw, 5, 'Solicitante'); y += 5;
  
  cell(M, y, sw, 25, ''); 
  cell(M + sw, y, sw, 25, '');
  
  if (os.tecnico && os.tecnico.validacao) {
    const vTec = os.tecnico.validacao;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
    doc.text(os.tecnico.nome || 'Técnico Registrado', M + 4, y + 5);
 doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(22, 163, 74);
    doc.text('OK - Confirmado através do dispositivo e PIN', M + 4, y + 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
    doc.text(obterNomeDispositivo(vTec.userAgent), M + 4, y + 15);
    doc.text(obterNavegador(vTec.userAgent), M + 4, y + 19);
    doc.text(new Date(vTec.data).toLocaleString('pt-BR'), M + 4, y + 23);
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text('Aguardando validação do executante...', M + 4, y + 13);
  }

  if (os.solicitante && os.solicitante.validacao) {
    const vSol = os.solicitante.validacao;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
    doc.text(os.solicitante.nome || 'Solicitante', M + sw + 4, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(22, 163, 74);
    doc.text('OK - Confirmado através do dispositivo', M + sw + 4, y + 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
    doc.text(obterNomeDispositivo(vSol.userAgent), M + sw + 4, y + 15);
    doc.text(obterNavegador(vSol.userAgent), M + sw + 4, y + 19);
    doc.text(new Date(vSol.data).toLocaleString('pt-BR'), M + sw + 4, y + 23);
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text('Aguardando aceite do solicitante...', M + sw + 4, y + 13);
  }

  y += 25 + 5;

  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text('Confidencial & Proprietário — Sistema Integrado de Manutenção OS', M, y);
  doc.text('Formulário Ref: F-ZZ-181B-0020', W - M, y, { align: 'right' });

  doc.save(`OS_${os.chamado || os.id}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
  toast('PDF estruturado gerado! ✔');
}

function setFilter(f, btn) { curFilter = f; document.querySelectorAll('.f-chip').forEach(b => b.classList.remove('on')); btn.classList.add('on'); renderOSList(); }
function renderDatalist() { const probs = [...new Set(db.map(o => o.problema))]; document.getElementById('prob-dl').innerHTML = probs.map(p => `<option value="${p}">`).join(''); }
function renderTecSelect() { const sel = document.getElementById('tec-os-select'); if (sel) sel.innerHTML = '<option value="">— escolha uma OS —</option>' + db.map(o => `<option value="${o.id}">${o.chamado || '?'} — ${o.problema}</option>`).join(''); }
function setSSMA(campo, valor) { ssmaRespostas[campo] = valor; document.querySelectorAll(`[data-q="${campo}"]`).forEach(btn => btn.classList.remove('active')); if (valor !== null) { document.querySelector(`[data-q="${campo}"][data-v="${valor}"]`)?.classList.add('active'); } }
function addPeca() { pecas.push({ cod: '', desc: '', qtd: '' }); renderPecasList(false); }
function removePeca(i) { pecas.splice(i, 1); renderPecasList(false); }

function renderPecasList(isDisabled = false) { 
  const el = document.getElementById('pecas-list-tec'); 
  if (el) el.innerHTML = pecas.map((p, i) => `<div class="peca-row"><input placeholder="Código" value="${p.cod}" oninput="pecas[${i}].cod=this.value" ${isDisabled ? 'disabled' : ''}><input placeholder="Descrição" value="${p.desc}" oninput="pecas[${i}].desc=this.value" ${isDisabled ? 'disabled' : ''}><input placeholder="Qtd" value="${p.qtd}" oninput="pecas[${i}].qtd=this.value" ${isDisabled ? 'disabled' : ''}>${isDisabled ? '' : `<button class="peca-del" onclick="removePeca(${i})">✕</button>`}</div>`).join(''); 
}

function fmtDate(d) { if (!d) return '—'; try { return new Date(d + 'T12:00').toLocaleDateString('pt-BR'); } catch { return d; } }
function toast(msg) { const t = document.getElementById('toast'); if(t){ t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); } }

// ===== NOTIFICAÇÃO AO SUPERVISOR (quando técnico finaliza e aguarda encaminhamento ao solicitante) =====
let notifLidas = JSON.parse(localStorage.getItem('notifLidas') || '[]');

function initNotificacoes() {
  if (document.getElementById('sino-notif')) return; // evita duplicar

  const style = document.createElement('style');
  style.textContent = `
    #sino-notif { position: fixed; top: 16px; right: 16px; z-index: 9999; width: 44px; height: 44px; border-radius: 50%;
      background: #7c3aed; color: #fff; border: none; cursor: pointer; font-size: 20px; box-shadow: 0 4px 12px rgba(124,58,237,0.4);
      display: flex; align-items: center; justify-content: center; }
    #sino-badge { position: fixed; top: 12px; right: 12px; z-index: 10000; background: #dc2626; color: #fff; font-size: 11px;
      font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: none; align-items: center; justify-content: center;
      padding: 0 4px; pointer-events: none; }
    #painel-notif { position: fixed; top: 68px; right: 16px; z-index: 9998; width: 320px; max-height: 420px; overflow-y: auto;
      background: #fff; border: 1px solid #ede9fe; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: none; }
    #painel-notif .notif-header { padding: 12px 14px; font-weight: 700; font-size: 13px; color: #6b21a8; background: #f5f3ff;
      border-bottom: 1px solid #ede9fe; border-radius: 10px 10px 0 0; }
    #painel-notif .notif-item { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    #painel-notif .notif-item b { display: block; color: #1e293b; margin-bottom: 2px; }
    #painel-notif .notif-item span { color: #64748b; font-size: 12px; }
    #painel-notif .notif-actions { margin-top: 8px; display: flex; gap: 6px; }
    #painel-notif .notif-actions button { flex: 1; border: none; border-radius: 5px; padding: 6px 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
    #painel-notif .notif-btn-enviar { background: #16a34a; color: #fff; }
    #painel-notif .notif-btn-ok { background: #f1f5f9; color: #475569; }
    #painel-notif .notif-empty { padding: 20px 14px; text-align: center; color: #94a3b8; font-size: 12px; }
  `;
  document.head.appendChild(style);

  const sino = document.createElement('button');
  sino.id = 'sino-notif';
  sino.textContent = '🔔';
  sino.onclick = toggleNotificacoes;
  document.body.appendChild(sino);

  const badge = document.createElement('div');
  badge.id = 'sino-badge';
  document.body.appendChild(badge);

  const painel = document.createElement('div');
  painel.id = 'painel-notif';
  document.body.appendChild(painel);

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function osPendentesEnvio() {
  return db.filter(o => o.status === 'assinando' && !notifLidas.includes(o.id));
}

function atualizarBadgeNotificacoes() {
  const badge = document.getElementById('sino-badge');
  if (!badge) return;
  const pendentes = osPendentesEnvio();
  if (pendentes.length > 0) {
    badge.textContent = pendentes.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  if (document.getElementById('painel-notif')?.style.display === 'block') {
    renderPainelNotificacoes();
  }
}

function toggleNotificacoes() {
  const painel = document.getElementById('painel-notif');
  if (!painel) return;
  const abrir = painel.style.display !== 'block';
  painel.style.display = abrir ? 'block' : 'none';
  if (abrir) renderPainelNotificacoes();
}

function renderPainelNotificacoes() {
  const painel = document.getElementById('painel-notif');
  if (!painel) return;
  const pendentes = osPendentesEnvio();
  painel.innerHTML = `<div class="notif-header">🔔 OS aguardando envio ao solicitante</div>` +
    (pendentes.length ? pendentes.map(o => `
      <div class="notif-item">
        <b>${o.chamado || 'S/N'} — ${o.problema}</b>
        <span>Técnico: ${o.tecnico?.nome || '—'}</span>
        <div class="notif-actions">
          <button class="notif-btn-enviar" onclick="encaminharParaSolicitante('${o.id}')">📲 Encaminhar p/ WhatsApp</button>
          <button class="notif-btn-ok" onclick="marcarNotifVista('${o.id}')">Marcar visto</button>
        </div>
      </div>`).join('') : '<div class="notif-empty">Nenhuma OS pendente de envio 🎉</div>');
}

function marcarNotifVista(id) {
  if (!notifLidas.includes(id)) notifLidas.push(id);
  localStorage.setItem('notifLidas', JSON.stringify(notifLidas));
  atualizarBadgeNotificacoes();
}

function encaminharParaSolicitante(id) {
  const os = db.find(o => o.id === id);
  if (!os) return;

  const link = `${window.location.origin}${window.location.pathname}?os=${os.id}&role=solicitante`;
  const texto = `🔔 *Solicitação de Aceite*\n\nO serviço foi concluído.\n\nAbra o link abaixo para validar a execução:\n\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  marcarNotifVista(id);
}

function notificarSupervisor(os) {
  toast(`🔔 OS ${os.chamado || os.id} finalizada pelo técnico — encaminhe para o solicitante`);
  atualizarBadgeNotificacoes();

  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification('OS finalizada — aguardando envio', {
      body: `${os.chamado || 'S/N'} — ${os.problema}\nClique para encaminhar ao solicitante.`,
      icon: undefined
    });
    n.onclick = () => { window.focus(); toggleNotificacoes(); };
  }
}

initNotificacoes();

const params = new URLSearchParams(window.location.search);
const osId = params.get("os");
if (osId) {
    const esperar = setInterval(() => {
        const os = db.find(o => o.id === osId);
        if (!os) return;
        clearInterval(esperar);
        renderTecPage(os.id, params.get("role") || 'tecnico');
    }, 100);
}

window.goView = goView; window.toggleSidebar = toggleSidebar; window.closeSidebar = closeSidebar;
window.renderTecPage = renderTecPage; window.setSSMA = setSSMA; window.addPeca = addPeca; 
window.fecharOperacaoTecnico = fecharOperacaoTecnico; window.gerarPDF = gerarPDF; window.openDrawer = openDrawer; 
window.closeDrawer = closeDrawer; window.saveOS = saveOS; window.selTec = selTec; 
window.selStatus = selStatus; window.setFilter = setFilter; window.deleteOS = deleteOS; 
window.removePeca = removePeca;
window.toggleNotificacoes = toggleNotificacoes; window.marcarNotifVista = marcarNotifVista; 
window.encaminharParaSolicitante = encaminharParaSolicitante;