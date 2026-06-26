const KEY = 'os_sys_v1';
let db = JSON.parse(localStorage.getItem(KEY) || '[]');
let curFilter = 'all';
let curStatus = 'aberto';
let curTec = null;
let editId = null;
let curView = 'painel';

// 1. ADICIONADO O CAMPO 'phone' FORMATADO PARA CADA TÉCNICO
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

// 2. FUNÇÃO ATUALIZADA PARA ENVIAR MENSAGEM COM O ID ESPECÍFICO VIA QUERY STRING (?os=ID)
function makeWALink(os) {
  const tecObj = os.tec ? TEC[os.tec] : null;
  const phone = tecObj?.phone ? tecObj.phone : '';
  
  // Remove qualquer parâmetro antigo da URL base para gerar o link limpo
  const baseUrl = window.location.href.split('?')[0];
  const linkTecnico = `${baseUrl}?os=${os.id}`;
  
  const msg = `*ORDEM DE SERVIÇO — ${os.chamado || 'S/N'}*\n\n` +
    `*Problema:* ${os.problema}\n` +
    `*Local:* ${os.area || '—'}\n` +
    `*Data:* ${fmtDate(os.data)}\n\n` +
    `Acesse para preencher e assinar:\n${linkTecnico}`;
    
  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  } else {
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }
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
      <div class="ssma-item">
        <div class="ssma-text">1. Os preparativos de sinalização e bloqueio foram tomados?</div>
        <div class="ssma-buttons">
          <button class="ssma-btn yes" data-q="q1" data-v="SIM" onclick="setSSMA('q1','SIM')">SIM</button>
          <button class="ssma-btn no" data-q="q1" data-v="NÃO" onclick="setSSMA('q1','NÃO')">NÃO</button>
        </div>
      </div>
      <div class="ssma-item">
        <div class="ssma-text">2. A área foi isolada/sinalizada corretamente com fita/cones?</div>
        <div class="ssma-buttons">
          <button class="ssma-btn yes" data-q="q2" data-v="SIM" onclick="setSSMA('q2','SIM')">SIM</button>
          <button class="ssma-btn no" data-q="q2" data-v="NÃO" onclick="setSSMA('q2','NÃO')">NÃO</button>
        </div>
      </div>
      <div class="ssma-item">
        <div class="ssma-text">3. O equipamento foi devidamente desenergizado ou identificado com TAG?</div>
        <div class="ssma-buttons">
          <button class="ssma-btn yes" data-q="q3" data-v="SIM" onclick="setSSMA('q3','SIM')">SIM</button>
          <button class="ssma-btn no" data-q="q3" data-v="NÃO" onclick="setSSMA('q3','NÃO')">NÃO</button>
        </div>
      </div>
      
      <div class="field" style="margin-top:12px;">
        <label>Caso alguma das respostas tenha sido "não", indique quais as ações tomadas:</label>
        <textarea id="tec-acoes-ssma" placeholder="Descreva as ações de contingência ou justificativa..." style="height:60px;">${o.acoesSsma || ''}</textarea>
      </div>
    </section>

    <section class="tec-section">
      <div class="tec-section-title">Tempos de Execução</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="field"><label>Início do Conserto</label><input type="datetime-local" id="tec-inicio" value="${o.iniciada || ''}"></div>
        <div class="field"><label>Fim do Conserto</label><input type="datetime-local" id="tec-fim" value="${o.concluida || ''}"></div>
      </div>
      <div class="field"><label>Relatório Técnico / Serviço Realizado</label><textarea id="tec-servico" placeholder="Descreva lo que foi feito com detalhes...">${o.servicoRealizado || ''}</textarea></div>
    </section>

    <section class="tec-section">
      <div class="tec-section-title">Peças Utilizadas</div>
      <div class="pecas-list" id="pecas-list-tec"></div>
      <button class="btn-add-peca" onclick="addPeca()">+ Adicionar Peça</button>
    </section>

    <section class="tec-section">
      <div class="tec-section-title">Assinatura Executante (Técnico)</div>
      <div class="sig-wrap"><canvas class="sig-canvas" id="sig-tec" height="100"></canvas><div class="sig-placeholder" id="ph-tec">✍ Assine com o dedo ou mouse</div></div>
      <div class="sig-actions"><button class="btn-clear" onclick="clearSig('sig-tec','ph-tec')">Limpar</button></div>
    </section>

    <section class="tec-section">
      <div class="tec-section-title">Assinatura Solicitante (Área)</div>
      <div class="sig-wrap"><canvas class="sig-canvas" id="sig-sol" height="100"></canvas><div class="sig-placeholder" id="ph-sol">✍ Assine aqui</div></div>
      <div class="sig-actions"><button class="btn-clear" onclick="clearSig('sig-sol','ph-sol')">Limpar</button></div>
    </section>

    <section class="tec-section">
      <div class="tec-section-title">Acompanhante de Manutenção (Opcional)</div>
      <div class="sig-wrap"><canvas class="sig-canvas" id="sig-acomp" height="100"></canvas><div class="sig-placeholder" id="ph-acomp">✍ Assine aqui</div></div>
      <div class="sig-actions"><button class="btn-clear" onclick="clearSig('sig-acomp','ph-acomp')">Limpar</button></div>
    </section>

    <footer style="display:flex;gap:8px;">
      <button class="btn btn-green" style="flex:1" onclick="confirmarOS('${o.id}')">✔ Salvar Dados</button>
      <button class="btn btn-primary" onclick="gerarPDF('${o.id}')" style="flex:1">📄 Gerar PDF</button>
    </footer>
  </div>`;
}

function addPeca() {
  pecas.push({ cod: '', desc: '', qtd: '' });
  renderPecasList();
}
function removePeca(i) { pecas.splice(i, 1); renderPecasList(); }
function renderPecasList() {
  const el = document.getElementById('pecas-list-tec');
  if (!el) return;
  el.innerHTML = pecas.map((p, i) => `
    <div class="peca-row">
      <input placeholder="Código" value="${p.cod}" oninput="pecas[${i}].cod=this.value">
      <input placeholder="Descrição" value="${p.desc}" oninput="pecas[${i}].desc=this.value">
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
    ctx.strokeStyle = '#1C1C1A'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    // Recupera e renderiza a assinatura salva anteriormente se ela existir
    const savedSig = os ? [os.sigTec, os.sigSol, os.sigAcomp][i] : null;
    if (savedSig) {
      const img = new Image();
      img.src = savedSig;
      img.onload = () => { ctx.drawImage(img, 0, 0); };
      ph.classList.add('hidden'); // Esconde a mensagem de placeholder
    }

    let drawing = false, lx = 0, ly = 0;
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - r.left) * (canvas.width / r.width), y: (src.clientY - r.top) * (canvas.height / r.height) };
    }
    function start(e) { e.preventDefault(); drawing = true; const p = pos(e); lx = p.x; ly = p.y; ph.classList.add('hidden'); }
    function draw(e) { e.preventDefault(); if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke(); lx = p.x; ly = p.y; }
    function end() { drawing = false; }
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', end);
  });
  pecas = os?.pecas ? [...os.pecas] : [];
  renderPecasList();
}

