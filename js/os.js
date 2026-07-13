/* =======================================================
   SISTEMA OS v2 — OS Module
   CRUD completo, numeração automática, filtros, busca,
   histórico, SLA, PDF, Excel
   ======================================================= */

import { requireAuth, fazerLogout, getUsuarioAtual } from './auth.js';
import { initUI, showToast, showDownloadToast, openDrawer, closeDrawer, confirmAction, renderSidebarUser, applyRoleVisibility, hideLoader, debounce } from './ui.js';
import {
  formatDate, formatRelativeTime, calcularSLA, renderStatusBadge,
  renderPriorityBadge, escapeHtml, getInitials, getAvatarColor,
  exportarExcel, prepararDadosExcel, gerarPDF
} from './utils.js';
import { database } from './firebase.js';
import {
  ref, onValue, push, set, update, remove, get, runTransaction
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

// ── Init ──
initUI();
requireAuth(['admin', 'tecnico', 'usuario'], (user) => {
  renderSidebarUser(user);
  applyRoleVisibility(user.role);
  setupPage(user);
  hideLoader();
});

// ── State ──
let currentUser = null;
let allOrdens   = [];
let allTecnicos = {};
let editingId   = null;
let currentFilter  = 'todas';
let currentSearch  = '';
let currentPriority = '';
let currentTecFilter = '';
let sortField  = 'criadoEm';
let sortDir    = 'desc';
let currentPage = 1;
const PAGE_SIZE  = 20;

// ── Setup ──
function setupPage(user) {
  currentUser = user;

  // Check URL params
  const params = new URLSearchParams(location.search);
  const filterParam = params.get('filter');
  if (filterParam) setFilter(filterParam);

  const idParam = params.get('id');

  listenOrdens(user, idParam);
  listenTecnicos();
  setupDrawer(user);
  setupSearch();
  setupFilters();
  setupSort();
  setupExport(user);
}

// ── Firebase Listeners ──
function listenOrdens(user, openId = null) {
  onValue(ref(database, 'ordensServico'), (snap) => {
    const raw = snap.val() || {};
    let ordens = Object.entries(raw).map(([id, os]) => ({ id, ...os }));

    // Technicians only see their own
    if (user.role === 'tecnico' && user.tecId) {
      ordens = ordens.filter(os => os.tecId === user.tecId);
    }

    allOrdens = ordens;
    renderTable();

    // Open specific OS if URL param present
    if (openId) {
      const target = ordens.find(os => os.id === openId);
      if (target) { setTimeout(() => openEdit(target.id), 300); }
    }

    // Update nav badge
    const badge = document.getElementById('nav-os-badge');
    const abertas = ordens.filter(os => os.status === 'aberta').length;
    if (badge) {
      badge.textContent = abertas;
      badge.classList.toggle('hidden', abertas === 0);
    }
  });
}

function listenTecnicos() {
  onValue(ref(database, 'tecnicos'), (snap) => {
    allTecnicos = snap.val() || {};
    renderTecGrid();
    renderTecFilter();
  });
}

// ── Filtering & Sorting ──
function getFiltered() {
  let list = [...allOrdens];

  if (currentFilter !== 'todas') {
    if (currentFilter === 'finalizada') {
      list = list.filter(os => os.status === 'finalizada' || os.status === 'fechada');
    } else {
      list = list.filter(os => os.status === currentFilter);
    }
  }
  if (currentPriority) list = list.filter(os => os.prioridade === currentPriority);
  if (currentTecFilter) list = list.filter(os => os.tecId === currentTecFilter);
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(os =>
      String(os.numero).includes(q) ||
      (os.titulo || '').toLowerCase().includes(q) ||
      (os.solicitante || '').toLowerCase().includes(q) ||
      (os.categoria || '').toLowerCase().includes(q) ||
      (os.local || '').toLowerCase().includes(q) ||
      (os.setor || '').toLowerCase().includes(q) ||
      (os.tecNome || '').toLowerCase().includes(q)
    );
  }

  // Sort
  list.sort((a, b) => {
    let av = a[sortField] ?? '', bv = b[sortField] ?? '';
    if (sortField === 'numero') { av = Number(av); bv = Number(bv); }
    else if (sortField === 'criadoEm') { av = new Date(av); bv = new Date(bv); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

// ── Render Table ──
function renderTable() {
  const tbody = document.getElementById('os-tbody');
  const countEl = document.getElementById('os-count-label');
  if (!tbody) return;

  const filtered = getFiltered();
  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Count label
  if (countEl) {
    countEl.textContent = `${total} ordem${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`;
  }

  // Table info
  const info = document.getElementById('table-info');
  if (info) {
    const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, total);
    info.textContent = total === 0 ? 'Nenhum resultado' : `Exibindo ${from}–${to} de ${total}`;
  }

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Nenhuma OS encontrada</h3>
        <p>${currentSearch ? `Nenhum resultado para "${escapeHtml(currentSearch)}"` : 'Não há ordens de serviço com os filtros selecionados.'}</p>
      </div>
    </td></tr>`;
    renderPagination(0, 0);
    return;
  }

  tbody.innerHTML = pageData.map(os => {
    const sla = calcularSLA(os.prazo, os.criadoEm);
    const slaHtml = sla
      ? `<div class="sla-bar-wrap" style="min-width:100px;">
           <div class="sla-bar-label"><span>${sla.label}</span></div>
           <div class="sla-bar"><div class="sla-bar-fill sla-${sla.status}" style="width:${sla.pct}%"></div></div>
         </div>`
      : '<span class="text-muted">—</span>';

    const tecInitials = getInitials(os.tecNome || '');
    const tecColor = getAvatarColor(os.tecNome || os.tecId || '');
    const tecHtml = os.tecNome
      ? `<div class="flex items-center gap-2"><div class="avatar avatar-sm ${tecColor}">${tecInitials}</div><span>${escapeHtml(os.tecNome)}</span></div>`
      : '<span class="text-muted text-sm">Não atribuído</span>';

    return `
      <tr style="cursor:pointer;" onclick="window._editOS('${os.id}')">
        <td><span class="table-number">#${String(os.numero || '').padStart(5,'0')}</span></td>
        <td>
          <div style="font-weight:600;color:var(--text);font-size:13.5px;margin-bottom:3px;">${escapeHtml(os.titulo || 'Sem título')}</div>
          <div style="font-size:11.5px;color:var(--text-muted);">${escapeHtml(os.categoria || '')}${os.setor ? ` · ${escapeHtml(os.setor)}` : ''}</div>
        </td>
        <td class="hide-mobile" style="color:var(--text-3);font-size:13px;">${escapeHtml(os.solicitante || '—')}</td>
        <td>${tecHtml}</td>
        <td>${renderStatusBadge(os.status)}</td>
        <td class="hide-mobile">${renderPriorityBadge(os.prioridade || 'media')}</td>
        <td class="hide-mobile">${slaHtml}</td>
        <td class="hide-mobile" style="color:var(--text-muted);font-size:12px;">${formatDate(os.criadoEm)}</td>
        <td>
          <div class="table-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-ghost" onclick="window._editOS('${os.id}')" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${currentUser?.role === 'admin' ? `
            <button class="btn btn-sm btn-ghost" onclick="window._encaminharOS('${os.id}')" title="Encaminhar para técnico">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>` : ''}
            <button class="btn btn-sm btn-ghost" onclick="window._printOS('${os.id}')" title="PDF">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(currentPage, totalPages);
}

// ── Pagination ──
function renderPagination(page, totalPages) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = `
    <button class="page-btn" onclick="window._goPage(${page-1})" ${page<=1?'disabled':''}>‹</button>
  `;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      html += `<button class="page-btn ${i===page?'active':''}" onclick="window._goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - page) === 3) {
      html += `<span style="color:var(--text-muted);padding:0 4px;">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="window._goPage(${page+1})" ${page>=totalPages?'disabled':''}>›</button>`;
  el.innerHTML = html;
}
window._goPage = (p) => { currentPage = p; renderTable(); };

// ── Filter chips ──
function setupFilters() {
  document.getElementById('filter-bar')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setFilter(chip.dataset.filter);
  });

  document.getElementById('filter-priority')?.addEventListener('change', (e) => {
    currentPriority = e.target.value;
    currentPage = 1;
    renderTable();
  });

  document.getElementById('filter-tec')?.addEventListener('change', (e) => {
    currentTecFilter = e.target.value;
    currentPage = 1;
    renderTable();
  });
}

function setFilter(filter) {
  currentFilter = filter;
  currentPage = 1;
  document.querySelectorAll('#filter-bar .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  renderTable();
}

// ── Search ──
function setupSearch() {
  const inp = document.getElementById('search-input');
  if (!inp) return;
  inp.addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.trim();
    currentPage = 1;
    renderTable();
  }, 250));
}

// ── Sort ──
function setupSort() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortField = field; sortDir = 'desc'; }
      document.querySelectorAll('.sortable').forEach(t => t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(`sort-${sortDir}`);
      renderTable();
    });
  });
}

// ── Render Tech Filter Select ──
function renderTecFilter() {
  const sel = document.getElementById('filter-tec');
  if (!sel) return;
  const saved = sel.value;
  const opts = Object.entries(allTecnicos)
    .map(([id, t]) => `<option value="${id}">${escapeHtml(t.nome)}</option>`)
    .join('');
  sel.innerHTML = `<option value="">Todos técnicos</option>${opts}`;
  if (saved) sel.value = saved;
}

// ── Render Tech Grid in drawer ──
function renderTecGrid() {
  const grid = document.getElementById('f-tec-grid');
  if (!grid) return;
  const tecs = Object.entries(allTecnicos);
  if (tecs.length === 0) {
    grid.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Nenhum técnico cadastrado.</p>`;
    return;
  }

  const current = document.getElementById('f-tecid')?.value;
  grid.innerHTML = tecs.map(([id, t]) => {
    const initials = getInitials(t.nome);
    const color = getAvatarColor(t.nome);
    return `
      <div class="tec-card ${current === id ? 'selected' : ''}" data-tecid="${id}" data-tecnome="${escapeHtml(t.nome)}">
        <div class="avatar avatar-md ${color}">${initials}</div>
        <div class="tec-card-name">${escapeHtml(t.nome)}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.tec-card').forEach(card => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.tec-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('f-tecid').value = card.dataset.tecid;
      document.getElementById('f-tecnome').value = card.dataset.tecnome;
    });
  });
}

// ── Drawer Setup ──
function setupDrawer(user) {
  // Open new
  document.getElementById('btn-nova-os')?.addEventListener('click', () => openNew());
  // Close
  document.getElementById('drawer-os-close')?.addEventListener('click', () => closeDrawer('drawer-os'));
  document.getElementById('btn-cancelar-os')?.addEventListener('click', () => closeDrawer('drawer-os'));
  // Overlay
  document.getElementById('overlay')?.addEventListener('click', () => closeDrawer('drawer-os'));
  // Save
  document.getElementById('btn-salvar-os')?.addEventListener('click', () => saveOS(user));
  // Delete
  document.getElementById('btn-delete-os')?.addEventListener('click', () => deleteOS(user));
  // PDF
  document.getElementById('btn-print-pdf')?.addEventListener('click', () => printCurrentOS());
  // Status selector
  document.getElementById('f-status-selector')?.querySelectorAll('.status-opt').forEach(opt => {
    opt.addEventListener('click', () => selectStatus(opt.dataset.status));
  });
}

function openNew() {
  editingId = null;
  resetForm();
  document.getElementById('drawer-os-title').textContent = 'Nova Ordem de Serviço';
  document.getElementById('drawer-os-number').textContent = 'Gerando número...';
  document.getElementById('btn-delete-os')?.classList.add('hidden');
  document.getElementById('btn-print-pdf')?.classList.add('hidden');
  document.getElementById('section-verificacao-admin')?.classList.add('hidden');
  document.getElementById('btn-encaminhar-os')?.classList.add('hidden');
  document.getElementById('section-historico')?.classList.add('hidden');

  // Set today's date
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('f-data-abertura').value = today;

  selectStatus('aberta');
  renderTecGrid();
  openDrawer('drawer-os');

  // ONLY PEEK the next number — do NOT increment the counter
  peekProximoNumeroOS().then(n => {
    if (n) document.getElementById('drawer-os-number').textContent = `OS #${String(n).padStart(5,'0')}`;
  });
}

// ── Edit OS ──
async function openEdit(osId) {
  const os = allOrdens.find(o => o.id === osId);
  if (!os) return;

  editingId = osId;
  resetForm();

  document.getElementById('drawer-os-title').textContent = 'Editar Ordem de Serviço';
  document.getElementById('drawer-os-number').textContent = `OS #${String(os.numero||'').padStart(5,'0')}`;

  // Permissions: admin can edit all, tecnico only their own, usuario can't edit
  const user = currentUser;
  const canEdit = user.role === 'admin' ||
    (user.role === 'tecnico' && os.tecId === user.tecId);

  // Fill form
  document.getElementById('f-titulo').value      = os.titulo || '';
  document.getElementById('f-categoria').value   = os.categoria || '';
  document.getElementById('f-setor').value       = os.setor || '';
  document.getElementById('f-local').value       = os.local || '';
  document.getElementById('f-descricao').value   = os.descricao || '';
  document.getElementById('f-solicitante').value = os.solicitante || '';
  document.getElementById('f-prioridade').value  = os.prioridade || 'media';
  document.getElementById('f-data-abertura').value = os.criadoEm ? os.criadoEm.slice(0,10) : '';
  document.getElementById('f-prazo').value       = os.prazo ? os.prazo.slice(0,10) : '';
  document.getElementById('f-previsao').value    = os.previsao ? os.previsao.slice(0,10) : '';
  document.getElementById('f-solucao').value     = os.solucao || '';
  document.getElementById('f-especialidade').value  = os.especialidade || '';
  document.getElementById('f-tipo-servico').value    = os.tipoServico   || '';
  document.getElementById('f-tecid').value       = os.tecId || '';
  document.getElementById('f-tecnome').value     = os.tecNome || '';

  selectStatus(os.status || 'aberta');
  renderTecGrid();

  // Admin-only buttons
  if (user.role === 'admin') {
    document.getElementById('btn-delete-os')?.classList.remove('hidden');
  }
  document.getElementById('btn-print-pdf')?.classList.remove('hidden');

  // Load history
  await loadHistorico(osId);

  // Read-only for non-editors
  if (!canEdit) {
    document.querySelectorAll('#drawer-os-body input, #drawer-os-body select, #drawer-os-body textarea').forEach(el => {
      el.disabled = true;
    });
    document.getElementById('btn-salvar-os').disabled = true;
  }

  // Verificação admin section
  const secVer = document.getElementById('section-verificacao-admin');
  if (secVer && user.role === 'admin') {
    secVer.classList.remove('hidden');
    // Render tec sig status
    const adminTecSig = document.getElementById('admin-tec-sig');
    if (adminTecSig) {
      if (os.confirmacaoTec?.confirmado) {
        adminTecSig.innerHTML = `<div class="assinatura-badge-ok"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Confirmado</div><div class="assinatura-detail">${new Date(os.confirmacaoTec.data).toLocaleString('pt-BR')} · ${os.confirmacaoTec.dispositivo || ''}</div>`;
      } else {
        adminTecSig.innerHTML = `<div class="assinatura-badge-pending"><span>⏳</span> Aguardando técnico concluir</div>`;
      }
    }
    // Render sol sig status
    const adminSolSig = document.getElementById('admin-sol-sig');
    const adminSolAction = document.getElementById('admin-sol-action');
    if (adminSolSig) {
      if (os.confirmacaoSol?.confirmado) {
        adminSolSig.innerHTML = `<div class="assinatura-badge-ok"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Confirmado</div><div class="assinatura-detail">${new Date(os.confirmacaoSol.data).toLocaleString('pt-BR')} · ${os.confirmacaoSol.dispositivo || ''}</div>`;
        if (adminSolAction) adminSolAction.classList.add('hidden');
      } else {
        adminSolSig.innerHTML = `<div class="assinatura-badge-pending"><span>⏳</span> Aguardando confirmação</div>`;
        if (adminSolAction) adminSolAction.classList.remove('hidden');
      }
    }
    // Link to tecnico page
    const btnTec = document.getElementById('btn-abrir-tecnico');
    if (btnTec) btnTec.href = `tecnico.html?id=${osId}`;
    // Setup send PIN sol button
    const btnSolPin = document.getElementById('btn-solicitar-pin-sol');
    if (btnSolPin) {
      btnSolPin.onclick = () => window._enviarPinSolicitanteAdmin(os);
    }
  } else if (secVer) {
    secVer.classList.add('hidden');
  }

  openDrawer('drawer-os');
}

// Global handler for table row click
window._editOS = openEdit;

window._enviarPinSolicitanteAdmin = async (os) => {
  if (!os) return;
  const pin    = String(Math.floor(100000 + Math.random() * 900000));
  const token  = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
  const now    = new Date().toISOString();
  const exp    = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const numOS  = String(os.numero || '').padStart(5, '0');
  const user   = currentUser;

  try {
    await set(ref(database, `pins/${token}`), {
      osId:        os.id,
      tipo:        'solicitante',
      codigo:      pin,
      osNumero:    os.numero,
      osTitulo:    os.titulo,
      solicitante: os.solicitante,
      tecNome:     os.tecNome,
      criadoEm:    now,
      expiraEm:    exp,
      confirmado:  false
    });
    await update(ref(database, `ordensServico/${os.id}`), {
      pinSolicitante: { token, codigo: pin, criadoEm: now, expiraEm: exp, confirmado: false }
    });

    const baseUrl = `${location.origin}${location.pathname.replace('os.html', '')}assinar.html`;
    const link    = `${baseUrl}?t=${token}`;
    const msg     = `🔐 *Confirmação de OS — Sistema OS v2*\n\nOlá, *${os.solicitante || 'Solicitante'}*!\n\nA OS *#${numOS}* foi concluída pelo técnico *${os.tecNome || '—'}*.\n\nPara confirmar o recebimento do serviço:\n\n🔑 *PIN: ${pin}*\n🔗 ${link}\n\n⚠ Este PIN expira em *48 horas*.`;

    const tel = (os.telefoneSolicitante || '').replace(/\D/g, '');
    if (tel) {
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    } else {
      await navigator.clipboard.writeText(msg).catch(() => {});
      showToast(`PIN gerado! Sem telefone cadastrado — mensagem copiada.`, 'info', 8000);
      return;
    }
    showToast(`PIN enviado ao solicitante via WhatsApp!`, 'success');
  } catch(e) {
    console.error(e);
    showToast('Erro ao gerar PIN.', 'error');
  }
};

// ── Encaminhar OS via WhatsApp ──
window._encaminharOS = async (osId) => {
  const os  = allOrdens.find(o => o.id === osId);
  if (!os) return;
  const tecs = Object.entries(allTecnicos);
  if (tecs.length === 0) { showToast('Nenhum técnico cadastrado.', 'warning'); return; }

  // Build select options including phone info
  const options = tecs.map(([id, t]) => {
    const tel = t.telefone ? ` · ${t.telefone}` : ' · (sem telefone)';
    return `<option value="${id}"
      data-nome="${escapeHtml(t.nome)}"
      data-tel="${escapeHtml(t.telefone || '')}"
      ${os.tecId === id ? 'selected' : ''}
    >${escapeHtml(t.nome)}${tel}</option>`;
  }).join('');

  // Default message
  const numOS   = String(os.numero || '').padStart(5, '0');
  const prioLabel = { baixa:'🟢 Baixa', media:'🟡 Média', alta:'🔴 Alta', urgente:'🚨 Urgente' }[os.prioridade] || os.prioridade;
  const defaultMsg =
`*📋 Nova OS Encaminhada — #${numOS}*

Olá, você recebeu uma nova Ordem de Serviço!

*Título:* ${os.titulo || '—'}
*Solicitante:* ${os.solicitante || '—'}
*Prioridade:* ${prioLabel}
*Local/Setor:* ${[os.local, os.setor].filter(Boolean).join(' · ') || '—'}
*Descrição:*
${os.descricao || '—'}

Acesse o sistema para mais detalhes.
Sistema OS v2`;

  const div = document.createElement('div');
  div.id = '__encaminhar-modal';
  div.innerHTML = `
    <div class="modal-backdrop" id="__enc-backdrop">
      <div class="modal" style="max-width:520px;width:calc(100vw - 32px);" role="dialog" aria-modal="true">

        <div class="modal-header" style="gap:10px;">
          <div>
            <h3 class="modal-title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="color:#25d366;vertical-align:-3px;margin-right:6px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.531 5.855L.057 23.887a.75.75 0 00.916.948l6.188-1.616A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.694 9.694 0 01-4.92-1.337l-.354-.211-3.674.96.978-3.568-.231-.368A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
              Encaminhar OS #${numOS} via WhatsApp
            </h3>
            <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">Selecione o técnico e confirme a mensagem</div>
          </div>
        </div>

        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">

          <!-- Técnico select -->
          <div>
            <label class="form-label" style="margin-bottom:6px;display:block;">Técnico responsável</label>
            <select id="__enc-select" class="form-control" style="width:100%;">
              <option value="">— Sem técnico (remover) —</option>
              ${options}
            </select>
            <div id="__enc-tel-info" style="margin-top:8px;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92l.01 2z"/></svg>
              <span id="__enc-tel-text">Selecione um técnico para ver o telefone</span>
            </div>
          </div>

          <!-- Mensagem editável -->
          <div id="__enc-msg-wrap">
            <label class="form-label" style="margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
              <span>Mensagem WhatsApp</span>
              <button type="button" id="__enc-reset-msg" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;">↺ Restaurar padrão</button>
            </label>
            <textarea id="__enc-msg"
              rows="10"
              class="form-control"
              style="width:100%;resize:vertical;font-family:monospace;font-size:12px;line-height:1.6;"
            >${defaultMsg}</textarea>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
              Você pode editar livremente antes de enviar.
            </div>
          </div>

        </div>

        <div class="modal-footer" style="justify-content:space-between;">
          <button class="btn btn-sm" id="__enc-cancel">Cancelar</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-ghost" id="__enc-save-only">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Só salvar
            </button>
            <button class="btn btn-sm btn-primary" id="__enc-ok" style="background:#25d366;border-color:#25d366;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.531 5.855L.057 23.887a.75.75 0 00.916.948l6.188-1.616A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.694 9.694 0 01-4.92-1.337l-.354-.211-3.674.96.978-3.568-.231-.368A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
              Salvar e enviar WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(div);
  document.body.style.overflow = 'hidden';

  // ── Helpers ──
  const cleanup = () => { document.body.style.overflow = ''; div.remove(); };

  // Update phone info when technician changes
  const sel     = document.getElementById('__enc-select');
  const telText = document.getElementById('__enc-tel-text');
  const updateTelInfo = () => {
    const opt = sel.selectedOptions[0];
    const tel = opt?.dataset.tel || '';
    if (!sel.value) {
      telText.textContent = 'Nenhum técnico selecionado';
    } else if (tel) {
      telText.innerHTML = `<strong>${escapeHtml(opt.dataset.nome)}</strong> · 📱 ${escapeHtml(tel)}`;
    } else {
      telText.innerHTML = `<strong>${escapeHtml(opt.dataset.nome)}</strong> · <span style="color:var(--warning);">⚠ Sem telefone cadastrado — WhatsApp não disponível</span>`;
    }
  };
  sel.addEventListener('change', updateTelInfo);
  updateTelInfo(); // run once

  // Reset message to default
  document.getElementById('__enc-reset-msg').addEventListener('click', () => {
    document.getElementById('__enc-msg').value = defaultMsg;
  });

  document.getElementById('__enc-cancel').addEventListener('click', cleanup);
  document.getElementById('__enc-backdrop').addEventListener('click', (e) => {
    if (e.target.id === '__enc-backdrop') cleanup();
  });

  // ── Save OS assignment to Firebase ──
  async function saveAssignment(tecId, tecNome) {
    const now = new Date().toISOString();
    await update(ref(database, `ordensServico/${osId}`), {
      tecId:       tecId  || null,
      tecNome:     tecNome || null,
      status:      tecId ? 'em_andamento' : os.status,
      atualizadoEm: now,
      atualizadoPor: currentUser?.uid
    });
    await push(ref(database, `historico/${osId}`), {
      tipo: 'update',
      descricao: tecId
        ? `OS encaminhada para ${tecNome} via WhatsApp por ${currentUser?.nome || 'Admin'}.`
        : `Técnico removido por ${currentUser?.nome || 'Admin'}.`,
      em: now,
      usuarioNome: currentUser?.nome || 'Admin',
      usuarioId:   currentUser?.uid
    });
  }

  // ── Só salvar (sem WhatsApp) ──
  document.getElementById('__enc-save-only').addEventListener('click', async () => {
    const tecId   = sel.value;
    const tecNome = sel.selectedOptions[0]?.dataset.nome || '';
    cleanup();
    try {
      await saveAssignment(tecId, tecNome);
      showToast(tecId ? `OS encaminhada para ${tecNome}!` : 'Técnico removido.', 'success');
    } catch(e) {
      console.error(e);
      showToast('Erro ao salvar.', 'error');
    }
  });

  // ── Salvar + abrir WhatsApp ──
  document.getElementById('__enc-ok').addEventListener('click', async () => {
    const tecId   = sel.value;
    const tecNome = sel.selectedOptions[0]?.dataset.nome || '';
    const tel     = sel.selectedOptions[0]?.dataset.tel  || '';
    const msg     = document.getElementById('__enc-msg').value.trim();

    if (!tecId) { showToast('Selecione um técnico para enviar no WhatsApp.', 'warning'); return; }

    cleanup();

    try {
      await saveAssignment(tecId, tecNome);
      showToast(`OS encaminhada para ${tecNome}!`, 'success');
    } catch(e) {
      console.error(e);
      showToast('Erro ao salvar encaminhamento.', 'error');
      return;
    }

    if (!tel) {
      showToast(`${tecNome} não tem telefone cadastrado. Cadastre o número em Usuários → Técnicos.`, 'warning', 6000);
      return;
    }

    // Clean phone: keep only digits + leading +
    const cleanTel = tel.replace(/\D/g, '');
    const waUrl    = `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  });
};
// ── Load History ──
async function loadHistorico(osId) {
  const section = document.getElementById('section-historico');
  const timeline = document.getElementById('historico-timeline');
  if (!section || !timeline) return;

  section.classList.remove('hidden');
  const snap = await get(ref(database, `historico/${osId}`));
  if (!snap.exists()) {
    timeline.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Nenhum histórico registrado.</div>`;
    return;
  }

  const hist = Object.values(snap.val()).sort((a, b) =>
    new Date(b.em) - new Date(a.em)
  );

  const dotClass = { create: 'dot-create', update: 'dot-update', close: 'dot-close', delete: 'dot-delete' };
  const dotIcon = {
    create: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    update: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    close:  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    delete: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>`
  };

  timeline.innerHTML = hist.map(h => `
    <div class="timeline-item">
      <div class="timeline-dot ${dotClass[h.tipo] || 'dot-update'}">${dotIcon[h.tipo] || dotIcon.update}</div>
      <div class="timeline-content">
        <div class="timeline-text">${escapeHtml(h.descricao)}</div>
        <div class="timeline-time">${formatRelativeTime(h.em)} — <strong>${escapeHtml(h.usuarioNome || 'Sistema')}</strong></div>
      </div>
    </div>
  `).join('');
}

