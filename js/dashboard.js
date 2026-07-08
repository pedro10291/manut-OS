/* =======================================================
   SISTEMA OS v2 — Dashboard Module
   KPIs em tempo real, Chart.js, Activity Feed
   ======================================================= */

import { requireAuth, fazerLogout, getUsuarioAtual } from './auth.js';
import { initUI, showToast, renderSidebarUser, applyRoleVisibility, hideLoader } from './ui.js';
import {
  formatRelativeTime, formatDate, agruparPorMes,
  calcularTempoMedio, isToday, getStatusConfig, getInitials,
  getAvatarColor, escapeHtml, exportarExcel, prepararDadosExcel
} from './utils.js';
import { database } from './firebase.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

// ── Init ──
initUI();
requireAuth(['admin', 'tecnico', 'usuario'], (user) => {
  renderSidebarUser(user);
  applyRoleVisibility(user.role);
  setupPage(user);
  hideLoader();
});

let chartMensal = null;
let chartStatus = null;
let allOrdens   = [];
let allTecnicos = {};

// ── Setup page ──
function setupPage(user) {
  // OS badge update interval
  listenOrdens(user);
  listenTecnicos();
  setupExportButton(user);
  updateLastUpdateTime();
  setInterval(updateLastUpdateTime, 60_000);
}

// ── Listen: Ordens de Serviço ──
function listenOrdens(user) {
  const ordensRef = ref(database, 'ordensServico');
  onValue(ordensRef, (snap) => {
    const raw = snap.val() || {};
    let ordens = Object.entries(raw).map(([id, os]) => ({ id, ...os }));

    // Technicians can only see their own OS
    if (user.role === 'tecnico' && user.tecId) {
      ordens = ordens.filter(os => os.tecId === user.tecId);
    }

    allOrdens = ordens;
    renderKPIs(ordens, user);
    renderChartMensal(ordens);
    renderChartStatus(ordens);
    renderActivity(ordens);
    renderRanking(ordens);
  });
}

// ── Listen: Técnicos ──
function listenTecnicos() {
  const tecRef = ref(database, 'tecnicos');
  onValue(tecRef, (snap) => {
    allTecnicos = snap.val() || {};
    renderTecOnline();
  });
}

