/* =======================================================
   SISTEMA OS v2 — UI Module
   Sidebar, Toast, Modal, Theme Toggle, Page Loader
   ======================================================= */

// ── Theme ──
const THEME_KEY = 'os-theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const iconDark  = document.getElementById('theme-icon-dark');
  const iconLight = document.getElementById('theme-icon-light');
  if (iconDark)  iconDark.classList.toggle('hidden',  theme === 'light');
  if (iconLight) iconLight.classList.toggle('hidden', theme === 'dark');
}

export function toggleTheme() {
  const current = getTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  applyTheme(getTheme());
}

// ── Page Loader ──
export function showLoader() {
  const el = document.getElementById('page-loader');
  if (el) { el.classList.remove('hidden', 'fade-out'); }
}

export function hideLoader() {
  const el = document.getElementById('page-loader');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.classList.add('hidden'), 500);
}

// ── Sidebar ──
let sidebarEl = null;
let mainWrapperEl = null;
let overlayEl = null;
const SIDEBAR_KEY = 'os-sidebar-collapsed';

export function initSidebar() {
  sidebarEl     = document.getElementById('sidebar');
  mainWrapperEl = document.getElementById('main-wrapper');
  overlayEl     = document.getElementById('overlay');

  if (!sidebarEl) return;

  // Restore state (desktop only)
  if (window.innerWidth > 768) {
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === 'true';
    setSidebarCollapsed(collapsed);
  }

  // Mobile overlay click closes sidebar
  if (overlayEl) {
    overlayEl.addEventListener('click', () => {
      closeMobileSidebar();
      closeDrawer();
    });
  }
}

export function setSidebarCollapsed(collapsed) {
  if (!sidebarEl || !mainWrapperEl) return;
  sidebarEl.classList.toggle('collapsed', collapsed);
  mainWrapperEl.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  // Arrow rotation handled by CSS: .sidebar.collapsed .sidebar-toggle svg { transform: rotate(180deg) }
}

export function toggleSidebar() {
  if (!sidebarEl) return;
  if (window.innerWidth <= 768) {
    toggleMobileSidebar();
  } else {
    setSidebarCollapsed(!sidebarEl.classList.contains('collapsed'));
  }
}

function toggleMobileSidebar() {
  const open = sidebarEl.classList.toggle('mobile-open');
  if (overlayEl) overlayEl.classList.toggle('active', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

function closeMobileSidebar() {
  if (!sidebarEl) return;
  sidebarEl.classList.remove('mobile-open');
  if (overlayEl) overlayEl.classList.remove('active');
  document.body.style.overflow = '';
}

// ── Set active nav item ──
export function setActiveNav(pageId) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });
}

// ── Toast Notifications ──
const TOAST_ICONS = {
  success:  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning:  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:     `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
};

const TOAST_TITLES = {
  success:  'Sucesso',
  error:    'Erro',
  warning:  'Atenção',
  info:     'Informação',
  download: 'PDF Pronto'
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'|'download'} type
 * @param {number} duration - ms; 0 = persistent (user must close manually)
 * @param {string|null} title
 * @param {{label:string, onClick:function}|null} action - optional action button
 */
export function showToast(message, type = 'info', duration = 4000, title = null, action = null) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
    <div class="toast-body">
      <div class="toast-title">${title || TOAST_TITLES[type] || 'Notificação'}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
      ${action ? `<button class="toast-action-btn" type="button">${action.label}</button>` : ''}
    </div>
    <button class="toast-close" aria-label="Fechar">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  const dismiss = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 320);
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);

  if (action) {
    toast.querySelector('.toast-action-btn')?.addEventListener('click', () => {
      action.onClick();
      dismiss();
    });
  }

  container.appendChild(toast);
  if (duration > 0) setTimeout(dismiss, duration);

  return { dismiss };
}

/**
 * Show a persistent download notification with a "Baixar PDF" button.
 * Auto-revokes the blob URL after download starts.
 */
export function showDownloadToast(url, filename, osNumero = '') {
  const label = osNumero ? `OS #${String(osNumero).padStart(5, '0')}` : filename;
  showToast(
    `<strong>${label}</strong> foi gerado. Clique em Baixar para salvar.`,
    'download',
    0,  // persistent
    '📄 PDF Pronto',
    {
      label: '⬇️ Baixar PDF',
      onClick: () => {
        const a = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }
    }
  );
}

