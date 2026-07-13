/* =======================================================
   SISTEMA OS v2 — Usuários Module
   Listagem de usuários, convites, equipe técnica
   ======================================================= */

import { requireAuth, criarConvite, getUsuarioAtual } from './auth.js';
import { initUI, showToast, openDrawer, closeDrawer, confirmAction, renderSidebarUser, applyRoleVisibility, hideLoader } from './ui.js';
import { formatDate, formatRelativeTime, getInitials, getAvatarColor, escapeHtml, copyToClipboard } from './utils.js';
import { database } from './firebase.js';
import { ref, onValue, push, set, update, remove, get } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

// ── Init ──
initUI();
requireAuth(['admin'], (user) => {
  renderSidebarUser(user);
  applyRoleVisibility(user.role);
  setupPage(user);
  hideLoader();
});

let allUsuarios = {};
let allTecnicos = {};
let allConvites = {};
let currentTab = 'usuarios';

// ── Setup ──
function setupPage(user) {
  listenUsuarios();
  listenTecnicos();
  listenConvites();
  setupTabs();
  setupConviteDrawer(user);
  setupTecnicoDrawer();
  setupEditModal();
}

// ── Firebase Listeners ──
function listenUsuarios() {
  onValue(ref(database, 'usuarios'), (snap) => {
    allUsuarios = snap.val() || {};
    renderUsuarios();
    const label = document.getElementById('users-count-label');
    if (label) {
      const total = Object.keys(allUsuarios).length;
      label.textContent = `${total} usuário${total !== 1 ? 's' : ''} cadastrado${total !== 1 ? 's' : ''}`;
    }
  });
}

function listenTecnicos() {
  onValue(ref(database, 'tecnicos'), (snap) => {
    allTecnicos = snap.val() || {};
    renderTecnicos();
    populateTecSelects();
  });
}

function listenConvites() {
  onValue(ref(database, 'convites'), (snap) => {
    allConvites = snap.val() || {};
    renderConvites();
  });
}

// ── Tabs ──
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        const isActive = b.dataset.tab === currentTab;
        b.style.borderBottomColor = isActive ? 'var(--accent)' : 'transparent';
        b.style.color = isActive ? 'var(--accent)' : 'var(--text-muted)';
        b.style.fontWeight = isActive ? '600' : '500';
      });
      document.getElementById('panel-usuarios').classList.toggle('hidden', currentTab !== 'usuarios');
      document.getElementById('panel-tecnicos').classList.toggle('hidden', currentTab !== 'tecnicos');
      document.getElementById('panel-convites').classList.toggle('hidden', currentTab !== 'convites');
    });
  });
}

