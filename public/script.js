/* ==========================================================
   TIENDERU - SCRIPT PRINCIPAL (INDEX/LOGIN/REGISTRO) 2026
   ========================================================== */

// --- 1. CONFIGURACIÓN INICIAL Y PARÁMETROS ---
const params = new URLSearchParams(window.location.search);

// --- 2. CARGADORES DE SECCIONES DINÁMICAS ---
async function loadPricing() {
    const placeholder = document.getElementById('pricing-placeholder');
    if (!placeholder) return;
    try {
        const res = await fetch('pricing.html');
        if (!res.ok) throw new Error('No se pudo cargar pricing.html');
        placeholder.innerHTML = await res.text();
        console.log("Pricing inyectado correctamente.");
    } catch (e) { 
        console.error("Error al cargar el pricing:", e); 
    }
}

async function loadFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;
    try {
        const res = await fetch('footer.html');
        if (!res.ok) throw new Error('No se pudo cargar footer.html');
        placeholder.innerHTML = await res.text();
    } catch (e) { 
        console.error("Error al cargar el footer:", e); 
    }
}

// --- 3. INICIALIZACIÓN DEL DOM ---
document.addEventListener("DOMContentLoaded", () => {
    initAuthVisuals();
    loadPricing(); 
    loadFooter();
    checkURLActions();
    
    // Inicializar calculadora de masivos si existe el input
    if (document.getElementById('calc-qty')) {
        calculateWA();
    }
});

// --- 4. GESTIÓN DE AUTENTICACIÓN (LOGIN) ---
async function authUser(u, p) {
    const overlay = document.getElementById('loader-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        
        const data = await res.json();

        if (data.success && data.user) {
            // Limpieza de seguridad
            localStorage.clear();
            sessionStorage.clear();
            
            const userDataString = JSON.stringify(data.user);
            localStorage.setItem('user', userDataString);
            localStorage.setItem('ss', userDataString);

            // Guardar ID de vendedor/usuario
            const vId = data.user.vendedor_id || data.user.id || data.user.ID;
            localStorage.setItem('vendedor_id', vId ? vId.toString() : "0");

            // Redirección por Rol
            const role = (data.user.rol || data.user.role || 'user').toLowerCase().trim();
            if (role === 'admin') {
                window.location.replace('dashboard.html');
            } else if (role === 'vendedor') {
                window.location.replace('vendedor.html');
            } else {
                window.location.replace('ecosistema.html');
            }
        } else {
            if (overlay) overlay.style.display = 'none';
            Swal.fire('Error', data.message || 'Credenciales incorrectas', 'error');
        }
    } catch (err) {
        if (overlay) overlay.style.display = 'none';
        console.error("Login Error:", err);
        Swal.fire('Error', 'No pudimos conectar con el servidor.', 'error');
    }
}

// --- 5. GESTIÓN DE REGISTRO (Llamado desde login.html) ---
async function handleRegister(e) {
    e.preventDefault();
    const overlay = document.getElementById('loader-overlay');
    const loaderText = document.getElementById('loader-text');
    
    if (overlay) overlay.style.display = 'flex';
    if (loaderText) loaderText.innerText = "CONFIGURANDO TU INSTANCIA...";

    const payload = {
        plan: document.getElementById('r-plan').value,
        nombre: document.getElementById('r-nombre').value,
        telefono: document.getElementById('r-tel').value,
        slug: document.getElementById('r-slug') ? document.getElementById('r-slug').value : '',
        username: document.getElementById('r-user').value,
        password: document.getElementById('r-pass').value,
        ciudad: document.getElementById('r-ciu') ? document.getElementById('r-ciu').value : ''
    };

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if(data.success) {
            if (overlay) overlay.style.display = 'none';
            Swal.fire({
                title: '¡Ecosistema Activado!',
                text: 'Tu instancia ha sido creada. Ya puedes iniciar sesión.',
                icon: 'success',
                confirmButtonText: 'IR AL LOGIN'
            }).then(() => {
                if(typeof switchTab === 'function') switchTab('login');
                else window.location.href = 'login.html?tab=login';
            });
        } else {
            if (overlay) overlay.style.display = 'none';
            Swal.fire('Atención', data.message, 'warning');
        }
    } catch (err) {
        if (overlay) overlay.style.display = 'none';
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
}

