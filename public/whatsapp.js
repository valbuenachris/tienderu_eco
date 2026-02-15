/* ==========================================================
   TIENDERU - WHATSAPP.JS (CONTROL TOTAL: QR, ESTADO Y LOGOUT)
   ========================================================== */

   const EVOLUTION_API_URL = 'https://evoapi.tienderu.com'; 
   const EVOLUTION_GLOBAL_KEY = 'UDm3ik8V579GPJCOS4ov66Sfr8dejAi9Mv8jdtZzGNM='; 
   
   /**
    * 1. INICIALIZACIÓN AUTOMÁTICA
    */
   document.addEventListener("DOMContentLoaded", () => {
       setTimeout(() => {
           checkInitialStatus();
       }, 1500);
   });
   
   /**
    * 2. VERIFICACIÓN DE ESTADO INICIAL
    */
   async function checkInitialStatus() {
       const instanceInput = document.getElementById('wa-instance-name');
       if(!instanceInput || !instanceInput.value) return;
   
       const instanceName = instanceInput.value.trim().toLowerCase().replace(/\s+/g, '');
       
       try {
           const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
               method: 'GET',
               headers: { 'apikey': EVOLUTION_GLOBAL_KEY }
           });
           const data = await res.json();
   
           if (data.instance && data.instance.state === 'open') {
               UI_MarcarConectado();
           }
       } catch (e) {
           console.log("Instancia no inicializada.");
       }
   }
   
   /**
    * 3. FUNCIÓN PRINCIPAL: GENERAR CONEXIÓN / QR
    */
   async function saveAndConnectWA() {
       const instanceInput = document.getElementById('wa-instance-name');
       const qrBox = document.getElementById('wa-qr-box');
       const statusText = document.getElementById('wa-status');
   
       if(!instanceInput.value.trim()) return alert("Error: No se detectó el nombre del POS");
       const instanceName = instanceInput.value.trim().toLowerCase().replace(/\s+/g, '');
   
       const WEBHOOK_URL = `https://n8.tienderu.com/webhook/34d04da7-0c36-429a-bb17-5b69554264db/whatsapp-bridge/${instanceName}`;
   
       qrBox.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:30px; color:#4f46e5"></i><p style="font-size:10px; margin-top:10px;">Configurando Instancia...</p>';
   
       try {
           // PASO 1. CREAR INSTANCIA
           await fetch(`${EVOLUTION_API_URL}/instance/create`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_GLOBAL_KEY },
               body: JSON.stringify({ 
                   instanceName: instanceName, 
                   qrcode: true,
                   integration: "WHATSAPP-BAILEYS",
                   webhook: {
                       enabled: true,
                       url: WEBHOOK_URL,
                       webhook_by_events: false,
                       webhook_base64: false,
                       events: ["MESSAGES_UPSERT"]
                   }
               })
           });
   
           await new Promise(r => setTimeout(r, 1200));
   
           // PASO 2. SETEO WEBHOOK
           await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_GLOBAL_KEY },
               body: JSON.stringify({
                   enabled: true, url: WEBHOOK_URL, webhook_by_events: false, webhook_base64: false, events: ["MESSAGES_UPSERT"]
               })
           });
   
           const qrRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
               method: 'GET',
               headers: { 'apikey': EVOLUTION_GLOBAL_KEY }
           });
   
           const qrData = await qrRes.json();
   
           if (qrData.base64) {
               qrBox.innerHTML = `<img src="${qrData.base64}" style="width:200px; border-radius:10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border: 3px solid white;">`;
               statusText.innerHTML = '<i class="fas fa-qrcode"></i> ESCANEA EL QR EN TU WHATSAPP';
               checkWAStatus(instanceName);
           } else if (qrData.instance?.state === 'open' || qrData.status === 'CONNECTED') {
               UI_MarcarConectado();
           }
   
       } catch (error) {
           qrBox.innerHTML = '<p style="color:red; font-size:10px">Error de conexión</p>';
       }
   }
   
   /**
    * 4. MONITOREO DE ESCANEO
    */
   async function checkWAStatus(instanceName) {
       const interval = setInterval(async () => {
           try {
               const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
                   method: 'GET',
                   headers: { 'apikey': EVOLUTION_GLOBAL_KEY }
               });
               const data = await res.json();
               if (data.instance && data.instance.state === 'open') {
                   clearInterval(interval);
                   UI_MarcarConectado();
               }
           } catch (e) {}
       }, 5000);
   }
   
   /**
 * 6. UI: ACTUALIZACIÓN CUANDO ESTÁ CONECTADO
 * Se asegura de mostrar AMBOS botones (Regenerar y Desconectar) de forma vertical.
 */
