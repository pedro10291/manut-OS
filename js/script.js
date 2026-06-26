import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBhg5OtVBvO8UwN9urmmGN8EC2n21iL_u4",
    authDomain: "sistema-os-5923c.firebaseapp.com",
    databaseURL: "https://sistema-os-5923c-default-rtdb.firebaseio.com/",
    projectId: "sistema-os-5923c",
    storageBucket: "sistema-os-5923c.firebasestorage.app",
    messagingSenderId: "1087548477429",
    appId: "1:1087548477429:web:aacf473df2836eb43e1abc"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let db = [];
let curFilter = 'all';
let curStatus = 'aberto';
let curTec = null;
let editId = null;
let curView = 'painel';
let ssmaRespostas = { q1: null, q2: null, q3: null };
let pecas = [];

const TEC = {
    jhonatan: { label: 'Jhonatan', sub: 'Predial', av: 'av-j', initials: 'JH', phone: '5511985070553' },
    jorge: { label: 'Jorge F.', sub: 'Elétrica', av: 'av-jo', initials: 'JO', phone: '5511984610163' },
    hugo: { label: 'Zé Hugo', sub: 'Elétrica', av: 'av-zh', initials: 'ZH', phone: '5511985070529' }
};
const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Andamento', concluido: 'Concluído', assinando: 'Aguard. assinatura', fechado: 'Fechado' };
const PILL_CLASS = { aberto: 'p-aberto', andamento: 'p-andamento', concluido: 'p-concluido', assinando: 'p-assinando', fechado: 'p-fechado' };

// Sincronização do Banco de Dados
onValue(ref(database, 'os'), (snapshot) => {
    const data = snapshot.val();
    db = data ? Object.values(data) : [];
    if (curView === 'painel') renderPainel();
    if (curView === 'os') renderOSList();
});

function goView(v) {
    curView = v;
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + v)?.classList.add('active');
    document.getElementById('nav-' + v)?.classList.add('active');
    if (v === 'painel') renderPainel();
    if (v === 'os') renderOSList();
    if (v === 'tec-link') renderTecSelect();
}

function openDrawer(id) {
    editId = id || null; curTec = null; curStatus = 'aberto';
    document.getElementById('drawer-title').textContent = id ? 'Editar OS' : 'Nova OS';
    document.getElementById('ov1').classList.add('show');
    document.getElementById('drawer1').classList.add('open');
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
        document.getElementById('f-data').value = new Date().toISOString().slice(0, 10);
    }
}

function closeDrawer() {
    document.getElementById('ov1').classList.remove('show');
    document.getElementById('drawer1').classList.remove('open');
}

function saveOS() {
    const id = editId || 'os_' + Date.now();
    const data = {
        id: id,
        chamado: document.getElementById('f-chamado').value.trim(),
        problema: document.getElementById('f-problema').value.trim(),
        esp: document.getElementById('f-esp').value,
        data: document.getElementById('f-data').value,
        area: document.getElementById('f-area').value.trim(),
        solicitante: document.getElementById('f-solicitante').value.trim(),
        desc: document.getElementById('f-desc').value.trim(),
        tec: curTec,
        status: curStatus
    };
    
    if (!editId) {
        data.sigTec = null; data.sigSol = null; data.pecas = []; 
        data.ssma = { q1: null, q2: null, q3: null };
    } else {
        const original = db.find(x => x.id === id);
        Object.assign(data, original);
    }

    set(ref(database, 'os/' + id), data);
    toast('Salvo no Firebase!');
    closeDrawer();
}

function confirmarOS(id) {
    const osRef = ref(database, 'os/' + id);
    const os = db.find(x => x.id === id);
    const updatedOS = {
        ...os,
        sigTec: document.getElementById('sig-tec').toDataURL(),
        sigSol: document.getElementById('sig-sol').toDataURL(),
        pecas: pecas,
        iniciada: document.getElementById('tec-inicio').value,
        concluida: document.getElementById('tec-fim').value,
        servicoRealizado: document.getElementById('tec-servico').value,
        ssma: { ...ssmaRespostas },
        status: 'assinando'
    };
    update(osRef, updatedOS);
    toast('Dados salvos!');
}

function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function fmtDate(d) { return d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—'; }

window.onload = () => {
    const osId = new URLSearchParams(window.location.search).get('os');
    if (osId) {
        document.querySelector('.sidebar-container')?.style.display = 'none';
        goView('tec-link');
        onValue(ref(database, 'os/' + osId), (snap) => { if (snap.exists()) renderTecPage(osId); }, { onlyOnce: true });
    } else { renderPainel(); }
};
