/* ECOSISTEMA TIENDERU - LOGIC PRO 2026 */
const session = JSON.parse(localStorage.getItem('ss')) || JSON.parse(localStorage.getItem('user'));
if (!session || !session.username) {
    console.log("Sesión no encontrada, regresando al index...");
    window.location.href = 'index.html'; 
}

let userData = {};
let listaContactosFinal = []; 

// --- 1. NAVEGACIÓN Y SOPORTE RESPONSIVE ---
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function toggleEcoMenu() {
    const submenu = document.getElementById('eco-submenu');
    if (submenu) {
        submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
    }
}

function toggleMediaInput() {
    const type = document.getElementById('camp-type').value;
    const imgContainer = document.getElementById('container-url-imagen');
    const docContainer = document.getElementById('container-upload-doc');

    if(imgContainer) imgContainer.style.display = (type === 'image') ? 'block' : 'none';
    if(docContainer) docContainer.style.display = (type === 'document') ? 'block' : 'none';
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${t}`);
    if (targetTab) targetTab.classList.add('active');

    const targetBtn = document.getElementById(`btn-${t}`);
    if (targetBtn) targetBtn.classList.add('active');

    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

function switchSubTab(target) {
    document.querySelectorAll('.sub-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.btn-sub-tab').forEach(b => b.classList.remove('active'));
    
    const targetEl = document.getElementById(`sub-${target}`);
    if(targetEl) {
        targetEl.style.display = 'block';
        if(window.innerWidth <= 768) window.scrollTo({top: 0, behavior: 'smooth'});
    }
    
    const btnEl = document.getElementById(`btn-sub-${target}`);
    if(btnEl) btnEl.classList.add('active');
    
    if(target === 'hist') cargarHistorialCampanas();
    if(target === 'envio') obtenerCreditosActuales();
}

// --- 2. INICIALIZACIÓN Y CARGA DE DATOS ---
async function init() {
    try {
        const res = await fetch(`/api/user/info/${session.username}`);
        userData = await res.json();
        
        const welcomeEl = document.getElementById('user-welcome');
        const sideNameEl = document.getElementById('side-user-name');
        
        if (welcomeEl) welcomeEl.innerText = `¡Hola, ${userData.nombre}!`;
        if (sideNameEl) sideNameEl.innerText = userData.nombre;
        
        const planElement = document.getElementById('user-plan-badge');
        if (planElement && userData.plan) {
            planElement.innerText = `Plan ${userData.plan}`;
            if (userData.plan.toLowerCase() === 'pro') planElement.classList.add('plan-pro');
        }
        
        const fields = {
            'wa-instance-name': userData.nombre_pos,
            'p-nombre': userData.nombre,
            'p-user': session.username,
            'p-tel': userData.telefono,
            'p-ciu': userData.city,
            'p-dir': userData.direccion || 'No registrada',
            'p-url': `${userData.nombre_pos}.tienderu.com`,
            'bot-prompt': userData.prompt
        };

        for (let id in fields) {
            let el = document.getElementById(id);
            if(el) el.value = fields[id] || '';
        }

        aplicarFiltroPlanes(userData.plan);
        loadFacturas(); 
        cargarListasRepositorio();
        obtenerCreditosActuales();
        
    } catch (e) { console.error("Error init:", e); }
}

// --- 3. FACTURACIÓN Y CRÉDITOS ---
async function obtenerCreditosActuales() {
    try {
        const response = await fetch(`/api/user/creditos/${session.username}`);
        const data = await response.json();
        const txtEl = document.getElementById('display-creditos-texto');
        const mulEl = document.getElementById('display-creditos-multi');
        if (txtEl) txtEl.innerText = data.creditos_texto || 0;
        if (mulEl) mulEl.innerText = data.creditos_multi || 0;
    } catch (e) { console.error("Error créditos:", e); }
}

async function loadFacturas() {
    try {
        const res = await fetch(`/api/user/facturacion/${session.username}`);
        const facts = await res.json();
        const container = document.getElementById('render-facturas');
        if(!container) return;
        if (facts.length === 0) {
            container.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay facturas.</td></tr>';
            return;
        }
        container.innerHTML = facts.map(f => {
            let estadoClase = f.estado.toUpperCase() === 'PAGADO' ? 'badge-activo' : 'badge-mora';
            return `<tr>
                <td><strong>${f.periodo}</strong></td>
                <td>$${Number(f.monto).toLocaleString()}</td>
                <td><span class="badge ${estadoClase}">${f.estado}</span></td>
                <td><button onclick="generarTirilla('${f.periodo}','${f.monto}','${f.estado}')" class="btn-tirilla"><i class="fas fa-file-pdf"></i> Ver PDF</button></td>
            </tr>`;
        }).join('');
    } catch (e) { console.error(e); }
}

// --- 4. GESTIÓN DE LISTAS ---
function procesarArchivoCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const lineas = e.target.result.split('\n');
        let nuevos = [];
        lineas.forEach((linea, index) => {
            if (index === 0 && linea.toLowerCase().includes('nombre')) return;
            const columnas = linea.split(',');
            if (columnas.length >= 2) {
                const nombreRaw = columnas[0] ? columnas[0].trim() : "";
                const celularRaw = columnas[1] ? columnas[1].trim().replace(/\D/g, '') : "";
                if (nombreRaw !== "" && celularRaw !== "") {
                    nuevos.push({ nombre: nombreRaw, celular: celularRaw });
                }
            }
        });
        listaContactosFinal = [...nuevos]; 
        const fileInfo = document.getElementById('file-info');
        if (fileInfo) fileInfo.innerHTML = `<i class="fas fa-check"></i> ${nuevos.length} contactos cargados.`;
    };
    reader.readAsText(file);
}

async function guardarNuevaLista() {
    const nombreInput = document.getElementById('nuevo-nombre-lista');
    const manualInput = document.getElementById('lista-manual-input');
    const infoArchivo = document.getElementById('file-info');
    const nombre = nombreInput.value.trim();

    let contactosFinales = [];
    if (manualInput && manualInput.value.trim() !== "") {
        const lineas = manualInput.value.split('\n');
        contactosFinales = lineas.map(linea => {
            const partes = linea.split(',');
            return { 
                nombre: partes[0] ? partes[0].trim() : '', 
                celular: partes[1] ? partes[1].trim().replace(/\D/g, '') : '' 
            };
        }).filter(item => item.nombre !== '' && item.celular !== '');
    } else if (listaContactosFinal.length > 0) {
        contactosFinales = listaContactosFinal;
    }

    if (!nombre || contactosFinales.length === 0) return alert("⚠️ Verifica nombre y contactos.");

    try {
        const res = await fetch('/api/campanas/guardar-lista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: session.username, nombre_lista: nombre, contactos: contactosFinales })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert("✅ Lista guardada.");
            nombreInput.value = "";
            if (manualInput) manualInput.value = "";
            if (infoArchivo) infoArchivo.innerHTML = "";
            listaContactosFinal = []; 
            cargarListasRepositorio();
        }
    } catch (e) { console.error(e); }
}

async function cargarListasRepositorio() {
    try {
        const res = await fetch(`/api/campanas/listas/${session.username}`);
        const listas = await res.json();
        const select = document.getElementById('camp-group-select');
        if (select) {
            select.innerHTML = '<option value="">-- Seleccionar Lista --</option>' + 
                listas.map(l => `<option value="${l.id}">${l.nombre_lista} (${l.total_contactos} contactos)</option>`).join('');
        }
        const container = document.getElementById('render-listas-repo');
        if (container) {
            container.innerHTML = listas.map(l => `
                <div class="lista-card">
                    <div class="lista-card-icon"><i class="fas fa-users"></i></div>
                    <div class="lista-card-info"><h3>${l.nombre_lista}</h3><p>${l.total_contactos} Contactos</p></div>
                    <button class="btn-delete-lista" onclick="eliminarLista(${l.id})"><i class="fas fa-trash-alt"></i></button>
                </div>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function eliminarLista(id) {
    if (!confirm("⚠️ ¿Eliminar lista?")) return;
    try {
        const res = await fetch(`/api/campanas/lista/eliminar/${id}`, { method: 'DELETE' });
        if (res.ok) cargarListasRepositorio();
    } catch (e) { console.error(e); }
}

// --- 5. GESTIÓN DE CARGA DE ARCHIVOS (SOLUCIÓN DEFINITIVA ANTI-BLOQUEO) ---
const uploadBtn = document.getElementById('camp-file-upload');

if (uploadBtn) {
    uploadBtn.onchange = function(e) {
        const file = e.target.files[0];
        const dropzone = document.querySelector('.mini-dropzone');
        const dropzoneText = dropzone ? dropzone.querySelector('p') : null;
        const mediaInput = document.getElementById('camp-media-url');

        if (!file) return;

        // 1. Validación de peso (5MB - según tu app.js)
        if (file.size > 5 * 1024 * 1024) {
            alert("⚠️ Archivo muy grande. El límite es de 5MB.");
            this.value = "";
            return;
        }

        // 2. Feedback visual
        if (dropzone) {
            dropzone.classList.add('uploading');
            if (dropzoneText) dropzoneText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Conectando...`;
        }

        const formData = new FormData();
        // CLAVE: 'archivo' debe coincidir con upload.single('archivo') de tu app.js
        formData.append('archivo', file);

        // 3. Usamos XMLHttpRequest para forzar la persistencia de la conexión
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/campanas/upload-doc', true);

        // Evitar que el navegador intente adivinar el content-type (deja que XHR lo haga)
        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable && dropzoneText) {
                const percent = Math.round((event.loaded / event.total) * 100);
                dropzoneText.innerHTML = `<i class="fas fa-sync fa-spin"></i> Subiendo: ${percent}%`;
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        if (mediaInput) mediaInput.value = data.url;
                        if (dropzone) {
                            dropzone.classList.remove('uploading');
                            dropzone.classList.add('success');
                        }
                        if (dropzoneText) dropzoneText.innerHTML = `<i class="fas fa-check-circle"></i> ${file.name} listo`;
                        console.log("✅ Servidor respondió con URL:", data.url);
                    }
                } catch (err) {
                    console.error("❌ Error parseando JSON:", err);
                }
            } else {
                showError(dropzone, dropzoneText, `Error ${xhr.status}`);
            }
        };

        xhr.onerror = function() {
            showError(dropzone, dropzoneText, "Conexión rechazada por el servidor");
        };

        xhr.send(formData);
    };
}

function showError(dz, txt, msg) {
    if (dz) dz.classList.remove('uploading');
    if (txt) txt.innerHTML = `<i class="fas fa-times-circle"></i> Error de Red`;
    alert(`❌ No se pudo subir el archivo.\n\nCausa: ${msg}\n\nPosible solución: Intenta guardar el documento como PDF en lugar de Word.`);
}

// --- 6. LANZAMIENTO DE CAMPAÑA (RECONSTRUIDA CON PEAJE DE CONEXIÓN "OPEN") ---
// FUNCIÓN ACTUALIZADA: LANZAR CAMPAÑA IA (PRO 2026)
async function lanzarCampañaIA(event) {
    if (event) event.preventDefault();
    
    // 0. Referencias de UI
    const btn = event.currentTarget || event.target;
    const overlay = document.getElementById('loading-overlay');
    const loaderBar = document.getElementById('loader-bar');
    const loaderText = overlay ? overlay.querySelector('p') : null;
    
    // 1. Captura de datos
    const inputMedia = document.getElementById('camp-media-url');
    const mediaUrl = inputMedia ? inputMedia.value.trim() : "";
    const nombreCampana = document.getElementById('camp-name-input').value.trim();
    const mensajeCuerpo = document.getElementById('camp-msg').value.trim();
    const tipoMensaje = document.getElementById('camp-type').value;
    const listaSelect = document.getElementById('camp-group-select');
    
    // Importante: Usar nombre_pos si existe para la URL y la instancia
    const slugInstancia = userData.nombre_pos || session.username;
    const instanciaActual = document.getElementById('wa-instance-name')?.value || slugInstancia;

    // 2. Extracción de cantidad de contactos desde el SELECT
    const textoOpcion = listaSelect.options[listaSelect.selectedIndex]?.text || "";
    const match = textoOpcion.match(/\((\d+)/); 
    const totalContactos = match ? parseInt(match[1]) : 0;

    // --- BLOQUE DE VALIDACIONES DE SEGURIDAD ---
    if (!nombreCampana) return alert("⚠️ Dale un nombre a tu campaña.");
    if (!listaSelect.value || totalContactos <= 0) return alert("⚠️ Selecciona una lista válida con contactos.");
    if (!mensajeCuerpo) return alert("⚠️ Escribe el mensaje de la campaña.");
    if (tipoMensaje !== 'text' && !mediaUrl) return alert("⚠️ El archivo multimedia no se ha cargado. Por favor, súbelo primero.");

    // 3. VALIDACIÓN DE CRÉDITOS (PRE-ENVÍO)
    const sTexto = parseInt(document.getElementById('display-creditos-texto')?.innerText) || 0;
    const sMulti = parseInt(document.getElementById('display-creditos-multi')?.innerText) || 0;

    if (tipoMensaje === 'text') {
        if (sTexto < totalContactos) return alert(`❌ Saldo insuficiente texto (${sTexto}/${totalContactos}).`);
    } else {
        if (sMulti < totalContactos) return alert(`❌ Saldo insuficiente multimedia (${sMulti}/${totalContactos}).`);
    }

    // --- PEAJE CRÍTICO: VERIFICACIÓN DE CONEXIÓN WHATSAPP ---
    try {
        const resStatus = await fetch(`/api/servicios/status-whatsapp/${instanciaActual}`);
        const dataStatus = await resStatus.json();

        if (!dataStatus.success || dataStatus.state !== "open") {
            alert("⚠️ WhatsApp Desconectado: Debes vincular tu QR antes de lanzar una campaña.");
            if (typeof switchTab === 'function') switchTab('wa'); 
            return;
        }
    } catch (err) {
        console.error("Error en peaje:", err);
        return alert("❌ Error al verificar conexión. Intenta de nuevo.");
    }

    // Confirmación final
    if (!confirm(`¿Confirmas el envío a ${totalContactos} contactos?\nSe descontarán ${totalContactos} créditos de tu saldo.`)) return;

    // --- INICIO DEL PROCESO ---
    if (overlay) overlay.style.display = 'flex';
    btn.disabled = true;
    
    if (loaderBar) { loaderBar.style.width = "10%"; loaderBar.style.backgroundColor = "#6366f1"; }
    if (loaderText) loaderText.innerText = "Preparando motores de envío...";

    try {
        // A. Obtener contactos
        if (loaderBar) loaderBar.style.width = "30%";
        if (loaderText) loaderText.innerText = `Extrayendo ${totalContactos} destinatarios...`;
        
        const resC = await fetch(`/api/campanas/contactos/${listaSelect.value}`);
        const contactos = await resC.json();

        // B. Enviar al Bridge n8n (Cumpliendo regla 2025-11-10 de incluir URL)
        if (loaderBar) loaderBar.style.width = "65%";
        if (loaderText) loaderText.innerText = "Transmitiendo datos al servidor de mensajería...";
        
        const response = await fetch('https://n8.tienderu.com/webhook/34d04da7-0c36-429a-bb17-5b69554264db/whatsapp-bridge/instancia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: session.username,
                instancia: instanciaActual,
                nombre_campana: nombreCampana,
                tipo_mensaje: tipoMensaje,
                media_url: mediaUrl,
                media_type: tipoMensaje === 'text' ? null : tipoMensaje,
                mensaje_original: mensajeCuerpo,
                is_campaign: "true",
                destinatarios: contactos,
                // REGLA: Incluir URL del producto/tienda siempre
                catalog_url: `https://${slugInstancia}.tienderu.com` 
            })
        });

        if (response.ok) {
            // C. DESCUENTO DE CRÉDITOS
            if (loaderBar) loaderBar.style.width = "85%";
            if (loaderText) loaderText.innerText = "Actualizando tu saldo...";
            
            await fetch('/api/user/descontar-creditos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: session.username,
                    cantidad: totalContactos,
                    tipo: tipoMensaje === 'text' ? 'texto' : 'multi'
                })
            });

            // D. Registro en Historial
            if (loaderBar) { loaderBar.style.width = "100%"; loaderBar.style.backgroundColor = "#10b981"; }
            if (loaderText) loaderText.innerText = "¡Envío masivo completado!";
            
            await fetch('/api/campanas/historial/guardar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: session.username, 
                    nombre: nombreCampana, 
                    enviados: totalContactos 
                })
            });

            setTimeout(() => {
                alert(`🚀 ¡Campaña "${nombreCampana}" enviada exitosamente!`);
                if (typeof obtenerCreditosActuales === 'function') obtenerCreditosActuales();
                if (typeof cargarHistorialCampanas === 'function') cargarHistorialCampanas();
                // Limpiar campos manualmente si no existe la función limpiar
                document.getElementById('camp-name-input').value = "";
                document.getElementById('camp-msg').value = "";
            }, 600);
            
        } else {
            throw new Error("Respuesta de servidor fallida");
        }
    } catch (e) {
        console.error("Error en campaña:", e);
        alert("❌ Hubo un problema al procesar el envío. Revisa tu conexión o créditos.");
    } finally {
        setTimeout(() => {
            if (overlay) overlay.style.display = 'none';
            btn.disabled = false;
        }, 1200);
    }
}

