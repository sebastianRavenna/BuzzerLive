-- Migración: Agregar campos adicionales a función registrar_accion
-- Esto soluciona el bug del cliente congelado al eliminar la necesidad de queries posteriores

CREATE OR REPLACE FUNCTION registrar_accion(
    p_partido_id UUID,
    p_equipo_id UUID,
    p_jugador_id UUID,
    p_tipo tipo_accion,
    p_cuarto SMALLINT,
    p_timestamp_local TIMESTAMPTZ,
    p_cliente_id VARCHAR(50) DEFAULT NULL,
    p_tiros_libres SMALLINT DEFAULT NULL,
    p_numero_falta SMALLINT DEFAULT NULL,
    p_puntos_local SMALLINT DEFAULT NULL,
    p_puntos_visitante SMALLINT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_accion_id UUID;
    v_valor SMALLINT := 0;
    v_es_local BOOLEAN;
    v_partido RECORD;
BEGIN
    -- Obtener info del partido
    SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;

    -- Determinar si es equipo local o visitante
    v_es_local := (p_equipo_id = v_partido.equipo_local_id);

    -- Calcular valor según tipo de acción
    CASE p_tipo
        WHEN 'PUNTO_1' THEN v_valor := 1;
        WHEN 'PUNTO_2' THEN v_valor := 2;
        WHEN 'PUNTO_3' THEN v_valor := 3;
        ELSE v_valor := 0;
    END CASE;

    -- Insertar la acción con campos adicionales
    INSERT INTO acciones (
        partido_id, equipo_id, jugador_id, tipo, cuarto,
        valor, timestamp_local, cliente_id,
        tiros_libres, numero_falta, puntos_local, puntos_visitante
    ) VALUES (
        p_partido_id, p_equipo_id, p_jugador_id, p_tipo, p_cuarto,
        v_valor, p_timestamp_local, p_cliente_id,
        p_tiros_libres, p_numero_falta, p_puntos_local, p_puntos_visitante
    ) RETURNING id INTO v_accion_id;

    -- Actualizar marcador del partido si es punto
    IF v_valor > 0 THEN
        IF v_es_local THEN
            UPDATE partidos SET
                puntos_local = puntos_local + v_valor,
                updated_at = NOW()
            WHERE id = p_partido_id;
        ELSE
            UPDATE partidos SET
                puntos_visitante = puntos_visitante + v_valor,
                updated_at = NOW()
            WHERE id = p_partido_id;
        END IF;
    END IF;

    -- Actualizar faltas de equipo si es falta
    IF p_tipo IN ('FALTA_PERSONAL', 'FALTA_TECNICA', 'FALTA_ANTIDEPORTIVA') THEN
        IF v_es_local THEN
            UPDATE partidos SET
                faltas_equipo_local = jsonb_set(
                    faltas_equipo_local,
                    ARRAY[(p_cuarto - 1)::TEXT],
                    to_jsonb((faltas_equipo_local->(p_cuarto - 1))::INT + 1)
                ),
                updated_at = NOW()
            WHERE id = p_partido_id;
        ELSE
            UPDATE partidos SET
                faltas_equipo_visitante = jsonb_set(
                    faltas_equipo_visitante,
                    ARRAY[(p_cuarto - 1)::TEXT],
                    to_jsonb((faltas_equipo_visitante->(p_cuarto - 1))::INT + 1)
                ),
                updated_at = NOW()
            WHERE id = p_partido_id;
        END IF;

        -- Actualizar faltas del jugador en participaciones
        IF p_jugador_id IS NOT NULL THEN
            UPDATE participaciones_partido SET
                faltas = faltas + 1,
                updated_at = NOW()
            WHERE partido_id = p_partido_id AND jugador_id = p_jugador_id;
        END IF;
    END IF;

    -- Actualizar puntos del jugador en participaciones
    IF v_valor > 0 AND p_jugador_id IS NOT NULL THEN
        UPDATE participaciones_partido SET
            puntos = puntos + v_valor,
            participo = TRUE,
            updated_at = NOW()
        WHERE partido_id = p_partido_id AND jugador_id = p_jugador_id;
    END IF;

    RETURN v_accion_id;
END;
$$ LANGUAGE plpgsql;
