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

// ── PDF Generator (jsPDF via CDN) ──
export async function gerarPDF(os, historico = []) {
  if (typeof window.jspdf === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const blue  = [30, 64, 175];
  const gray  = [100, 116, 139];
  const dark  = [15, 23, 42];
  const light = [241, 245, 249];

  // Header bar
  doc.setFillColor(...blue);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', 15, 14);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`N° ${String(os.numero || '').padStart(5,'0')}`, 15, 22);
  doc.setFontSize(10);
  doc.text(`Emitido: ${formatDateTime(new Date())}`, 210 - 15, 22, { align: 'right' });

  // ── Info fields ──
  let y = 40;
  doc.setTextColor(...dark);

  function field(label, value, x, w) {
    doc.setFillColor(...light);
    doc.roundedRect(x, y, w, 16, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray);
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(...dark);
    doc.text(String(value || '—').slice(0, 40), x + 4, y + 13);
  }

  field('Título', os.titulo, 15, 120);
  field('Status', getStatusConfig(os.status)?.label || os.status, 140, 55);
  y += 22;
  field('Solicitante', os.solicitante, 15, 85);
  field('Setor', os.setor, 105, 50);
  field('Prioridade', os.prioridade, 160, 35);
  y += 22;
  field('Local / Área', os.local, 15, 85);
  field('Categoria', os.categoria, 105, 85);
  y += 22;
  field('Data de Abertura', formatDate(os.criadoEm), 15, 85);
  field('Técnico Responsável', os.tecNome, 105, 50);
  field('SLA / Prazo', formatDate(os.prazo), 160, 35);

  // ── Description ──
  y += 26;
  doc.setFillColor(...light);
  doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray);
  doc.text('DESCRIÇÃO', 19, y + 6);
  y += 14;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...dark);
  const descLines = doc.splitTextToSize(os.descricao || '—', 175);
  doc.text(descLines.slice(0, 6), 15, y);
  y += Math.min(descLines.length, 6) * 5 + 8;

  // ── Solution ──
  if (os.solucao) {
    doc.setFillColor(...light);
    doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray);
    doc.text('SOLUÇÃO APLICADA', 19, y + 6);
    y += 14;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...dark);
    const solLines = doc.splitTextToSize(os.solucao, 175);
    doc.text(solLines.slice(0, 4), 15, y);
    y += Math.min(solLines.length, 4) * 5 + 8;
  }

  // ── History ──
  if (historico.length > 0) {
    y += 4;
    doc.setFillColor(...light);
    doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray);
    doc.text('HISTÓRICO', 19, y + 6);
    y += 14;
    historico.slice(0, 5).forEach(h => {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...dark);
      doc.text(`• ${formatDateTime(h.em)} — ${h.descricao}`, 15, y);
      y += 6;
    });
  }

  // ── Signature ──
  y = Math.max(y + 10, 230);
  doc.setDrawColor(...gray);
  doc.line(15, y, 95, y);
  doc.line(115, y, 195, y);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray);
  doc.text('Técnico Responsável', 55, y + 6, { align: 'center' });
  doc.text('Solicitante / Responsável', 155, y + 6, { align: 'center' });

  // Footer
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 285, 210, 12, 'F');
  doc.setFontSize(7); doc.setTextColor(...gray);
  doc.text(`Sistema OS v2 — Gerado em ${formatDateTime(new Date())}`, 15, 292);
  doc.text(`OS N° ${String(os.numero||'').padStart(5,'0')}`, 210 - 15, 292, { align: 'right' });

  doc.save(`OS_${String(os.numero||'0').padStart(5,'0')}.pdf`);
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