// Función auxiliar para resetear el formulario tras el éxito
function limpiarFormularioCampaña() {
    const ids = ['camp-name-input', 'camp-msg', 'camp-media-url', 'camp-group-select'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const dz = document.querySelector('.mini-dropzone');
    if (dz) {
        dz.classList.remove('success', 'uploading');
        const p = dz.querySelector('p');
        if(p) p.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Clic para subir`;
    }
}

function limpiarFormularioCampaña() {
    const fields = ['camp-name-input', 'camp-msg', 'camp-media-url', 'camp-group-select'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const dz = document.querySelector('.mini-dropzone');
    if (dz) {
        dz.classList.remove('success', 'uploading');
        const p = dz.querySelector('p');
        if(p) p.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Clic para subir`;
    }
}

// --- 7. UTILIDADES, PDF Y QR (LÓGICA POS RESTAURADA) ---
async function generarTirilla(periodo, monto, estado) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 190] });
    const numFactura = Math.floor(Math.random() * 900000) + 100000;

    const logoData = getBase64Image('main-logo-img'); 
    if (logoData) doc.addImage(logoData, 'PNG', 20, 8, 40, 12); 
    else doc.text("TIENDERU", 40, 15, {align:"center"});

    doc.setFontSize(7).text("TIENDERU CLOUD S.A.S", 40, 24, {align:"center"});
    doc.text("NIT: 901.352.478-1", 40, 28, {align:"center"});
    doc.text("Bogotá, Colombia - soporte@tienderu.com", 40, 32, {align:"center"});
    doc.line(5, 40, 75, 40);
    
    doc.setFont("helvetica", "bold").setFontSize(9).text(`FACTURA POS No. ${numFactura}`, 40, 47, {align:"center"});
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 5, 55);
    doc.text(`Cliente: ${userData.nombre.toUpperCase()}`, 5, 60);
    doc.text(`Periodo: ${periodo}`, 5, 65);

    doc.setFillColor(240, 240, 240).rect(5, 72, 70, 7, 'F');
    doc.text("CONCEPTO", 7, 77);
    doc.text("VALOR", 73, 77, {align:"right"});
    doc.text("Suscripción POS Cloud", 7, 86);
    doc.text(`$${Number(monto).toLocaleString()}`, 73, 86, {align:"right"});

    doc.line(5, 92, 75, 92);
    doc.text("TOTAL A PAGAR:", 5, 98);
    doc.text(`$${Number(monto).toLocaleString()}`, 73, 98, {align:"right"});

    const qrContainer = document.getElementById('qr-hidden');
    if(qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, { text: `TIENDERU-FAC-${numFactura}`, width: 128, height: 128 });
        setTimeout(() => {
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) doc.addImage(canvas.toDataURL("image/png"), 'PNG', 28, 110, 24, 24);
            window.open(URL.createObjectURL(doc.output('blob')), '_blank');
        }, 300);
    }
}

