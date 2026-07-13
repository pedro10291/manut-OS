import { fmtDate } from "./utils.js";

export function makeWALink(os, telemovel, token, tipoUsuario) {
  const origem = window.location.origin + window.location.pathname;
  // v2: Envia o token na URL para futuras validações automáticas
  const link = `${origem}?os=${os.id}&token=${token}&role=${tipoUsuario}`;

  const msg = `📋 *ORDEM DE SERVIÇO ${os.chamado || "S/N"} (v2)*

🔧 Problema: ${os.problema}
📍 Local: ${os.area || "—"}
📅 Data: ${fmtDate(os.data)}
🔐 Perfil: ${tipoUsuario === 'tecnico' ? 'Executante' : 'Aprovação Solicitante'}

Clique no link abaixo para aceder e assinar com segurança:
${link}`;

  return `https://wa.me/${telemovel}?text=${encodeURIComponent(msg)}`;
}