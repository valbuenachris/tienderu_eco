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
   
           // Al verificar estado, también intentamos recuperar/asegurar la apikey de la instancia
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
           // PASO 1. CREAR INSTANCIA Y CAPTURAR APIKEY DE INSTANCIA
           const resCreate = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
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
   
           const dataCreate = await resCreate.json();
           
           // GUARDAMOS LA APIKEY ESPECÍFICA DE LA INSTANCIA (HASH)
           if (dataCreate.hash) {
               localStorage.setItem(`apikey_${instanceName}`, dataCreate.hash);
           } else if (dataCreate.instance && dataCreate.instance.hash) {
               localStorage.setItem(`apikey_${instanceName}`, dataCreate.instance.hash);
           }
   
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
   
           // Si la conexión devuelve datos de instancia, nos aseguramos de tener la apikey guardada
           if (qrData.instance && qrData.instance.hash) {
               localStorage.setItem(`apikey_${instanceName}`, qrData.instance.hash);
           }
   
           if (qrData.base64) {
               qrBox.innerHTML = `<img src="${qrData.base64}" style="width:200px; border-radius:10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border: 3px solid white;">`;
               statusText.innerHTML = '<i class="fas fa-qrcode"></i> ESCANEA EL QR EN TU WHATSAPP';
               checkWAStatus(instanceName);
           } else if (qrData.instance?.state === 'open' || qrData.status === 'CONNECTED') {
               UI_MarcarConectado();
           }
   
       } catch (error) {
           console.error("Error en conexión WA:", error);
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
               
               // Guardar hash si aparece durante el monitoreo
               if (data.instance && data.instance.hash) {
                   localStorage.setItem(`apikey_${instanceName}`, data.instance.hash);
               }
   
               if (data.instance && data.instance.state === 'open') {
                   clearInterval(interval);
                   UI_MarcarConectado();
               }
           } catch (e) {}
       }, 5000);
   }
   
   /**
    * 6. UI: ACTUALIZACIÓN CUANDO ESTÁ CONECTADO
    */
   function UI_MarcarConectado() {
       const qrBox = document.getElementById('wa-qr-box');
       const statusText = document.getElementById('wa-status');
       const instanceInput = document.getElementById('wa-instance-name');
   
       if (qrBox) {
           qrBox.innerHTML = '<i class="fas fa-check-circle" style="font-size:60px; color:#10b981"></i>';
           qrBox.style.background = '#f0fdf4';
           qrBox.style.border = '2px solid #bbf7d0';
           qrBox.style.display = 'flex';
           qrBox.style.alignItems = 'center';
           qrBox.style.justifyContent = 'center';
           qrBox.style.minHeight = '200px'; // Mantiene proporcionalidad del logo y UI
       }
       
       if (statusText) {
           statusText.innerHTML = 'BOT CONECTADO CORRECTAMENTE';
           statusText.style.color = '#10b981';
           statusText.style.fontWeight = '800';
           statusText.style.marginBottom = '15px';
       }
   
       const existingBtn = document.querySelector('button[onclick*="saveAndConnectWA"]');
       
       if (existingBtn) {
           let actionsGroup = document.getElementById('wa-actions-group');
           
           if (!actionsGroup) {
               actionsGroup = document.createElement('div');
               actionsGroup.id = 'wa-actions-group';
               actionsGroup.style.display = 'flex';
               actionsGroup.style.flexDirection = 'column';
               actionsGroup.style.gap = '10px';
               actionsGroup.style.width = '100%';
               
               existingBtn.parentNode.replaceChild(actionsGroup, existingBtn);
           }
   
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
    */
   async function logoutWA() {
       const instanceInput = document.getElementById('wa-instance-name');
       if(!instanceInput || !instanceInput.value) return;
       
       const instanceName = instanceInput.value.trim().toLowerCase().replace(/\s+/g, '');
   
       if(!confirm("⚠️ ¿Estás seguro? Se borrará la conexión y el bot dejará de responder.")) return;
   
       try {
           const res = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
               method: 'DELETE',
               headers: { 'apikey': EVOLUTION_GLOBAL_KEY }
           });
   
           // Limpiamos la apikey guardada localmente al desconectar
           localStorage.removeItem(`apikey_${instanceName}`);
   
           if(res.ok) {
               alert("Bot desconectado exitosamente.");
               location.reload();
           } else {
               alert("La instancia ya estaba cerrada o no existe.");
               location.reload();
           }
       } catch (error) {
           console.error("Error al desconectar:", error);
           alert("Error de red al intentar desconectar.");
       }
   }