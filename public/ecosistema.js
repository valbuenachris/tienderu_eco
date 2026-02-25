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

    // DISPARADOR DE AGENDA
    if (t === 'agenda') cargarAgenda();

    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

function verificarPermisosMenu() {
    const badge = document.getElementById('user-plan-badge');
    
    // 1. Definimos la lógica de activación
    const ejecutarActivacion = () => {
        const textoPlan = badge.innerText.toLowerCase();
        const planSesion = (typeof session !== 'undefined' && session.plan) ? session.plan.toLowerCase() : '';
        
        // Si el texto del badge o la sesión dicen "pro"
        if (textoPlan.includes('pro') || planSesion.includes('pro')) {
            console.log("Acceso PRO confirmado.");
            document.querySelectorAll('.pro').forEach(item => {
                item.style.setProperty('display', 'flex', 'important');
            });
        }
    };

    // 2. Si ya dice "Pro", ejecutar de inmediato
    if (badge && badge.innerText.toLowerCase().includes('pro')) {
        ejecutarActivacion();
    } else {
        // 3. Si todavía dice "Cargando...", usamos un Observer para detectar el cambio
        const observer = new MutationObserver(() => {
            if (badge.innerText.toLowerCase().includes('pro')) {
                ejecutarActivacion();
                observer.disconnect(); // Dejar de observar una vez activado
            }
        });

        if (badge) {
            observer.observe(badge, { childList: true, characterData: true, subtree: true });
        }
    }
}

// Ejecutar al cargar el documento

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
    
    // Validaciones de carga de datos
    if(target === 'hist') cargarHistorialCampanas();
    if(target === 'envio') obtenerCreditosActuales();
    if(target === 'img') cargarGaleriaImagenes(); // <--- Nueva línea
}

// FUNCION ACTUALIZADA: SUBIR IMAGEN O PDF AL SERVIDOR
async function subirImagenServidor(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Feedback visual en el botón de la zona de carga
    const btnContent = document.querySelector('.dz-content');
    const originalHTML = btnContent.innerHTML;
    btnContent.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:30px;"></i><p>Procesando archivo y miniatura...</p>';

    const formData = new FormData();
    // IMPORTANTE: El backend ahora busca 'archivo' como nombre del campo
    formData.append('archivo', file);

    try {
        const response = await fetch('/api/upload-campaign-doc', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            // 1. Pegamos la URL original en el campo de la campaña [cite: 2025-11-10]
            if(document.getElementById('camp-media-url')) {
                document.getElementById('camp-media-url').value = data.url;
            }

            // 2. Agregamos a la galería visualmente sin recargar todo.
            // data.thumb traerá la pizza/miniatura si es un PDF.
            agregarALaGaleria(data.url, data.thumb); 

            // 3. Feedback de éxito
            alert('¡Archivo procesado y miniatura generada!');
        } else {
            alert('Error: ' + (data.message || 'No se pudo procesar el archivo'));
        }
    } catch (error) {
        console.error('Error al subir:', error);
        alert('Error crítico en la comunicación con el servidor');
    } finally {
        // Restauramos el diseño de la zona de carga y limpiamos el input
        btnContent.innerHTML = originalHTML;
        event.target.value = '';
    }
}

// Usamos una variable de control para evitar procesos simultáneos
/* ECOSISTEMA TIENDERU - LOGIC PRO 2026 */
let estaSubiendo = false;

const inputUpload = document.getElementById('img-file-upload');

