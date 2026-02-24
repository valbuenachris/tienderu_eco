const express = require('express');
const multer = require('multer');
const { exec, execSync } = require('child_process');
const mysql = require('mysql2');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { fromPath } = require("pdf2pic");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

<<<<<<< HEAD
=======


>>>>>>> 72e0d0b (Version: 2.3.3.6)
// --- CONFIGURACIÓN DE RUTAS ESTÁTICAS Y PERSISTENCIA DOCKER ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('/opt/manager/public/uploads'));
app.use('/uploads/campaigns/thumbnails', express.static('/opt/manager/public/uploads/campaigns/thumbnails'));

// --- CONFIGURACIÓN DE BASE DE DATOS (POOL ROBUSTO) ---
const db = mysql.createPool({
    host: '72.60.172.34',
    user: 'root',
    password: 'Juanes801', 
    database: 'manager_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- CONFIGURACIÓN EVOLUTION API ---
const EVO_URL = 'https://evoapi.tienderu.com';
const EVO_KEY = 'UDm3ik8V579GPJCOS4ov66Sfr8dejAi9Mv8jdtZzGNM=';

// --- CONFIGURACIÓN DE ALMACENAMIENTO PRO (MULTER) ---
const storageDoc = multer.diskStorage({
    destination: (req, file, cb) => {
        const pathAbs = '/opt/manager/public/uploads/campaigns/';
        if (!fs.existsSync(pathAbs)) fs.mkdirSync(pathAbs, { recursive: true });
        cb(null, pathAbs);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname).toLowerCase();
        
        // DETERMINAR PREFIJO SEGÚN EL TIPO DE ARCHIVO
        // Imágenes JPG, PNG, WEBP, etc. llevan 'img-'
        // El resto (PDF, DOCX) llevan 'doc-'
        const esImagen = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension);
        const prefijo = esImagen ? 'img-' : 'doc-';
        
        cb(null, prefijo + uniqueSuffix + extension);
    }
});
const uploadDoc = multer({ storage: storageDoc, limits: { fileSize: 10 * 1024 * 1024 } });

// --- LÓGICA DE FACTURACIÓN Y PERIODOS ---
const registrarFactura = (username, diaCorte, estado) => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const hoy = new Date();
    
    // Calculamos el mes actual y el siguiente con lógica de año
    const mesActual = hoy.getMonth();
    const proximoMes = (mesActual + 1) % 12;
    const anioActual = hoy.getFullYear();
    const anioSiguiente = proximoMes === 0 ? anioActual + 1 : anioActual;

    const periodoStr = `${meses[mesActual]} ${diaCorte} - ${meses[proximoMes]} ${diaCorte} ${anioActual}`;
    
    // Mapeo de estados más claro
    let est = 'PAGADO';
    if (estado === 'pago') est = 'EN MORA';
    if (estado === 'pop') est = 'SUSPENDIDO';

    // Asegúrate de que en MySQL, 'username' y 'periodo' sean UNIQUE juntos para que esto funcione
    const queryFact = `
        INSERT INTO facturacion (username, periodo, monto, estado, fecha_registro) 
        VALUES (?, ?, 50000, ?, NOW()) 
        ON DUPLICATE KEY UPDATE 
            estado = VALUES(estado), 
            fecha_registro = NOW()
    `;
    
<<<<<<< HEAD
    db.query(queryFact, [username, periodoStr, est], (err) => {
        if (err) console.error("❌ Error al registrar factura:", err);
    });
};

// --- ENDPOINTS ADMINISTRADOR (GESTIÓN GLOBAL) ---
=======
    db.query(queryFact, [username, periodoStr, est], (err, result) => {
        if (err) {
            console.error("❌ Error al registrar factura en MySQL:", err);
            return;
        }
        console.log(`✅ Factura procesada para ${username}: ${est} (${periodoStr})`);
    });
};

