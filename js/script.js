const KEY = 'os_sys_v1';
let db = JSON.parse(localStorage.getItem(KEY) || '[]');
let curFilter = 'all';
let curStatus = 'aberto';
let curTec = null;
let editId = null;
let curView = 'painel';

const TEC = {
  jhonatan: { label: 'Jhonatan', sub: 'Predial', av: 'av-j', initials: 'JH', phone: '5511985070553' },
  jorge: { label: 'Jorge F.', sub: 'Elétrica', av: 'av-jo', initials: 'JO', phone: '5511984610163' },
  hugo: { label: 'Zé Hugo', sub: 'Elétrica', av: 'av-zh', initials: 'ZH', phone: '5511985070529' }
};
const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Andamento', concluido: 'Concluído', assinando: 'Aguard. assinatura', fechado: 'Fechado' };
const PILL_CLASS = { aberto: 'p-aberto', andamento: 'p-andamento', concluido: 'p-concluido', assinando: 'p-assinando', fechado: 'p-fechado' };

let ssmaRespostas = { q1: null, q2: null, q3: null };
let pecas = [];

function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

function goView(v) {
  curView = v;
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.getElementById('nav-' + v)?.classList.add('active');
  document.getElementById('fab').style.display = v === 'os' ? 'flex' : 'none';
  if (v === 'painel') renderPainel();
  if (v === 'os') renderOSList();
  if (v === 'tec-link') renderTecSelect();
}

function openDrawer(id) {
  editId = id || null; curTec = null; curStatus = 'aberto';
  document.getElementById('drawer-title').textContent = id ? 'Editar OS' : 'Nova OS';
  document.getElementById('ov1').classList.add('show');
  document.getElementById('drawer-container1')?.classList.add('open') || document.getElementById('drawer1').classList.add('open');
  if (id) {
    const o = db.find(x => x.id === id);
    document.getElementById('f-chamado').value = o.chamado || '';
    document.getElementById('f-problema').value = o.problema || '';
    document.getElementById('f-esp').value = o.esp || 'Predial';
    document.getElementById('f-data').value = o.data || '';
    document.getElementById('f-area').value = o.area || '';
    document.getElementById('f-solicitante').value = o.solicitante || '';
    document.getElementById('f-desc').value = o.desc || '';
    curStatus = o.status || 'aberto';
    curTec = o.tec || null;
  } else {
    ['f-chamado', 'f-problema', 'f-area', 'f-solicitante', 'f-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-esp').value = 'Predial';
    document.getElementById('f-data').value = new Date().toISOString().slice(0, 10);
  }
  document.querySelectorAll('.tec-opt').forEach(e => e.classList.remove('sel'));
  if (curTec) {
    const map = { jhonatan: 'j', jorge: 'jo', hugo: 'zh' };
    document.getElementById('to-' + map[curTec])?.classList.add('sel');
  }
  document.querySelectorAll('.st').forEach(e => { e.className = 'st'; if (e.dataset.s === curStatus) e.classList.add('on-' + curStatus); });
}

function closeDrawer() {
  document.getElementById('ov1').classList.remove('show');
  document.getElementById('drawer-container1')?.classList.remove('open') || document.getElementById('drawer1').classList.remove('open');
}

function selTec(t) {
  curTec = t;
  document.querySelectorAll('.tec-opt').forEach(e => e.classList.remove('sel'));
  const map = { jhonatan: 'j', jorge: 'jo', hugo: 'zh' };
  document.getElementById('to-' + map[t])?.classList.add('sel');
}

function selStatus(el) {
  curStatus = el.dataset.s;
  document.querySelectorAll('.st').forEach(e => e.className = 'st');
  el.classList.add('on-' + curStatus);
}

