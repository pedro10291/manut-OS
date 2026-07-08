/* =======================================================
   SISTEMA OS v2 — Perfil Module
   ======================================================= */

import { requireAuth, fazerLogout, recuperarSenha, getUsuarioAtual } from './auth.js';
import { initUI, showToast, renderSidebarUser, applyRoleVisibility, hideLoader, applyTheme, getTheme } from './ui.js';
import { formatDate, getInitials, getAvatarColor, escapeHtml } from './utils.js';
import { database } from './firebase.js';
import { ref, get, onValue } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

initUI();
requireAuth(['admin', 'tecnico', 'usuario'], (user) => {
  renderSidebarUser(user);
  applyRoleVisibility(user.role);
  renderProfile(user);
  setupActions(user);
  hideLoader();
});

async function renderProfile(user) {
  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  const initials  = getInitials(user.nome || user.email);
  const color     = getAvatarColor(user.nome || user.uid);
  if (avatarEl) {
    avatarEl.textContent = initials;
    avatarEl.className = `avatar avatar-xl ${color}`;
  }

  // Name, email
  document.getElementById('profile-name').textContent  = escapeHtml(user.nome || '—');
  document.getElementById('profile-email').textContent = escapeHtml(user.email || '—');

  // Role badge
  const roleLabels = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuário' };
  const roleBadgeClass = { admin: 'role-admin', tecnico: 'role-tecnico', usuario: 'role-usuario' };
  const roleBadgeEl = document.getElementById('profile-role-badge');
  if (roleBadgeEl) {
    roleBadgeEl.innerHTML = `<span class="role-chip ${roleBadgeClass[user.role] || 'role-usuario'}">${roleLabels[user.role] || user.role}</span>`;
  }

  // Since
  document.getElementById('profile-since').textContent = formatDate(user.criadoEm) || '—';

  // Técnico vinculado
  if (user.tecId) {
    const tecSnap = await get(ref(database, `tecnicos/${user.tecId}`));
    const tecNome = tecSnap.exists() ? tecSnap.val().nome : '—';
    document.getElementById('profile-tec').textContent = escapeHtml(tecNome);
  } else {
    document.getElementById('profile-tec').textContent = '—';
  }

  // OS count
  if (user.role === 'tecnico' && user.tecId) {
    const osSnap = await get(ref(database, 'ordensServico'));
    const allOS = osSnap.val() || {};
    const myOS = Object.values(allOS).filter(os =>
      os.tecId === user.tecId && (os.status === 'aberta' || os.status === 'andamento')
    ).length;
    document.getElementById('profile-os-count').textContent = myOS;
  } else if (user.role === 'admin') {
    const osSnap = await get(ref(database, 'ordensServico'));
    const total = osSnap.exists() ? Object.keys(osSnap.val()).length : 0;
    document.getElementById('profile-os-count').textContent = total;
  } else {
    document.getElementById('profile-os-count').textContent = '—';
  }

  // Next OS number
  const configSnap = await get(ref(database, 'config/contadorOS'));
  const proxNum = document.getElementById('proximo-os-num');
  if (proxNum && configSnap.exists()) {
    proxNum.textContent = `Próxima: #${String(configSnap.val() + 1).padStart(5, '0')}`;
  }

  // Clock
  function updateClock() {
    const el = document.getElementById('current-time');
    if (el) {
      el.textContent = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
}

function setupActions(user) {
  // Logout buttons
  document.getElementById('btn-logout-profile')?.addEventListener('click', fazerLogout);
  document.getElementById('btn-logout')?.addEventListener('click', fazerLogout);

  // Theme buttons
  const darkBtn  = document.getElementById('theme-dark-btn');
  const lightBtn = document.getElementById('theme-light-btn');

  function updateThemeBtns() {
    const current = getTheme();
    if (darkBtn)  darkBtn.classList.toggle('btn-primary',  current === 'dark');
    if (lightBtn) lightBtn.classList.toggle('btn-primary', current === 'light');
  }
  updateThemeBtns();

  darkBtn?.addEventListener('click',  () => { applyTheme('dark');  updateThemeBtns(); showToast('Tema escuro ativado.', 'info'); });
  lightBtn?.addEventListener('click', () => { applyTheme('light'); updateThemeBtns(); showToast('Tema claro ativado.', 'info'); });

  // Theme toggle in header
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    updateThemeBtns();
    const iconD = document.getElementById('theme-icon-dark');
    const iconL = document.getElementById('theme-icon-light');
    iconD?.classList.toggle('hidden', next === 'light');
    iconL?.classList.toggle('hidden', next === 'dark');
  });

  // Password Reset
  document.getElementById('btn-reset-pwd')?.addEventListener('click', async () => {
    if (!user.email) return;
    const btn = document.getElementById('btn-reset-pwd');
    btn.disabled = true;
    try {
      await recuperarSenha(user.email);
      const msgEl = document.getElementById('pwd-reset-msg');
      msgEl.className = 'lf-success';
      msgEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Link enviado para <strong>${escapeHtml(user.email)}</strong>`;
      msgEl.classList.remove('hidden');
      showToast('Link de redefinição enviado!', 'success');
    } catch {
      showToast('Erro ao enviar link. Tente novamente.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
  // Note: menu-toggle and sidebar-toggle-desktop listeners are handled by initUI()
}

