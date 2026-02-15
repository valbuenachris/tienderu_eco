/**
 * TIENDERU ADMIN DASHBOARD - FINAL STABLE VERSION 2026
 * Ajuste: Gestión de Vendedores Full Width & Form Reset
 */

// Variables globales para los gráficos
let statusChart = null;
let cityChart = null;

// 1. SESIÓN Y SEGURIDAD
const initAuth = () => {
    const userSession = JSON.parse(localStorage.getItem('user')) || JSON.parse(localStorage.getItem('ss'));
    
    if (!userSession || (userSession.role !== 'admin' && userSession.rol !== 'admin')) {
        console.warn("Acceso no autorizado");
        window.location.href = 'index.html';
    } else {
        const nameDisplay = document.getElementById('admin-display-name');
        if (nameDisplay) {
            nameDisplay.innerText = (userSession.nombre || userSession.username).toUpperCase();
        }
    }
};

// 2. NAVEGACIÓN Y MENÚ MÓVIL
const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
};

const tab = (t) => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetTab = document.getElementById('tab-' + t);
    const targetBtn = document.getElementById('b-' + t);
    
    if (targetTab) targetTab.classList.remove('hidden');
    if (targetBtn) targetBtn.classList.add('active');

    if (t === 'list') loadAdminList();
    if (t === 'home') loadAdminStats();
    if (t === 'staff') loadVendedores(); 
    if (t === 'create') {
        const corteInput = document.getElementById('adm-corte');
        if (corteInput) corteInput.value = new Date().getDate();
    }
};

// 3. CARGA DE COMERCIOS
async function loadAdminList() {
    const container = document.getElementById('admin-table-container');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/list');
        const data = await res.json();
        const usuariosValidos = data.usuarios ? data.usuarios.filter(u => u && u.nombre && u.nombre_pos) : [];

        if (usuariosValidos.length === 0) {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--gray);"><p>No hay comercios activos.</p></div>`;
            return;
        }

        let html = `<table class="desktop-table">
            <thead>
                <tr>
                    <th>Comercio</th>
                    <th>Teléfono</th>
                    <th>Sede</th>
                    <th>Corte</th>
                    <th>Estado</th>
                    <th>Gestión</th>
                </tr>
            </thead>
            <tbody>`;
        
        usuariosValidos.forEach(i => {
            const bc = i.estado === 'pos' ? 'badge-pos' : (i.estado === 'pago' ? 'badge-pago' : 'badge-pop');
            const txt = i.estado === 'pos' ? 'Activo' : (i.estado === 'pago' ? 'En Mora' : 'Suspendido');
            const url = `https://${i.nombre_pos}.tienderu.com`;
            
            html += `<tr>
                <td data-label="Comercio">
                    <div style="text-align: right;">
                        <strong style="display:block; color:var(--dark);">${i.nombre}</strong>
                        <small style="color:var(--primary); font-size:10px;">${url}</small>
                    </div>
                </td>
                <td data-label="Teléfono">
                    <a href="https://wa.me/57${i.telefono}" target="_blank" style="text-decoration:none; color:inherit;">
                        <i class="fab fa-whatsapp" style="color:#25d366"></i> ${i.telefono}
                    </a>
                </td>
                <td data-label="Sede">${i.ciudad || 'N/A'}</td>
                <td data-label="Corte"><strong>${i.dia_pago || '15'}</strong></td>
                <td data-label="Estado"><span class="badge ${bc}">${txt}</span></td>
                <td data-label="Acción" class="actions-cell">
                    <button onclick="updStatus('${i.nombre_pos}','pos','${i.username}')" class="btn-action btn-check"><i class="fas fa-check"></i></button>
                    <button onclick="updStatus('${i.nombre_pos}','pago','${i.username}')" class="btn-action btn-warn"><i class="fas fa-exclamation"></i></button>
                    <button onclick="updStatus('${i.nombre_pos}','pop','${i.username}')" class="btn-action btn-ban"><i class="fas fa-ban"></i></button>
                    <a href="${url}" target="_blank" class="btn-action btn-nav"><i class="fas fa-external-link-alt"></i></a>
                </td>
            </tr>`;
        });
        container.innerHTML = html + '</tbody></table>';
    } catch (e) { container.innerHTML = "<p>Error al cargar lista.</p>"; }
}

// 4. ESTADÍSTICAS