// ── Drawer ──
let activeDrawer  = null;
let activeOverlay = null;

export function openDrawer(drawerId, overlayId = 'overlay') {
  const drawer  = document.getElementById(drawerId);
  const overlay = document.getElementById(overlayId) || overlayEl;
  if (!drawer) return;

  activeDrawer  = drawer;
  activeOverlay = overlay;

  drawer.classList.add('open');
  if (overlay) overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeDrawer(drawerId = null) {
  const drawer = drawerId ? document.getElementById(drawerId) : activeDrawer;
  if (!drawer) return;
  drawer.classList.remove('open');
  if (activeOverlay) activeOverlay.classList.remove('active');
  document.body.style.overflow = '';
  activeDrawer  = null;
  activeOverlay = null;
}

// ── Modal ──
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Confirmation Modal ──
export function confirmAction(options = {}) {
  return new Promise((resolve) => {
    const {
      title   = 'Confirmar ação',
      message = 'Tem certeza que deseja continuar?',
      confirm = 'Confirmar',
      cancel  = 'Cancelar',
      danger  = false
    } = options;

    const old = document.getElementById('__confirm-modal');
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = '__confirm-modal';
    div.innerHTML = `
      <div class="modal-backdrop" id="__confirm-backdrop">
        <div class="modal modal-sm" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
          </div>
          <div class="modal-body">${message}</div>
          <div class="modal-footer">
            <button class="btn btn-sm" id="__confirm-cancel">${cancel}</button>
            <button class="btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}" id="__confirm-ok">${confirm}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    document.body.style.overflow = 'hidden';

    const cleanup = (result) => {
      document.body.style.overflow = '';
      div.remove();
      resolve(result);
    };

    document.getElementById('__confirm-ok').addEventListener('click',     () => cleanup(true));
    document.getElementById('__confirm-cancel').addEventListener('click',  () => cleanup(false));
    document.getElementById('__confirm-backdrop').addEventListener('click', (e) => {
      if (e.target === document.getElementById('__confirm-backdrop')) cleanup(false);
    });
  });
}

// ── Render Sidebar User ──
export function renderSidebarUser(user) {
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const nameEl   = document.getElementById('sidebar-user-name');
  const roleEl   = document.getElementById('sidebar-user-role');

  const roleLabels = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuário' };
  const avatarColors = ['avatar-blue','avatar-green','avatar-purple','avatar-orange','avatar-cyan'];

  if (avatarEl) {
    const initials = (user.nome || user.email || 'U').split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
    const color    = avatarColors[(user.uid || '').charCodeAt(0) % avatarColors.length] || 'avatar-blue';
    avatarEl.textContent  = initials;
    avatarEl.className    = `avatar avatar-md ${color}`;
  }
  if (nameEl) nameEl.textContent  = user.nome || user.email || '—';
  if (roleEl) roleEl.textContent  = roleLabels[user.role] || user.role || '—';
}

// ── Role Visibility ──
export function applyRoleVisibility(role) {
  document.querySelectorAll('[data-role]').forEach(el => {
    const allowed = el.dataset.role.split(',').map(r => r.trim());
    el.style.display = allowed.includes(role) ? '' : 'none';
  });
}

// ── Debounce ──
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Format helpers (re-exported from utils for convenience) ──
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init everything ──
export function initUI() {
  initTheme();
  initSidebar();

  // Theme toggle (header)
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    toggleTheme();
    const theme = getTheme();
    document.getElementById('theme-icon-dark')?.classList.toggle('hidden',  theme === 'light');
    document.getElementById('theme-icon-light')?.classList.toggle('hidden', theme === 'dark');
  });

  // Hamburger (header) — opens mobile sidebar OR collapses desktop sidebar
  const menuBtn = document.getElementById('menu-toggle');
  if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);

  // Collapse arrow (inside sidebar header) — desktop only
  const desktopToggle = document.getElementById('sidebar-toggle-desktop');
  if (desktopToggle) desktopToggle.addEventListener('click', toggleSidebar);

  // Logout button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { fazerLogout } = await import('./auth.js');
      fazerLogout();
    });
  }
}
