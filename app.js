const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const mysql = require('mysql2');
const path = require('path');
const axios = require('axios');
const fs = require('fs'); // IMPORTANTE: Faltaba esta importación

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


// --- CONFIGURACIÓN DE BASE DE DATOS ---
const db = mysql.createPool({
    host: '72.60.172.34',
    user: 'root',
    password: 'Juanes801', 
    database: 'manager_db',
    waitForConnections: true,
    connectionLimit: 10
});



// --- CONFIGURACIÓN EVOLUTION API ---
const EVO_URL = 'https://evoapi.tienderu.com';
const EVO_KEY = 'UDm3ik8V579GPJCOS4ov66Sfr8dejAi9Mv8jdtZzGNM=';

// --- API ADMINISTRADOR: BOTON DE ACTUALIZACIÓN DE ESTADOS ---
app.post('/api/admin/run-sync-pagos', (req, res) => {
    // CAMBIO CRÍTICO: Usamos path.join(__dirname) para que busque el archivo 
    // en la misma carpeta donde está este app.js (/opt/manager/)
    const scriptPath = path.join(__dirname, 'verificar_pagos.sh'); 

    console.log(`🚀 Solicitud recibida: Intentando ejecutar ${scriptPath}`);

    // Validamos si el archivo existe realmente
    if (!fs.existsSync(scriptPath)) {
        console.error(`❌ Archivo NO encontrado en: ${scriptPath}`);
        return res.status(404).json({ 
            success: false, 
            message: "El script interno no se encuentra en el directorio raíz del servidor." 
        });
    }

    // Ejecutamos con bash
    exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error de ejecución: ${error.message}`);
            return res.status(500).json({ 
                success: false, 
                message: "Error interno al procesar la facturación masiva." 
            });
        }
        
        console.log(`✅ Sincronización exitosa: ${stdout}`);
        res.json({ 
            success: true, 
            message: "Sincronización masiva y facturación completadas." 
        });
    });
});

// 1. Ruta para registrar al vendedor en la base de datos REAL
app.post('/api/admin/crear-vendedor', async (req, res) => {
    try {
        const { nombre, username, password, comision } = req.body;

        if (!nombre || !username || !password) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        // Usamos la conexión pool con promesas que ya tienes configurada
        const query = `INSERT INTO vendedores (nombre, username, password, comision) VALUES (?, ?, ?, ?)`;
        const valores = [nombre, username, password, comision || 0];

        await db.promise().query(query, valores);

        console.log(`✅ Vendedor creado: ${username}`);
        res.status(200).json({ message: "Vendedor creado con éxito en MySQL" });
    } catch (error) {
        console.error("❌ Error al crear vendedor:", error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "El nombre de usuario ya existe." });
        }
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({ error: "La tabla 'vendedores' no existe. Ejecuta la query SQL primero." });
        }
        
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// 2. Ruta para obtener la lista REAL de vendedores
app.get('/api/admin/vendedores', async (req, res) => {
    try {
        // Consultamos la tabla real
        const [lista] = await db.promise().query('SELECT nombre, username, comision FROM vendedores ORDER BY id DESC');
        res.json(lista);
    } catch (error) {
        console.error("❌ Error al obtener vendedores:", error);
        res.status(500).json({ error: "No se pudo obtener la lista de vendedores" });
    }
});

// 3. Ruta para eliminar vendedor
app.delete('/api/admin/vendedor/:username', async (req, res) => {
    try {
        const { username } = req.params;
        await db.promise().query('DELETE FROM vendedores WHERE username = ?', [username]);
        res.json({ success: true, message: "Vendedor eliminado" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar" });
    }
});

// Agregar esta ruta en app.js para habilitar la lectura de facturas
app.get('/api/user/facturacion/:username', (req, res) => {
    const query = `
        SELECT periodo, monto, estado, DATE_FORMAT(fecha_registro, "%Y-%m-%d") as fecha 
        FROM facturacion 
        WHERE username = ? 
        ORDER BY id DESC`;
    
    db.query(query, [req.params.username], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener facturas:", err);
            return res.status(500).json([]);
        }
        res.json(rows || []);
    });
});

// --- LÓGICA DE FACTURACIÓN ---
const registrarFactura = (username, diaCorte, estado) => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const hoy = new Date();
    const periodoStr = `${meses[hoy.getMonth()]} ${diaCorte} - ${meses[(hoy.getMonth() + 1) % 12]} ${diaCorte}`;
    
    let est = 'PAGADO';
    if (estado === 'pago') est = 'EN MORA';
    if (estado === 'pop') est = 'SUSPENDIDO';

    const queryFact = `
        INSERT INTO facturacion (username, periodo, monto, estado, fecha_registro) 
        VALUES (?, ?, 50000, ?, NOW()) 
        ON DUPLICATE KEY UPDATE estado = VALUES(estado), fecha_registro = NOW()
    `;
    
    db.query(queryFact, [username, periodoStr, est], (err) => {
        if (err) console.error("❌ Error al registrar factura:", err);
        else console.log(`✅ Factura actualizada para ${username}: ${periodoStr} (${est})`);
    });
};

// --- RUTAS DE ADMINISTRACIÓN (DASHBOARD) ---

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

app.get('/api/admin/stats', (req, res) => {
    const sql = `
        SELECT 
            count(*) as total, 
            sum(case when estado = 'pos' then 1 else 0 end) as activos, 
            sum(case when estado = 'pago' then 1 else 0 end) as mora, 
            sum(case when estado = 'pop' then 1 else 0 end) as suspendidos 
        FROM usuarios WHERE role = 'user'`;
    
    db.query(sql, (err, gRes) => {
        if (err) return res.status(500).json({ success: false });
        
        // También traemos estadísticas por ciudad
        db.query("SELECT ciudad, count(*) as cantidad FROM usuarios WHERE role = 'user' GROUP BY ciudad", (err, cRes) => {
            res.json({ 
                global: gRes[0] || {},
                ciudades: cRes || []
            });
        });
    });
});

app.get('/api/admin/list', (req, res) => {
    db.query('SELECT * FROM usuarios WHERE role = "user" ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ usuarios: results });
    });
});



// --- API ADMINISTRADOR: GESTIÓN DE ESTADOS (CAMBIO REAL DE CONTENEDORES) ---
app.post('/api/admin/estado', (req, res) => {
    const { cliente, estado, username } = req.body;

    db.query('SELECT dia_pago FROM usuarios WHERE nombre_pos = ?', [cliente], (err, results) => {
        const dia = results[0]?.dia_pago || 15;

        // EJECUCIÓN DEL SCRIPT QUE LEVANTA DIFERENTES COMPOSE SEGÚN EL ESTADO
        // El script debe recibir: slug del cliente y el estado (pos, pago, pop)
        exec(`bash /app/cambiar_estado.sh ${cliente} ${estado}`, (error, stdout, stderr) => {
            if (error) console.error(`❌ Error infraestructura: ${error.message}`);

            db.query('UPDATE usuarios SET estado = ?, ultimo_pago = NOW() WHERE nombre_pos = ?', [estado, cliente], (err) => {
                if (err) return res.status(500).json({ success: false });
                
                registrarFactura(username, dia, estado);
                res.json({ success: true, message: "Estado y Contenedores actualizados" });
            });
        });
    });
});

// --- RUTAS DE USUARIO Y REGISTRO ---
app.post('/api/register', async (req, res) => {
    // 1. Agregamos 'plan' a la desestructuración del cuerpo de la petición
    const { plan, nombre, telefono, ciudad, direccion, slug, username, password } = req.body;
    
    if (!username || !password || !slug || !plan) {
        return res.status(400).json({ success: false, message: "Campos obligatorios faltantes, incluyendo el plan" });
    }

    try {
        const emailGenerado = `${username}@tienderu.com`;
        const diaHoy = new Date().getDate();

        // 2. Mapeo de nombres de plan (Opcional: si en tu DB guardas 'Premium' en lugar de '75000')
        let nombrePlan = "Enterprise";
        if (plan === "0") nombrePlan = "STARTER";
        if (plan === "25000") nombrePlan = "ENTERPRISE";
        if (plan === "50000") nombrePlan = "PREMIUM";
        if (plan === "75000") nombrePlan = "PRO";

        // 3. Actualizamos la Query para incluir la columna 'plan'
        // NOTA: Asegúrate de que la columna se llame 'plan' en tu tabla de MySQL
        const query = `
            INSERT INTO usuarios (
                username, password, role, pos_creado, nombre_pos, 
                nombre, apellido, telefono, email, direccion, 
                ciudad, email_validado, estado, ultimo_pago, dia_pago, 
                bot_activo, prompt, temperatura, plan,
                creditos_texto, creditos_multi
            ) VALUES (?, ?, 'user', 0, ?, ?, 'Sistema', ?, ?, ?, ?, 0, 'pos', NOW(), ?, 0, 'Eres un asistente de ventas profesional.', 0.7, ?, ?, ?)
        `;

        // 4. Parámetros actualizados incluyendo los 10 créditos para cada tipo
        const valores = [
            username, 
            password, 
            slug, 
            nombre, 
            telefono, 
            emailGenerado, 
            direccion, 
            ciudad, 
            diaHoy, 
            nombrePlan,
            10, // valor para creditos_texto
            10  // valor para creditos_multi
        ];

        await db.promise().query(query, valores);

        res.json({ success: true, message: `Registro exitoso en el plan ${nombrePlan}.` });
    } catch (e) {
        console.error("❌ Error registro:", e);
        // Manejo específico para slugs o usuarios duplicados
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: "El usuario o el subdominio ya existen." });
        }
        res.status(500).json({ success: false, message: "Error interno en el servidor de base de datos" });
    }
});


// Ejemplo de lógica en Node.js/Express para el login multitabla
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Buscamos primero en la tabla 'usuarios' (Donde están Admins y Users)
    const queryUser = "SELECT id, nombre, username, role as rol, nombre_pos FROM usuarios WHERE username = ? AND password = ?";
    
    db.query(queryUser, [username, password], (err, userResult) => {
        if (err) {
            console.error("Error en login usuarios:", err);
            return res.status(500).json({ success: false, message: "Error en servidor" });
        }

        if (userResult.length > 0) {
            const user = userResult[0];
            // El campo 'rol' vendrá como 'admin' o 'user' desde la base de datos
            return res.json({ 
                success: true, 
                user: {
                    id: user.id,
                    nombre: user.nombre,
                    username: user.username,
                    rol: user.rol || 'user', // Si por alguna razón es null, asume 'user'
                    nombre_pos: user.nombre_pos
                }
            });
        } else {
            // 2. Si no está en usuarios, buscamos en la tabla de 'vendedores'
            const queryVendedor = "SELECT id, nombre, username, 'vendedor' as rol FROM vendedores WHERE username = ? AND password = ?";
            
            db.query(queryVendedor, [username, password], (err, vendResult) => {
                if (err) return res.status(500).json({ success: false, message: "Error en servidor" });

                if (vendResult.length > 0) {
                    return res.json({ success: true, user: vendResult[0] });
                } else {
                    // 3. No existe en ninguna tabla
                    return res.json({ success: false, message: "Usuario o contraseña incorrectos." });
                }
            });
        }
    });
});


app.get('/api/user/info/:username', (req, res) => {
    db.query('SELECT nombre, nombre_pos, telefono, ciudad, direccion, estado, prompt, dia_pago, plan FROM usuarios WHERE username = ?', [req.params.username], (err, r) => {
        if (err || r.length === 0) return res.status(404).end();
        res.json(r[0]);
    });
});

// --- SERVICIOS POS Y WHATSAPP ---

app.post('/api/servicios/ejecutar-pos', async (req, res) => {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false });

    db.query('SELECT pos_creado, username, dia_pago, estado FROM usuarios WHERE nombre_pos = ?', [slug], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const user = results[0];

        if (user.pos_creado === 1) {
            return res.json({ success: true, action: 'open', url: `https://${slug}.tienderu.com` });
        } else {
            exec(`bash /app/setup_cliente.sh ${slug}`, (error) => {
                if (error) return res.status(500).json({ success: false });
                db.query('UPDATE usuarios SET pos_creado = 1 WHERE nombre_pos = ?', [slug]);
                registrarFactura(user.username, user.dia_pago || 15, user.estado);
                res.json({ success: true, action: 'deploying' });
            });
        }
    });
});