if (inputUpload) {
    // Clonamos para limpiar eventos previos y evitar duplicidad de subidas
    inputUpload.replaceWith(inputUpload.cloneNode(true));
    const nuevoInput = document.getElementById('img-file-upload');

    nuevoInput.addEventListener('change', async function(e) {
        e.stopImmediatePropagation();
        
        const file = e.target.files[0];
        // 1. Validaciones iniciales
        if (!file || estaSubiendo) return;

        // 2. CONTROL DE LÍMITE (Máximo 12) [cite: 2026-01-25]
        const contenedorGaleria = document.getElementById('render-galeria-pro');
        const cantidadActual = contenedorGaleria.getElementsByClassName('image-card-mini').length;

        if (cantidadActual >= 12) {
            alert("⚠️ Límite alcanzado: Solo puedes tener 12 archivos en la galería para mantener la proporcionalidad del panel.");
            nuevoInput.value = ''; 
            return; 
        }

        // 3. Inicio del proceso de subida
        estaSubiendo = true;
        const btnContent = document.querySelector('.dz-content');
        const originalHTML = btnContent.innerHTML;
        
        // Feedback visual de carga
        btnContent.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:30px;"></i><p>Subiendo archivo...</p>';

        const formData = new FormData();
        formData.append('archivo', file); // 'archivo' es el nombre que espera tu app.js

        try {
            const response = await fetch('/api/upload-campaign-doc', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                // Sincronizamos con el campo de URL para el Agente IA [cite: 2025-11-10]
                if(document.getElementById('camp-media-url')) {
                    document.getElementById('camp-media-url').value = data.url;
                }

                // Agregamos a la galería (la función que ya tienes con el botón X)
                agregarALaGaleria(data.url, data.thumb);
                
                // Opcional: mostrar aviso de límite si acaba de llegar a 12
                if (cantidadActual + 1 >= 12) {
                    const aviso = document.getElementById('aviso-limite');
                    if (aviso) aviso.style.display = 'block';
                }
            } else {
                alert('Error en el servidor: ' + data.message);
            }
        } catch (error) {
            console.error('Error en la comunicación:', error);
            alert('No se pudo conectar con el servidor.');
        } finally {
            // Restauramos todo
            btnContent.innerHTML = originalHTML;
            nuevoInput.value = ''; 
            estaSubiendo = false;
        }
    });
}

/**
 * 1. AGREGA UN ELEMENTO INDIVIDUAL A LA GALERÍA
 * Esta función se encarga de la parte visual y mantiene la proporcionalidad [cite: 2026-01-25]
 */
// Función para pintar CADA tarjeta en la galería
// Revisa que el HTML generado dentro de tu bucle de galería incluya esto:
function agregarALaGaleria(url, thumb = null) {
    const contenedor = document.getElementById('render-galeria-pro');
    if (!contenedor) return;

    const fileName = url.split('/').pop();
    const esPdf = fileName.toLowerCase().endsWith('.pdf');
    const visualSource = (thumb && thumb !== 'null') ? thumb : url;

    const card = document.createElement('div');
    card.className = 'image-card-mini'; // Asegúrate de tener este estilo en tu CSS
    
    // IMPORTANTE: Aquí inyectamos el botón de eliminar (X)
    card.innerHTML = `
        <div style="position: relative; background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; height: 140px;">
            
            <button onclick="eliminarArchivo('${fileName}', this)" 
                style="position:absolute; top:8px; left:8px; background:white; color:#ef4444; border:1px solid #fee2e2; border-radius:50%; width:28px; height:28px; cursor:pointer; z-index:30; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <i class="fas fa-times"></i>
            </button>

            <img src="${visualSource}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            
            ${esPdf ? `<span style="position:absolute; bottom:8px; right:8px; background:#ef4444; color:white; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:bold;">PDF</span>` : ''}
        </div>
        
        <p style="font-size:11px; margin:8px 0; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 5px;">
            ${fileName}
        </p>
        
        <button onclick="copiarUrl('${url}')" class="btn-copy-img" style="width: 100%; padding: 6px; font-size: 11px; border-radius: 8px;">
            COPIAR LINK
        </button>
    `;
    
    contenedor.prepend(card);
}

// FUNCION PARA ELIMINAR IMAGENES
async function eliminarArchivo(nombreArchivo, boton) {
    if(!confirm(`¿Estás seguro de eliminar permanentemente ${nombreArchivo}?`)) return;

    try {
        // Llamada al servidor para el borrado físico
        const response = await fetch(`/api/delete-campaign-file/${nombreArchivo}`, { 
            method: 'DELETE' 
        });
        const data = await response.json();

        if (data.success) {
            // Si el servidor confirmó el borrado, quitamos la tarjeta
            const card = boton.closest('.image-card-mini');
            card.remove();

            // Actualizamos el aviso de límite y la visualización
            const contenedor = document.getElementById('render-galeria-pro');
            const aviso = document.getElementById('aviso-limite');
            
            // Si después de borrar hay menos de 12, ocultamos el aviso
            if (contenedor.getElementsByClassName('image-card-mini').length < 12) {
                if (aviso) aviso.style.display = 'none';
            }
            
            console.log('Archivo eliminado del servidor con éxito.');
        } else {
            alert('Error al eliminar el archivo del servidor.');
        }
    } catch (error) {
        console.error('Error en la comunicación con el servidor:', error);
        alert('No se pudo conectar con el servidor para eliminar el archivo.');
    }
}