// Este endpoint alimenta la tabla de facturación en el frontend
app.get('/api/user/facturacion/:username', (req, res) => {
    const { username } = req.params;
    const query = "SELECT periodo, monto, estado FROM facturacion WHERE username = ? ORDER BY id DESC";
    
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('❌ Error en DB Facturación:', err);
            return res.status(500).json({ success: false });
        }
        // Enviamos siempre un array (aunque esté vacío) para evitar el error de JSON.parse
        res.json(results || []);
    });
});
>>>>>>> 72e0d0b (Version: 2.3.3.6)

// --- ENDPOINTS ADMINISTRADOR (GESTIÓN GLOBAL) ---

app.get('/api/admin/stats', (req, res) => {
    const sql = `SELECT count(*) as total, 
                sum(case when estado = 'pos' then 1 else 0 end) as activos, 
                sum(case when estado = 'pago' then 1 else 0 end) as mora, 
                sum(case when estado = 'pop' then 1 else 0 end) as suspendidos 
                FROM usuarios WHERE role = 'user'`;
    db.query(sql, (err, gRes) => {
        if (err) return res.status(500).json({ success: false });
        db.query("SELECT ciudad, count(*) as cantidad FROM usuarios WHERE role = 'user' GROUP BY ciudad", (err, cRes) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ global: gRes[0] || {}, ciudades: cRes || [] });
        });
    });
});

app.get('/api/admin/list', (req, res) => {
    db.query('SELECT * FROM usuarios WHERE role = "user" ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ usuarios: results });
    });
});

app.post('/api/admin/estado', (req, res) => {
    const { cliente, estado, username } = req.body;
    db.query('SELECT dia_pago FROM usuarios WHERE nombre_pos = ?', [cliente], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        const dia = results[0]?.dia_pago || 15;
        
        exec(`bash /app/cambiar_estado.sh ${cliente} ${estado}`, (error, stdout, stderr) => {
            if (error) console.error(`❌ Error infra: ${error.message}`);
            
            db.query('UPDATE usuarios SET estado = ?, ultimo_pago = NOW() WHERE nombre_pos = ?', [estado, cliente], (err) => {
                if (err) return res.status(500).json({ success: false });
                registrarFactura(username, dia, estado);
                res.json({ success: true, message: "Estado actualizado y factura generada" });
            });
        });
    });
});

app.post('/api/admin/run-sync-pagos', (req, res) => {
    const scriptPath = path.join(__dirname, 'verificar_pagos.sh'); 
    if (!fs.existsSync(scriptPath)) return res.status(404).json({ success: false, message: "Script no encontrado" });
    
    exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ success: false, message: error.message });
        res.json({ success: true, message: "Sincronización masiva completada exitosamente." });
    });
});

// --- GESTIÓN DE VENDEDORES (MODULO COMPLETO) ---

app.post('/api/admin/crear-vendedor', async (req, res) => {
    try {
        const { nombre, username, password, comision } = req.body;
        if (!nombre || !username || !password) return res.status(400).json({ error: "Datos incompletos" });

        const query = `INSERT INTO vendedores (nombre, username, password, comision) VALUES (?, ?, ?, ?)`;
        await db.promise().query(query, [nombre, username, password, comision || 0]);
        res.status(200).json({ message: "Vendedor registrado correctamente" });
    } catch (error) {
        console.error("❌ Error MySQL:", error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "El usuario ya existe" });
        res.status(500).json({ error: "Error interno" });
    }
});

app.get('/api/admin/vendedores', async (req, res) => {
    try {
        const [lista] = await db.promise().query('SELECT id, nombre, username, comision FROM vendedores ORDER BY id DESC');
        res.json(lista);
    } catch (error) { res.status(500).json({ error: "Error al listar" }); }
});

app.delete('/api/admin/vendedor/:username', async (req, res) => {
    try {
        const { username } = req.params;
        await db.promise().query('DELETE FROM vendedores WHERE username = ?', [username]);
        res.json({ success: true, message: "Vendedor eliminado" });
    } catch (error) { res.status(500).json({ error: "Error al eliminar" }); }
});