// ── Select Status ──
function selectStatus(status) {
  document.getElementById('f-status').value = status;
  document.querySelectorAll('#f-status-selector .status-opt').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.status === status);
  });
  const solucaoSection = document.getElementById('section-solucao');
  if (solucaoSection) {
    solucaoSection.classList.toggle('hidden', status !== 'finalizada' && status !== 'fechada');
  }
}

// ── Reset Form ──
function resetForm() {
  ['f-titulo','f-setor','f-local','f-descricao','f-solicitante','f-solucao',
   'f-data-abertura','f-prazo','f-previsao','f-tecid','f-tecnome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cat = document.getElementById('f-categoria');
  if (cat) cat.value = '';
  const prio = document.getElementById('f-prioridade');
  if (prio) prio.value = 'media';

  // Re-enable all fields
  document.querySelectorAll('#drawer-os-body input, #drawer-os-body select, #drawer-os-body textarea').forEach(el => {
    el.disabled = false;
  });
  document.getElementById('btn-salvar-os').disabled = false;

  selectStatus('aberta');
  const section = document.getElementById('section-historico');
  if (section) section.classList.add('hidden');

  const esp = document.getElementById('f-especialidade');
  if (esp) esp.value = '';
  const tipo = document.getElementById('f-tipo-servico');
  if (tipo) tipo.value = '';
}

// ── Peek next OS number (READ ONLY — does NOT increment the counter) ──
async function peekProximoNumeroOS() {
  const snap = await get(ref(database, 'config/contadorOS'));
  const current = snap.exists() ? snap.val() : 16999;
  return current + 1; // just a preview
}

// ── Get and reserve next OS number (atomic increment — only call at save time) ──
async function getProximoNumeroOS() {
  const counterRef = ref(database, 'config/contadorOS');
  let numero = null;
  await runTransaction(counterRef, (current) => {
    if (current === null) current = 16999;
    numero = current + 1;
    return numero;
  });
  return numero;
}

// ── Save OS ──
async function saveOS(user) {
  const titulo     = document.getElementById('f-titulo').value.trim();
  const categoria  = document.getElementById('f-categoria').value;
  const setor      = document.getElementById('f-setor').value.trim();
  const local      = document.getElementById('f-local').value.trim();
  const descricao  = document.getElementById('f-descricao').value.trim();
  const solicitante = document.getElementById('f-solicitante').value.trim();
  const prioridade = document.getElementById('f-prioridade').value;
  const dataAbertura = document.getElementById('f-data-abertura').value;
  const prazo      = document.getElementById('f-prazo').value;
  const previsao   = document.getElementById('f-previsao').value;
  const status     = document.getElementById('f-status').value || 'aberta';
  const solucao    = document.getElementById('f-solucao').value.trim();
  const especialidade = document.getElementById('f-especialidade').value;
  const tipoServico   = document.getElementById('f-tipo-servico').value;
  const tecId      = document.getElementById('f-tecid').value;
  const tecNome    = document.getElementById('f-tecnome').value;

  if (!titulo)      { showToast('Informe o título da OS.', 'warning'); return; }
  if (!categoria)   { showToast('Selecione a categoria.', 'warning'); return; }
  if (!solicitante) { showToast('Informe o solicitante.', 'warning'); return; }

  const btn = document.getElementById('btn-salvar-os');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="border-top-color:white;"></span> Salvando...`;

  try {
    const now = new Date().toISOString();
    const histDesc = editingId
      ? `OS atualizada por ${user.nome}. Status: ${status}.`
      : `OS criada por ${user.nome}.`;

    if (editingId) {
      // Update existing
      const existing = allOrdens.find(o => o.id === editingId);
      const finalizadoEm = (status === 'finalizada' || status === 'fechada') && !existing?.finalizadoEm
        ? now : (existing?.finalizadoEm || null);

      await update(ref(database, `ordensServico/${editingId}`), {
        titulo, categoria, setor, local, descricao, solicitante,
        prioridade, prazo: prazo || null, previsao: previsao || null,
        status, solucao: solucao || null, tecId: tecId || null, tecNome: tecNome || null,
        especialidade: especialidade || null, tipoServico: tipoServico || null,
        atualizadoEm: now, atualizadoPor: user.uid,
        finalizadoEm
      });

      // Log history
      await push(ref(database, `historico/${editingId}`), {
        tipo: status === 'finalizada' ? 'close' : 'update',
        descricao: histDesc,
        em: now,
        usuarioNome: user.nome,
        usuarioId: user.uid
      });

      showToast('OS atualizada com sucesso!', 'success');
    } else {
      // Create new
      const numero = await getProximoNumeroOS();
      const newOS = {
        numero, titulo, categoria, setor, local, descricao, solicitante,
        prioridade, status: 'aberta',
        prazo: prazo || null, previsao: previsao || null, solucao: null,
        tecId: tecId || null, tecNome: tecNome || null,
        especialidade: especialidade || null, tipoServico: tipoServico || null,
        criadoEm: dataAbertura ? `${dataAbertura}T${now.slice(11)}` : now,
        criadoPor: user.uid,
        atualizadoEm: now
      };

      const newRef = push(ref(database, 'ordensServico'));
      await set(newRef, newOS);

      // Log history
      await push(ref(database, `historico/${newRef.key}`), {
        tipo: 'create',
        descricao: `OS #${String(numero).padStart(5,'0')} criada por ${user.nome}.`,
        em: now, usuarioNome: user.nome, usuarioId: user.uid
      });

      showToast(`OS #${String(numero).padStart(5,'0')} criada com sucesso!`, 'success');
    }

    closeDrawer('drawer-os');
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar OS. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar OS`;
  }
}

// ── Delete OS ──
async function deleteOS(user) {
  if (user.role !== 'admin') { showToast('Sem permissão para excluir OS.', 'error'); return; }
  if (!editingId) return;

  const os = allOrdens.find(o => o.id === editingId);
  const confirmed = await confirmAction({
    title: 'Excluir OS',
    message: `Tem certeza que deseja excluir a OS #${String(os?.numero||'').padStart(5,'0')}? Esta ação não pode ser desfeita.`,
    confirm: 'Excluir', danger: true
  });
  if (!confirmed) return;

  try {
    await remove(ref(database, `ordensServico/${editingId}`));
    await remove(ref(database, `historico/${editingId}`));
    closeDrawer('drawer-os');
    showToast('OS excluída.', 'success');
  } catch {
    showToast('Erro ao excluir OS.', 'error');
  }
}

