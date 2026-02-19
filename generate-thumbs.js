const fs = require('fs');
const path = require('path');
const { fromPath } = require("pdf2pic");

const baseDir = '/opt/manager/public/uploads/campaigns/';
const thumbDir = path.join(baseDir, 'thumbnails');

// Asegurar que la carpeta de miniaturas existe
if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
}

const options = {
    density: 100,
    savePath: thumbDir,
    format: "png",
    width: 600,
    height: 800
};

async function generateExistingThumbs() {
    console.log("🔍 Iniciando escaneo de PDFs antiguos...");
    
    const files = fs.readdirSync(baseDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    for (const file of pdfFiles) {
        const thumbName = `thumb-${path.parse(file).name}.1.png`;
        const thumbPath = path.join(thumbDir, thumbName);

        if (!fs.existsSync(thumbPath)) {
            console.log(`📸 Generando miniatura para: ${file}`);
            try {
                const convert = fromPath(path.join(baseDir, file), {
                    ...options,
                    saveFilename: `thumb-${path.parse(file).name}`
                });
                await convert(1);
                console.log(`✅ Éxito: ${thumbName}`);
            } catch (err) {
                console.error(`❌ Error en ${file}:`, err.message);
            }
        } else {
            console.log(`⏩ Ya existe miniatura para: ${file}`);
        }
    }
    console.log("✨ Proceso finalizado.");
    process.exit();
}

generateExistingThumbs();