function UI_MarcarConectado() {
    const qrBox = document.getElementById('wa-qr-box');
    const statusText = document.getElementById('wa-status');
    const instanceInput = document.getElementById('wa-instance-name');

    // 1. Actualizamos el cuadro del QR con el check verde
    if (qrBox) {
        qrBox.innerHTML = '<i class="fas fa-check-circle" style="font-size:60px; color:#10b981"></i>';
        qrBox.style.background = '#f0fdf4';
        qrBox.style.border = '2px solid #bbf7d0';
        qrBox.style.display = 'flex';
        qrBox.style.alignItems = 'center';
        qrBox.style.justifyContent = 'center';
    }
    
    // 2. Actualizamos el texto de estado
    if (statusText) {
        statusText.innerHTML = 'BOT CONECTADO CORRECTAMENTE';
        statusText.style.color = '#10b981';
        statusText.style.fontWeight = '800';
        statusText.style.marginBottom = '15px';
    }

    // 3. Localizamos el botón original para reemplazarlo por la nueva botonera
    // Buscamos cualquier botón que tenga la función de conectar para sustituirlo
    const existingBtn = document.querySelector('button[onclick*="saveAndConnectWA"]');
    
    if (existingBtn) {
        // Creamos un contenedor para los nuevos botones si no existe
        let actionsGroup = document.getElementById('wa-actions-group');
        
        if (!actionsGroup) {
            actionsGroup = document.createElement('div');
            actionsGroup.id = 'wa-actions-group';
            actionsGroup.style.display = 'flex';
            actionsGroup.style.flexDirection = 'column';
            actionsGroup.style.gap = '10px';
            actionsGroup.style.width = '100%';
            
            // Insertamos el nuevo grupo justo donde estaba el botón anterior
            existingBtn.parentNode.replaceChild(actionsGroup, existingBtn);
        }

        // Inyectamos los dos botones con estilos que combinan con tu diseño Pro
        actionsGroup.innerHTML = `
            <button onclick="saveAndConnectWA()" class="btn-main" style="background:#059669; color:white; width:100%; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-sync-alt"></i> REGENERAR CONEXIÓN
            </button>
            <button onclick="logoutWA()" class="btn-main" style="background:#ef4444; color:white; width:100%; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-power-off"></i> DESCONECTAR BOT
            </button>
        `;
    }
}

/**
 * 5. FUNCIÓN DE DESCONEXIÓN (LOGOUT)
 * Borra la instancia en la Evolution API y limpia la interfaz.
 */
async function logoutWA() {
    const instanceInput = document.getElementById('wa-instance-name');
    if(!instanceInput || !instanceInput.value) return;
    
    const instanceName = instanceInput.value.trim().toLowerCase().replace(/\s+/g, '');

    if(!confirm("⚠️ ¿Estás seguro? Se borrará la conexión y el bot dejará de responder.")) return;

    try {
        // Intentamos borrar la instancia de la API
        const res = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': EVOLUTION_GLOBAL_KEY }
        });

        if(res.ok) {
            alert("Bot desconectado exitosamente.");
            location.reload(); // Recargamos para volver al estado inicial
        } else {
            alert("La instancia ya estaba cerrada o no existe.");
            location.reload();
        }
    } catch (error) {
        console.error("Error al desconectar:", error);
        alert("Error de red al intentar desconectar.");
    }
}