// ── Render KPIs ──
function renderKPIs(ordens, user) {
  const hoje = ordens.filter(os => isToday(os.criadoEm));
  const abertas     = ordens.filter(os => os.status === 'aberta').length;
  const andamento   = ordens.filter(os => os.status === 'andamento').length;
  const finalizadas = ordens.filter(os => os.status === 'finalizada' || os.status === 'fechada').length;
  const canceladas  = ordens.filter(os => os.status === 'cancelada').length;
  const tempoMedio  = calcularTempoMedio(ordens);
  const tecCount    = Object.keys(allTecnicos).length;

  // Update nav badge
  const navBadge = document.getElementById('nav-os-badge');
  if (navBadge) {
    if (abertas > 0) { navBadge.textContent = abertas; navBadge.classList.remove('hidden'); }
    else navBadge.classList.add('hidden');
  }

  const kpiData = [
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`,
      value: abertas,
      label: 'OS Abertas',
      color: 'kpi-blue',
      link: 'os.html?filter=aberta'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      value: andamento,
      label: 'Em Andamento',
      color: 'kpi-amber',
      link: 'os.html?filter=andamento'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      value: finalizadas,
      label: 'Finalizadas',
      color: 'kpi-green',
      link: 'os.html?filter=finalizada'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      value: hoje.length,
      label: 'Abertas Hoje',
      color: 'kpi-accent',
      link: 'os.html'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
      value: tecCount,
      label: 'Técnicos',
      color: 'kpi-purple',
      link: 'usuarios.html'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      value: tempoMedio?.label || '—',
      label: 'Tempo Médio',
      color: 'kpi-red',
      raw: true
    }
  ];

  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  grid.innerHTML = kpiData.map(({ icon, value, label, color, link, raw }) => `
    ${link ? `<a href="${link}" class="kpi-card ${color}" style="text-decoration:none;">` : `<div class="kpi-card ${color}">`}
      <div class="kpi-card-bg"></div>
      <div class="kpi-top">
        <div class="kpi-icon-wrap">${icon}</div>
      </div>
      <div class="kpi-body">
        <div class="kpi-value">${raw ? value : value.toLocaleString('pt-BR')}</div>
        <div class="kpi-label">${label}</div>
      </div>
    ${link ? '</a>' : '</div>'}
  `).join('');
}

// ── Chart.js defaults ──
function chartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    textColor: isDark ? '#94a3b8' : '#64748b',
    gridColor: isDark ? 'rgba(71,85,105,0.3)' : 'rgba(203,213,225,0.5)',
    bgCard:    isDark ? '#1e293b' : '#ffffff'
  };
}

// ── Monthly Bar Chart ──
function renderChartMensal(ordens, months = 6) {
  const canvas = document.getElementById('chart-mensal');
  if (!canvas) return;

  const data = agruparPorMes(ordens, months);
  const { textColor, gridColor } = chartDefaults();

  const cfg = {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [
        {
          label: 'Abertas',
          data: data.map(d => d.abertas),
          backgroundColor: 'rgba(6,182,212,0.7)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Finalizadas',
          data: data.map(d => d.finalizadas),
          backgroundColor: 'rgba(34,197,94,0.7)',
          borderColor: '#22c55e',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 }, boxWidth: 12, boxHeight: 12 } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter' } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, precision: 0, font: { family: 'Inter' } }, beginAtZero: true }
      }
    }
  };

  if (chartMensal) { chartMensal.destroy(); }
  chartMensal = new Chart(canvas, cfg);

  // Period buttons
  document.querySelectorAll('.chart-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChartMensal(allOrdens, parseInt(btn.dataset.period));
    });
  });
}

// ── Status Donut Chart ──
function renderChartStatus(ordens) {
  const canvas = document.getElementById('chart-status');
  const legend = document.getElementById('status-legend');
  const totalLabel = document.getElementById('total-os-label');
  if (!canvas) return;

  const counts = {
    aberta:     ordens.filter(o => o.status === 'aberta').length,
    andamento:  ordens.filter(o => o.status === 'andamento').length,
    finalizada: ordens.filter(o => o.status === 'finalizada' || o.status === 'fechada').length,
    cancelada:  ordens.filter(o => o.status === 'cancelada').length,
    aguardando: ordens.filter(o => o.status === 'aguardando').length,
  };

  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (totalLabel) totalLabel.textContent = `${total} OS no total`;

  const statusItems = [
    { key: 'aberta',     label: 'Abertas',     color: '#06b6d4' },
    { key: 'andamento',  label: 'Andamento',   color: '#f59e0b' },
    { key: 'finalizada', label: 'Finalizadas', color: '#22c55e' },
    { key: 'cancelada',  label: 'Canceladas',  color: '#ef4444' },
    { key: 'aguardando', label: 'Aguardando',  color: '#a855f7' },
  ].filter(s => counts[s.key] > 0);

  if (legend) {
    legend.innerHTML = statusItems.map(s => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${s.color};"></div>
        <span>${s.label}</span>
        <span class="legend-val">${counts[s.key]}</span>
        <span class="legend-pct">${total ? Math.round(counts[s.key]/total*100) : 0}%</span>
      </div>
    `).join('');
  }

  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: statusItems.map(s => s.label),
      datasets: [{
        data: statusItems.map(s => counts[s.key]),
        backgroundColor: statusItems.map(s => s.color + 'cc'),
        borderColor: statusItems.map(s => s.color),
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed/total*100)}%)`
        }}
      }
    }
  });
}

// ── Activity Feed ──
function renderActivity(ordens) {
  const list = document.getElementById('activity-list');
  const countEl = document.getElementById('activity-count');
  if (!list) return;

  const sorted = [...ordens].sort((a, b) =>
    new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm)
  ).slice(0, 10);

  if (countEl) countEl.textContent = `${sorted.length} recentes`;

  if (sorted.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:40px 0;"><div class="empty-state-icon">📋</div><h3>Nenhuma OS</h3><p>Nenhuma ordem de serviço registrada ainda.</p></div>`;
    return;
  }

  const icons = {
    aberta:     { bg: 'var(--info-bg)',    color: 'var(--info)',    icon: '📄' },
    andamento:  { bg: 'var(--warning-bg)', color: 'var(--warning)', icon: '⚙️' },
    finalizada: { bg: 'var(--success-bg)', color: 'var(--success)', icon: '✅' },
    cancelada:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',  icon: '❌' },
    aguardando: { bg: 'var(--purple-bg)',  color: 'var(--purple)',  icon: '⏳' },
  };

  list.innerHTML = sorted.map(os => {
    const cfg = icons[os.status] || icons.aberta;
    const date = os.atualizadoEm || os.criadoEm;
    return `
      <div class="activity-item">
        <div class="activity-icon" style="background:${cfg.bg};">${cfg.icon}</div>
        <div class="activity-content">
          <div class="activity-text">
            <span class="activity-os-num">OS #${String(os.numero||'').padStart(5,'0')}</span>
            — ${escapeHtml(os.titulo || 'Sem título')}
          </div>
          <div class="activity-time">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatRelativeTime(date)}
            ${os.tecNome ? `· <strong>${escapeHtml(os.tecNome)}</strong>` : ''}
          </div>
        </div>
        <a href="os.html?id=${os.id}" class="btn btn-sm btn-ghost" style="flex-shrink:0;">Ver</a>
      </div>
    `;
  }).join('');
}