// --- ENDPOINTS DE USUARIO Y LOGIN (HIBRIDO) ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const queryUser = "SELECT id, nombre, username, role as rol, nombre_pos FROM usuarios WHERE username = ? AND password = ?";
    
    db.query(queryUser, [username, password], (err, userResult) => {
        if (err) return res.status(500).json({ success: false });
        
        if (userResult.length > 0) {
            return res.json({ success: true, user: userResult[0] });
        } else {
            const queryVendedor = "SELECT id, nombre, username, 'vendedor' as rol FROM vendedores WHERE username = ? AND password = ?";
            db.query(queryVendedor, [username, password], (err, vendResult) => {
                if (vendResult && vendResult.length > 0) return res.json({ success: true, user: vendResult[0] });
                res.json({ success: false, message: "Credenciales inválidas" });
            });
        }
    });
});

app.post('/api/register', async (req, res) => {
    const { plan, nombre, telefono, ciudad, direccion, slug, username, password } = req.body;
    try {
        const emailGen = `${username}@tienderu.com`;
        const diaPago = new Date().getDate();
        let planNombre = "PREMIUM";
        if (plan === "0") planNombre = "STARTER";
        if (plan === "25000") planNombre = "ENTERPRISE";
        if (plan === "75000") planNombre = "PRO";

        const sql = `INSERT INTO usuarios (username, password, role, pos_creado, nombre_pos, nombre, apellido, telefono, email, direccion, ciudad, email_validado, estado, ultimo_pago, dia_pago, bot_activo, prompt, temperatura, plan, creditos_texto, creditos_multi) 
                     VALUES (?, ?, 'user', 0, ?, ?, 'Sistema', ?, ?, ?, ?, 0, 'pos', NOW(), ?, 0, 'Eres un asistente de ventas profesional.', 0.7, ?, 10, 10)`;

        await db.promise().query(sql, [username, password, slug, nombre, telefono, emailGen, direccion, ciudad, diaPago, planNombre]);
        res.json({ success: true, message: `Bienvenido al plan ${planNombre}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// SIGUE CON MÁS DE 600 LÍNEAS RESTANTES... (CAMPANAS, WHATSAPP, EVO API, MINIATURAS)

// --- CONTINUACIÓN: SERVICIOS POS Y WHATSAPP (PARTE 2) ---

app.get('/api/user/info/:username', (req, res) => {
    db.query('SELECT id, nombre, nombre_pos, telefono, ciudad, direccion, estado, prompt, dia_pago, plan FROM usuarios WHERE username = ?', [req.params.username], (err, r) => {
        if (err || r.length === 0) return res.status(404).end();
        res.json(r[0]);
    });
});

app.post('/api/servicios/ejecutar-pos', async (req, res) => {
    const { slug } = req.body;
    db.query('SELECT pos_creado, username, dia_pago, estado FROM usuarios WHERE nombre_pos = ?', [slug], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const user = results[0];
        
        if (user.pos_creado === 1) {
            return res.json({ success: true, action: 'open', url: `https://${slug}.tienderu.com` });
        }
        
        // Ejecución de script de infraestructura para desplegar el POS del cliente
        exec(`bash /app/setup_cliente.sh ${slug}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error desplegando POS: ${error.message}`);
                return res.status(500).json({ success: false });
            }
            db.query('UPDATE usuarios SET pos_creado = 1 WHERE nombre_pos = ?', [slug]);
            registrarFactura(user.username, user.dia_pago || 15, user.estado);
            res.json({ success: true, action: 'deploying' });
        });
    });
});