// --- 6. COMPRA DE PLANES (TABLA DE PRECIOS) ---
window.procesarCompra = function(planKey) {
    console.log("Iniciando validación para:", planKey);
    
    const precios = { 
        'free': '0', 'enterprise': '25000', 'premium': '50000', 'pro': '75000' 
    };
    const monto = precios[planKey.toLowerCase()];

    // Validación estricta de sesión
    const raw = localStorage.getItem('ss') || localStorage.getItem('user');
    let sessionActive = null;
    try {
        if (raw && raw !== "null" && raw !== "undefined") {
            sessionActive = JSON.parse(raw);
        }
    } catch (e) { sessionActive = null; }

    if (!sessionActive || !sessionActive.username) {
        // CASO NO LOGUEADO: Redirigir a login.html
        Swal.fire({
            title: 'Identificación Necesaria',
            text: `Para activar el plan ${planKey.toUpperCase()}, primero debes crear tu cuenta o iniciar sesión.`,
            icon: 'info',
            confirmButtonText: 'IR AL REGISTRO',
            confirmButtonColor: '#4f46e5'
        }).then((result) => {
            if (result.isConfirmed) {
                // [cite: 2025-11-10] URL con parámetros del producto
                window.location.href = `login.html?tab=registro&plan=${planKey.toLowerCase()}&monto=${monto}`;
            }
        });
    } else {
        // CASO LOGUEADO: Ir a Checkout
        // Limpiamos el identificador para que sea alfanumérico puro una sola vez
        const iden = (sessionActive.slug || sessionActive.username.split('@')[0]).replace(/[^a-z0-9]/gi, '');
        
        // IMPORTANTE: plan solo lleva el ID de la tienda, ref lleva el nombre del plan comercial
        window.location.href = `checkout.html?plan=${iden}&monto=${monto}&ref=${planKey.toLowerCase()}`;
    }
};

// --- 7. CALCULADORA DE MASIVOS ---
let currentWAPrice = 25;
let currentWAType = 'texto';

window.setWAType = function(type, price) {
    currentWAType = type;
    currentWAPrice = price;
    document.querySelectorAll('.calc-type-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = type === 'texto' ? document.getElementById('btn-texto') : document.getElementById('btn-multi');
    if (activeBtn) activeBtn.classList.add('active');
    calculateWA();
};

window.calculateWA = function() {
    const qtyInput = document.getElementById('calc-qty');
    if (!qtyInput) return 0;
    const qty = Math.max(0, parseInt(qtyInput.value) || 0);
    const total = qty * currentWAPrice;
    const totalElement = document.getElementById('calc-total');
    if (totalElement) totalElement.innerText = `$${total.toLocaleString()}`;
    return total;
};

window.irAPagarMasivos = function() {
    const cantidad = document.getElementById('calc-qty').value;
    const montoTotal = calculateWA();
    
    const raw = localStorage.getItem('ss') || localStorage.getItem('user');
    let sessionActive = null;
    try {
        if (raw && raw !== "null" && raw !== "undefined") {
            sessionActive = JSON.parse(raw);
        }
    } catch (e) { sessionActive = null; }

    if (!sessionActive || !sessionActive.username) {
        Swal.fire({
            title: 'Identificación Necesaria',
            text: 'Inicia sesión para asociar los créditos a tu cuenta.',
            icon: 'info',
            confirmButtonText: 'IR AL LOGIN',
            confirmButtonColor: '#10b981'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = `login.html?tab=registro&plan=recarga&monto=${montoTotal}`;
            }
        });
    } else {
        const cleanUser = sessionActive.username.toLowerCase().replace(/[^a-z0-9]/gi, '');
        // [cite: 2025-11-10] Formato de plan exacto para n8n
        const planKey = `recarga_${cleanUser}_${cantidad}_${currentWAType}`;
        window.location.href = `checkout.html?plan=${planKey}&monto=${montoTotal}`;
    }
};