// ── Technicians Online ──
function renderTecOnline() {
  const list = document.getElementById('tec-online-list');
  const countEl = document.getElementById('online-count');
  if (!list) return;

  const tecs = Object.entries(allTecnicos).map(([id, t]) => ({ id, ...t }));

  if (countEl) countEl.textContent = `${tecs.length} técnico${tecs.length !== 1 ? 's' : ''}`;

  if (tecs.length === 0) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px;">Nenhum técnico cadastrado</p>`;
    return;
  }

  // Count OS per tech
  const osPerTec = {};
  allOrdens.forEach(os => {
    if (os.tecId && (os.status === 'aberta' || os.status === 'andamento')) {
      osPerTec[os.tecId] = (osPerTec[os.tecId] || 0) + 1;
    }
  });

  list.innerHTML = tecs.map(t => {
    const initials = getInitials(t.nome);
    const color = getAvatarColor(t.nome || t.id);
    const count = osPerTec[t.id] || 0;
    return `
      <div class="tec-online-item">
        <div class="avatar avatar-sm ${color}">${initials}</div>
        <div class="tec-online-info">
          <div class="tec-online-name">${escapeHtml(t.nome)}</div>
          <div class="tec-online-status">${count} OS ativa${count !== 1 ? 's' : ''}</div>
        </div>
        ${count > 0 ? `<span class="tec-online-count">${count}</span>` : ''}
      </div>
    `;
  }).join('');
}

// ── Top Issues Ranking ──
function renderRanking(ordens) {
  const list = document.getElementById('rank-list');
  if (!list) return;

  const freq = {};
  ordens.filter(os => os.status !== 'cancelada').forEach(os => {
    const cat = os.categoria || 'Sem categoria';
    freq[cat] = (freq[cat] || 0) + 1;
  });

  const ranked = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (ranked.length === 0) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px;">Nenhum dado disponível</p>`;
    return;
  }

  const max = ranked[0][1];
  list.innerHTML = ranked.map(([cat, count], i) => `
    <div class="rank-item">
      <div class="rank-num">${i + 1}</div>
      <div class="rank-label">${escapeHtml(cat)}</div>
      <div class="rank-bar-wrap">
        <div class="rank-bar">
          <div class="rank-bar-fill" style="width:${Math.round(count/max*100)}%"></div>
        </div>
      </div>
      <div class="rank-count">${count}</div>
    </div>
  `).join('');
}

// ── Export Button ──
function setupExportButton(user) {
  const btn = document.getElementById('btn-export-excel');
  if (!btn || user.role === 'usuario') {
    if (btn) btn.classList.add('hidden');
    return;
  }
  btn.addEventListener('click', async () => {
    if (allOrdens.length === 0) { showToast('Nenhum dado para exportar.', 'warning'); return; }
    try {
      btn.disabled = true;
      await exportarExcel(prepararDadosExcel(allOrdens, allTecnicos), 'ordens_servico');
      showToast('Excel exportado com sucesso!', 'success');
    } catch { showToast('Erro ao exportar. Tente novamente.', 'error'); }
    finally { btn.disabled = false; }
  });
}

// ── Last Update Label ──
function updateLastUpdateTime() {
  const el = document.getElementById('last-update');
  if (el) el.textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