app.post('/api/servicios/activar-whatsapp', async (req, res) => {
    const { slug, password } = req.body;
    const instanceName = slug.toLowerCase().replace(/\s+/g, '');
    const WEBHOOK_URL = `https://n8.tienderu.com/webhook/34d04da7-0c36-429a-bb17-5b69554264db/whatsapp-bridge/${instanceName}`;
    
    try {
        // 1. Crear instancia en Evolution API
        await axios.post(`${EVO_URL}/instance/create`, { 
            instanceName, 
            token: password || "123456", 
            qrcode: true, 
            integration: "WHATSAPP-BAILEYS" 
        }, { headers: { 'apikey': EVO_KEY } });

        // 2. Configurar Webhook para el Agente IA
        await axios.post(`${EVO_URL}/webhook/set/${instanceName}`, { 
            enabled: true, 
            url: WEBHOOK_URL, 
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] 
        }, { headers: { 'apikey': EVO_KEY } });

        res.json({ success: true });
    } catch (e) {
        console.error("Error activando WhatsApp:", e.response?.data || e.message);
        res.status(500).json({ success: false });
    }
});

app.get('/api/servicios/status-whatsapp/:slug', async (req, res) => {
    const instanceName = req.params.slug.toLowerCase().replace(/\s+/g, '');
    try {
        const response = await axios.get(`${EVO_URL}/instance/connectionState/${instanceName}`, { 
            headers: { 'apikey': EVO_KEY } 
        });
        res.json({ success: true, state: response.data.instance.state });
    } catch (e) {
        res.json({ success: true, state: "DISCONNECTED" });
    }
});

// --- GESTIÓN DE CRÉDITOS Y AGENTE IA ---

