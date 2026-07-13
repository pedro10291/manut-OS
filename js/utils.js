/* =======================================================
   SISTEMA OS v2 — Utils Module
   SLA, Date/Time formatting, Excel export, PDF, Debounce
   ======================================================= */

// ── Date Formatting ──
export function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);

  if (abs < 60_000)       return 'agora há pouco';
  if (abs < 3_600_000)    return `há ${Math.floor(abs / 60_000)} min`;
  if (abs < 86_400_000)   return `há ${Math.floor(abs / 3_600_000)}h`;
  if (abs < 2_592_000_000) return `há ${Math.floor(abs / 86_400_000)} dias`;
  return formatDate(d);
}

export function formatMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

// ── Number formatting ──
export function formatarNumeroOS(n) {
  return String(n).padStart(5, '0');
}

export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ── SLA Calculation ──
// Returns { pct: 0-100, status: 'ok'|'warning'|'danger', label, daysLeft }
export function calcularSLA(prazoISO, aberturaISO = null) {
  if (!prazoISO) return null;

  const now    = new Date();
  const prazo  = new Date(prazoISO);
  const start  = aberturaISO ? new Date(aberturaISO) : null;

  const msTotal  = start ? prazo - start : prazo - (now - 86_400_000);
  const msLeft   = prazo - now;
  const pct      = Math.min(100, Math.max(0, Math.round((msLeft / msTotal) * 100)));

  const hoursLeft = msLeft / 3_600_000;
  const daysLeft  = Math.ceil(msLeft / 86_400_000);

  let status, label;
  if (msLeft <= 0) {
    status = 'danger';
    label  = `Vencido há ${Math.abs(daysLeft)} dia(s)`;
  } else if (hoursLeft < 24) {
    status = 'danger';
    label  = `Vence em ${Math.round(hoursLeft)}h`;
  } else if (daysLeft <= 3) {
    status = 'warning';
    label  = `${daysLeft} dia(s)`;
  } else {
    status = 'ok';
    label  = `${daysLeft} dia(s)`;
  }

  return { pct, status, label, daysLeft, msLeft };
}

// ── Status Helpers ──
const STATUS_CONFIG = {
  aberta:     { label: 'Aberta',     class: 'badge-aberta',     color: '#06b6d4' },
  andamento:  { label: 'Andamento',  class: 'badge-andamento',  color: '#f59e0b' },
  finalizada: { label: 'Finalizada', class: 'badge-finalizada', color: '#22c55e' },
  fechada:    { label: 'Fechada',    class: 'badge-fechada',    color: '#64748b' },
  cancelada:  { label: 'Cancelada',  class: 'badge-cancelada',  color: '#ef4444' },
  aguardando: { label: 'Aguardando', class: 'badge-aguardando', color: '#a855f7' }
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG['aberta'];
}

export function renderStatusBadge(status) {
  const c = getStatusConfig(status);
  return `<span class="badge ${c.class}">${c.label}</span>`;
}

// ── Priority Helpers ──
const PRIORITY_CONFIG = {
  alta:  { label: 'Alta',  class: 'priority-alta'  },
  media: { label: 'Média', class: 'priority-media' },
  baixa: { label: 'Baixa', class: 'priority-baixa' }
};

export function renderPriorityBadge(priority) {
  const c = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['media'];
  return `<span class="priority ${c.class}">${c.label}</span>`;
}

// ── Avatar color ──
const AVATAR_COLORS = [
  'avatar-blue', 'avatar-green', 'avatar-purple',
  'avatar-orange', 'avatar-cyan', 'avatar-pink'
];
export function getAvatarColor(str) {
  let hash = 0;
  for (let i = 0; i < (str||'').length; i++) hash += str.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

// ── Debounce ──
export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ── HTML Sanitize ──
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Copy to Clipboard ──
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  }
}

