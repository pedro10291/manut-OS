# 🔧 Sistema OS v2

Sistema de Gestão de Ordens de Serviço — inspirado no GLPI/Movidesk/Jira, porém mais limpo e moderno.

## 🚀 Como Rodar

Este projeto usa **ES Modules nativos** (`type="module"`), então **não funciona via `file://`**.  
Você precisa de um servidor HTTP local:

### Opção 1 — VS Code (Recomendado)
1. Instale a extensão **Live Server** (ritwickdey.LiveServer)
2. Clique com o botão direito em `index.html` → **Open with Live Server**
3. O sistema abre em `http://127.0.0.1:5500`

### Opção 2 — Python
```bash
python -m http.server 5500
# acesse http://localhost:5500
```

### Opção 3 — Node.js
```bash
npx serve . -p 5500
# acesse http://localhost:5500
```

---

## 🔥 Configuração Firebase

Antes de usar, configure o Firebase:

### 1. Realtime Database — Regras de Segurança
No [Firebase Console](https://console.firebase.google.com) → Realtime Database → Regras:
- Cole o conteúdo de `database.rules.json`
- Clique em **Publicar**

### 2. Authentication
- Habilite o provedor **E-mail/Senha** em Authentication → Sign-in method

### 3. Primeiro Usuário (Admin Automático)
1. Acesse `http://localhost:5500`
2. Clique em **"Criar conta"** no Firebase Console (Authentication → Add user)
3. Faça login com esse e-mail e senha no sistema
4. O sistema detecta que não há usuários cadastrados e **promove automaticamente para Administrador**

---

## 📁 Estrutura do Projeto

```
system_OS_automation_login_admin_auto/
│
├── index.html          <- Redirect auth-aware (login ou dashboard)
├── login.html          <- Tela de login + recuperação de senha
├── dashboard.html      <- KPIs, gráficos e atividades em tempo real
├── os.html             <- CRUD completo de Ordens de Serviço
├── usuarios.html       <- Gestão de usuários, técnicos e convites
├── perfil.html         <- Perfil do usuário, tema, reset de senha
├── cadastro.html       <- Registro via link de convite
│
├── css/
│   ├── style.css       <- Design tokens, reset, utilitários, animações
│   ├── login.css       <- Estilos específicos da tela de login
│   ├── components.css  <- Sidebar, botões, cards, tabela, drawer, modal
│   └── dashboard.css   <- KPI cards, gráficos, activity feed
│
├── js/
│   ├── firebase.js     <- Configuração Firebase (app, auth, db, storage)
│   ├── auth.js         <- Login, guards, convites, primeiro admin
│   ├── ui.js           <- Sidebar, tema, toast, drawer, modal, loader
│   ├── utils.js        <- SLA, formatação, PDF (jsPDF), Excel (SheetJS)
│   ├── login.js        <- Lógica da tela de login
│   ├── dashboard.js    <- KPIs, Chart.js, activity feed, ranking
│   ├── os.js           <- CRUD OS, numeração atômica, filtros, histórico
│   ├── usuarios.js     <- Usuários, técnicos, convites
│   └── perfil.js       <- Perfil, tema, reset senha
│
└── database.rules.json <- Regras de segurança do Firebase RTDB
```

---

## Funcionalidades

| Módulo | Funcionalidades |
|--------|-----------------|
| Autenticacao | Login, logout, manter conectado, recuperacao de senha, timeout 45min |
| Admin Auto | Primeiro usuario vira admin automaticamente |
| OS | Criacao, edicao, exclusao, historico completo |
| Numeracao | Sequencial atomica via Firebase Transaction (inicio: 17000) |
| Filtros | Status, prioridade, tecnico, categoria, setor, busca textual |
| Dashboard | KPIs em tempo real, grafico mensal e de status (Chart.js) |
| Usuarios | Lista por papel, ativacao/desativacao |
| Tecnicos | CRUD completo, vinculacao a usuarios |
| Convites | Link de convite unico por token |
| PDF | Geracao de OS em PDF (jsPDF CDN) |
| Excel | Exportacao com filtros aplicados (SheetJS CDN) |
| Tema | Claro/Escuro, persiste no localStorage |
| Responsivo | Mobile-first, sidebar retratil |

---

## Estrutura do Firebase Realtime Database

```
root/
├── config/contadorOS: 16999
├── usuarios/{uid}: { nome, email, role, tecId, ativo, criadoEm }
├── tecnicos/{id}: { nome, email, telefone, especialidade }
├── ordensServico/{id}: { numero, titulo, status, prioridade, ... }
├── historico/{osId}/{id}: { tipo, descricao, usuario, criadoEm }
├── categorias/{id}: { nome }
├── setores/{id}: { nome }
├── convites/{token}: { nome, role, email, usado, criadoEm }
└── presenca/{uid}: { online, ultimaVez }
```
