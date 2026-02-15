#!/bin/bash

# --- CONFIGURACIÓN ---
DIR="/opt/manager"
DB_HOST="72.60.172.34"
DB_USER="root"
DB_PASS="Juanes801"
DB_NAME="manager_db"

# Obtener datos de tiempo actuales
HOY_DIA=$(date +%-d)
HOY_MES=$(date +%m)
HOY_ANIO=$(date +%Y)
HOY_FECHA=$(date +%Y-%m-%d)
HOY_SEC=$(date -d "$HOY_FECHA" +%s)

# FUNCIÓN: Registrar/Actualizar factura en la tabla de control
registrar_factura_bash() {
    local username_arg=$1
    local estado_arg=$2
    local dia_corte_arg=$3

    # Nombres de meses en español
    meses=("Ene" "Feb" "Mar" "Abr" "May" "Jun" "Jul" "Ago" "Sep" "Oct" "Nov" "Dic")
    
    # Obtener mes actual e índice
    mes_actual_idx=$((10#$HOY_MES - 1))
    mes_sig_idx=$(( (mes_actual_idx + 1) % 12 ))
    
    periodo_str="${meses[$mes_actual_idx]} $dia_corte_arg - ${meses[$mes_sig_idx]} $dia_corte_arg"
    
    # Mapeo de estados legibles
    estado_factura="PAGADO"
    if [ "$estado_arg" == "pago" ]; then estado_factura="EN MORA"; fi
    if [ "$estado_arg" == "pop" ]; then estado_factura="SUSPENDIDO"; fi

    query_factura="INSERT INTO facturacion (username, periodo, monto, estado, fecha_registro) \
                   VALUES ('$username_arg', '$periodo_str', 50000, '$estado_factura', NOW()) \
                   ON DUPLICATE KEY UPDATE estado = VALUES(estado), fecha_registro = NOW();"
    
    mysql -h $DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "$query_factura"
}

echo "--- 🕒 INICIO DE REVISIÓN DE CARTERA ($HOY_FECHA) ---"

# Obtenemos los usuarios con servicio activo
usuarios=$(mysql -h $DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -N -s -e "SELECT nombre_pos, ultimo_pago, estado, username, dia_pago FROM usuarios WHERE pos_creado=1")

while read -r nombre_pos ultimo_pago estado_db username dia_pago; do
    # Validar datos básicos
    if [ -z "$nombre_pos" ] || [ "$nombre_pos" == "NULL" ]; then continue; fi
    if [ -z "$ultimo_pago" ] || [ "$ultimo_pago" == "NULL" ]; then ultimo_pago="2024-01-01"; fi

    # 1. CALCULAR EL ÚLTIMO DÍA DE CORTE QUE PASÓ EL USUARIO
    # Si hoy es 1 y su corte es 28, su último corte fue el 28 del mes pasado.
    if [ "$HOY_DIA" -ge "$dia_pago" ]; then
        FECHA_CORTE_STR="$HOY_ANIO-$HOY_MES-$dia_pago"
    else
        FECHA_CORTE_STR=$(date -d "$HOY_ANIO-$HOY_MES-$dia_pago -1 month" +%Y-%m-%d)
    fi
    SEC_CORTE=$(date -d "$FECHA_CORTE_STR" +%s)
    SEC_PAGO=$(date -d "$ultimo_pago" +%s)

    # 2. DETERMINAR SI EL PAGO CUBRE EL CICLO ACTUAL
    # Es "PAGO AL DÍA" si el último pago es igual o posterior al último corte generado
    if [ "$SEC_PAGO" -ge "$SEC_CORTE" ]; then
        PAGO_AL_DIA=true
    else
        PAGO_AL_DIA=false
    fi

    # 3. DETERMINAR NUEVO ESTADO SEGÚN REGLAS DE DÍA DE CORTE
    NUEVO_ESTADO=""
    if [ "$PAGO_AL_DIA" = true ]; then
        NUEVO_ESTADO="pos"   # Todo en orden
    else
        # Si no ha pagado, evaluamos los días de gracia
        # El día de corte entra en MORA (pago)
        # El día de corte + 4 entra en SUSPENSIÓN (pop)
        
        # Calculamos los días transcurridos desde el corte
        DIAS_DESDE_CORTE=$(( (HOY_SEC - SEC_CORTE) / 86400 ))

        if [ "$DIAS_DESDE_CORTE" -ge 4 ]; then
            NUEVO_ESTADO="pop"   # Suspensión (Día 5 en adelante)
        elif [ "$DIAS_DESDE_CORTE" -ge 0 ]; then
            NUEVO_ESTADO="pago"  # Mora (Día 1 al 4)
        else
            NUEVO_ESTADO="pos"   # Aún no llega su fecha de corte
        fi
    fi

    echo ">> Cliente: $username | Corte: $dia_pago | Último Pago: $ultimo_pago | ¿Al día?: $PAGO_AL_DIA"

    # 4. APLICAR CAMBIOS SOLO SI HAY UN CAMBIO DE ESTADO
    if [ "$NUEVO_ESTADO" != "$estado_db" ]; then
        echo "   [!] Cambio detectado: $estado_db -> $NUEVO_ESTADO"
        
        # Cambio técnico (Vhost/Servidor)
        bash "$DIR/cambiar_estado.sh" "$nombre_pos" "$NUEVO_ESTADO"
        
        # Actualizar base de datos
        mysql -h $DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "UPDATE usuarios SET estado='$NUEVO_ESTADO' WHERE nombre_pos='$nombre_pos'"
        
        # Registrar en tabla de facturación
        registrar_factura_bash "$username" "$NUEVO_ESTADO" "$dia_pago"
        
        echo "   [OK] Actualización completada para $username."
    fi

done <<< "$usuarios"

echo "--- 🏁 PROCESO FINALIZADO ---"