// --- 8. UTILIDADES DE INTERFAZ (NAVBAR / MODALES) ---
function initAuthVisuals() {
    const container = document.getElementById('auth-button-container');
    if (!container) return;

    const raw = localStorage.getItem('ss') || localStorage.getItem('user');
    let userSession = null;
    try {
        if (raw && raw !== "null") userSession = JSON.parse(raw);
    } catch(e) { userSession = null; }

    if (userSession && userSession.username) {
        const isAdmin = userSession.role === 'admin' || userSession.rol === 'admin';
        const isVendedor = userSession.vendedor_id && userSession.vendedor_id !== "0";
        
        let destino = 'ecosistema.html';
        if (isAdmin) destino = 'dashboard.html';
        else if (isVendedor) destino = 'vendedor.html';

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 11px; font-weight: 800; color: var(--primary); display: none; @media (min-width: 768px) { display: block; }">
                    HOLA, ${(userSession.nombre || userSession.username).split(' ')[0].toUpperCase()}
                </span>
                <button class="btn-login-nav" onclick="window.location.href='${destino}'" style="background: var(--success); border:none; color:white; padding: 8px 15px; border-radius:8px; cursor:pointer;">
                    <i class="fas fa-th-large"></i> MI PANEL
                </button>
                <button onclick="handleLogout()" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px;" title="Cerrar Sesión">
                    <i class="fas fa-power-off"></i>
                </button>
            </div>
        `;
    }
}

function handleLogout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("index.html");
}

function checkURLActions() {
    const action = params.get('action');
    const plan = params.get('plan');
    if (action === 'checkout' && plan) {
        window.procesarCompra(plan);
    }
}

window.openLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// --- 9. EVENT LISTENERS DE FORMULARIOS ---
document.getElementById('loginFormModal')?.addEventListener('submit', (e) => {
    e.preventDefault();
    authUser(document.getElementById('ml-user').value, document.getElementById('ml-pass').value);
});

document.getElementById('registerForm')?.addEventListener('submit', handleRegister);

/**
 * TIENDERU GLOBAL - script.js
 * Gestión de componentes dinámicos y autenticación
 */

document.addEventListener("DOMContentLoaded", function() {
    // Iniciamos la carga del Navbar al cargar el DOM
    loadNavbar();
});

/**
 * Carga el archivo navbar.html e inyecta el contenido
 */
function loadNavbar() {
    const navContainer = document.getElementById("navbar-placeholder");
    if (!navContainer) {
        console.warn("No se encontró el contenedor #navbar-placeholder en esta página.");
        return;
    }

    // Usamos el path absoluto '/' para asegurar que funcione desde cualquier subcarpeta
    fetch('/navbar.html')
        .then(response => {
            if (!response.ok) throw new Error("Error al cargar navbar.html: " + response.status);
            return response.text();
        })
        .then(data => {
            navContainer.innerHTML = data;
            
            // Forzamos un pequeño delay de renderizado antes de validar la sesión
            requestAnimationFrame(() => {
                validarSesionActiva();
            });
        })
        .catch(error => {
            console.error("Fallo la carga del Navbar dinámico:", error);
        });
}

/**
 * Valida si existe una sesión activa basada en los datos de authUser (app.js)
 * Configura los botones de navegación y sus estilos
 */
function validarSesionActiva() {
    const container = document.getElementById("auth-button-container");
    if (!container) return;

    // Leemos el objeto 'user' guardado por la función authUser de tu app.js
    const userDataString = localStorage.getItem('user');

    if (userDataString) {
        try {
            const user = JSON.parse(userDataString);
            
            // Inyectamos botones para usuario LOGUEADO
            // Usamos estilos inline para asegurar legibilidad (evitar blanco sobre blanco)
            container.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button id="btn-mi-panel" class="btn-panel-nav" style="
                        background-color: #4f46e5 !important;
                        color: #ffffff !important;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 10px;
                        font-weight: 700;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
                    ">
                        <i class="fas fa-th-large"></i> MI PANEL
                    </button>
                    
                    <button id="btn-logout" class="btn-logout-nav" title="Cerrar Sesión" style="
                        background-color: #fee2e2;
                        color: #ef4444;
                        border: none;
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: 0.3s;
                    ">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;

            // Lógica de redirección por ROL (Igual a la de tu app.js)
            document.getElementById("btn-mi-panel").onclick = function() {
                const role = (user.rol || user.role || 'user').toLowerCase().trim();
                
                if (role === 'admin') {
                    window.location.href = '/dashboard.html';
                } else if (role === 'vendedor') {
                    window.location.href = '/vendedor.html';
                } else {
                    window.location.href = '/ecosistema.html';
                }
            };

            // Lógica de Cierre de Sesión
            document.getElementById("btn-logout").onclick = function() {
                // Limpieza total como en authUser
                localStorage.clear();
                sessionStorage.clear();
                // Redirigir al inicio
                window.location.href = '/index.html';
            };

        } catch (e) {
            console.error("Error al procesar los datos de sesión:", e);
            mostrarBotonAcceder(container);
        }
    } else {
        // Si no hay sesión, mostramos el botón de ACCEDER normal
        mostrarBotonAcceder(container);
    }
}

/**
 * Renderiza el botón de login por defecto
 */
function mostrarBotonAcceder(container) {
    container.innerHTML = `
        <button class="btn-login-nav" onclick="window.location.href='/login.html'" style="
            background: transparent;
            color: #4f46e5;
            border: 2px solid #4f46e5;
            padding: 10px 22px;
            border-radius: 10px;
            font-weight: 700;
            cursor: pointer;
            transition: 0.3s;
        ">
            <i class="fas fa-user" style="margin-right: 8px;"></i> ACCEDER
        </button>
    `;
}

/**
 * Función auxiliar para asegurar la proporcionalidad del logo tras inyección [cite: 2026-01-25]
 * Previene deformaciones en cualquier resolución
 */
window.addEventListener('resize', function() {
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.style.height = "40px";
        logo.style.width = "auto";
        logo.style.objectFit = "contain";
    }
});