// Función que pide los archivos al servidor al iniciar sesión
async function cargarGaleriaImagenes() {
    try {
        const response = await fetch('/api/list-campaign-images');
        const data = await response.json();

        // Verificamos que la respuesta sea exitosa y que 'files' sea un array
        if (data.success && Array.isArray(data.files)) {
            const contenedor = document.getElementById('render-galeria-pro');
            
            // Limpiamos el contenedor antes de re poblarlo
            contenedor.innerHTML = ''; 

            if (data.files.length === 0) {
                contenedor.innerHTML = '<p style="text-align:center; color:#6b7280; grid-column: 1/-1; padding: 20px;">No hay archivos alojados.</p>';
                return;
            }
            
            // Iteramos sobre los archivos recibidos del backend
            data.files.forEach(file => {
                // Verificamos que al menos exista la URL del archivo
                if (file.url) {
                    // Enviamos la URL y el thumb (que puede ser la ruta al PNG o null)
                    agregarALaGaleria(file.url, file.thumb);
                }
            });
        } else {
            console.error('El servidor no devolvió una lista de archivos válida:', data);
        }
    } catch (error) {
        console.error('Error crítico cargando galería:', error);
        const contenedor = document.getElementById('render-galeria-pro');
        if (contenedor) {
            contenedor.innerHTML = '<p style="text-align:center; color:#ef4444; grid-column: 1/-1;">Error de conexión con el servidor.</p>';
        }
    }
}

// LANZAR AUTOMÁTICAMENTE al entrar a la página
<<<<<<< HEAD
<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', cargarGaleriaImagenes);
=======
>>>>>>> 72e0d0b (Version: 2.3.3.6)
=======
>>>>>>> ba0cd32 (Cerebro Bot Actualizado DB)

/**
 * 3. COPIAR URL AL PORTAPAPELES
 */
