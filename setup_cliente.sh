#!/bin/bash

# 1. VALIDACIÓN DE PARÁMETRO
CLIENTE=$1
if [ -z "$CLIENTE" ]; then
    echo "❌ Error: No se recibió el nombre del cliente."
    exit 1
fi

echo "========================================"
echo " 🚀 INICIANDO DESPLIEGUE: $CLIENTE"
echo "========================================"

# --- CONFIGURACIÓN (Extraída de tu v1.8) ---
BASE_DIR="/opt/pos"
CLIENT_DIR="$BASE_DIR/$CLIENTE"
UPLOADS_ORIG="$BASE_DIR/template/uploads"
DB_HOST="72.60.172.34"
DB_ROOT_PASS="Juanes801"
DB_NAME="${CLIENTE}_db"
DB_USER="${CLIENTE}_user"
DB_PASS="Juanes801" 
DOMAIN="$CLIENTE.tienderu.com"
CONTAINER_NAME="${CLIENTE}_pos"

# 2. CREACIÓN DE DIRECTORIOS Y BASE DE DATOS
mkdir -p "$CLIENT_DIR/uploads"
cp -r "$UPLOADS_ORIG/"* "$CLIENT_DIR/uploads/" 2>/dev/null || true

mysql -h "$DB_HOST" -u root -p"$DB_ROOT_PASS" <<EOF
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%';
FLUSH PRIVILEGES;
EOF

mysqldump -h "$DB_HOST" -u root -p"$DB_ROOT_PASS" template_db | mysql -h "$DB_HOST" -u root -p"$DB_ROOT_PASS" "$DB_NAME"

# 3. GENERACIÓN DE LOS ARCHIVOS COMPOSE
crear_config() {
    local TIPO=$1    
    local VERSION=$2 
    cat > "$CLIENT_DIR/$TIPO-compose.yml" <<EOF
services:
  $CONTAINER_NAME:
    image: cvalbuena/tienderu-pos:$VERSION
    container_name: $CONTAINER_NAME
    restart: unless-stopped
    volumes:
      - $CLIENT_DIR/uploads:/var/www/html/uploads
    environment:
      APP_BASE_URL: https://$DOMAIN/
      DB_HOST: $DB_HOST
      DB_NAME: $DB_NAME
      DB_USER: $DB_USER
      DB_PASS: $DB_PASS
      APP_VERSION: $VERSION
    networks:
      - multi-apps_multi_app_network
      - npm_npm_net

networks:
  multi-apps_multi_app_network:
    external: true
  npm_npm_net:
    external: true
EOF
}

crear_config "pos" "1.2.0"
crear_config "pago" "1.2.1"
crear_config "pop" "1.2.1.1"

# 4. LEVANTAMIENTO DEL CONTENEDOR
cd "$CLIENT_DIR"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker compose -p "$CLIENTE" -f pos-compose.yml up -d

# 5. REGISTRO DE DÍA DE PAGO
echo "$(date +%d)" > "$CLIENT_DIR/.dia_pago"

# 6. CONFIGURAR PROXY EN NPM (Lógica v1.8 Corregida)
NPM_URL="http://31.97.140.1:81"
NPM_EMAIL="info@tienderu.com"
NPM_PASS="Juanes801+"

TOKEN=$(curl -s -X POST "$NPM_URL/api/tokens" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$NPM_EMAIL\",\"secret\":\"$NPM_PASS\"}" | jq -r .token)

# Nota: El endpoint correcto en muchas versiones de NPM es /api/nginx/proxy-hosts
curl -s -X POST "$NPM_URL/api/nginx/proxy-hosts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"domain_names\": [\"$DOMAIN\"],
    \"forward_scheme\": \"http\",
    \"forward_host\": \"$CONTAINER_NAME\",
    \"forward_port\": 80,
    \"ssl_forced\": true,
    \"certificate_id\": \"new\",
    \"meta\": { \"letsencrypt_email\": \"$NPM_EMAIL\", \"letsencrypt_agree\": true },
    \"advanced_config\": \"\",
    \"allow_websocket_upgrade\": true,
    \"block_exploits\": false,
    \"caching_enabled\": false,
    \"http2_support\": true,
    \"hsts_enabled\": true,
    \"hsts_subdomains\": false,
    \"enabled\": 1
  }"

echo "✅ Proceso terminado para $CLIENTE"