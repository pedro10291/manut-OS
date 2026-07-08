/* =======================================================
   SISTEMA OS v2 — OS Module
   CRUD completo, numeração automática, filtros, busca,
   histórico, SLA, PDF, Excel
   ======================================================= */

import { requireAuth, fazerLogout, getUsuarioAtual } from './auth.js';
import { initUI, showToast, openDrawer, closeDrawer, confirmAction, renderSidebarUser, applyRoleVisibility, hideLoader, debounce } from './ui.js';
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
  document.getElementById('section-historico')?.classList.add('hidden');

  // Set today's date
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('f-data-abertura').value = today;

  selectStatus('aberta');
  renderTecGrid();
  openDrawer('drawer-os');

  // Generate number
  getProximoNumeroOS().then(n => {
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

  openDrawer('drawer-os');
}

// Global handler for table row click
window._editOS = openEdit;

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
}

// ── Get Next OS Number (atomic) ──
async function getProximoNumeroOS() {
  const counterRef = ref(database, 'config/contadorOS');
  let numero = null;
  await runTransaction(counterRef, (current) => {
    if (current === null) {
      current = 16999;
    }
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
    await gerarPDF(os, hist);
    showToast('PDF gerado!', 'success');
  } catch { showToast('Erro ao gerar PDF.', 'error'); }
}
window._printOS = async (osId) => {
  const os = allOrdens.find(o => o.id === osId);
  if (!os) return;
  try {
    await gerarPDF(os, []);
    showToast('PDF gerado!', 'success');
  } catch { showToast('Erro ao gerar PDF.', 'error'); }
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