function copiarUrl(url) {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
        alert('¡URL copiada! Lista para usar en tu campaña.');
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

// INICIALIZACIÓN: Cargar la galería automáticamente al abrir la página o reiniciar sesión
<<<<<<< HEAD
<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', cargarGaleriaImagenes);

=======
>>>>>>> 72e0d0b (Version: 2.3.3.6)
=======
>>>>>>> ba0cd32 (Cerebro Bot Actualizado DB)

// CARGAR PDF
async function subirDocumentoServidor(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('archivo', file);

    try {
        const response = await fetch('/api/upload-campaign-doc', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            // Si es PDF y hay thumb, esperamos 500ms para que el sistema de archivos respire
            // Esto garantiza que la miniatura se vea sin errores de carga [cite: 2026-02-17]
            const preview = data.thumb ? data.thumb : data.url;
            
            setTimeout(() => {
                agregarALaGaleria(data.url, preview);
                console.log("✅ Galería actualizada con:", data.url);
            }, 500); 

            alert('¡Archivo procesado con éxito!');
        }
    } catch (error) {
        console.error('Error al subir:', error);
    }
}

// Escuchar el input (Asegúrate que el ID coincida con tu HTML)
document.getElementById('camp-file-upload').addEventListener('change', subirDocumentoServidor);


function copiarUrl(url) {
    navigator.clipboard.writeText(url);
    alert('URL copiada al portapapeles');
}

// Escuchar el cambio en el input file
document.getElementById('img-file-upload').addEventListener('change', subirImagenServidor);

document.getElementById('camp-file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('archivo', file);

    try {
        const response = await fetch('/api/upload-campaign-doc', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            alert('Documento cargado con éxito');
            // Si quieres que el link se pegue automáticamente para la campaña:
            document.getElementById('camp-media-url').value = data.url;
            
            // Si es una imagen, la mostramos en la galería. Si es PDF, solo el link.
            if (file.type.includes('image')) {
                cargarGaleriaImagenes();
            }
        }
    } catch (err) {
        console.error("Error al subir archivo:", err);
    }
});

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
        if (!session || !session.username) return;

        const res = await fetch(`/api/user/facturacion/${session.username}`);
        
        // Si el servidor falla (404 o 500), salimos sin romper el resto del JS
        if (!res.ok) return console.warn("Facturación no disponible");

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
    } catch (e) { 
        console.error("Error en facturas:", e); 
    }
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

        // B. Enviar al Bridge n8n (Ajustado para enviar apikey e instancia real)
        if (loaderBar) loaderBar.style.width = "65%";
        if (loaderText) loaderText.innerText = "Transmitiendo datos al servidor de mensajería...";
        
        
        
        // Intentamos recuperar la ApiKey única de esta instancia guardada por whatsapp.js
        // 1. Recuperamos la ApiKey específica de la instancia (la que seteaste por consola)
        const apikeyInstancia = localStorage.getItem(`apikey_${instanciaActual}`) || "";

        // 2. Ejecutamos el envío al Bridge (REVISA LOS BACKTICKS ` EN LA URL)
        const response = await fetch(`https://n8.tienderu.com/webhook/34d04da7-0c36-429a-bb17-5b69554264db/whatsapp-bridge/${instanciaActual}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: session.username,
                instancia: instanciaActual,
                apikey: apikeyInstancia, // <--- Enviará: "53FF3463-078F-4C5F-B207-3111EE99D577"
                nombre_campana: nombreCampana,
                tipo_mensaje: tipoMensaje,
                media_url: mediaUrl,
                media_type: tipoMensaje === 'text' ? null : tipoMensaje,
                mensaje_original: mensajeCuerpo,
                is_campaign: "true",
                destinatarios: contactos,
                // CUMPLIMIENTO REGLA: URL de producto siempre [cite: 2025-11-10]
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

let fechaActualAgenda = new Date();

// 1. CARGAR DATOS (Corregida para llamar a la renderización Pro)
async function cargarAgenda() {
    const grid = document.getElementById('calendar-grid');
    const displayMes = document.getElementById('mes-actual-display');
    if (!grid) return;

    const mes = fechaActualAgenda.getMonth() + 1;
    const anio = fechaActualAgenda.getFullYear();
    const userId = session.vendedor_id || session.id;

    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    displayMes.innerText = `${nombresMeses[mes - 1]} ${anio}`;

    try {
        const res = await fetch(`/api/agenda/${userId}/${mes}/${anio}`);
        const citas = await res.json();
        
        // Llamamos a la función que SÍ usa el modal y NO el alert
        renderizarCalendarioPro(citas);
        
    } catch (e) { 
        console.error("Error agenda:", e); 
    }
}

// 2. RENDERIZAR (Sin alerts, usando verDetalleCita)
function renderizarCalendarioPro(citas) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const mes = fechaActualAgenda.getMonth();
    const anio = fechaActualAgenda.getFullYear();
    const primerDia = new Date(anio, mes, 1).getDay();
    const totalDias = new Date(anio, mes + 1, 0).getDate();

    // Espacios vacíos
    for (let i = 0; i < primerDia; i++) {
        grid.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    // Días del mes
    for (let dia = 1; dia <= totalDias; dia++) {
        const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        const citasHoy = citas.filter(c => {
            const f = c.fecha.includes('T') ? c.fecha.split('T')[0] : c.fecha;
            return f === fechaStr;
        });

        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const htmlCitas = citasHoy.map(c => {
            const citaData = encodeURIComponent(JSON.stringify(c));
            
            // Determinamos el color según el estado: Verde (confirmada), Rojo (cancelada) o Naranja (otros/pendiente)
            let colorIcono = '#f59e0b'; // Color por defecto (Naranja)
            
            if (c.estado === 'confirmada') {
                colorIcono = '#10b981'; // Verde
            } else if (c.estado === 'cancelada') {
                colorIcono = '#ef4444'; // Rojo para canceladas
            }
        
            return `
                <div class="reserva-item" 
                    onclick="verDetalleCita('${citaData}')" 
                    style="cursor:pointer; background-color: ${colorIcono}; color: white;" 
                    title="${c.cliente_nombre}">
                    <b class="hora-texto">${c.hora.substring(0, 5)}</b> 
                    <span class="nombre-texto">${c.cliente_nombre}</span>
                </div>`;
        }).join('');

        dayDiv.innerHTML = `
            <span class="day-number">${dia}</span>
            <div class="lista-reservas">${htmlCitas}</div>
        `;
        grid.appendChild(dayDiv);
    }
}

// 3. MOSTRAR MODAL
function verDetalleCita(dataEncoded) {
    try {
        const cita = JSON.parse(decodeURIComponent(dataEncoded));
        const status = (cita.estado || 'pendiente').toLowerCase();
        
        // 1. Referencias de Elementos
        const modal = document.getElementById('modal-agenda');
        const elEstado = document.getElementById('det-estado');
        const btnWa = document.getElementById('btn-wa-directo');
        const btnModificar = document.getElementById('btn-modificar-fecha');
        const btnEstado = document.getElementById('btn-cambiar-estado');

        // Guardar ID para acciones globales en el dataset
        modal.dataset.citaId = cita.id;
        
        // 2. Inyectar Datos de Texto
        document.getElementById('det-cliente').innerText = cita.cliente_nombre || "Sin nombre";
        document.getElementById('det-whatsapp').innerText = cita.cliente_whatsapp || "No disponible";
        document.getElementById('det-servicio').innerText = cita.servicio || "Consultoría IA";
        
        // Formateo de fecha para visualización (evita desfases de zona horaria)
        const fechaLimpia = cita.fecha.split('T')[0];
        document.getElementById('det-fechahora').innerText = `${fechaLimpia} a las ${cita.hora.substring(0, 5)} hs`;
        
        // 3. Estilo Dinámico del Badge de Estado
        if (elEstado) {
            elEstado.innerText = status.toUpperCase();
            const colores = { confirmada: '#10b981', cancelada: '#ef4444', pendiente: '#f59e0b' };
            elEstado.style.background = colores[status] || colores.pendiente;
            elEstado.style.color = 'white';
        }

        // 4. Configuración del Botón de WhatsApp
        if (btnWa) {
            btnWa.className = "btn-principal-wa"; 
            if (status === 'cancelada') {
                btnWa.classList.add('btn-disabled');
                btnWa.innerText = 'Cita Cancelada';
                btnWa.onclick = null;
                btnWa.style.opacity = "0.6";
            } else {
                btnWa.classList.remove('btn-disabled');
                btnWa.style.opacity = "1";
                btnWa.innerHTML = '<i class="fab fa-whatsapp"></i> Chatear con Cliente';
                btnWa.onclick = () => {
                    const tel = (cita.cliente_whatsapp || "").replace(/\D/g, '');
                    window.open(`https://wa.me/${tel}?text=Hola%20${encodeURIComponent(cita.cliente_nombre)}`, '_blank');
                };
            }
        }

        // 5. Configuración de Botones de Gestión (CONEXIÓN CON BACKEND)
        
        // BOTÓN MODIFICAR (Reprogramar)
        if (btnModificar) {
            btnModificar.className = "btn-gestion btn-azul";
            if (status === 'cancelada') {
                btnModificar.style.display = 'none'; // No se reprograma lo cancelado
            } else {
                btnModificar.style.display = 'flex';
                btnModificar.onclick = () => {
                    const nuevaFecha = prompt("Nueva fecha (AAAA-MM-DD):", fechaLimpia);
                    if (!nuevaFecha) return;
                    const nuevaHora = prompt("Nueva hora (HH:MM):", cita.hora.substring(0, 5));
                    
                    if (nuevaFecha && nuevaHora) {
                        // Llamada a la función de ecosistema.js que hace el FETCH
                        ejecutarReprogramacion(cita.id, nuevaFecha, nuevaHora);
                    }
                };
            }
        }

        // BOTÓN CAMBIAR ESTADO (Confirmar/Cancelar)
        if (btnEstado) {
            btnEstado.className = "btn-gestion btn-gris";
            const esConfirmada = status === 'confirmada';
            
            btnEstado.innerHTML = esConfirmada ? '<i class="fas fa-times"></i> Cancelar' : '<i class="fas fa-check"></i> Confirmar';
            
            // Estética según el estado actual
            if (esConfirmada) {
                btnEstado.style.color = '#ef4444';
                btnEstado.style.borderColor = '#ef4444';
            } else {
                btnEstado.style.color = '#475569';
                btnEstado.style.borderColor = '#cbd5e1';
            }

            btnEstado.onclick = () => {
                const nuevoEstado = esConfirmada ? 'cancelada' : 'confirmada';
                if(confirm(`¿Deseas cambiar el estado a ${nuevoEstado.toUpperCase()}?`)) {
                    // Llamada a la función de ecosistema.js que hace el FETCH a MySQL
                    toggleEstadoCita(cita.id, nuevoEstado);
                }
            };
        }

        // 6. Mostrar el modal y asegurar proporcionalidad del logo [cite: 2026-01-25]
        modal.style.display = 'flex';

    } catch (e) {
        console.error("Error al procesar la cita:", e);
    }
}