// ── Excel Export (SheetJS via CDN) ──
export async function exportarExcel(dados, filename = 'ordens_servico') {
  // Dynamically load SheetJS if not already loaded
  if (typeof XLSX === 'undefined') {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  }
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'OS');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// -- PDF Generator: Formato F-ZZ-181B-0020 --
export async function gerarPDF(os, historico = []) {
  if (typeof window.jspdf === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 12, cw = W - M * 2;

  function cell(x, y, w, h, text, opts) {
    opts = opts || {};
    if (opts.fill) doc.setFillColor(...opts.fill);
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, opts.fill ? 'FD' : 'S');
    if (text === undefined || text === null || text === '') return;
    const fs = opts.fs || 8;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(fs); doc.setTextColor(...(opts.tc || [30,30,30]));
    const align = opts.align || 'left';
    const tx = align === 'center' ? x + w/2 : (align === 'right' ? x + w - 2 : x + 2);
    const dim = doc.getTextDimensions(String(text));
    doc.text(String(text), tx, y + (h + dim.h)/2 - 0.25, { align, maxWidth: w - 4 });
  }
  const hdr = (x,y,w,h,t) => cell(x,y,w,h,t,{fill:[26,68,128],tc:[255,255,255],bold:true,fs:8,align:'center'});
  const lbl = (x,y,w,h,t) => cell(x,y,w,h,t,{fill:[235,240,248],tc:[26,68,128],bold:true,fs:7.5});
  const val = (x,y,w,h,t) => cell(x,y,w,h,t,{fs:8});
  const fmtD  = v => { if(!v) return '-'; const d=new Date(v); return isNaN(d)?'-':d.toLocaleDateString('pt-BR'); };
  const fmtDT = v => { if(!v) return '-'; const d=new Date(v); return isNaN(d)?'-':d.toLocaleString('pt-BR'); };
  const fmtH  = v => { if(!v) return '-'; const d=new Date(v); return isNaN(d)?'-':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); };

  const numOS = String(os.numero||'').padStart(5,'0');
  const tipo  = os.tipoServico ? os.tipoServico.toUpperCase() : 'CORRETIVA';
  let y = M;

  // Titulo
  hdr(M,y,cw,8,'ORDEM DE SERVICO - F-ZZ-181B-0020'); y+=8;

  // Identificacao
  lbl(M,y,30,6,'N OS / Chamado');     val(M+30,y,35,6,numOS);
  lbl(M+65,y,30,6,'Tipo de Servico'); val(M+95,y,cw-95,6,tipo); y+=6;
  lbl(M,y,30,6,'Data de Abertura');   val(M+30,y,35,6,fmtD(os.criadoEm));
  lbl(M+65,y,30,6,'Especialidade');   val(M+95,y,cw-95,6,os.especialidade||os.categoria||'-'); y+=6;
  lbl(M,y,30,6,'Solicitante');        val(M+30,y,cw-30,6,os.solicitante||'-'); y+=6;
  lbl(M,y,30,6,'Local / Area');       val(M+30,y,cw-30,6,[os.local,os.setor].filter(Boolean).join(' - ')||'-'); y+=6;
  lbl(M,y,30,6,'Tecnico');            val(M+30,y,cw-30,6,os.tecNome||'-'); y+=8;

  // TAG / Equipamento
  hdr(M,y,cw,6,'TAG: Descricao do Equipamento'); y+=6;
  lbl(M,y,20,7,'TAG:');            val(M+20,y,45,7,os.tag||'-');
  lbl(M+65,y,35,7,'Desc. Equip.:'); val(M+100,y,cw-100,7,os.descEquipamento||'-'); y+=8;

  // Motivo
  hdr(M,y,cw,6,'Motivo / Sintoma'); y+=6;
  val(M,y,cw,7,os.titulo||'-'); y+=8;

  // SSMA
  hdr(M,y,cw,6,'Preparativos de Seguranca / SSMA'); y+=6;
  const ssma = os.ssma||{q1:null,q2:null,q3:null};
  [
    {q:'1. Os preparativos de sinalizacao e bloqueio foram tomados?',            v:ssma.q1},
    {q:'2. A area foi isolada/sinalizada corretamente com fita/cones?',          v:ssma.q2},
    {q:'3. O equipamento foi devidamente desenergizado ou identificado com TAG?', v:ssma.q3}
  ].forEach(function(item) {
    lbl(M,y,cw-30,5.5,item.q);
    var t='[   ] SIM   [   ] NAO';
    if(item.v==='SIM') t='[ X ] SIM   [   ] NAO';
    if(item.v==='NAO'||item.v==='\u004eÃO') t='[   ] SIM   [ X ] NAO';
    cell(M+cw-30,y,30,5.5,t,{fs:7.5,align:'center',bold:true}); y+=5.5;
  });
  lbl(M,y,cw,5,'Caso alguma resposta seja NAO, indique as acoes tomadas:'); y+=5;
  val(M,y,cw,7,os.acoesSsma||'-'); y+=8;

  // Descricao da Solicitacao
  hdr(M,y,cw,6,'Descricao do Servico Solicitado'); y+=6;
  const dLines = doc.splitTextToSize(os.descricao||'Nenhuma descricao.', cw-4);
  const dH = Math.max(12, dLines.length*4+4);
  cell(M,y,cw,dH,'');
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(30,30,30);
  doc.text(dLines, M+2, y+4); y+=dH;

  // Relatorio Tecnico
  hdr(M,y,cw,6,'Descricao do Servico Efetivamente Realizado (Relatorio Tecnico)'); y+=6;
  const srLines = doc.splitTextToSize(os.servicoRealizado||'Aguardando preenchimento.', cw-4);
  const srH = Math.max(14, srLines.length*4+4);
  cell(M,y,cw,srH,'');
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(30,30,30);
  doc.text(srLines, M+2, y+4); y+=srH;

  // Tempos
  if(y>210){ doc.addPage(); y=M; }
  hdr(M,y,cw,6,'Tempos de Execucao e Ocorrencia'); y+=6;
  lbl(M,y,60,5,'Etapa'); lbl(M+60,y,63,5,'Data'); lbl(M+123,y,63,5,'Hora'); y+=5;
  [
    {et:'Inicio da Ocorrencia', data:fmtD(os.criadoEm),  hora:fmtH(os.criadoEm)},
    {et:'Inicio do Conserto',   data:fmtD(os.iniciada),  hora:fmtH(os.iniciada) },
    {et:'Fim do Conserto',      data:fmtD(os.concluida), hora:fmtH(os.concluida)},
  ].forEach(function(l) { lbl(M,y,60,5,l.et); val(M+60,y,63,5,l.data); val(M+123,y,63,5,l.hora); y+=5; });
  y+=2;

  // Pecas
  if(y>230){ doc.addPage(); y=M; }
  hdr(M,y,cw,6,'Materiais e Pecas Utilizadas'); y+=6;
  lbl(M,y,35,5,'Codigo'); lbl(M+35,y,cw-60,5,'Descricao da Peca / Insumo'); lbl(M+cw-25,y,25,5,'Qtd'); y+=5;
  const pecas = (os.pecas&&os.pecas.length) ? os.pecas : [{cod:'',desc:'',qtd:''},{cod:'',desc:'',qtd:''},{cod:'',desc:'',qtd:''}];
  pecas.slice(0,6).forEach(function(p){ val(M,y,35,5,p.cod||''); val(M+35,y,cw-60,5,p.desc||''); val(M+cw-25,y,25,5,p.qtd||''); y+=5; });
  y+=4;

  // Auditoria digital
  if(y>235){ doc.addPage(); y=M; }
  hdr(M,y,cw,5.5,'Assinatura Digital & Auditoria (Homologacao via Dispositivo)'); y+=5.5;
  const sw=cw/2;
  lbl(M,y,sw,5,'Executante / Tecnico'); lbl(M+sw,y,sw,5,'Solicitante / Aceite'); y+=5;
  cell(M,y,sw,28,''); cell(M+sw,y,sw,28,'');

  const cTec=os.confirmacaoTec;
  if(cTec&&cTec.confirmado){
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(30,30,30);
    doc.text(cTec.nome||'Tecnico', M+3, y+5);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(22,163,74);
    doc.text('OK - Confirmado atraves do dispositivo', M+3, y+10);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(71,85,105);
    doc.text('Disp.: '+(cTec.dispositivo||'-'), M+3, y+15);
    doc.text('Nav.: '+(cTec.navegador||'-'),     M+3, y+19);
    doc.text(fmtDT(cTec.data),                   M+3, y+23);
  } else {
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(140,140,140);
    doc.text('Aguardando validacao do executante...', M+3, y+14);
  }

  const cSol=os.confirmacaoSol;
  if(cSol&&cSol.confirmado){
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(30,30,30);
    doc.text(cSol.nome||'Solicitante', M+sw+3, y+5);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(22,163,74);
    doc.text('OK - Confirmado atraves do dispositivo', M+sw+3, y+10);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(71,85,105);
    doc.text('Disp.: '+(cSol.dispositivo||'-'), M+sw+3, y+15);
    doc.text('Nav.: '+(cSol.navegador||'-'),     M+sw+3, y+19);
    doc.text(fmtDT(cSol.data),                   M+sw+3, y+23);
  } else {
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(140,140,140);
    doc.text('Aguardando aceite do solicitante...', M+sw+3, y+14);
  }

  y+=30;
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(140,140,140);
  doc.text('Confidencial & Proprietario - Sistema OS v2', M, y);
  doc.text('Formulario Ref: F-ZZ-181B-0020', W-M, y, {align:'right'});

  const filename = 'OS_'+numOS+'_'+new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')+'.pdf';
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  return { url, filename };
}