function clearSig(cid, phid) {
  const c = document.getElementById(cid); if (!c) return;
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  document.getElementById(phid)?.classList.remove('hidden');
}

function getSig(cid) {
  const c = document.getElementById(cid); if (!c) return null;
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const hasContent = [...d].some((v, i) => i % 4 === 3 && v > 0);
  return hasContent ? c.toDataURL('image/png') : null;
}

function confirmarOS(id) {
  const os = db.find(x => x.id === id); if (!os) return;
  
  // Captura e armazena permanentemente os dados das assinaturas no objeto global da OS
  os.sigTec = getSig('sig-tec') || os.sigTec;
  os.sigSol = getSig('sig-sol') || os.sigSol;
  os.sigAcomp = getSig('sig-acomp') || os.sigAcomp;
  
  os.pecas = [...pecas];
  os.iniciada = document.getElementById('tec-inicio')?.value || null;
  os.concluida = document.getElementById('tec-fim')?.value || null;
  os.servicoRealizado = document.getElementById('tec-servico')?.value || '';
  
  os.tag = document.getElementById('tec-tag')?.value.trim() || '';
  os.descEquipamento = document.getElementById('tec-desc-equip')?.value.trim() || '';
  os.acoesSsma = document.getElementById('tec-acoes-ssma')?.value.trim() || '';
  
  os.ssma = { ...ssmaRespostas };
  if (os.sigTec || os.sigSol) os.status = 'assinando';
  
  save();
  toast('Dados operacionais e segurança salvos! ✔');
  
  // Se estiver acessando de fora do link isolado, atualiza a listagem geral
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get('os')) {
    renderOSList();
  }
}