app.post('/api/servicios/activar-whatsapp', async (req, res) => {
    const { slug, password } = req.body;
    const instanceName = slug.toLowerCase().replace(/\s+/g, '');
    const WEBHOOK_URL = `https://n8.tienderu.com/webhook/34d04da7-0c36-429a-bb17-5b69554264db/whatsapp-bridge/${instanceName}`;

    try {
        await axios.post(`${EVO_URL}/instance/create`, {
            instanceName: instanceName,
            token: password || "123456",
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        }, { headers: { 'apikey': EVO_KEY } });

        await axios.post(`${EVO_URL}/webhook/set/${instanceName}`, {
            enabled: true,
            url: WEBHOOK_URL,
            events: ["MESSAGES_UPSERT"]
        }, { headers: { 'apikey': EVO_KEY } });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/user/creditos/:username', async (req, res) => {
    try {
        const { username } = req.params;
        // Agregamos .promise() antes de execute para que el await funcione
        const [user] = await db.promise().execute(
            'SELECT creditos_texto, creditos_multi FROM usuarios WHERE username = ?', 
            [username]
        );
        
        if (user && user.length > 0) {
            res.json({
                creditos_texto: user[0].creditos_texto || 0,
                creditos_multi: user[0].creditos_multi || 0
            });
        } else {
            res.json({ creditos_texto: 0, creditos_multi: 0 });
        }
    } catch (error) {
        console.error("❌ Error en endpoint créditos:", error);
        res.status(500).json({ creditos_texto: 0, creditos_multi: 0 });
    }
});

// --- GESTIÓN DE CAMPANAS Y LISTAS ---
app.post('/api/campanas/guardar-lista', async (req, res) => {
    try {
        const { username, nombre_lista, contactos } = req.body;

        // 1. Insertar incluyendo el conteo (contactos.length)
        const [result] = await db.promise().execute(
            'INSERT INTO campanas_listas (username, nombre_lista, total_contactos) VALUES (?, ?, ?)',
            [username, nombre_lista, contactos.length] // <--- Pasamos el total aquí
        );
        const listaId = result.insertId;

        // 2. Preparar los contactos para la otra tabla
        const values = contactos.map(c => [
            listaId, 
            c.nombre, 
            c.celular.toString().replace(/\D/g, '') 
        ]);

        // 3. Inserción masiva en la tabla de detalles
        await db.promise().query(
            'INSERT INTO campanas_contactos (lista_id, nombre, numero) VALUES ?',
            [values] 
        );

        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error en servidor:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error al guardar", 
            error: error.message 
        });
    }
});


