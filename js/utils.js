
export function fmtDate(d) { 
  if (!d) return '—'; 
  try { 
    return new Date(d + 'T12:00').toLocaleDateString('pt-BR'); 
  } catch { 
    return d; 
  } 
}

export function toast(msg) { 
  const t = document.getElementById('toast'); 
  if (!t) return;
  t.textContent = msg; 
  t.classList.add('show'); 
  setTimeout(() => t.classList.remove('show'), 2800); 
}

export function addHistorico(os, evento, usuario) {
  if (!os.historico) os.historico = [];
  os.historico.push({
    data: new Date().toISOString(),
    evento,
    usuario
  });
}