function gerarPDF(id) {
  const os = db.find(x => x.id === id); if (!os) return;
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('Biblioteca de PDF carregando. Aguarde.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 12, cw = W - M * 2;

  function cell(x, y, w, h, text, opts = {}) {
    if (opts.fill) doc.setFillColor(...(opts.fill));
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
    if (opts.fill) doc.rect(x, y, w, h, 'FD'); else doc.rect(x, y, w, h, 'S');
    if (text !== undefined && text !== null && text !== '') {
      doc.setFontSize(opts.fs || 8); doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(...(opts.tc || [30, 30, 30]));
      const align = opts.align || 'left';
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 2 : x + 2;
      doc.text(String(text), tx, y + h / 2 + (opts.fs / 2 * 0.35), { align, baseline: 'middle', maxWidth: w - 4 });
    }
  }
  function hdr(x, y, w, h, text) { cell(x, y, w, h, text, { fill: [26, 68, 128], tc: [255, 255, 255], bold: true, fs: 8, align: 'center' }); }
  function lbl(x, y, w, h, text) { cell(x, y, w, h, text, { fill: [235, 240, 248], tc: [26, 68, 128], bold: true, fs: 7.5 }); }
  function val(x, y, w, h, text) { cell(x, y, w, h, text, { fs: 8 }); }

  let y = M;
  hdr(M, y, cw, 8, 'ORDEM DE SERVIÇO — F-ZZ-181B-0020'); y += 8;
  lbl(M, y, 30, 6, 'N° OS / Chamado'); val(M + 30, y, 40, 6, os.chamado || '—');
  lbl(M + 70, y, 30, 6, 'Tipo de Serviço'); val(M + 100, y, 40, 6, 'CORRETIVA');
  lbl(M + 140, y, 22, 6, 'Especialidade'); val(M + 162, y, cw - 150, 6, os.esp || '—'); y += 6;
  lbl(M, y, 30, 6, 'Data de Abertura'); val(M + 30, y, 40, 6, fmtDate(os.data));
  lbl(M + 70, y, 30, 6, 'Solicitante'); val(M + 100, y, cw - 100, 6, os.solicitante || '—'); y += 6;
  lbl(M, y, 30, 6, 'Local / Área'); val(M + 30, y, cw - 30, 6, os.area || '—'); y += 6;
  lbl(M, y, 30, 6, 'Técnico'); val(M + 30, y, cw - 30, 6, os.tec ? TEC[os.tec].label : '—'); y += 8;

  hdr(M, y, cw, 6, 'TAG: Descrição do Equipamento'); y += 6;
  lbl(M, y, 20, 7, 'TAG:'); val(M + 20, y, 45, 7, os.tag || '—');
  lbl(M + 65, y, 35, 7, 'Desc. Equipamento:'); val(M + 100, y, cw - 100, 7, os.descEquipamento || '—'); y += 8;
  
  hdr(M, y, cw, 6, 'Motivo / Sintoma'); y += 6;
  val(M, y, cw, 7, os.problema || '—'); y += 8;

  hdr(M, y, cw, 6, 'Preparativos de Segurança / SSMA'); y += 6;
  const s = os.ssma || { q1: null, q2: null, q3: null };
  const chk = [
    { q: 'Os preparativos de sinalização e bloqueio foram tomados?', v: s.q1 },
    { q: 'A área foi isolada/sinalizada corretamente com fita/cones?', v: s.q2 },
    { q: 'O equipamento foi devidamente desenergizado ou identificado com TAG?', v: s.q3}
  ];
  chk.forEach(item => {
    lbl(M, y, cw - 30, 5.5, item.q);
    let txt = '[   ] SIM   [   ] NÃO';
    if (item.v === 'SIM') txt = '[ X ] SIM   [   ] NÃO';
    if (item.v === 'NÃO') txt = '[   ] SIM   [ X ] NÃO';
    cell(M + cw - 30, y, 30, 5.5, txt, { fs: 7.5, align: 'center', bold: true });
    y += 5.5;
  });
  
  lbl(M, y, cw, 5, 'Caso alguma das respostas tenha sido "não", indique quais as ações tomadas:'); y += 5;
  val(M, y, cw, 6.5, os.acoesSsma || '—'); y += 8.5;

  hdr(M, y, cw, 6, 'Descrição do Serviço a ser Realizado (Solicitação)'); y += 6;
  const dLines = doc.splitTextToSize(os.desc || 'Nenhuma descrição detalhada.', cw - 4);
  const dH = Math.max(12, dLines.length * 4 + 4); cell(M, y, cw, dH, '');
  doc.text(dLines, M + 2, y + 4); y += dH;

  hdr(M, y, cw, 6, 'Descrição do Serviço Efetivamente Realizado (Relatório Técnico)'); y += 6;
  const srLines = doc.splitTextToSize(os.servicoRealizado || 'Aguardando preenchimento do relatório técnico.', cw - 4);
  const srH = Math.max(12, srLines.length * 4 + 4); cell(M, y, cw, srH, '');
  doc.text(srLines, M + 2, y + 4); y += srH;

  hdr(M, y, cw, 6, 'Tempos de Execução e Ocorrência'); y += 6;
  const cW1 = 46, cW2 = 35, cW3 = 35, cW4 = 35, cW5 = 35;
  lbl(M, y, cW1, 5, 'Etapa'); lbl(M + cW1, y, cW2, 5, 'Data'); lbl(M + cW1 + cW2, y, cW3, 5, 'Hora'); lbl(M + cW1 + cW2 + cW3, y, cW4, 5, 'Data'); lbl(M + cW1 + cW2 + cW3 + cW4, y, cW5, 5, 'Hora'); y += 5;
  lbl(M, y, cW1, 5, 'Início da Ocorrência'); val(M + cW1, y, cW2, 5, fmtDate(os.data)); val(M + cW1 + cW2, y, cW3, 5, '—'); lbl(M + cW1 + cW2 + cW3, y, cW4, 5, 'Fim Ocorrência'); val(M + cW1 + cW2 + cW3 + cW4, y, cW5, 5, '—'); y += 5;
  lbl(M, y, cW1, 5, 'Início do Conserto'); val(M + cW1, y, cW2, 5, os.iniciada ? os.iniciada.slice(0, 10).split('-').reverse().join('/') : '—'); val(M + cW1 + cW2, y, cW3, 5, os.iniciada ? os.iniciada.slice(11, 16) : '—'); lbl(M + cW1 + cW2 + cW3, y, cW4, 5, 'Fim Conserto'); val(M + cW1 + cW2 + cW3 + cW4, y, cW5, 5, os.concluida ? os.concluida.slice(0, 10).split('-').reverse().join('/') : '—'); y += 5;
  lbl(M, y, cW1, 5, 'Hora que parou o Equip.'); val(M + cW1, y, cW2, 5, '—'); val(M+cW1+cW2, y, cW3, 5, '—'); lbl(M + cW1 + cW2 + cW3, y, cW4, 5, 'Hora Volt. Equip.'); val(M + cW1 + cW2 + cW3 + cW4, y, cW5, 5, os.concluida ? os.concluida.slice(11, 16) : '—'); y += 7;

  hdr(M, y, cw, 6, 'Materiais e Peças Utilizadas'); y += 6;
  lbl(M, y, 35, 5, 'Código'); lbl(M + 35, y, cw - 60, 5, 'Descrição da Peça / Insumo'); lbl(M + cw - 25, y, 25, 5, 'Quantidade'); y += 5;
  const pecasArr = os.pecas && os.pecas.length ? os.pecas : [{ cod: '', desc: '', qtd: '' }, { cod: '', desc: '', qtd: '' }, { cod: '', desc: '', qtd: '' }];
  pecasArr.slice(0, 4).forEach(p => {
    val(M, y, 35, 5, p.cod || '—'); val(M + 35, y, cw - 60, 5, p.desc || '—'); val(M + cw - 25, y, 25, 5, p.qtd || '—'); y += 5;
  });
  y += 3;

  const sigH = 18;
  hdr(M, y, cw, 5.5, 'Validação e Encerramento (Assinaturas Digitais)'); y += 5.5;
  const sw = cw / 3;
  lbl(M, y, sw, 5, 'Assinatura Executante (Técnico)'); lbl(M + sw, y, sw, 5, 'Assinatura Solicitante (Área)'); lbl(M + sw * 2, y, sw, 5, 'Acompanhante Manutenção'); y += 5;
  cell(M, y, sw, sigH, ''); cell(M + sw, y, sw, sigH, ''); cell(M + sw * 2, y, sw, sigH, '');

  if (os.sigTec) { try { doc.addImage(os.sigTec, 'PNG', M + 1, y + 1, sw - 2, sigH - 2); } catch (e) { } }
  if (os.sigSol) { try { doc.addImage(os.sigSol, 'PNG', M + sw + 1, y + 1, sw - 2, sigH - 2); } catch (e) { } }
  if (os.sigAcomp) { try { doc.addImage(os.sigAcomp, 'PNG', M + sw * 2 + 1, y + 1, sw - 2, sigH - 2); } catch (e) { } }
  y += sigH + 5;

  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text('Confidencial & Proprietário — Sistema Integrado de Manutenção OS', M, y);
  doc.text('Formulário Ref: F-ZZ-181B-0020', W - M, y, { align: 'right' });

  doc.save(`OS_${os.chamado || os.id}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
  toast('PDF estruturado gerado! ✔');
}

function fmtDate(d) { if (!d) return '—'; try { return new Date(d + 'T12:00').toLocaleDateString('pt-BR'); } catch { return d; } }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }

// INTERCEPTA A URL LOGO NO INÍCIO PARA ISOLAR A TELA SE HOUVER PARÂMETRO DA OS
window.onload = () => {
  document.getElementById('f-data').value = new Date().toISOString().slice(0, 10);
  
  const urlParams = new URLSearchParams(window.location.search);
  const osIsoladaId = urlParams.get('os');
  
  if (osIsoladaId) {
    // Esconde o menu superior/lateral de navegação administrativa para o técnico
    const sidebar = document.querySelector('.sidebar-container');
    if (sidebar) sidebar.style.display = 'none';
    
    // Força a entrada direta na visualização da página operacional carregando a OS correta
    goView('tec-link');
    
    // Seleciona e renderiza apenas a OS correspondente
    const selectOS = document.getElementById('tec-os-select');
    if (selectOS) {
      renderTecSelect();
      selectOS.value = osIsoladaId;
    }
    renderTecPage(osIsoladaId);
  } else {
    // Carregamento padrão administrativo caso não seja link direto
    renderPainel();
  }
};