function getBase64Image(imgId) {
    const img = document.getElementById(imgId);
    if (!img || !img.complete) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
}

async function guardarCerebroBot() {
    const promptInput = document.getElementById('bot-prompt');
    const btn = document.getElementById('btn-save-brain');
    const promptValue = promptInput.value;

    // 1. Obtener la sesión y validar el ID
    const rawSession = localStorage.getItem('ss') || localStorage.getItem('user');
    const session = rawSession ? JSON.parse(rawSession) : null;
    
    // Intentamos capturar el ID de cualquier variante posible
    const userId = session?.id || session?.ID || session?.vendedor_id || localStorage.getItem('vendedor_id');

    if (!userId) {
        return Swal.fire('Sesión Expirada', 'No pudimos identificar tu usuario. Por favor, reingresa.', 'error');
    }

    // UI: Estado de carga
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> GUARDANDO EN DB...`;

    try {
        const response = await fetch('/api/update-bot-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                prompt: promptValue
            })
        });

        const result = await response.json();

        if (result.success) {
            // [cite: 2025-11-10] Actualizamos el storage local para que el cambio persista visualmente
            session.prompt = promptValue;
            localStorage.setItem('ss', JSON.stringify(session));

            Swal.fire({
                title: '¡Sincronizado!',
                text: 'El cerebro de tu IA ha sido actualizado en la nube.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            throw new Error(result.message || "Error al actualizar");
        }
    } catch (error) {
        console.error("Error en fetch:", error);
        Swal.fire('Error de Conexión', 'La base de datos no respondió. Verifica tu internet.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function aplicarFiltroPlanes(plan) {
    const p = (plan || 'starter').toLowerCase();
    const niveles = {
        'starter': ['camp', 'wa'],
        'enterprise': ['camp', 'wa', 'pos', 'shop'],
        'premium': ['camp',  'wa', 'pos', 'shop',  'support'],
        'pro': ['camp',  'wa', 'pos', 'shop', 'support', 'crm', 'marketing', 'finance', 'bots']
    };
    const permitidos = niveles[p] || niveles['enterprise'];
    ['camp',  'wa', 'pos', 'shop', 'support', 'crm', 'marketing', 'finance', 'bots'].forEach(id => {
        const el = document.getElementById(`card-${id}`);
        const btn = document.getElementById(`btn-${id}`);
        if(el) el.style.display = permitidos.includes(id) ? 'block' : 'none';
        if(btn) btn.style.display = permitidos.includes(id) ? 'flex' : 'none';
    });
}

async function cargarHistorialCampanas() {
    try {
        const res = await fetch(`/api/campanas/historial/${session.username}`);
        const data = await res.json();
        const container = document.getElementById('render-historial-campanas');
        if (!container) return;
        container.innerHTML = data.map(c => `
            <tr>
                <td>${c.nombre}</td>
                <td>${c.enviados}</td>
                <td>${c.fecha}</td>
                <td><span class="badge-status">${c.estado}</span></td>
            </tr>`).join('');
    } catch (e) { console.error(e); }
}

async function ejecutarPOS() {
    try {
        const res = await fetch('/api/servicios/ejecutar-pos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: userData.nombre_pos })
        });
        const data = await res.json();
        if (data.action === 'open') window.open(data.url, '_blank');
        else alert("🚀 Desplegando...");
    } catch (e) { console.error(e); }
}

function logout() { localStorage.clear(); window.location.replace('index.html'); }

document.addEventListener("DOMContentLoaded", init);