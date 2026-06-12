// Configuración de Credenciales
const SUPABASE_URL = "https://qjzhlqliempopuntudyc.supabase.co";
const SUPABASE_KEY = "sb_publishable_4zAnWJaBRfljr3zncC84ZA_4LpjScZd";
const supabaseApp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales compartidas entre archivos
let usuarioActualEmail = "";
let listaCierres = [];
let listaProductos = [];
let ventasDetalleMaestro = [];
let datosFiltradosGlobal = [];

// Variables de Control para Modificaciones
let modoEdicionActivo = false;
let fechaEdicionOriginal = "";
let desglosePrevioEdicion = [];

// Función para obtener la hora de Perú exacta
function obtenerFechaLocalPeru() {
    const fechaPeru = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Lima"}));
    const yyyy = fechaPeru.getFullYear();
    const mm = String(fechaPeru.getMonth() + 1).padStart(2, '0');
    const dd = String(fechaPeru.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Inicialización de Interfaz
lucide.createIcons();
document.getElementById('caja-fecha').value = obtenerFechaLocalPeru();
document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
});

// Comportamiento del Menú Lateral Móvil
const sidebar = document.getElementById('sidebar');
document.getElementById('open-sidebar').addEventListener('click', () => sidebar.classList.remove('-translate-x-full'));
document.getElementById('close-sidebar').addEventListener('click', () => sidebar.classList.add('-translate-x-full'));

// Cambios de Pestaña
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

function cambiarPestaña(targetId, buttonNode) {
    navButtons.forEach(b => b.classList.remove('active', 'bg-slate-800', 'text-white'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    buttonNode.classList.add('active', 'bg-slate-800', 'text-white');
    document.getElementById(targetId).classList.add('active');
    document.getElementById('page-title').textContent = buttonNode.innerText.trim();
    sidebar.classList.add('-translate-x-full');
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => cambiarPestaña(btn.getAttribute('data-target'), btn));
});

// Autenticación de Usuario
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseApp.auth.getSession();
    if (session) conectarUsuarioApp(session.user.email);
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('auth-error').classList.add('hidden');
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    const { data, error } = await supabaseApp.auth.signInWithPassword({ email, password });
    if (error) {
        document.getElementById('auth-error').textContent = "Error: " + error.message;
        document.getElementById('auth-error').classList.remove('hidden');
    } else {
        conectarUsuarioApp(data.user.email);
    }
});

async function conectarUsuarioApp(email) {
    usuarioActualEmail = email;
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('opacity-30', 'pointer-events-none');
    document.getElementById('user-display-email').textContent = usuarioActualEmail;
    
    await cargarProductosMaestros();
    await cargarHistorialReal();
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    if(confirm("¿Estás seguro de que deseas cerrar sesión en este dispositivo?")) {
        await supabaseApp.auth.signOut();
        window.location.reload();
    }
});