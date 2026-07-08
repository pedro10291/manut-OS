/* =======================================================
   SISTEMA OS v2 — Auth Module
   Firebase Authentication + Guards + Password Recovery
   + First Admin + Session Persistence
   ======================================================= */

import { database, auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  ref, get, set, runTransaction
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

// ── State ──
let currentUser = null; // { uid, email, nome, role, tecId, ... }
let inactivityTimer = null;
const INACTIVITY_MINUTES = 45;

// ── Public: Get current user ──
export function getUsuarioAtual() {
  return currentUser;
}

// ── Public: Sign in ──
export async function fazerLogin(email, senha, lembrar = false) {
  const persistence = lembrar ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

// ── Public: Sign out ──
export async function fazerLogout() {
  clearTimeout(inactivityTimer);
  currentUser = null;
  await signOut(auth);
  window.location.href = 'login.html';
}

// ── Public: Password reset ──
export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Public: Create invite ──
export async function criarConvite({ nome, role, email, tecId = null }) {
  const token = crypto.randomUUID().replace(/-/g, '');
  await set(ref(database, `convites/${token}`), {
    nome, role, email: email || null, tecId,
    usado: false, criadoEm: new Date().toISOString(),
    criadoPor: currentUser?.uid || null
  });
  return token;
}

// ── Public: Get invite ──
export async function buscarConvite(token) {
  const snap = await get(ref(database, `convites/${token}`));
  return snap.exists() ? { ...snap.val(), token } : null;
}

// ── Public: Complete registration via invite ──
export async function finalizarCadastro(token, email, senha) {
  const convite = await buscarConvite(token);
  if (!convite)       throw new Error('Convite inválido ou expirado.');
  if (convite.usado)  throw new Error('Este convite já foi utilizado.');

  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  const uid = cred.user.uid;

  await set(ref(database, `usuarios/${uid}`), {
    nome: convite.nome,
    role: convite.role,
    tecId: convite.tecId || null,
    email,
    ativo: true,
    criadoEm: new Date().toISOString(),
    conviteToken: token
  });
  await set(ref(database, `convites/${token}/usado`), true);
  return cred.user;
}

// ── Load profile from DB ──
async function carregarPerfil(uid) {
  const snap = await get(ref(database, `usuarios/${uid}`));
  return snap.exists() ? snap.val() : null;
}

// ── Auto-create first admin ──
async function verificarPrimeiroAdmin(user) {
  const snap = await get(ref(database, 'usuarios'));
  const total = snap.exists() ? Object.keys(snap.val()).length : 0;
  if (total > 0) return null;

  const perfil = {
    nome: user.email.split('@')[0],
    role: 'admin',
    tecId: null,
    email: user.email,
    ativo: true,
    criadoEm: new Date().toISOString(),
    criadoAutomaticamente: true
  };
  await set(ref(database, `usuarios/${user.uid}`), perfil);
  return perfil;
}

// ── Inactivity control ──
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  if (!currentUser) return;
  inactivityTimer = setTimeout(() => {
    alert('Sessão encerrada por inatividade. Faça login novamente.');
    fazerLogout();
  }, INACTIVITY_MINUTES * 60 * 1000);
}

function startActivityMonitor() {
  ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach(evt =>
    document.addEventListener(evt, resetInactivityTimer, { passive: true })
  );
  resetInactivityTimer();
}

// ── Route Guard ──
// Call on every protected page, at page load.
// allowedRoles: array e.g. ['admin'] or ['admin','tecnico']
// onReady(user): callback when auth is confirmed and role is valid
export function requireAuth(allowedRoles, onReady) {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      window.location.href = 'login.html';
      return;
    }

    let perfil = await carregarPerfil(firebaseUser.uid);

    // First admin auto-creation
    if (!perfil) {
      perfil = await verificarPrimeiroAdmin(firebaseUser);
      if (!perfil) {
        alert('Sua conta não tem perfil configurado. Contate o administrador.');
        await signOut(auth);
        window.location.href = 'login.html';
        return;
      }
    }

    // Check if account is active
    if (perfil.ativo === false) {
      alert('Sua conta foi desativada. Contate o administrador.');
      await signOut(auth);
      window.location.href = 'login.html';
      return;
    }

    // Role check
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(perfil.role)) {
      window.location.href = 'dashboard.html'; // redirect to allowed area
      return;
    }

    currentUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      ...perfil
    };

    startActivityMonitor();
    unsubscribe(); // stop listening after first valid auth
    if (onReady) onReady(currentUser);
  });
}

// ── Login-page guard (redirect if already logged in) ──
export function redirectIfLoggedIn(destination = 'dashboard.html') {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      unsubscribe();
      return;
    }
    const perfil = await carregarPerfil(firebaseUser.uid);
    if (perfil && perfil.ativo !== false) {
      unsubscribe();
      window.location.href = destination;
    } else {
      unsubscribe();
    }
  });
}

// ── Presence: mark technician online ──
export async function marcarPresenca(uid) {
  // Uses Realtime DB to track last seen
  const presRef = ref(database, `presenca/${uid}`);
  await set(presRef, {
    online: true,
    ultimaVez: new Date().toISOString(),
    uid
  });
  // Mark offline on disconnect
  const { onDisconnect } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js');
  onDisconnect(presRef).update({ online: false, ultimaVez: new Date().toISOString() });
}