// ── Prepare data for Excel export ──
export function prepararDadosExcel(ordens, tecnicos = {}) {
  return ordens.map(os => ({
    'N° OS':          os.numero,
    'Título':         os.titulo || '',
    'Descrição':      os.descricao || '',
    'Categoria':      os.categoria || '',
    'Setor':          os.setor || '',
    'Local':          os.local || '',
    'Solicitante':    os.solicitante || '',
    'Técnico':        os.tecNome || tecnicos[os.tecId]?.nome || '',
    'Status':         getStatusConfig(os.status)?.label || '',
    'Prioridade':     os.prioridade || '',
    'Abertura':       formatDate(os.criadoEm),
    'Prazo SLA':      formatDate(os.prazo),
    'Finalização':    formatDate(os.finalizadoEm),
    'Solução':        os.solucao || '',
  }));
}

// ── Group OS by month ──
export function agruparPorMes(ordens, months = 6) {
  const now = new Date();
  const result = {};

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    result[key] = { label: formatMonth(d), abertas: 0, finalizadas: 0, total: 0 };
  }

  ordens.forEach(os => {
    const d = new Date(os.criadoEm);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (result[key]) {
      result[key].total++;
      if (os.status === 'finalizada' || os.status === 'fechada') result[key].finalizadas++;
      else result[key].abertas++;
    }
  });

  return Object.values(result);
}

// ── Calculate average resolution time ──
export function calcularTempoMedio(ordens) {
  const finalizadas = ordens.filter(os =>
    os.finalizadoEm && os.criadoEm &&
    (os.status === 'finalizada' || os.status === 'fechada')
  );
  if (finalizadas.length === 0) return null;

  const total = finalizadas.reduce((sum, os) => {
    const ms = new Date(os.finalizadoEm) - new Date(os.criadoEm);
    return sum + ms;
  }, 0);

  const avgMs = total / finalizadas.length;
  const avgHours = Math.round(avgMs / 3_600_000);
  return { horas: avgHours, label: formatDuration(avgHours * 60) };
}

// ── Today's OS ──
export function isToday(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const today = new Date();
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}
