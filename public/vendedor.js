// 1. CONTROL DE SESIÓN Y VARIABLES GLOBALES
const vendedorId = localStorage.getItem('vendedor_id');
const userStored = localStorage.getItem('user');

let myLineChart = null;
let myDoughnutChart = null;

// Configuración común para que los gráficos sean 100% responsivos
const chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150, // Pequeño retraso para recalcular bien tras girar el móvil
    plugins: {
        legend: { display: false }
    }
};

if (!vendedorId || vendedorId === "undefined") {
    window.location.replace('index.html');
}

// 2. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    if (userStored) {
        try {
            const userData = JSON.parse(userStored);
            const profileName = document.getElementById('profile-name');
            if (profileName) profileName.innerText = userData.nombre || "Agente Comercial";
        } catch(e) { console.error("Error datos usuario:", e); }
    }
    cargarDashboard();
});

// Forzar actualización de tamaño de gráficos al cambiar el tamaño de la ventana
window.addEventListener('resize', () => {
    if (myLineChart) myLineChart.resize();
    if (myDoughnutChart) myDoughnutChart.resize();
});

// 3. CARGA DE DATOS
async function cargarDashboard() {
    mostrarLoader(true);
    try {
        const response = await fetch('/api/vendedor/stats/' + vendedorId);
        const data = await response.json();

        if (data.success) {
            // Stats principales
            const { activos, mora, suspendidos, total } = data.stats;
            document.getElementById('count-activos').innerText = activos;
            document.getElementById('count-mora').innerText = mora;
            document.getElementById('count-suspendidos').innerText = suspendidos;
            document.getElementById('count-total').innerText = total;
            document.getElementById('comision-actual').innerText = '$ ' + data.totalMes;

            // Efectividad
            const porc = total > 0 ? Math.round((activos / total) * 100) : 0;
            document.getElementById('perc-efectividad').innerText = porc + '%';
            document.getElementById('label-efectividad').innerText = porc + '%';

            renderizarGraficoComisiones(data.chart);
            renderizarGraficoEfectividad(activos, (total - activos));

            // TABLA CON DATA-LABELS (Crucial para el CSS de tarjetas en móvil)
            const tbody = document.querySelector("#tabla-comercios tbody");
            if (tbody) {
                tbody.innerHTML = data.comercios.map(c => {
                    let textoEstado = "";
                    let claseColor = "";

                    if (c.estado === "pos") { textoEstado = "ACTIVO"; claseColor = "status-verde"; }
                    else if (c.estado === "pago") { textoEstado = "EN MORA"; claseColor = "status-naranja"; }
                    else if (c.estado === "pop") { textoEstado = "SUSPENDIDO"; claseColor = "status-rojo"; }
                    else { textoEstado = c.estado.toUpperCase(); claseColor = "status-verde"; }

                    // [cite: 2025-11-10] URL del producto siempre incluida
                    const urlTienda = c.username ? `${c.username}.tienderu.com` : 'Sin URL';

                    return `
                        <tr>
                            <td data-label="Comercio">
                                <strong>${c.nombre_pos}</strong><br>
                                <a href="https://${urlTienda}" target="_blank" class="comercio-url">${urlTienda}</a>
                            </td>
                            <td data-label="Teléfono">${c.telefono || '---'}</td>
                            <td data-label="Sede">${c.sede || '---'}</td>
                            <td data-label="Corte">Día ${c.corte || '15'}</td>
                            <td data-label="Estado">
                                <span class="status-badge ${claseColor}">${textoEstado}</span>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) { console.error("Error fetch:", err); }
    finally { mostrarLoader(false); }
}

// 4. GRÁFICOS (AJUSTADOS AL ANCHO DEL MÓVIL)
function renderizarGraficoComisiones(datosChart) {
    const ctx = document.getElementById('comisionesChart').getContext('2d');
    if (myLineChart) myLineChart.destroy();
    
    myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datosChart.labels,
            datasets: [{
                label: 'Ingresos',
                data: datosChart.datasets,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            ...chartOptionsBase,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderizarGraficoEfectividad(activos, inactivos) {
    const ctx = document.getElementById('efectividadChart').getContext('2d');
    if (myDoughnutChart) myDoughnutChart.destroy();
    
    myDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Activos', 'Otros'],
            datasets: [{
                data: [activos, inactivos],
                backgroundColor: ['#10b981', '#f1f5f9'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            ...chartOptionsBase,
            cutout: '80%'
        }
    });
}

// 5. NAVEGACIÓN Y MENÚ
function tab(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const targetSection = document.getElementById(id);
    const targetBtn = document.getElementById('b-' + id);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    // Cerrar menú si está en móvil al cambiar de pestaña
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        toggleMenu();
    }
}

function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function mostrarLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

// 6. FORMULARIO Y SESIÓN
async function handleCreate() {
    const pass = document.getElementById('new-pass').value;
    const conf = document.getElementById('new-pass-conf').value;
    if (pass !== conf) { alert("Las contraseñas no coinciden."); return; }

    const formData = {
        vendedor_id: vendedorId,
        nombre_pos: document.getElementById('new-name').value,
        sede: document.getElementById('new-sede').value,
        telefono: document.getElementById('new-phone').value,
        email: document.getElementById('new-email').value,
        password: pass,
        username: document.getElementById('new-subdomain').value
    };

    mostrarLoader(true);
    try {
        const res = await fetch('/api/vendedor/create-pos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await res.json();
        if (result.success) {
            alert("¡Punto de Venta desplegado!");
            document.querySelector('#create form').reset();
            cargarDashboard();
            tab('list');
        } else { alert("Error: " + result.message); }
    } catch (err) { alert("Error de conexión con el servidor."); }
    finally { mostrarLoader(false); }
}

function logout() {
    if (confirm("¿Estás seguro de que deseas salir?")) {
        localStorage.clear();
        window.location.replace('index.html');
    }
}