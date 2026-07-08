import { buscarConvite, finalizarCadastro } from "./auth.js";

const params = new URLSearchParams(window.location.search);
const token = params.get('convite');

const perfilEl = document.getElementById('cad-perfil');
const msgEl = document.getElementById('cad-msg');
const form = document.getElementById('cad-form');
const btn = document.getElementById('cad-btn');

function mostrarMsg(texto, tipo) {
  msgEl.textContent = texto;
  msgEl.className = tipo;
  msgEl.style.display = 'block';
}

async function init() {
  if (!token) {
    perfilEl.textContent = 'Link inválido.';
    form.style.display = 'none';
    return;
  }
  const convite = await buscarConvite(token);
  if (!convite) {
    perfilEl.textContent = '⚠️ Convite não encontrado.';
    form.style.display = 'none';
    return;
  }
  if (convite.usado) {
    perfilEl.textContent = '⚠️ Este convite já foi utilizado.';
    form.style.display = 'none';
    return;
  }
  const rotulo = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuário (Solicitante)' };
  perfilEl.textContent = `Convite para: ${convite.nome} — perfil: ${rotulo[convite.role] || convite.role}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const senha2 = document.getElementById('cad-senha2').value;

  const senhaForte = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(senha);
  if (!senhaForte) { mostrarMsg('A senha precisa ter 8+ caracteres, com letra e número.', 'erro'); return; }
  if (senha !== senha2) { mostrarMsg('As senhas não coincidem.', 'erro'); return; }

  btn.disabled = true;
  btn.textContent = 'Criando...';
  try {
    await finalizarCadastro(token, email, senha);
    mostrarMsg('✔ Acesso criado com sucesso! Redirecionando para o login...', 'ok');
    setTimeout(() => { window.location.href = 'index.html'; }, 1800);
  } catch (err) {
    mostrarMsg(err.message?.includes('email-already') ? 'Este e-mail já está em uso.' : 'Não foi possível criar o acesso: ' + err.message, 'erro');
    btn.disabled = false;
    btn.textContent = 'Criar acesso';
  }
});

init();