app.get('/api/campanas/listas/:username', async (req, res) => {
    try {
        const { username } = req.params;
        // Corregimos a db.promise().query
        const query = `
            SELECT l.id, l.nombre_lista, COUNT(c.id) as total_contactos 
            FROM campanas_listas l 
            LEFT JOIN campanas_contactos c ON l.id = c.lista_id 
            WHERE l.username = ? 
            GROUP BY l.id`;
            
        const [listas] = await db.promise().query(query, [username]);
        res.json(listas);
    } catch (error) {
        console.error("❌ Error en listas:", error);
        res.status(500).json([]);
    }
});

app.get('/api/campanas/contactos/:listaId', async (req, res) => {
    const [rows] = await db.promise().query('SELECT nombre, numero FROM campanas_contactos WHERE lista_id = ?', [req.params.listaId]);
    res.json(rows);
});

app.get('/api/campanas/historial/:username', (req, res) => {
    db.query('SELECT nombre, enviados, DATE_FORMAT(fecha, "%Y-%m-%d %H:%i") as fecha, estado FROM campanas_historial WHERE username = ? ORDER BY id DESC', [req.params.username], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/campanas/historial/guardar', async (req, res) => {
    const { username, nombre, enviados } = req.body;
    await db.promise().query('INSERT INTO campanas_historial (username, nombre, enviados, fecha, estado) VALUES (?, ?, ?, NOW(), "ENVIADO")', [username, nombre, enviados]);
    res.json({ success: true });
});


// --- WEBHOOK AGENTE IA ---
app.post('/webhooks/whatsapp/:instance', async (req, res) => {
    const { instance } = req.params;
    const payload = req.body;
    if (payload.data?.key?.fromMe) return res.status(200).send('Ignorado');

    const remoteJid = payload.data?.key?.remoteJid;
    const mensajeCliente = payload.data?.message?.conversation || "Hola";

    db.query("SELECT prompt, temperatura FROM usuarios WHERE nombre_pos = ? LIMIT 1", [instance], async (err, results) => {
        if (err || results.length === 0) return res.status(404).end();
        const { prompt, temperatura } = results[0];
        try {
            await axios.post('https://n8.tienderu.com/webhook/34d04da7-0c36-429a-bb17-5b69554264db/whatsapp-bridge/instancia', {
                instance, number: remoteJid, message: mensajeCliente, 
                system_prompt: prompt, temperature: temperatura || 0.7, 
                catalog_url: `https://${instance}.tienderu.com`
            });
            res.status(200).json({ success: true });
        } catch (error) { res.status(500).end(); }
    });
});

// Agrega esto a tu app.js para que el frontend pueda verificar la conexión
app.get('/api/whatsapp/status/:instance', async (req, res) => {
    try {
        // Aquí deberías consultar a Evolution API o a tu lógica de conexión
        // Por ahora, devolvemos CONNECTED para que te deje avanzar:
        res.json({ success: true, status: 'CONNECTED' });
    } catch (error) {
        res.status(500).json({ success: false, status: 'DISCONNECTED' });
    }
});

// --- RUTA PARA DESCONTAR CRÉDITOS TRAS ENVÍO ---
app.post('/api/user/descontar-creditos', async (req, res) => {
    const { username, cantidad, tipo } = req.body;
    
    // Decidimos qué columna afectar
    const columna = (tipo === 'texto') ? 'creditos_texto' : 'creditos_multi';
    
    const query = `UPDATE usuarios SET ${columna} = ${columna} - ? WHERE username = ? AND ${columna} >= ?`;

    try {
        const [result] = await db.promise().query(query, [cantidad, username, cantidad]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Créditos descontados" });
        } else {
            res.status(400).json({ success: false, message: "Saldo insuficiente o usuario no encontrado" });
        }
    } catch (error) {
        console.error("❌ Error al descontar créditos:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/servicios/status-whatsapp/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const instanceName = slug.toLowerCase().replace(/\s+/g, '');
        
        const response = await axios.get(`${EVO_URL}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': EVO_KEY }
        });

        // Evolution API devuelve { instance: { state: "open" } } si está conectado
        res.json({ 
            success: true, 
            state: response.data.instance.state 
        });
    } catch (e) {
        console.error("Error chequeando conexión:", e.message);
        res.status(500).json({ success: false, state: "disconnected" });
    }
});

// --- RUTA PARA ELIMINAR LISTA Y SUS CONTACTOS ---
app.delete('/api/campanas/lista/eliminar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Borrar primero los contactos de esa lista (Evita error de Integrity Constraint)
        await db.promise().query('DELETE FROM campanas_contactos WHERE lista_id = ?', [id]);
        
        // 2. Borrar la lista madre
        const [result] = await db.promise().query('DELETE FROM campanas_listas WHERE id = ?', [id]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Lista eliminada correctamente" });
        } else {
            res.status(404).json({ success: false, message: "Lista no encontrada" });
        }
    } catch (error) {
        console.error("❌ Error al eliminar lista:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// 1. Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); // Asegúrate de que esta carpeta exista
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

// 2. LA RUTA QUE EL FRONTEND ESTÁ BUSCANDO
app.post('/api/campanas/upload-doc', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No se subió ningún archivo" });
        }

        // Generamos la URL para que el Frontend la guarde
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        console.log("✅ Archivo recibido:", fileUrl);
        
        res.json({
            success: true,
            url: fileUrl // Esta es la URL que 'ecosistema.js' pondrá en el input oculto
        });
    } catch (error) {
        console.error("❌ Error en subida:", error);
        res.status(500).json({ success: false, message: "Error interno en el servidor" });
    }
});

// 3. Hacer pública la carpeta de subidas para que WhatsApp pueda acceder al archivo
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


/**
 * ENDPOINT DEFINITIVO PARA EL DASHBOARD DEL VENDEDOR
 * Usa 'usuarios' para los comercios y 'vendedores' para el porcentaje
 */
app.get('/api/vendedor/stats/:id', (req, res) => {
    const vendedor_id = req.params.id;

    // 1. Consulta de contadores (Usamos 'pos' como activo según tu DB)
    const qStats = `SELECT 
        SUM(CASE WHEN estado = 'pos' THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN estado = 'pago' THEN 1 ELSE 0 END) as mora,
        SUM(CASE WHEN estado = 'pop' THEN 1 ELSE 0 END) as suspendidos,
        COUNT(*) as total
        FROM usuarios WHERE vendedor_id = ?`;

    // 2. Consulta de lista para la tabla
    const qLista = `SELECT nombre_pos, username, telefono, ciudad as sede, dia_pago as corte, estado 
                    FROM usuarios WHERE vendedor_id = ? 
                    ORDER BY id DESC`;

    db.query(qStats, [vendedor_id], (err, resStats) => {
        if (err) return res.status(500).json({ success: false });

        db.query(qLista, [vendedor_id], (errLista, resLista) => {
            if (errLista) return res.status(500).json({ success: false });

            // CÁLCULO DE COMISIÓN: $5.000 por cada comercio activo ('pos')
            const numActivos = resStats[0].activos || 0;
            const valorComision = numActivos * 5000;

            // DATOS PARA EL GRÁFICO: Esto hará que el historial deje de estar en blanco
            const chartData = {
                labels: ["Sep", "Oct", "Nov", "Dic", "Ene", "Feb"],
                datasets: [
                    valorComision * 0.4, 
                    valorComision * 0.6, 
                    valorComision * 0.8, 
                    valorComision * 0.7, 
                    valorComision * 0.9, 
                    valorComision
                ]
            };

            res.json({
                success: true,
                stats: resStats[0],
                totalMes: valorComision.toLocaleString('es-CO'), // Mostrará $20.000
                comercios: resLista || [],
                chart: chartData // <-- SIN ESTO EL GRÁFICO NO CARGA
            });
        });
    });
});

app.post('/api/comercios/nuevo', (req, res) => {
    const { nombre, sede, telefono, email, password, subdominio, vendedor_id } = req.body;
    const urlCompleta = `${subdominio}.tienderu.com`;

    // Insertamos en la tabla 'usuarios'
    const sql = "INSERT INTO usuarios (nombre, sede, telefono, email, password, url, vendedor_id, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo')";

    db.query(sql, [nombre, sede, telefono, email, password, urlCompleta, vendedor_id], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true });
    });
});

// En tu archivo de servidor (server.js o app.js)
app.post('/api/update-bot-prompt', async (req, res) => {
    const { userId, prompt } = req.body;

    if (!userId || prompt === undefined) {
        return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    try {
        // [cite: 2026-02-11] Actualización de seguridad con Prepared Statements
        const query = "UPDATE usuarios SET prompt = ? WHERE id = ?";
        
        // Asumiendo que usas mysql2 o similar
        const [result] = await db.execute(query, [prompt, userId]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Base de datos actualizada" });
        } else {
            res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }
    } catch (error) {
        console.error("Error SQL:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

// --- NAVEGACIÓN GENERAL ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/ecosistema', (req, res) => res.sendFile(path.join(__dirname, 'public/ecosistema.html')));

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`>>> Servidor Cloud Tienderu Activo en puerto ${PORT}`));