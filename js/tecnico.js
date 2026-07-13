/* =======================================================
   SISTEMA OS v2 — Técnico Module
   Painel de preenchimento de OS para técnicos
   ======================================================= */

import { requireAuth, fazerLogout, getUsuarioAtual } from './auth.js';
import { initUI, showToast, showDownloadToast, renderSidebarUser, applyRoleVisibility, hideLoader, debounce } from './ui.js';
import { formatDate, formatDateTime, escapeHtml, getInitials, getAvatarColor } from './utils.js';
import { database } from './firebase.js';
import {
  ref, onValue, get, set, update, push
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

initUI();
requireAuth(['admin', 'tecnico'], (user) => {
  renderSidebarUser(user);
  applyRoleVisibility(user.role);
  setupPage(user);
  hideLoader();
});

// ── State ──
let currentOS   = null;
let currentUser = null;
let allOS       = [];
let pecas       = [];
let ssma        = { q1: null, q2: null, q3: null };
let currentOsId = null;

// ── Setup ──
function setupPage(user) {
  currentUser = user;
  const params = new URLSearchParams(location.search);
  const osId   = params.get('id');

  listenMinhasOS(user, osId);

  document.getElementById('btn-back-list')?.addEventListener('click', () => {
    history.replaceState({}, '', 'tecnico.html');
    showSelector();
  });
}

// ── Listen: OS assigned to this technician ──
function listenMinhasOS(user, openId = null) {
  onValue(ref(database, 'ordensServico'), (snap) => {
    const raw = snap.val() || {};
    let ordens = Object.entries(raw).map(([id, os]) => ({ id, ...os }));

    // Filter to only this technician's OS
    if (user.role === 'tecnico') {
      ordens = ordens.filter(os => os.tecId === user.tecId || os.tecNome === user.nome);
    }
    ordens.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    allOS = ordens;

    // Badge
    const open = ordens.filter(o => o.status !== 'finalizada' && o.status !== 'cancelada').length;
    const badge = document.getElementById('nav-tec-badge');
    if (badge) { badge.textContent = open; badge.classList.toggle('hidden', open === 0); }

    if (openId) {
      const target = ordens.find(o => o.id === openId);
      if (target) { openOsForm(target); return; }
    }

    renderList(ordens);
    showSelector();
  });
}

// ── Render OS list ──
function renderList(ordens) {
  const container = document.getElementById('tec-os-list');
  if (!container) return;

  const sub = document.getElementById('tec-subtitle');
  if (sub) sub.textContent = `${ordens.length} ordem${ordens.length !== 1 ? 's' : ''} atribuída${ordens.length !== 1 ? 's' : ''}`;

  if (ordens.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin:0 auto 16px;opacity:0.4;display:block;">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px;">Nenhuma OS atribuída</div>
        <div style="font-size:13px;">Aguarde o administrador encaminhar uma OS para você.</div>
      </div>`;
    return;
  }

  const STATUS_COLOR = {
    aberta:     { bg: 'var(--accent-light)',  color: 'var(--accent)'   },
    andamento:  { bg: 'var(--warning-bg)',    color: 'var(--warning)'  },
    em_andamento:{ bg:'var(--warning-bg)',    color: 'var(--warning)'  },
    finalizada: { bg: 'var(--success-bg)',    color: 'var(--success)'  },
    cancelada:  { bg: 'var(--danger-bg)',     color: 'var(--danger)'   }
  };
  const STATUS_LABEL = {
    aberta:'Aberta', andamento:'Em Andamento', em_andamento:'Em Andamento',
    finalizada:'Finalizada', cancelada:'Cancelada'
  };
  const PRIO_COLOR = { alta:'var(--danger)', media:'var(--warning)', baixa:'var(--success)', urgente:'var(--danger)' };

  container.innerHTML = ordens.map(os => {
    const st = STATUS_COLOR[os.status] || STATUS_COLOR.aberta;
    const num = String(os.numero || '').padStart(5, '0');
    const tecConfirmado = os.confirmacaoTec?.confirmado;
    const solConfirmado = os.confirmacaoSol?.confirmado;

    return `
    <div class="card" style="cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;"
      onclick="window._abrirOS('${os.id}')"
      onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-lg)'"
      onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div class="card-body" style="padding:16px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
              <span style="font-size:12px;font-weight:700;color:var(--accent);">OS #${num}</span>
              <span style="padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${st.bg};color:${st.color};">${STATUS_LABEL[os.status] || 'Aberta'}</span>
              ${os.prioridade === 'alta' || os.prioridade === 'urgente' ? `<span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:var(--danger-bg);color:var(--danger);">🔴 ${os.prioridade.charAt(0).toUpperCase()+os.prioridade.slice(1)}</span>` : ''}
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(os.titulo || 'Sem título')}</div>
            <div style="font-size:12px;color:var(--text-muted);">
              📍 ${escapeHtml(os.local || os.setor || '—')} · Solicitante: ${escapeHtml(os.solicitante || '—')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;">
            <div style="font-size:11px;color:var(--text-muted);">${formatDate(os.criadoEm)}</div>
            <div style="display:flex;gap:4px;">
              <span title="Confirmação técnico" style="font-size:16px;">${tecConfirmado ? '✅' : '⏳'}</span>
              <span title="Confirmação solicitante" style="font-size:16px;">${solConfirmado ? '✅' : '⏳'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

window._abrirOS = (osId) => {
  const os = allOS.find(o => o.id === osId);
  if (os) openOsForm(os);
};

// ── Open OS form ──
function openOsForm(os) {
  currentOS   = os;
  currentOsId = os.id;
  pecas  = os.pecas  ? [...os.pecas]  : [];
  ssma   = os.ssma   ? { ...os.ssma } : { q1: null, q2: null, q3: null };

  document.getElementById('tec-os-selector').classList.add('hidden');
  document.getElementById('tec-os-form').classList.remove('hidden');

  history.replaceState({}, '', `tecnico.html?id=${os.id}`);

  renderOsHeader(os);
  renderFormFields(os);
  renderPecas();
  renderSSMA();
  renderVerificacao(os);
  renderFlowButtons(os);

  document.getElementById('header-title').textContent = `OS #${String(os.numero||'').padStart(5,'0')}`;
}

function showSelector() {
  document.getElementById('tec-os-selector').classList.remove('hidden');
  document.getElementById('tec-os-form').classList.add('hidden');
  document.getElementById('header-title').textContent = 'Painel do Técnico';
}

function renderOsHeader(os) {
  const num = String(os.numero || '').padStart(5, '0');
  document.getElementById('tec-os-ref').textContent = `OS #${num} · ${os.especialidade || os.categoria || ''}`;
  document.getElementById('tec-os-titulo').textContent = os.titulo || 'Sem título';
  document.getElementById('tec-os-meta').innerHTML = `
    <span>📍 <strong>${escapeHtml(os.local || os.setor || '—')}</strong></span>
    <span>👤 Solicitante: <strong>${escapeHtml(os.solicitante || '—')}</strong></span>
    ${os.prioridade ? `<span>🎯 Prioridade: <strong>${os.prioridade}</strong></span>` : ''}
    ${os.prazo ? `<span>📅 Prazo: <strong>${formatDate(os.prazo)}</strong></span>` : ''}
  `;

  // Flow badge
  const badgeEl = document.getElementById('tec-flow-badge');
  const STATUS = {
    aberta:       { cls:'flow-badge-aberta',    label:'🔵 Aberta'      },
    andamento:    { cls:'flow-badge-execucao',  label:'🟡 Em Andamento'},
    em_andamento: { cls:'flow-badge-execucao',  label:'🟡 Em Andamento'},
    finalizada:   { cls:'flow-badge-concluida', label:'🟢 Finalizada'  },
    cancelada:    { cls:'flow-badge-concluida', label:'🔴 Cancelada'   }
  };
  const st = STATUS[os.status] || STATUS.aberta;
  badgeEl.innerHTML = `<span class="flow-badge ${st.cls}">${st.label}</span>`;

  // Alert
  const alertEl = document.getElementById('tec-alert-iniciar');
  if (alertEl) alertEl.classList.toggle('hidden', os.status !== 'aberta' && os.status);
}

function renderFormFields(os) {
  const isAberta = !os.status || os.status === 'aberta';
  const canEdit  = !isAberta;

  const tag        = document.getElementById('tec-tag');
  const descEquip  = document.getElementById('tec-desc-equip');
  const servico    = document.getElementById('tec-servico');
  const acoesSsma  = document.getElementById('tec-acoes-ssma');

  if (tag)       { tag.value       = os.tag             || ''; tag.disabled       = false; }
  if (descEquip) { descEquip.value = os.descEquipamento || ''; descEquip.disabled = false; }
  if (acoesSsma) { acoesSsma.value = os.acoesSsma       || ''; acoesSsma.disabled = false; }
  if (servico) {
    servico.value       = os.servicoRealizado || '';
    servico.disabled    = isAberta;
    servico.placeholder = isAberta
      ? 'Inicie o serviço para editar o relatório.'
      : 'Descreva o que foi realizado...';
  }

  // Disable SSMA buttons if OS is finalizada
  const isFinished = os.status === 'finalizada';
  document.querySelectorAll('.ssma-btn').forEach(btn => {
    btn.style.pointerEvents = isFinished ? 'none' : '';
    btn.style.opacity       = isFinished ? '0.6'  : '';
  });
  if (acoesSsma) acoesSsma.disabled = isFinished;
}

function renderFlowButtons(os) {
  const btnIniciar  = document.getElementById('btn-iniciar-tec');
  const btnConcluir = document.getElementById('btn-concluir-tec');
  const btnPDF      = document.getElementById('btn-pdf-tec');

  const isAberta   = !os.status || os.status === 'aberta';
  const isAndamento= os.status === 'andamento' || os.status === 'em_andamento';
  const isFinalizada = os.status === 'finalizada';

  if (btnIniciar)  btnIniciar.classList.toggle('hidden',  !isAberta);
  if (btnConcluir) btnConcluir.classList.toggle('hidden', !isAndamento);
  if (btnPDF)      btnPDF.classList.toggle('hidden',      !isFinalizada);
}

// ── SSMA ──
window._setSSMA = (q, v) => {
  ssma[q] = ssma[q] === v ? null : v;
  renderSSMA();
};

function renderSSMA() {
  document.querySelectorAll('.ssma-btn').forEach(btn => {
    const q = btn.dataset.q;
    const v = btn.dataset.v;
    btn.classList.remove('selected-sim', 'selected-nao');
    if (ssma[q] === v) {
      btn.classList.add(v === 'SIM' ? 'selected-sim' : 'selected-nao');
    }
  });
}

// ── Peças ──
window._addPeca = () => {
  pecas.push({ cod: '', desc: '', qtd: '1' });
  renderPecas();
  // Focus last cod input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.peca-cod');
    inputs[inputs.length - 1]?.focus();
  }, 50);
};

window._removePeca = (i) => {
  pecas.splice(i, 1);
  renderPecas();
};

function renderPecas() {
  const list = document.getElementById('pecas-list');
  if (!list) return;
  if (pecas.length === 0) {
    list.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">Nenhuma peça adicionada.</div>`;
    return;
  }
  list.innerHTML = pecas.map((p, i) => `
    <div class="peca-row">
      <input class="form-control peca-cod" value="${escapeHtml(p.cod)}" placeholder="Código"
        oninput="window._updatePeca(${i},'cod',this.value)">
      <input class="form-control peca-desc" value="${escapeHtml(p.desc)}" placeholder="Descrição"
        oninput="window._updatePeca(${i},'desc',this.value)">
      <input class="form-control peca-qtd" type="number" value="${escapeHtml(String(p.qtd))}" placeholder="Qtd" min="0"
        oninput="window._updatePeca(${i},'qtd',this.value)">
      <button class="btn-remove-peca" onclick="window._removePeca(${i})" title="Remover">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
}

window._updatePeca = (i, field, value) => {
  pecas[i][field] = value;
};

// ── PIN ──
function gerarPIN() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function renderPinDigits(containerId, pin) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = pin.split('').map(d =>
    `<div class="pin-digit">${d}</div>`
  ).join('');
}

function renderPinInputs(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length: 6}, (_, i) =>
    `<input type="number" min="0" max="9" maxlength="1" id="pi-${i}"
      style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:800;
        background:var(--bg-3);border:2px solid var(--border);border-radius:var(--r);
        color:var(--text);font-family:inherit;transition:border-color var(--t);"
      oninput="this.value=this.value.slice(-1);document.getElementById('pi-${i+1}')?.focus()"
      onkeydown="if(event.key==='Backspace'&&!this.value)document.getElementById('pi-${i-1}')?.focus()"
    >`
  ).join('');
  document.getElementById('pi-0')?.focus();
}

function getPinFromInputs() {
  return Array.from({length: 6}, (_, i) =>
    document.getElementById(`pi-${i}`)?.value || ''
  ).join('');
}

// ── Render verificação ──
function renderVerificacao(os) {
  // Técnico
  const tecSigStatus  = document.getElementById('tec-sig-status');
  const tecPinSection = document.getElementById('tec-pin-section');
  const solSigStatus  = document.getElementById('sol-sig-status');
  const solWaSection  = document.getElementById('sol-whatsapp-section');
  const secVer        = document.getElementById('section-verificacao');

  // Only show verification section when OS is finalizada
  if (secVer) secVer.classList.toggle('hidden', os.status !== 'finalizada' && os.status !== 'andamento' && os.status !== 'em_andamento');

  if (os.confirmacaoTec?.confirmado) {
    if (tecSigStatus) tecSigStatus.innerHTML = `
      <div class="assinatura-badge-ok">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
        Confirmado
      </div>
      <div class="assinatura-detail">
        <div>📅 ${new Date(os.confirmacaoTec.data).toLocaleString('pt-BR')}</div>
        <div>💻 ${obterDispositivo(os.confirmacaoTec.userAgent)}</div>
      </div>`;
    if (tecPinSection) tecPinSection.classList.add('hidden');
  } else if (os.pinTecnico) {
    if (tecSigStatus) tecSigStatus.innerHTML = `
      <div class="assinatura-badge-pending">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Aguardando PIN
      </div>`;
    if (tecPinSection) {
      tecPinSection.classList.remove('hidden');
      renderPinDigits('tec-pin-digits', os.pinTecnico.codigo || '------');
      const expiry = document.getElementById('tec-pin-expiry');
      if (expiry && os.pinTecnico.expiraEm) {
        expiry.textContent = `Expira em: ${new Date(os.pinTecnico.expiraEm).toLocaleString('pt-BR')}`;
      }
      renderPinInputs('tec-pin-inputs');
    }
  }

  // Solicitante
  if (os.confirmacaoSol?.confirmado) {
    if (solSigStatus) solSigStatus.innerHTML = `
      <div class="assinatura-badge-ok">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
        Confirmado
      </div>
      <div class="assinatura-detail">
        <div>📅 ${new Date(os.confirmacaoSol.data).toLocaleString('pt-BR')}</div>
        <div>💻 ${obterDispositivo(os.confirmacaoSol.userAgent)}</div>
      </div>`;
    if (solWaSection) solWaSection.classList.add('hidden');
  } else {
    if (solWaSection) solWaSection.classList.toggle('hidden', os.status !== 'finalizada');
  }
}

// ── Salvar campos do técnico ──
window._salvarTec = async () => {
  if (!currentOsId) return;
  const btn = document.getElementById('btn-salvar-tec');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="border-top-color:white;"></span> Salvando...`;
  try {
    const data = {
      tag:              document.getElementById('tec-tag')?.value.trim()       || null,
      descEquipamento:  document.getElementById('tec-desc-equip')?.value.trim()|| null,
      ssma:             { ...ssma },
      acoesSsma:        document.getElementById('tec-acoes-ssma')?.value.trim()|| null,
      servicoRealizado: document.getElementById('tec-servico')?.value.trim()   || null,
      pecas:            pecas.filter(p => p.desc || p.cod),
      atualizadoEm:     new Date().toISOString()
    };
    await update(ref(database, `ordensServico/${currentOsId}`), data);
    showToast('OS salva com sucesso!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Erro ao salvar.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar`;
  }
};

// ── Iniciar serviço ──
window._iniciarServico = async () => {
  if (!currentOsId) return;
  try {
    const now = new Date().toISOString();
    await update(ref(database, `ordensServico/${currentOsId}`), {
      status:      'andamento',
      iniciada:    now,
      atualizadoEm: now
    });
    await push(ref(database, `historico/${currentOsId}`), {
      tipo: 'update',
      descricao: `Serviço iniciado por ${currentUser.nome}.`,
      em: now, usuarioNome: currentUser.nome, usuarioId: currentUser.uid
    });
    showToast('Serviço iniciado! Preencha o relatório.', 'success');
  } catch(e) { showToast('Erro ao iniciar.', 'error'); }
};

// ── Concluir serviço ──
window._concluirServico = async () => {
  const servico = document.getElementById('tec-servico')?.value.trim();
  if (!servico) { showToast('Preencha o relatório técnico antes de concluir.', 'warning'); return; }

  // Save first
  await window._salvarTec();

  try {
    const now  = new Date().toISOString();
    const pin  = gerarPIN();
    const exp  = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await update(ref(database, `ordensServico/${currentOsId}`), {
      status:       'finalizada',
      concluida:    now,
      atualizadoEm: now,
      finalizadoEm: now,
      pinTecnico:   { codigo: pin, criadoEm: now, expiraEm: exp, confirmado: false }
    });
    await push(ref(database, `historico/${currentOsId}`), {
      tipo: 'close',
      descricao: `Serviço concluído por ${currentUser.nome}. PIN de verificação gerado.`,
      em: now, usuarioNome: currentUser.nome, usuarioId: currentUser.uid
    });
    showToast('OS concluída! Confirme com seu PIN abaixo.', 'success', 6000);
  } catch(e) { console.error(e); showToast('Erro ao concluir.', 'error'); }
};

// ── Confirmar técnico com PIN ──
window._confirmarTec = async () => {
  if (!currentOS?.pinTecnico) return;
  const digitado = getPinFromInputs();
  if (digitado.length < 6) { showToast('Digite o PIN completo (6 dígitos).', 'warning'); return; }
  if (digitado !== currentOS.pinTecnico.codigo) {
    showToast('PIN incorreto. Verifique e tente novamente.', 'error');
    return;
  }
  const exp = new Date(currentOS.pinTecnico.expiraEm);
  if (new Date() > exp) { showToast('PIN expirado. Regere o PIN recriando a OS.', 'error'); return; }

  try {
    const now = new Date().toISOString();
    await update(ref(database, `ordensServico/${currentOsId}`), {
      confirmacaoTec: {
        confirmado: true,
        nome:       currentUser.nome,
        data:       now,
        userAgent:  navigator.userAgent,
        dispositivo: obterDispositivo(navigator.userAgent),
        navegador:   obterNavegador(navigator.userAgent)
      },
      'pinTecnico/confirmado': true
    });
    await push(ref(database, `historico/${currentOsId}`), {
      tipo: 'update',
      descricao: `Verificação digital do técnico ${currentUser.nome} confirmada via PIN.`,
      em: now, usuarioNome: currentUser.nome, usuarioId: currentUser.uid
    });
    showToast('✅ Verificação confirmada com sucesso!', 'success');
  } catch(e) { console.error(e); showToast('Erro ao confirmar PIN.', 'error'); }
};

// ── Enviar PIN do solicitante via WhatsApp ──
window._enviarPinSolicitante = async () => {
  if (!currentOS) return;
  const pin    = gerarPIN();
  const token  = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
  const now    = new Date().toISOString();
  const exp    = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const numOS  = String(currentOS.numero || '').padStart(5, '0');

  try {
    // Save pin to Firebase
    await set(ref(database, `pins/${token}`), {
      osId:        currentOsId,
      tipo:        'solicitante',
      codigo:      pin,
      osNumero:    currentOS.numero,
      osTitulo:    currentOS.titulo,
      solicitante: currentOS.solicitante,
      tecNome:     currentUser.nome,
      criadoEm:    now,
      expiraEm:    exp,
      confirmado:  false
    });

    await update(ref(database, `ordensServico/${currentOsId}`), {
      pinSolicitante: { token, codigo: pin, criadoEm: now, expiraEm: exp, confirmado: false }
    });

    // Build WhatsApp link — URL to the public assinar.html page
    const baseUrl = `${location.origin}${location.pathname.replace('tecnico.html', '')}assinar.html`;
    const link = `${baseUrl}?t=${token}`;
    const msg  =
`🔐 *Confirmação de OS — Sistema OS v2*

Olá, *${currentOS.solicitante || 'Solicitante'}*!

A OS *#${numOS}* foi concluída pelo técnico *${currentUser.nome}*.

Para confirmar o recebimento do serviço, acesse o link abaixo e insira seu PIN:

🔑 *PIN: ${pin}*
🔗 ${link}

⚠ Este PIN expira em *48 horas*.
*Não compartilhe este PIN com ninguém.*`;

    const tel  = (currentOS.telefoneSolicitante || '').replace(/\D/g, '');
    if (tel) {
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    } else {
      // No phone — copy link to clipboard
      await navigator.clipboard.writeText(msg).catch(() => {});
      showToast('PIN gerado! Solicitante não tem telefone — mensagem copiada para área de transferência.', 'info', 8000);
      return;
    }
    showToast('PIN enviado via WhatsApp!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Erro ao gerar PIN do solicitante.', 'error');
  }
};

// ── PDF ──
window._gerarPDF = async () => {
  if (!currentOS) return;
  try {
    const { gerarPDF } = await import('./utils.js');
    const snap = await get(ref(database, `historico/${currentOsId}`));
    const hist = snap.exists() ? Object.values(snap.val()) : [];
    const { url, filename } = await gerarPDF(currentOS, hist);
    showDownloadToast(url, filename, currentOS.numero);
  } catch(e) { console.error(e); showToast('Erro ao gerar PDF.', 'error'); }
};

// ── Helpers ──
function obterDispositivo(ua = '') {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Dispositivo desconhecido';
}

function obterNavegador(ua = '') {
  if (/Edg\//i.test(ua))     return 'Microsoft Edge';
  if (/Chrome/i.test(ua))    return 'Google Chrome';
  if (/Firefox/i.test(ua))   return 'Mozilla Firefox';
  if (/Safari/i.test(ua))    return 'Safari';
  if (/OPR|Opera/i.test(ua)) return 'Opera';
  return 'Navegador desconhecido';
}