async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const d = await res.json();
        
        // 1. Renderizado de Tarjetas de Estadísticas
        const statsRender = document.getElementById('stats-render');
        if (statsRender && d.global) {
            statsRender.innerHTML = `
                <div class="stat-card">
                    <h4>Activos</h4>
                    <h2 style="color:var(--success)">${d.global.activos || 0}</h2>
                </div>
                <div class="stat-card">
                    <h4>En Mora</h4>
                    <h2 style="color:var(--warning)">${d.global.mora || 0}</h2>
                </div>
                <div class="stat-card">
                    <h4>Suspendidos</h4>
                    <h2 style="color:var(--danger)">${d.global.suspendidos || 0}</h2>
                </div>
                <div class="stat-card">
                    <h4>Total</h4>
                    <h2>${d.global.total || 0}</h2>
                </div>
            `;
        }

        // 2. Gráfico de Estados (Doughnut)
        const ctxStatus = document.getElementById('chartStatus');
        if (ctxStatus) {
            // statusChart debe estar declarada fuera de esta función
            if (window.statusChart) window.statusChart.destroy();
            
            window.statusChart = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Activos', 'Mora', 'Suspendidos'],
                    datasets: [{
                        data: [
                            d.global.activos || 0, 
                            d.global.mora || 0, 
                            d.global.suspendidos || 0
                        ],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    cutout: '70%',
                    plugins: {
                        legend: { 
                            position: 'bottom',
                            labels: { padding: 20, usePointStyle: true }
                        }
                    }
                }
            });
        }

        // 3. Gráfico de Sedes por Ciudad (Barra Horizontal)
        const ctxCities = document.getElementById('chartCities');
        if (ctxCities && d.ciudades) {
            // cityChart debe estar declarada fuera de esta función
            if (window.cityChart) window.cityChart.destroy(); 
            
            window.cityChart = new Chart(ctxCities, {
                type: 'bar',
                data: {
                    labels: d.ciudades.map(c => c.ciudad || 'Sin Ciudad'),
                    datasets: [{
                        label: 'Número de Comercios',
                        data: d.ciudades.map(c => c.cantidad || 0),
                        backgroundColor: '#6366f1', 
                        borderRadius: 8,
                        barThickness: 20
                    }]
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { 
                            beginAtZero: true, 
                            grid: { display: false },
                            ticks: { precision: 0 }
                        },
                        y: { 
                            grid: { display: false } 
                        }
                    },
                    plugins: {
                        legend: { display: false } 
                    }
                }
            });
        }
    } catch (e) { 
        console.error("❌ Error cargando métricas en el Dashboard:", e); 
    }
}

// 5. GESTIÓN DE VENDEDORES (CREAR, CARGAR, ELIMINAR)
async function crearVendedor() {
    const inputNombre = document.getElementById('v-nombre');
    const inputUser = document.getElementById('v-user');
    const inputPass = document.getElementById('v-pass');
    const inputComision = document.getElementById('v-comision');

    const v = {
        nombre: inputNombre.value.trim(),
        username: inputUser.value.trim(),
        password: inputPass.value.trim(),
        comision: inputComision.value || 0
    };

    if(!v.nombre || !v.username || !v.password) {
        alert("⚠️ Completa los campos obligatorios.");
        return;
    }

    showLoader("Registrando Vendedor...");

    try {
        const res = await fetch('/api/admin/crear-vendedor', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(v) 
        });

        if(res.ok) {
            alert("✅ Vendedor creado con éxito.");
            inputNombre.value = '';
            inputUser.value = '';
            inputPass.value = '';
            inputComision.value = '';
            loadVendedores(); 
        } else {
            const data = await res.json();
            alert("❌ Error: " + (data.error || "No se pudo registrar"));
        }
    } catch (e) { 
        alert("❌ Error de red o servidor."); 
    } finally { 
        hideLoader(); 
    }
}

async function loadVendedores() {
    const container = document.getElementById('vendedores-table-container');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/vendedores');
        const vendedores = await res.json();

        if (!vendedores || vendedores.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--gray);">No hay vendedores registrados.</p>`;
            return;
        }

        let html = `<table class="desktop-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>%</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>`;

        vendedores.forEach(v => {
            html += `
                <tr>
                    <td data-label="Nombre"><strong>${v.nombre}</strong></td>
                    <td data-label="Usuario">${v.username}</td>
                    <td data-label="Comisión">${v.comision}%</td>
                    <td data-label="Acción" class="actions-cell">
                        <button onclick="eliminarVendedor('${v.username}')" class="btn-action btn-ban">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });
        
        container.innerHTML = html + '</tbody></table>';
    } catch (e) {
        container.innerHTML = "<p>Error al cargar la lista de vendedores.</p>";
    }
}

async function eliminarVendedor(username) {
    if (!confirm(`¿Seguro que deseas eliminar al vendedor ${username}?`)) return;

    showLoader("Eliminando...");
    try {
        const res = await fetch(`/api/admin/vendedor/${username}`, { method: 'DELETE' });
        if (res.ok) {
            alert("✅ Vendedor eliminado.");
            loadVendedores();
        } else {
            alert("❌ No se pudo eliminar.");
        }
    } catch (e) {
        alert("❌ Error de comunicación.");
    } finally {
        hideLoader();
    }
}

// 6. ACCIONES GENERALES
async function updStatus(cliente, estado, username) {
    showLoader(`Actualizando Estado...`);
    try {
        await fetch('/api/admin/estado', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cliente, estado, username }) 
        });
        loadAdminList();
        loadAdminStats();
    } catch (e) { alert("Error al actualizar estado"); } finally { hideLoader(); }
}

async function runVerifySync() {
    if(!confirm("¿Ejecutar actualización masiva de estados por fecha de corte?")) return;
    
    showLoader("Sincronizando pagos...");
    try {
        const res = await fetch('/api/admin/run-sync-pagos', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        alert(res.ok ? "✅ " + data.message : "❌ Error: " + data.error);
    } catch (e) { 
        alert("❌ Error de conexión con la API"); 
    } finally {
        hideLoader();
        loadAdminList();
        loadAdminStats();
    }
}

// UTILS: LOADER & LOGOUT
const showLoader = (text) => {
    const loader = document.getElementById('loader-overlay');
    const txt = document.getElementById('loader-text');
    if(txt) txt.innerText = text;
    if(loader) loader.style.display = 'flex';
};

const hideLoader = () => {
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.style.display = 'none';
};

const logout = () => { 
    localStorage.clear(); 
    window.location.href = 'index.html'; 
};

window.onload = () => {
    initAuth();
    tab('home');
};