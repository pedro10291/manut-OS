/* =======================================================
   SISTEMA OS v2 — Login Page Script
   ======================================================= */

import { fazerLogin, recuperarSenha, redirectIfLoggedIn } from './auth.js';
import { showToast, initTheme, toggleTheme } from './ui.js';
import { database } from './firebase.js';
import { ref, get } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

// Apply saved theme
initTheme();

// Redirect if already logged in
redirectIfLoggedIn('dashboard.html');

// ── Theme Toggle ──
const themeBtn = document.getElementById('theme-toggle');
const iconDark  = document.getElementById('icon-dark');
const iconLight = document.getElementById('icon-light');

function updateThemeIcons() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  iconDark?.classList.toggle('hidden',  theme === 'light');
  iconLight?.classList.toggle('hidden', theme === 'dark');
}
updateThemeIcons();
themeBtn?.addEventListener('click', () => { toggleTheme(); updateThemeIcons(); });

// ── Element refs ──
const loginCard   = document.getElementById('login-card');
const recoverCard = document.getElementById('recover-card');
const loginForm   = document.getElementById('login-form');
const recoverForm = document.getElementById('recover-form');
const emailInput  = document.getElementById('login-email');
const senhaInput  = document.getElementById('login-senha');
const lembrarChk  = document.getElementById('lembrar');
const errorDiv    = document.getElementById('login-error');
const errorMsg    = document.getElementById('login-error-msg');
const btnLogin    = document.getElementById('btn-login');
const btnLoginTxt = document.getElementById('btn-login-text');
const btnLoginSpn = document.getElementById('btn-login-spinner');

// Recover elements
const btnRecuperar = document.getElementById('btn-recuperar');
const btnBack      = document.getElementById('btn-back');
const recoverEmail = document.getElementById('recover-email');
const recoverMsg   = document.getElementById('recover-msg');
const btnRecover   = document.getElementById('btn-recover');
const btnRecoverTxt = document.getElementById('btn-recover-text');
const btnRecoverSpn = document.getElementById('btn-recover-spinner');

// ── Toggle password visibility ──
const togglePwd = document.getElementById('toggle-pwd');
const eyeOpen   = document.getElementById('eye-open');
const eyeClosed = document.getElementById('eye-closed');

togglePwd?.addEventListener('click', () => {
  const isPassword = senhaInput.type === 'password';
  senhaInput.type = isPassword ? 'text' : 'password';
  eyeOpen?.classList.toggle('hidden', isPassword);
  eyeClosed?.classList.toggle('hidden', !isPassword);
});

// ── Switch to recovery form ──
btnRecuperar?.addEventListener('click', () => {
  loginCard.classList.add('hidden');
  recoverCard.classList.remove('hidden');
  recoverEmail.focus();
});

btnBack?.addEventListener('click', () => {
  recoverCard.classList.add('hidden');
  loginCard.classList.remove('hidden');
  recoverMsg.classList.add('hidden');
  emailInput.focus();
});

// ── Show login error ──
function showError(message) {
  errorMsg.textContent = message;
  errorDiv.classList.remove('hidden');
}
function hideError() {
  errorDiv.classList.add('hidden');
}

// ── Login submit ──
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email = emailInput.value.trim();
  const senha = senhaInput.value;
  const lembrar = lembrarChk?.checked ?? false;

  if (!email || !senha) { showError('Preencha o e-mail e a senha.'); return; }

  // Loading state
  btnLogin.disabled = true;
  btnLoginTxt.classList.add('hidden');
  btnLoginSpn.classList.remove('hidden');

  try {
    await fazerLogin(email, senha, lembrar);
    // onAuthStateChanged in auth.js will handle redirect
    // but we navigate proactively
    window.location.href = 'dashboard.html';
  } catch (err) {
    let msg = 'E-mail ou senha inválidos.';
    if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde e tente novamente.';
    if (err.code === 'auth/network-request-failed') msg = 'Falha de conexão. Verifique sua internet.';
    showError(msg);
  } finally {
    btnLogin.disabled = false;
    btnLoginTxt.classList.remove('hidden');
    btnLoginSpn.classList.add('hidden');
  }
});

// ── Recover submit ──
recoverForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = recoverEmail.value.trim();
  if (!email) return;

  btnRecover.disabled = true;
  btnRecoverTxt.classList.add('hidden');
  btnRecoverSpn.classList.remove('hidden');

  try {
    await recuperarSenha(email);
    recoverMsg.className = 'lf-success';
    recoverMsg.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>Link enviado para <strong>${email}</strong>. Verifique sua caixa de entrada.</span>
    `;
    recoverMsg.classList.remove('hidden');
    recoverForm.querySelector('button[type=submit]').disabled = true;
  } catch (err) {
    recoverMsg.className = 'lf-error';
    recoverMsg.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>E-mail não encontrado. Verifique o endereço informado.</span>
    `;
    recoverMsg.classList.remove('hidden');
  } finally {
    btnRecover.disabled = false;
    btnRecoverTxt.classList.remove('hidden');
    btnRecoverSpn.classList.add('hidden');
  }
});

// ── Load stats for left panel ──
async function loadLoginStats() {
  try {
    const [osSnap, tecSnap] = await Promise.all([
      get(ref(database, 'ordensServico')),
      get(ref(database, 'tecnicos'))
    ]);
    const statOS  = document.getElementById('stat-os');
    const statTec = document.getElementById('stat-tec');
    if (statOS)  statOS.textContent  = osSnap.exists()  ? Object.keys(osSnap.val()).length  : '0';
    if (statTec) statTec.textContent = tecSnap.exists() ? Object.keys(tecSnap.val()).length : '0';
  } catch { /* non-critical */ }
}
loadLoginStats();

// ── Enter key on email focuses password ──
emailInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); senhaInput?.focus(); }
});