function saveOS() {
  const prob = document.getElementById('f-problema').value.trim();
  if (!prob) { alert('Informe o tipo de problema.'); return; }
  const data = {
    chamado: document.getElementById('f-chamado').value.trim(),
    problema: prob,
    esp: document.getElementById('f-esp').value,
    data: document.getElementById('f-data').value,
    area: document.getElementById('f-area').value.trim(),
    solicitante: document.getElementById('f-solicitante').value.trim(),
    desc: document.getElementById('f-desc').value.trim(),
    tec: curTec,
    status: curStatus
  };
  if (editId) {
    const idx = db.findIndex(x => x.id === editId);
    db[idx] = { ...db[idx], ...data };
    toast('OS atualizada');
  } else {
    db.push({ id: 'os_' + Date.now(), ...data, sigTec: null, sigSol: null, sigAcomp: null, pecas: [], iniciada: null, concluida: null, tag: '', descEquipamento: '', acoesSsma: '', ssma: { q1: null, q2: null, q3: null } });
    toast('OS criada');
  }
  save(); closeDrawer();
  renderPainel(); renderOSList();
}

function renderPainel() {
  const tot = db.length;
  const open = db.filter(o => o.status === 'aberto').length;
  const prog = db.filter(o => o.status === 'andamento').length;
  const done = db.filter(o => ['concluido', 'assinando', 'fechado'].includes(o.status)).length;
  
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-l">Total</div><div class="kpi-v">${tot}</div><div class="kpi-s">desde o início</div></div>
    <div class="kpi"><div class="kpi-l">Em aberto</div><div class="kpi-v" style="color:var(--amber)">${open}</div><div class="kpi-s">aguardando execução</div></div>
    <div class="kpi"><div class="kpi-l">Andamento</div><div class="kpi-v" style="color:var(--accent)">${prog}</div><div class="kpi-s">sendo executadas</div></div>
    <div class="kpi"><div class="kpi-l">Concluídas</div><div class="kpi-v" style="color:var(--green)">${done}</div><div class="kpi-s">finalizadas</div></div>
  `;
  
  const cnt = {}; db.forEach(o => { cnt[o.problema] = (cnt[o.problema] || 0) + 1; });
  const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  const colors = ['#1A4480', '#1A6B3A', '#B45309', '#B91C1C', '#6B21A8', '#0E7490'];
  
  document.getElementById('prob-n').textContent = Object.keys(cnt).length + ' tipos';
  document.getElementById('prob-rank').innerHTML = sorted.length ? sorted.map(([p, n], i) => `
    <div class="rank-row">
      <span class="rank-n">${i + 1}</span>
      <span class="rank-name" title="${p}">${p}</span>
      <div class="rank-bar-w"><div class="rank-bar-f" style="width:${Math.round(n / max * 100)}%;background:${colors[i % colors.length]}"></div></div>
      <span class="rank-cnt">${n}</span>
    </div>`).join('') : '<div class="empty"><p>Nenhuma OS ainda.</p></div>';

  const months = {}; const ml = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = d.getFullYear() + '-' + (d.getMonth() + 1);
    months[k] = { l: ml[d.getMonth()], n: 0, cur: i === 0 };
  }
  db.forEach(o => { if (!o.data) return; const d = new Date(o.data); const k = d.getFullYear() + '-' + (d.getMonth() + 1); if (months[k]) months[k].n++; });
  const mv = Object.values(months); const mmax = Math.max(...mv.map(v => v.n), 1);
  
  document.getElementById('month-chart').innerHTML = mv.map(v => `
    <div class="month-col">
      <span class="mn">${v.n || ''}</span>
      <div class="bar-w"><div class="bar${v.cur ? ' cur' : ''}" style="height:${Math.round(v.n / mmax * 56) + 4}px"></div></div>
      <span class="ml">${v.l}</span>
    </div>`).join('');

  const ult = db.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 5);
  document.getElementById('ultimas-list').innerHTML = ult.length ? ult.map(o => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="goView('os')">
      <span style="font-size:11px;font-weight:700;color:var(--accent);font-family:monospace">${o.chamado || '—'}</span>
      <span style="flex:1;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.problema}</span>
      <span class="pill ${PILL_CLASS[o.status]}">${STATUS_LABEL[o.status]}</span>
    </div>`).join('') : '<div class="empty"><p>Nenhuma OS ainda.</p></div>';
}

