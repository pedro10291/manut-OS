import { fmtDate, toast } from "./utils.js";

export function gerarPDF(os, tecnicosData) {
  if (!window.jspdf || !window.jspdf.jsPDF) { 
    alert('A biblioteca de PDF ainda está a carregar. Aguarde.'); 
    return; 
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 12, cw = W - M * 2;

  function cell(x, y, w, h, text, opts = {}) {
    if (opts.fill) doc.setFillColor(...opts.fill);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, opts.fill ? 'FD' : 'S');
    if (!text) return;

    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.fs || 8);
    doc.setTextColor(...(opts.tc || [30, 30, 30]));

    const align = opts.align || 'left';
    let tx = x + 2;
    if (align === 'center') tx = x + w / 2;
    if (align === 'right') tx = x + w - 2;

    const dim = doc.getTextDimensions(String(text));
    const ty = y + (h + dim.h) / 2 - 0.25;
    doc.text(String(text), tx, ty, { align, maxWidth: w - 4 });
  }

  function hdr(x, y, w, h, text) { cell(x, y, w, h, text, { fill: [26,68,128], tc: [255,255,255], bold: true, align: 'center' }); }
  function lbl(x, y, w, h, text) { cell(x, y, w, h, text, { fill: [235, 240, 248], tc: [26, 68, 128], bold: true, fs: 7.5 }); }
  function val(x, y, w, h, text) { cell(x, y, w, h, text, { fs: 8 }); }

  let y = M;
  hdr(M, y, cw, 8, 'ORDEM DE SERVIÇO — F-ZZ-181B-0020 (v2)'); y += 8;

  lbl(M, y, 30, 6, 'N° OS / Chamado'); val(M + 30, y, 35, 6, os.chamado || '—');
  lbl(M + 65, y, 30, 6, 'Tipo de Serviço'); val(M + 95, y, cw - 95, 6, 'CORRETIVA'); y += 6;

  lbl(M, y, 30, 6, 'Data de Abertura'); val(M + 30, y, 35, 6, fmtDate(os.data));
  lbl(M + 65, y, 30, 6, 'Especialidade'); val(M + 95, y, cw - 95, 6, os.esp || '—'); y += 6;

  lbl(M, y, 30, 6, 'Solicitante'); val(M + 30, y, cw - 30, 6, os.solicitante || '—'); y += 6;
  lbl(M, y, 30, 6, 'Local / Área'); val(M + 30, y, cw - 30, 6, os.area || '—'); y += 6;
  lbl(M, y, 30, 6, 'Técnico'); val(M + 30, y, cw - 30, 6, os.tec ? tecnicosData[os.tec]?.label : '—'); y += 8;

  hdr(M, y, cw, 6, 'TAG / Equipamento'); y += 6;
  lbl(M, y, 20, 7, 'TAG:'); val(M + 20, y, 45, 7, os.tag || '—');
  lbl(M + 65, y, 35, 7, 'Desc. Equip.:'); val(M + 100, y, cw - 100, 7, os.descEquipamento || '—'); y += 8;
  
  hdr(M, y, cw, 6, 'Motivo / Sintoma'); y += 6;
  val(M, y, cw, 7, os.problema || '—'); y += 8;

  hdr(M, y, cw, 6, 'Preparativos de Segurança / SSMA'); y += 6;
  const s = os.ssma || { q1: null, q2: null, q3: null };
  const chk = [
    { q: '1. Os preparativos de sinalização e bloqueio foram tomados?', v: s.q1 },
    { q: '2. A área foi isolada/sinalizada corretamente com fita/cones?', v: s.q2 },
    { q: '3. O equipamento foi devidamente desenergizado?', v: s.q3 }
  ];
  chk.forEach(item => {
    lbl(M, y, cw - 30, 5.5, item.q);
    let txt = item.v ? `[ ${item.v === 'SIM' ? 'X' : ' '} ] SIM  [ ${item.v === 'NÃO' ? 'X' : ' '} ] NÃO` : '[   ] SIM  [   ] NÃO';
    cell(M + cw - 30, y, 30, 5.5, txt, { fs: 7.5, align: 'center', bold: true });
    y += 5.5;
  });
  
  lbl(M, y, cw, 5, 'Ações de Contingência / SSMA:'); y += 5;
  val(M, y, cw, 6.5, os.acoesSsma || '—'); y += 8.5;

  hdr(M, y, cw, 6, 'Relatório Técnico / Serviço Realizado'); y += 6;
  const srLines = doc.splitTextToSize(os.servicoRealizado || 'Aguardando preenchimento.', cw - 4);
  const srH = Math.max(12, srLines.length * 4 + 4); cell(M, y, cw, srH, '');
  doc.text(srLines, M + 2, y + 4); y += srH;

  // Bloco Novo: Auditoria de Validação Digital na v2
  if (os.tecnico?.validacao) {
    hdr(M, y, cw, 6, 'Rastreabilidade e Validação Digital (v2)'); y += 6;
    const v = os.tecnico.validacao;
    const gpsTxt = v.gps ? `Lat: ${v.gps.lat.toFixed(4)}, Lng: ${v.gps.lng.toFixed(4)} (Prec: ${v.gps.precisao}m)` : "Não autorizado/indisponível";
    doc.setFontSize(7);
    doc.text(`• Autenticado em: ${new Date(v.data).toLocaleString('pt-BR')} | IP/Dispositivo: ${v.plataforma} (${v.tela})`, M + 2, y + 3);
    doc.text(`• Geolocalização no ato da assinatura: ${gpsTxt}`, M + 2, y + 6);
    y += 9;
  }

  // Assinaturas Visuais
  hdr(M, y, cw, 5.5, 'Assinaturas Recolhidas'); y += 5.5;
  const sw = cw / 3;
  lbl(M, y, sw, 5, 'Técnico Executante'); lbl(M + sw, y, sw, 5, 'Solicitante da Área'); lbl(M + sw * 2, y, sw, 5, 'Acompanhante'); y += 5;
  cell(M, y, sw, 18, ''); cell(M + sw, y, sw, 18, ''); cell(M + sw * 2, y, sw, 18, '');

  if (os.sigTec) { try { doc.addImage(os.sigTec, 'PNG', M + 1, y + 1, sw - 2, 16); } catch(e){} }
  if (os.sigSol) { try { doc.addImage(os.sigSol, 'PNG', M + sw + 1, y + 1, sw - 2, 16); } catch(e){} }
  if (os.sigAcomp) { try { doc.addImage(os.sigAcomp, 'PNG', M + sw * 2 + 1, y + 1, sw - 2, 16); } catch(e){} }
  y += 23;

  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text('Sistema com Arquitetura Corporativa Modular v2', M, y);
  doc.save(`OS_${os.chamado || os.id}_v2.pdf`);
  toast('PDF Gerado com Auditoria ✔');
}