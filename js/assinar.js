/* =======================================================
   SISTEMA OS v2 — Assinar (public PIN confirmation)
   No auth required. Token + PIN = double validation.
   ======================================================= */

import { database } from './firebase.js';
import { ref, get, update } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

// ── State ──
const params = new URLSearchParams(location.search);
const token  = params.get('t');

let pinData = null;

// ── Show a state panel ──
function showState(id) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// ── Device helpers ──
function obterDispositivo(ua = '') {
  if (/Android/i.test(ua))        return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua))        return 'Windows PC';
  if (/Mac/i.test(ua))            return 'Mac';
  if (/Linux/i.test(ua))          return 'Linux';
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

// ── Init ──
async function init() {
  if (!token) {
    document.getElementById('error-msg').textContent = 'Nenhum token encontrado. Link inválido.';
    showState('state-error');
    return;
  }

  try {
    const snap = await get(ref(database, `pins/${token}`));
    if (!snap.exists()) {
      document.getElementById('error-msg').textContent = 'Este link não existe ou expirou.';
      showState('state-error');
      return;
    }

    pinData = snap.val();

    // Validate expiry
    if (pinData.expiraEm && new Date() > new Date(pinData.expiraEm)) {
      document.getElementById('error-msg').textContent = 'Este link expirou. Peça ao técnico um novo link.';
      showState('state-error');
      return;
    }

    // Already confirmed
    if (pinData.confirmado) {
      showState('state-already');
      return;
    }

    // Show form
    const num = String(pinData.osNumero || '').padStart(5, '0');
    document.getElementById('sum-num').textContent   = `OS #${num}`;
    document.getElementById('sum-title').textContent = pinData.osTitulo    || 'Sem título';
    document.getElementById('sum-sol').textContent   = pinData.solicitante || '—';
    document.getElementById('sum-tec').textContent   = pinData.tecNome     || '—';

    renderPinInputs();
    setupConfirmButton();
    showState('state-form');

  } catch(e) {
    console.error(e);
    document.getElementById('error-msg').textContent = 'Erro ao verificar o link. Tente novamente.';
    showState('state-error');
  }
}

// ── Render 6-digit inputs ──
function renderPinInputs() {
  const wrap = document.getElementById('pin-inputs-sol');
  if (!wrap) return;
  wrap.innerHTML = Array.from({length: 6}, (_, i) => `
    <input
      type="number" min="0" max="9"
      id="spi-${i}"
      oninput="this.value=this.value.slice(-1);document.getElementById('spi-${i+1}')?.focus()"
      onkeydown="if(event.key==='Backspace'&&!this.value)document.getElementById('spi-${i-1}')?.focus()"
    >
  `).join('');
  document.getElementById('spi-0')?.focus();
}

function getPinFromInputs() {
  return Array.from({length:6}, (_,i) => document.getElementById(`spi-${i}`)?.value || '').join('');
}

// ── Setup confirm button ──
function setupConfirmButton() {
  const btn = document.getElementById('btn-confirmar-sol');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const digitado = getPinFromInputs();
    const errEl    = document.getElementById('pin-error');

    if (digitado.length < 6) {
      errEl.textContent = 'Digite todos os 6 dígitos.';
      errEl.classList.remove('hidden');
      return;
    }

    if (digitado !== pinData.codigo) {
      errEl.textContent = 'PIN incorreto. Verifique e tente novamente.';
      errEl.classList.remove('hidden');
      // Shake effect
      const wrap = document.getElementById('pin-inputs-sol');
      wrap.style.animation = 'none';
      setTimeout(() => { wrap.style.animation = ''; }, 10);
      return;
    }

    errEl.classList.add('hidden');
    btn.disabled    = true;
    btn.textContent = 'Confirmando...';

    const now       = new Date().toISOString();
    const ua        = navigator.userAgent;
    const dispositivo = obterDispositivo(ua);
    const navegador   = obterNavegador(ua);

    try {
      // Mark pin as confirmed
      await update(ref(database, `pins/${token}`), {
        confirmado:     true,
        confirmacaoData: now,
        userAgent:       ua
      });

      // Save confirmation to the OS record
      if (pinData.osId) {
        await update(ref(database, `ordensServico/${pinData.osId}`), {
          confirmacaoSol: {
            confirmado:  true,
            nome:        pinData.solicitante || 'Solicitante',
            data:        now,
            userAgent:   ua,
            dispositivo,
            navegador
          },
          'pinSolicitante/confirmado': true
        });
      }

      // Show success
      const num = String(pinData.osNumero || '').padStart(5, '0');
      document.getElementById('audit-box').innerHTML = `
        <div><strong>OS:</strong> #${num} — ${pinData.osTitulo || ''}</div>
        <div><strong>Confirmado por:</strong> ${pinData.solicitante || 'Solicitante'}</div>
        <div><strong>Data/hora:</strong> ${new Date(now).toLocaleString('pt-BR')}</div>
        <div><strong>Dispositivo:</strong> ${dispositivo}</div>
        <div><strong>Navegador:</strong> ${navegador}</div>
      `;
      showState('state-success');

    } catch(e) {
      console.error(e);
      btn.disabled    = false;
      btn.textContent = 'Confirmar Recebimento';
      errEl.textContent = 'Erro ao confirmar. Tente novamente.';
      errEl.classList.remove('hidden');
    }
  });
}

init();