// ── Render Usuários ──
function renderUsuarios() {
  const tbody = document.getElementById('usuarios-tbody');
  const info  = document.getElementById('usuarios-table-info');
  if (!tbody) return;

  const entries = Object.entries(allUsuarios);
  if (info) info.textContent = `${entries.length} usuário${entries.length !== 1 ? 's' : ''}`;

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><div class="empty-state-icon">👥</div>
      <h3>Nenhum usuário</h3><p>Convide usuários para acessar o sistema.</p></div>
    </td></tr>`;
    return;
  }

  const roleLabels = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuário' };
  const roleBadgeClass = { admin: 'role-admin', tecnico: 'role-tecnico', usuario: 'role-usuario' };

  tbody.innerHTML = entries.map(([uid, u]) => {
    const initials = getInitials(u.nome || u.email || '?');
    const avatarColor = getAvatarColor(u.nome || uid);
    const tecNome = u.tecId && allTecnicos[u.tecId] ? allTecnicos[u.tecId].nome : '—';
    const ativo = u.ativo !== false;

    return `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <div class="avatar avatar-md ${avatarColor}">${initials}</div>
            <div>
              <div style="font-weight:600;color:var(--text);font-size:13.5px;">${escapeHtml(u.nome || '—')}</div>
              ${u.criadoAutomaticamente ? '<div style="font-size:10px;color:var(--warning);">⚡ Primeiro admin</div>' : ''}
            </div>
          </div>
        </td>
        <td style="color:var(--text-3);font-size:13px;">${escapeHtml(u.email || '—')}</td>
        <td><span class="role-chip ${roleBadgeClass[u.role] || 'role-usuario'}">${roleLabels[u.role] || u.role}</span></td>
        <td style="color:var(--text-3);font-size:12px;">${escapeHtml(tecNome)}</td>
        <td style="color:var(--text-muted);font-size:12px;">${formatDate(u.criadoEm)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
            color:${ativo ? 'var(--success)' : 'var(--text-muted)'};">
            <span style="width:7px;height:7px;border-radius:50%;background:${ativo ? 'var(--success)' : 'var(--text-muted)'};display:inline-block;"></span>
            ${ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <div class="table-actions" style="justify-content:flex-end;">
            <button class="btn btn-sm btn-ghost" onclick="window._editarUsuario('${uid}')" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Render Técnicos ──
function renderTecnicos() {
  const grid = document.getElementById('tecnicos-grid');
  if (!grid) return;

  const entries = Object.entries(allTecnicos);
  if (entries.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-state-icon">🔧</div>
      <h3>Nenhum técnico cadastrado</h3>
      <p>Adicione técnicos para atribuir às ordens de serviço.</p>
    </div>`;
    return;
  }

  grid.innerHTML = entries.map(([id, t]) => {
    const initials = getInitials(t.nome);
    const color = getAvatarColor(t.nome);
    // Count OS for this tech
    return `
      <div class="card" style="cursor:pointer;" onclick="window._editarTecnico('${id}')">
        <div class="card-body" style="display:flex;align-items:center;gap:14px;">
          <div class="avatar avatar-lg ${color}">${initials}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;color:var(--text);font-size:14px;margin-bottom:3px;">${escapeHtml(t.nome)}</div>
            ${t.especialidade ? `<div style="font-size:12px;color:var(--accent);margin-bottom:2px;">${escapeHtml(t.especialidade)}</div>` : ''}
            ${t.email ? `<div style="font-size:11px;color:var(--text-muted);">${escapeHtml(t.email)}</div>` : ''}
          </div>
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();window._editarTecnico('${id}')" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Render Convites ──
function renderConvites() {
  const tbody = document.getElementById('convites-tbody');
  if (!tbody) return;

  const entries = Object.entries(allConvites);
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><div class="empty-state-icon">📧</div>
      <h3>Nenhum convite</h3><p>Gere convites para novos usuários.</p></div>
    </td></tr>`;
    return;
  }

  const roleLabel = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuário' };

  tbody.innerHTML = entries.map(([token, c]) => {
    const link = `${location.origin}/cadastro.html?token=${token}`;
    return `
      <tr>
        <td style="font-weight:600;color:var(--text);">${escapeHtml(c.nome || '—')}</td>
        <td style="color:var(--text-3);font-size:12px;">${escapeHtml(c.email || '—')}</td>
        <td><span class="role-chip role-${c.role}">${roleLabel[c.role] || c.role}</span></td>
        <td style="color:var(--text-muted);font-size:12px;">${formatRelativeTime(c.criadoEm)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
            color:${c.usado ? 'var(--success)' : 'var(--warning)'};">
            <span style="width:7px;height:7px;border-radius:50%;background:${c.usado ? 'var(--success)' : 'var(--warning)'};display:inline-block;"></span>
            ${c.usado ? 'Utilizado' : 'Pendente'}
          </span>
        </td>
        <td>
          ${!c.usado ? `
            <button class="btn btn-sm btn-ghost" onclick="window._copyInviteLink('${token}')" title="Copiar link">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copiar
            </button>
          ` : '—'}
        </td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="window._deleteConvite('${token}')" title="Excluir">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Populate Tech Selects ──
function populateTecSelects() {
  const opts = Object.entries(allTecnicos)
    .map(([id, t]) => `<option value="${id}">${escapeHtml(t.nome)}</option>`)
    .join('');

  const cSel = document.getElementById('c-tecid');
  if (cSel) { const s = cSel.value; cSel.innerHTML = `<option value="">Selecionar...</option>${opts}`; cSel.value = s; }

  const eSel = document.getElementById('edit-tecid');
  if (eSel) { const s = eSel.value; eSel.innerHTML = `<option value="">Nenhum</option>${opts}`; eSel.value = s; }
}

// ── Convite Drawer ──
function setupConviteDrawer(user) {
  document.getElementById('btn-novo-convite')?.addEventListener('click', () => {
    document.getElementById('c-nome').value = '';
    document.getElementById('c-email').value = '';
    document.getElementById('c-role').value = 'usuario';
    document.getElementById('c-link-result')?.classList.add('hidden');
    document.getElementById('c-tec-group').style.display = 'none';
    openDrawer('drawer-convite');
  });

  document.getElementById('drawer-convite-close')?.addEventListener('click', () => closeDrawer('drawer-convite'));
  document.getElementById('btn-cancelar-convite')?.addEventListener('click', () => closeDrawer('drawer-convite'));

  document.getElementById('c-role')?.addEventListener('change', (e) => {
    document.getElementById('c-tec-group').style.display = e.target.value === 'tecnico' ? '' : 'none';
  });

  document.getElementById('btn-gerar-convite')?.addEventListener('click', async () => {
    const nome  = document.getElementById('c-nome').value.trim();
    const email = document.getElementById('c-email').value.trim();
    const role  = document.getElementById('c-role').value;
    const tecId = document.getElementById('c-tecid')?.value || null;

    if (!nome) { showToast('Informe o nome do usuário.', 'warning'); return; }

    const btn = document.getElementById('btn-gerar-convite');
    btn.disabled = true;
    btn.textContent = 'Gerando...';

    try {
      const token = await criarConvite({ nome, role, email: email || null, tecId });
      const link = `${location.origin}/cadastro.html?token=${token}`;

      document.getElementById('c-link-text').textContent = link;
      document.getElementById('c-link-result').classList.remove('hidden');
      showToast('Convite gerado! Compartilhe o link.', 'success');

      document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
        await copyToClipboard(link);
        showToast('Link copiado!', 'success');
      }, { once: true });
    } catch (err) {
      showToast('Erro ao gerar convite.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Gerar Convite';
    }
  });
}

// ── Copy invite link ──
window._copyInviteLink = async (token) => {
  const link = `${location.origin}/cadastro.html?token=${token}`;
  await copyToClipboard(link);
  showToast('Link copiado!', 'success');
};

// ── Delete convite ──
window._deleteConvite = async (token) => {
  const ok = await confirmAction({
    title: 'Excluir Convite',
    message: 'O link ficará inválido. Confirma a exclusão?',
    confirm: 'Excluir', danger: true
  });
  if (!ok) return;
  try {
    await remove(ref(database, `convites/${token}`));
    showToast('Convite excluído.', 'success');
  } catch { showToast('Erro ao excluir convite.', 'error'); }
};

// ── Editar Usuário (modal) ──
window._editarUsuario = (uid) => {
  const u = allUsuarios[uid];
  if (!u) return;
  document.getElementById('edit-uid').value = uid;
  document.getElementById('edit-role').value = u.role || 'usuario';
  document.getElementById('edit-tecid').value = u.tecId || '';
  document.getElementById('edit-ativo').value = String(u.ativo !== false);
  document.getElementById('modal-editar-usuario').classList.remove('hidden');
};

function setupEditModal() {
  const closeModal = () => document.getElementById('modal-editar-usuario').classList.add('hidden');
  document.getElementById('modal-editar-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-editar-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-editar-backdrop')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-editar-backdrop')) closeModal();
  });

  document.getElementById('btn-salvar-edicao')?.addEventListener('click', async () => {
    const uid   = document.getElementById('edit-uid').value;
    const role  = document.getElementById('edit-role').value;
    const tecId = document.getElementById('edit-tecid').value || null;
    const ativo = document.getElementById('edit-ativo').value === 'true';

    if (!uid) return;
    const btn = document.getElementById('btn-salvar-edicao');
    btn.disabled = true;
    try {
      await update(ref(database, `usuarios/${uid}`), { role, tecId, ativo });
      closeModal();
      showToast('Usuário atualizado!', 'success');
    } catch { showToast('Erro ao atualizar usuário.', 'error'); }
    finally { btn.disabled = false; }
  });
}

// ── Técnico Drawer ──
function setupTecnicoDrawer() {
  document.getElementById('btn-novo-tecnico')?.addEventListener('click', () => {
    document.getElementById('tec-edit-id').value = '';
    document.getElementById('tec-nome').value = '';
    document.getElementById('tec-email').value = '';
    document.getElementById('tec-tel').value = '';
    document.getElementById('tec-especialidade').value = '';
    document.getElementById('tec-obs').value = '';
    document.getElementById('drawer-tec-title').textContent = 'Novo Técnico';
    document.getElementById('btn-delete-tec')?.classList.add('hidden');
    openDrawer('drawer-tecnico');
  });

  document.getElementById('drawer-tecnico-close')?.addEventListener('click', () => closeDrawer('drawer-tecnico'));
  document.getElementById('btn-cancelar-tec')?.addEventListener('click', () => closeDrawer('drawer-tecnico'));

  document.getElementById('btn-salvar-tec')?.addEventListener('click', async () => {
    const id  = document.getElementById('tec-edit-id').value;
    const nome = document.getElementById('tec-nome').value.trim();
    if (!nome) { showToast('Informe o nome do técnico.', 'warning'); return; }

    const data = {
      nome,
      email: document.getElementById('tec-email').value.trim() || null,
      telefone: document.getElementById('tec-tel').value.trim() || null,
      especialidade: document.getElementById('tec-especialidade').value.trim() || null,
      obs: document.getElementById('tec-obs').value.trim() || null,
      ativo: true
    };

    const btn = document.getElementById('btn-salvar-tec');
    btn.disabled = true;
    try {
      if (id) {
        await update(ref(database, `tecnicos/${id}`), data);
        showToast('Técnico atualizado!', 'success');
      } else {
        await push(ref(database, 'tecnicos'), data);
        showToast(`Técnico ${nome} cadastrado!`, 'success');
      }
      closeDrawer('drawer-tecnico');
    } catch { showToast('Erro ao salvar técnico.', 'error'); }
    finally { btn.disabled = false; }
  });

  document.getElementById('btn-delete-tec')?.addEventListener('click', async () => {
    const id = document.getElementById('tec-edit-id').value;
    if (!id) return;
    const ok = await confirmAction({
      title: 'Excluir Técnico',
      message: 'O técnico será removido. OS existentes não serão afetadas.',
      confirm: 'Excluir', danger: true
    });
    if (!ok) return;
    try {
      await remove(ref(database, `tecnicos/${id}`));
      closeDrawer('drawer-tecnico');
      showToast('Técnico excluído.', 'success');
    } catch { showToast('Erro ao excluir.', 'error'); }
  });
}

window._editarTecnico = (id) => {
  const t = allTecnicos[id];
  if (!t) return;
  document.getElementById('tec-edit-id').value = id;
  document.getElementById('tec-nome').value = t.nome || '';
  document.getElementById('tec-email').value = t.email || '';
  document.getElementById('tec-tel').value = t.telefone || '';
  document.getElementById('tec-especialidade').value = t.especialidade || '';
  document.getElementById('tec-obs').value = t.obs || '';
  document.getElementById('drawer-tec-title').textContent = 'Editar Técnico';
  document.getElementById('btn-delete-tec')?.classList.remove('hidden');
  openDrawer('drawer-tecnico');
};