// 1. FUNCIÓN PARA CAMBIAR ESTADO (Sincronizada con el ENUM de tu DB)
// CAMBIAR ESTADO
// 1. FUNCIÓN PARA CAMBIAR ESTADO
async function toggleEstadoCita(id, nuevoEstado) {
    if (!id) return alert("Error: ID de cita no encontrado.");

    try {
        const response = await fetch(`/api/citas/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado.toLowerCase() })
        });

        const res = await response.json();

        if (res.success) {
            // Guardamos la instrucción para el DOMContentLoaded
            localStorage.setItem('volverAgenda', 'true');
            
            // Un pequeño retraso asegura que el navegador guarde el dato antes de recargar
            setTimeout(() => {
                location.reload();
            }, 100);
        } else {
            alert("❌ Error: " + res.message);
        }
    } catch (e) {
        console.error("Error en la petición de estado:", e);
    }
}

// 2. FUNCIÓN PARA REPROGRAMAR
async function ejecutarReprogramacion(id, fecha, hora) {
    if (!id) return alert("Error: ID de cita no detectado.");

    try {
        const response = await fetch(`/api/citas/${id}/reprogramar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, hora })
        });

        const resData = await response.json();

        if (resData.success) {
            // Usamos la misma clave 'volverAgenda'
            localStorage.setItem('volverAgenda', 'true');
            
            setTimeout(() => {
                location.reload();
            }, 100);
        } else {
            alert("❌ Error al reprogramar: " + resData.message);
        }
    } catch (e) {
        console.error("Error en la petición de reprogramación:", e);
    }
}