function renderOSList() {
  renderDatalist();
  const rows = db.filter(o => curFilter === 'all' || o.status === curFilter).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const wrap = document.getElementById('os-list');
  if (!rows.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">🔧</div><p>Nenhuma OS nesta categoria.</p></div>'; return; }
  
  wrap.innerHTML = rows.map(o => {
    const tec = o.tec ? TEC[o.tec] : null;
    const tecHtml = tec ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px"><div class="tav ${tec.av}" style="width:20px;height:20px;font-size:9px">${tec.initials}</div>${tec.label}</div>` : '<span style="font-size:11px;color:var(--muted2)">Sem técnico</span>';
    const waLink = makeWALink(o);
    return `<div class="os-card" onclick="openDrawer('${o.id}')">
      <span class="os-num">${o.chamado || '—'}</span>
      <div class="os-info">
        <div class="os-desc">${o.problema}</div>
        <div class="os-meta">
          <span class="esp-tag">${o.esp}</span>
          <span>${o.area || '—'}</span>
          <span>${fmtDate(o.data)}</span>
          ${tecHtml}
        </div>
      </div>
      <div class="os-actions" onclick="event.stopPropagation()">
        <span class="pill ${PILL_CLASS[o.status]}">${STATUS_LABEL[o.status]}</span>
        ${o.tec ? `<a href="${waLink}" target="_blank" style="text-decoration:none"><button class="btn btn-sm" style="background:#25D366;color:#fff;border:none">📲 WA</button></a>` : ''}
        <button class="btn btn-sm btn-primary" onclick="gerarPDF('${o.id}')">📄 PDF</button>
      </div>
    </div>`;
  }).join('');
}

function makeWALink(os) {
  const tecObj = os.tec ? TEC[os.tec] : null;
  const phone = tecObj?.phone ? tecObj.phone : '';
  const baseUrl = window.location.href.split('?')[0];
  const linkTecnico = `${baseUrl}?os=${os.id}`;
  
  const msg = `*ORDEM DE SERVIÇO — ${os.chamado || 'S/N'}*\n\n` +
    `*Problema:* ${os.problema}\n` +
    `*Local:* ${os.area || '—'}\n` +
    `*Data:* ${fmtDate(os.data)}\n\n` +
    `Acesse para preencher e assinar:\n${linkTecnico}`;
    
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function setFilter(f, btn) {
  curFilter = f;
  document.querySelectorAll('.f-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderOSList();
}

function renderDatalist() {
  const probs = [...new Set(db.map(o => o.problema))];
  document.getElementById('prob-dl').innerHTML = probs.map(p => `<option value="${p}">`).join('');
}

function renderTecSelect() {
  const sel = document.getElementById('tec-os-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— escolha uma OS —</option>' + db.map(o => `<option value="${o.id}">${o.chamado || '?'} — ${o.problema}</option>`).join('');
}

function setSSMA(campo, valor) {
  ssmaRespostas[campo] = valor;
  document.querySelectorAll(`[data-q="${campo}"]`).forEach(btn => btn.classList.remove('active'));
  if (valor !== null) {
    document.querySelector(`[data-q="${campo}"][data-v="${valor}"]`)?.classList.add('active');
  }
}

function renderTecPage(id) {
  if (!id) return;
  const o = db.find(x => x.id === id);
  if (!o) return;
  
  pecas = o.pecas ? [...o.pecas] : [];
  ssmaRespostas = o.ssma ? { ...o.ssma } : { q1: null, q2: null, q3: null };
  
  const wrap = document.getElementById('tec-page-wrap');
  wrap.innerHTML = buildTecPage(o);
  initCanvases(id);
  
  if (ssmaRespostas.q1 !== null) setSSMA('q1', ssmaRespostas.q1);
  if (ssmaRespostas.q2 !== null) setSSMA('q2', ssmaRespostas.q2);
  if (ssmaRespostas.q3 !== null) setSSMA('q3', ssmaRespostas.q3);
}

function buildTecPage(o) {
  return `<div class="tec-page">
    <header class="tec-header">
      <div class="tec-os-num">Chamado ${o.chamado || 'S/N'} · ${o.esp}</div>
      <div class="tec-os-title">${o.problema}</div>
      <div class="tec-os-sub">${o.area || '—'} · Solicitante: ${o.solicitante || '—'}</div>
    </header>
    <section class="tec-section">
      <div class="tec-section-title">Identificação do Equipamento</div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-bottom:4px;">
        <div class="field"><label>TAG</label><input id="tec-tag" placeholder="Ex: N/A ou Código" value="${o.tag || ''}"></div>
        <div class="field"><label>Descrição do Equipamento</label><input id="tec-desc-equip" placeholder="Ex: Compressor de Ar" value="${o.descEquipamento || ''}"></div>
      </div>
    </section>
    <section class="tec-section">
      <div class="tec-section-title">Preparativos de Segurança / SSMA</div>
      <div class="ssma-item"><div class="ssma-text">1. Os preparativos de sinalização e bloqueio foram tomados?</div><div class="ssma-buttons"><button class="ssma-btn yes" data-q="q1" data-v="SIM" onclick="setSSMA('q1','SIM')">SIM</button><button class="ssma-btn no" data-q="q1" data-v="NÃO" onclick="setSSMA('q1','NÃO')">NÃO</button></div></div>
      <div class="ssma-item"><div class="ssma-text">2. A área foi isolada/sinalizada corretamente com fita/cones?</div><div class="ssma-buttons"><button class="ssma-btn yes" data-q="q2" data-v="SIM" onclick="setSSMA('q2','SIM')">SIM</button><button class="ssma-btn no" data-q="q2" data-v="NÃO" onclick="setSSMA('q2','NÃO')">NÃO</button></div></div>
      <div class="ssma-item"><div class="ssma-text">3. O equipamento foi devidamente desenergizado ou identificado com TAG?</div><div class="ssma-buttons"><button class="ssma-btn yes" data-q="q3" data-v="SIM" onclick="setSSMA('q3','SIM')">SIM</button><button class="ssma-btn no" data-q="q3" data-v="NÃO" onclick="setSSMA('q3','NÃO')">NÃO</button></div></div>
      <div class="field" style="margin-top:12px;"><label>Caso alguma das respostas tenha sido "não", indique quais as ações tomadas:</label><textarea id="tec-acoes-ssma" placeholder="Descreva as ações de contingência ou justificativa..." style="height:60px;">${o.acoesSsma || ''}</textarea></div>
    </section>
    <section class="tec-section">
      <div class="tec-section-title">Tempos de Execução</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="field"><label>Início do Conserto</label><input type="datetime-local" id="tec-inicio" value="${o.iniciada || ''}"></div><div class="field"><label>Fim do Conserto</label><input type="datetime-local" id="tec-fim" value="${o.concluida || ''}"></div></div>
      <div class="field"><label>Relatório Técnico / Serviço Realizado</label><textarea id="tec-servico" placeholder="Descreva lo que foi feito com detalhes...">${o.servicoRealizado || ''}</textarea></div>
    </section>
    <section class="tec-section">
      <div class="tec-section-title">Peças Utilizadas</div>
      <div class="pecas-list" id="pecas-list-tec"></div>
      <button class="btn-add-peca" onclick="addPeca()">+ Adicionar Peça</button>
    </section>
    <section class="tec-section">
      <div class="tec-section-title">Assinaturas</div>
      <div class="sig-wrap"><canvas class="sig-canvas" id="sig-tec" height="100"></canvas><div class="sig-placeholder" id="ph-tec">✍ Assine Técnico</div></div>
      <button class="btn-clear" onclick="clearSig('sig-tec','ph-tec')">Limpar</button>
      <div class="sig-wrap"><canvas class="sig-canvas" id="sig-sol" height="100"></canvas><div class="sig-placeholder" id="ph-sol">✍ Assine Solicitante</div></div>
      <button class="btn-clear" onclick="clearSig('sig-sol','ph-sol')">Limpar</button>
    </section>
    <footer style="display:flex;gap:8px;"><button class="btn btn-green" style="flex:1" onclick="confirmarOS('${o.id}')">✔ Salvar Dados</button><button class="btn btn-primary" onclick="gerarPDF('${o.id}')" style="flex:1">📄 Gerar PDF</button></footer>
  </div>`;
}

function addPeca() { pecas.push({ cod: '', desc: '', qtd: '' }); renderPecasList(); }
function removePeca(i) { pecas.splice(i, 1); renderPecasList(); }
function renderPecasList() {
  const el = document.getElementById('pecas-list-tec');
  if (!el) return;
  el.innerHTML = pecas.map((p, i) => `
    <div class="peca-row">
      <input placeholder="Cod" value="${p.cod}" oninput="pecas[${i}].cod=this.value">
      <input placeholder="Desc" value="${p.desc}" oninput="pecas[${i}].desc=this.value">
      <input placeholder="Qtd" value="${p.qtd}" oninput="pecas[${i}].qtd=this.value">
      <button class="peca-del" onclick="removePeca(${i})">✕</button>
    </div>`).join('');
}

function initCanvases(osId) {
  const os = db.find(x => x.id === osId);
  ['sig-tec', 'sig-sol', 'sig-acomp'].forEach((cid, i) => {
    const canvas = document.getElementById(cid);
    if (!canvas) return;
    const ph = document.getElementById(['ph-tec', 'ph-sol', 'ph-acomp'][i]);
    canvas.width = canvas.offsetWidth || 380;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1C1C1A'; ctx.lineWidth = 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const savedSig = os ? [os.sigTec, os.sigSol, os.sigAcomp][i] : null;
    if (savedSig) { const img = new Image(); img.src = savedSig; img.onload = () => { ctx.drawImage(img, 0, 0); }; ph.classList.add('hidden'); }
    
    let drawing = false, lx = 0, ly = 0;
    function pos(e) { const r = canvas.getBoundingClientRect(); const s = e.touches ? e.touches[0] : e; return { x: (s.clientX - r.left) * (canvas.width / r.width), y: (s.clientY - r.top) * (canvas.height / r.height) }; }
    canvas.onmousedown = (e) => { drawing = true; const p = pos(e); lx = p.x; ly = p.y; ph.classList.add('hidden'); };
    canvas.onmousemove = (e) => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke(); lx = p.x; ly = p.y; };
    canvas.onmouseup = () => drawing = false;
  });
  renderPecasList();
}

function clearSig(cid, phid) { const c = document.getElementById(cid); c.getContext('2d').clearRect(0, 0, c.width, c.height); document.getElementById(phid).classList.remove('hidden'); }
function getSig(cid) { const c = document.getElementById(cid); return c ? c.toDataURL('image/png') : null; }

function confirmarOS(id) {
  const os = db.find(x => x.id === id); if (!os) return;
  os.sigTec = getSig('sig-tec'); os.sigSol = getSig('sig-sol'); os.pecas = [...pecas];
  os.iniciada = document.getElementById('tec-inicio').value; os.concluida = document.getElementById('tec-fim').value;
  os.servicoRealizado = document.getElementById('tec-servico').value; os.ssma = { ...ssmaRespostas };
  os.status = 'assinando'; save(); toast('Dados salvos!');
}

function gerarPDF(id) { /* Mantenha sua função gerarPDF original aqui */ }
function fmtDate(d) { if (!d) return '—'; return new Date(d + 'T12:00').toLocaleDateString('pt-BR'); }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }

window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const osIsoladaId = urlParams.get('os');
  if (osIsoladaId) {
    document.querySelector('.sidebar-container')?.style.setProperty('display', 'none');
    document.getElementById('tec-os-select')?.parentElement?.style.setProperty('display', 'none');
    goView('tec-link');
    renderTecPage(osIsoladaId);
  } else { renderPainel(); }
};