// ── PDF ──
async function printCurrentOS() {
  if (!editingId) return;
  const os = allOrdens.find(o => o.id === editingId);
  if (!os) return;
  try {
    const snap = await get(ref(database, `historico/${editingId}`));
    const hist = snap.exists() ? Object.values(snap.val()) : [];
    const { url, filename } = await gerarPDF(os, hist);
    showDownloadToast(url, filename, os.numero);
  } catch (e) {
    console.error(e);
    showToast('Erro ao gerar PDF.', 'error');
  }
}
window._printOS = async (osId) => {
  const os = allOrdens.find(o => o.id === osId);
  if (!os) return;
  try {
    const { url, filename } = await gerarPDF(os, []);
    showDownloadToast(url, filename, os.numero);
  } catch (e) {
    console.error(e);
    showToast('Erro ao gerar PDF.', 'error');
  }
};

// ── Export ──
function setupExport(user) {
  const btn = document.getElementById('btn-export-excel');
  if (!btn) return;
  if (user.role === 'usuario') { btn.classList.add('hidden'); return; }

  btn.addEventListener('click', async () => {
    const filtered = getFiltered();
    if (filtered.length === 0) { showToast('Nenhum dado para exportar.', 'warning'); return; }
    try {
      btn.disabled = true;
      await exportarExcel(prepararDadosExcel(filtered, allTecnicos));
      showToast(`${filtered.length} OS exportadas!`, 'success');
    } catch { showToast('Erro ao exportar.', 'error'); }
    finally { btn.disabled = false; }
  });
}