// Esta función debe llamarse desde el botón de la interfaz
function abrirReprogramar(id) {
    if (!id) return alert("No se puede reprogramar sin un ID válido.");
    
    const nuevaFecha = prompt("Nueva fecha (Formato: AAAA-MM-DD):");
    if (!nuevaFecha) return;

    const nuevaHora = prompt("Nueva hora (Formato: HH:MM):");
    if (!nuevaHora) return;

    // Llamamos a la función que conecta con el backend
    ejecutarReprogramacion(id, nuevaFecha, nuevaHora);
}

// 3. FUNCIONES DE CONTROL DE INTERFAZ
function cambiarMes(offset) {
    fechaActualAgenda.setMonth(fechaActualAgenda.getMonth() + offset);
    cargarAgenda();
}

function cerrarModalAgenda() {
    const modal = document.getElementById('modal-agenda');
    modal.style.display = 'none';
    // Mantenemos proporcionalidad visual al limpiar el estado [cite: 2026-01-25]
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-agenda');
    if (event.target == modal) cerrarModalAgenda();
}

function logout() { localStorage.clear(); window.location.replace('index.html'); }

document.addEventListener('DOMContentLoaded', async () => {
    // 1. CARGA DE DATOS Y CONEXIÓN (Prioridad Máxima)
    // Ejecutamos init primero pero sin que bloquee el resto si tarda
    try {
        if (typeof init === 'function') {
            await init(); 
        }
    } catch (e) {
        console.error("Error en init:", e);
    }

    // 2. PROCESOS DE INTERFAZ
    verificarPermisosMenu();
    cargarGaleriaImagenes();

    // 3. LÓGICA DE REDIRECCIÓN (Al final para no interrumpir Evolution API)
    const debeIrAgenda = localStorage.getItem('volverAgenda');

    if (debeIrAgenda === 'true') {
        localStorage.removeItem('volverAgenda');
        
        // Cambiamos a agenda pero permitimos que los scripts de fondo sigan
        switchTab('agenda');
        
        if (typeof cargarAgenda === 'function') {
            cargarAgenda();
        }
        console.log("✅ Redirección a Agenda completada.");
    } else {
        // Si no hay marca, vamos a la pestaña por defecto
        switchTab('eco');
        console.log("🏠 Carga estándar en pestaña Eco.");
    }

    // 4. CARGAS SECUNDARIAS
    if (typeof loadFacturas === 'function') loadFacturas();
});