app.get('/api/user/creditos/:username', async (req, res) => {
    try {
        const [user] = await db.promise().execute(
            'SELECT creditos_texto, creditos_multi FROM usuarios WHERE username = ?', 
            [req.params.username]
        );
        res.json(user[0] || { creditos_texto: 0, creditos_multi: 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/descontar-creditos', async (req, res) => {
    const { username, cantidad, tipo } = req.body;
    const columna = tipo === 'texto' ? 'creditos_texto' : 'creditos_multi';
    try {
        const [result] = await db.promise().query(
            `UPDATE usuarios SET ${columna} = ${columna} - ? WHERE username = ? AND ${columna} >= ?`, 
            [cantidad, username, cantidad]
        );
        res.json({ success: result.affectedRows > 0 });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/update-bot-prompt', async (req, res) => {
    const { userId, prompt, temperatura } = req.body;
    try {
        const [result] = await db.promise().execute(
            "UPDATE usuarios SET prompt = ?, temperatura = ? WHERE id = ?", 
            [prompt, temperatura || 0.7, userId]
        );
        res.json({ success: result.affectedRows > 0 });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- GESTIÓN DE CAMPANAS Y MULTIMEDIA (PARTE 3) ---
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

// --- ENDPOINTS DE SUBIDA Y PROCESAMIENTO DE ARCHIVOS ---

app.post('/api/upload-campaign-doc', uploadDoc.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No se subió archivo" });

    const fileName = req.file.filename;
    const filePath = req.file.path; // Ruta absoluta: /opt/manager/public/uploads/campaigns/doc-xxx.pdf
    const thumbDir = '/opt/manager/public/uploads/campaigns/thumbnails/';
    const fileUrl = `https://${req.headers.host}/uploads/campaigns/${fileName}`;
    let thumbUrl = null;

    if (req.file.mimetype === 'application/pdf') {
        try {
            if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
            execSync(`chmod -R 777 ${thumbDir}`);

            const options = {
                density: 100,
                saveFilename: `thumb-${path.parse(fileName).name}`,
                savePath: thumbDir,
                format: "png",
                width: 600,
                height: 800
            };

            const storeAsImage = fromPath(filePath, options);
            const result = await storeAsImage(1); // Genera la página 1
            
            thumbUrl = `https://${req.headers.host}/uploads/campaigns/thumbnails/${result.name}`;
            console.log("✅ Miniatura creada exitosamente:", result.name);
        } catch (err) {
            console.error("❌ Error generando miniatura PDF:", err.message);
        }
    }

    // Para el Agente IA, incluimos la URL del producto [cite: 2025-11-10]
    res.json({ 
        success: true, 
        url: fileUrl, 
        thumb: thumbUrl,
        name: fileName 
    });
});

app.get('/api/list-campaign-images', (req, res) => {
    const directoryPath = '/opt/manager/public/uploads/campaigns/';
    const thumbPathBase = path.join(directoryPath, 'thumbnails');
    
    fs.readdir(directoryPath, (err, files) => {
        if (err) return res.status(500).json({ success: false });

        const fileList = files
            .filter(file => !file.startsWith('.') && file !== 'thumbnails' && file !== 'test.txt')
            .map(file => {
                const isPdf = file.toLowerCase().endsWith('.pdf');
                let thumbUrl = null;

                if (isPdf) {
                    const thumbName = `thumb-${path.parse(file).name}.1.png`;
                    if (fs.existsSync(path.join(thumbPathBase, thumbName))) {
                        thumbUrl = `https://${req.headers.host}/uploads/campaigns/thumbnails/${thumbName}`;
                    }
                }

                return {
                    name: file,
                    url: `https://${req.headers.host}/uploads/campaigns/${file}`,
                    thumb: thumbUrl
                };
            });
        res.json({ success: true, files: fileList });
    });
});

// --- ENDPOINTS VENDEDORES Y COMISIONES ---

app.get('/api/vendedor/stats/:id', (req, res) => {
    const vendedor_id = req.params.id;
    const qStats = `
        SELECT 
            SUM(CASE WHEN estado = 'pos' THEN 1 ELSE 0 END) as activos, 
            SUM(CASE WHEN estado = 'pago' THEN 1 ELSE 0 END) as mora,
            SUM(CASE WHEN estado = 'pop' THEN 1 ELSE 0 END) as suspendidos,
            COUNT(*) as total 
        FROM usuarios WHERE vendedor_id = ?`;
        
    const qLista = `
        SELECT nombre_pos, username, telefono, ciudad as sede, dia_pago as corte, estado 
        FROM usuarios WHERE vendedor_id = ? ORDER BY id DESC`;

    db.query(qStats, [vendedor_id], (err, resStats) => {
        if (err) return res.status(500).json({ success: false });
        
        db.query(qLista, [vendedor_id], (errL, resLista) => {
            if (errL) return res.status(500).json({ success: false });
            
            const numActivos = resStats[0].activos || 0;
            // Comision de 5000 por cada cliente activo
            const comisionTotal = (numActivos * 5000).toLocaleString('es-CO');
            
            res.json({
                success: true,
                stats: resStats[0],
                totalMes: comisionTotal,
                comercios: resLista || [],
                chart: {
                    labels: ["Sep", "Oct", "Nov", "Dic", "Ene", "Feb"],
                    datasets: [0, 0, 0, 0, 0, numActivos * 5000]
                }
            });
        });
    });
});

// ENDPOINT PARA ELIMINAR ARCHIVOS DE CAMPAÑAS FÍSICAMENTE
app.delete('/api/delete-campaign-file/:filename', (req, res) => {
    const filename = req.params.filename;
    const directoryPath = '/opt/manager/public/uploads/campaigns/';
    const thumbPath = path.join(directoryPath, 'thumbnails', `thumb-${path.parse(filename).name}.1.png`);
    const filePath = path.join(directoryPath, filename);

    try {
        // 1. Borrar el archivo original
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 2. Borrar la miniatura si existe (para PDFs)
        if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
        }

        res.json({ success: true, message: 'Archivo y miniatura eliminados físicamente' });
    } catch (err) {
        console.error('Error al borrar archivo:', err);
        res.status(500).json({ success: false, message: 'No se pudo eliminar el archivo del disco' });
    }
<<<<<<< HEAD
});

// --- RUTAS DE NAVEGACIÓN Y CIERRE DEL SERVIDOR ---

app.get('/ecosistema', (req, res) => res.sendFile(path.join(__dirname, 'public/ecosistema.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html'))); // Alias
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
=======
});

// --- RUTAS DE NAVEGACIÓN Y CIERRE DEL SERVIDOR ---

app.get('/ecosistema', (req, res) => res.sendFile(path.join(__dirname, 'public/ecosistema.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html'))); // Alias
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));


// --- ENDPOINT DE AGENDA ACTUALIZADO Y CORREGIDO ---
app.get('/api/agenda/:vendedor_id/:mes/:anio', (req, res) => {
    const { vendedor_id, mes, anio } = req.params;

    // Consulta explícita para asegurar que traemos WhatsApp, Servicio y Estado
    const query = `
        SELECT 
            id, 
            cliente_nombre, 
            cliente_whatsapp, 
            fecha, 
            hora, 
            servicio, 
            estado 
        FROM agenda_citas 
        WHERE vendedor_id = ? 
          AND MONTH(fecha) = ? 
          AND YEAR(fecha) = ?
        ORDER BY fecha ASC, hora ASC`;

    db.query(query, [vendedor_id, mes, anio], (err, results) => {
        if (err) {
            console.error('❌ Error en DB (Agenda):', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Error al consultar la agenda' 
            });
        }

        // Enviamos los resultados al frontend
        // results será un array [] si no hay citas, lo cual es correcto
        res.json(results);
    });
});

