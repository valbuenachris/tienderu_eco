#!/bin/bash
CLIENTE=$1
ESTADO=$2 

CLIENT_DIR="/opt/pos/$CLIENTE"
CONTAINER_NAME="${CLIENTE}_pos"
COMPOSE_FILE="$ESTADO-compose.yml"

if [ ! -d "$CLIENT_DIR" ]; then 
    echo "Directorio no encontrado"
    exit 1
fi

cd "$CLIENT_DIR"

# Parar y limpiar profundamente
docker compose -p "$CLIENTE" down --remove-orphans

# Levantar el nuevo estado
docker compose -p "$CLIENTE" -f "$COMPOSE_FILE" up -d --force-recreate

echo "✅ $CLIENTE cambiado a $ESTADO"