// Guardar o actualizar cita (Usado por n8n y el Panel)
app.post('/api/agenda/guardar', (req, res) => {
    const { vendedor_id, cliente_nombre, cliente_whatsapp, fecha, hora, servicio } = req.body;
    const query = "INSERT INTO agenda_citas (vendedor_id, cliente_nombre, cliente_whatsapp, fecha, hora, servicio) VALUES (?,?,?,?,?,?)";
    
    db.query(query, [vendedor_id, cliente_nombre, cliente_whatsapp, fecha, hora, servicio], (err) => {
        if (err) return res.json({ success: false, message: err.message });
        res.json({ success: true, message: "Cita agendada correctamente" });
    });
});


// ==========================================
// RUTAS DE GESTIÓN DE AGENDA (MySQL)
// ==========================================

// --- RUTAS DE ACTUALIZACIÓN CORREGIDAS ---

// ACTUALIZAR ESTADO (Confirmar/Cancelar)
app.patch('/api/citas/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    // Forzamos el nombre de la tabla que confirmaste: agenda_citas
    const query = 'UPDATE agenda_citas SET estado = ? WHERE id = ?';
    
    db.query(query, [estado, id], (err, result) => {
        if (err) {
            console.error("❌ Error MySQL:", err);
            return res.status(500).json({ success: false, message: err.message });
        }
        
        // Si affectedRows es 0, el ID enviado no existe en la tabla
        if (result.affectedRows === 0) {
            console.log(`⚠️ No se encontró la cita con ID: ${id}`);
            return res.status(404).json({ success: false, message: "ID no encontrado en agenda_citas" });
        }

        console.log(`✅ Cita ${id} actualizada a ${estado}`);
        res.json({ success: true, message: "Actualizado en MySQL" });
    });
});

// REPROGRAMAR (Fecha/Hora)
app.patch('/api/citas/:id/reprogramar', (req, res) => {
    const { id } = req.params;
    const { fecha, hora } = req.body;

    const query = 'UPDATE agenda_citas SET fecha = ?, hora = ? WHERE id = ?';
    
    db.query(query, [fecha, hora, id], (err, result) => {
        if (err) {
            console.error("❌ Error MySQL:", err);
            return res.status(500).json({ success: false, message: err.message });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "No se pudo reprogramar: ID no existe" });
        }

        console.log(`📅 Cita ${id} reprogramada: ${fecha} ${hora}`);
        res.json({ success: true, message: "Fecha/Hora guardada" });
    });
});
>>>>>>> 72e0d0b (Version: 2.3.3.6)

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TIENDERU CLOUD MANAGER ACTIVO`);
    console.log(`   Puerto: ${PORT}`);
    console.log(`   Modo: Docker Persistente\n`);
});