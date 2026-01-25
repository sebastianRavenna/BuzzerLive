-- ============================================
-- BuzzerLive - Esquema de Base de Datos
-- Supabase (PostgreSQL)
-- Versión: MVP 0.1
-- ============================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS (Tipos enumerados)
-- ============================================

-- Estados posibles de un torneo
CREATE TYPE estado_torneo AS ENUM (
    'PLANIFICACION',
    'EN_CURSO', 
    'FINALIZADO',
    'CANCELADO'
);

-- Estados posibles de un partido
CREATE TYPE estado_partido AS ENUM (
    'PROGRAMADO',
    'EN_CURSO',
    'FINALIZADO',
    'SUSPENDIDO',
    'POSTERGADO'
);

-- Tipos de acciones en un partido
CREATE TYPE tipo_accion AS ENUM (
    'PUNTO_1',           -- Tiro libre convertido
    'PUNTO_2',           -- Doble convertido
    'PUNTO_3',           -- Triple convertido
    'FALTA_PERSONAL',    -- Falta de jugador
    'FALTA_TECNICA',     -- Falta técnica
    'FALTA_ANTIDEPORTIVA', -- Falta antideportiva
    'FALTA_DESCALIFICANTE', -- Falta descalificante
    'FALTA_TECNICA_ENTRENADOR', -- Falta técnica del entrenador
    'FALTA_TECNICA_BANCO', -- Falta técnica del banco
    'FALTA_DESCALIFICANTE_ENTRENADOR', -- Falta descalificante del entrenador
    'TIEMPO_MUERTO',     -- Timeout pedido
    'INICIO_CUARTO',     -- Marca inicio de período
    'FIN_CUARTO',        -- Marca fin de período
    'SUSTITUCION'        -- Sustitución de jugador
);

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

-- Tabla: torneos
-- Representa una competición/liga
CREATE TABLE torneos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,  -- Ej: "Primera División", "U21", etc.
    temporada VARCHAR(20) NOT NULL,  -- Ej: "2026", "2025-2026"
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado estado_torneo DEFAULT 'PLANIFICACION',
    puntos_victoria SMALLINT DEFAULT 2,  -- Puntos por ganar (FIBA = 2)
    puntos_derrota SMALLINT DEFAULT 1,   -- Puntos por perder (FIBA = 1)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: equipos
-- Equipos participantes en torneos
CREATE TABLE equipos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    nombre_corto VARCHAR(20),  -- Para mostrar en marcadores
    club VARCHAR(100),
    escudo_url TEXT,
    color_primario VARCHAR(7),   -- Hex color, ej: "#FF0000"
    color_secundario VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(torneo_id, nombre)
);

-- Tabla: jugadores
-- Roster de jugadores por equipo
CREATE TABLE jugadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    credencial VARCHAR(50),          -- Número de credencial CABB
    numero_camiseta SMALLINT NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    dni VARCHAR(15),
    fecha_nacimiento DATE,
    es_capitan BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(equipo_id, numero_camiseta),
    CHECK(numero_camiseta >= 0 AND numero_camiseta <= 99)
);

-- Tabla: partidos
-- Encuentros entre equipos
CREATE TABLE partidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    equipo_local_id UUID NOT NULL REFERENCES equipos(id),
    equipo_visitante_id UUID NOT NULL REFERENCES equipos(id),
    
    -- Programación
    fecha DATE NOT NULL,
    hora TIME,
    lugar VARCHAR(200),
    jornada SMALLINT,              -- Número de fecha/jornada
    fase VARCHAR(50),              -- "Regular", "Playoffs", "Final", etc.
    
    -- Estado del partido
    estado estado_partido DEFAULT 'PROGRAMADO',
    cuarto_actual SMALLINT DEFAULT 0,  -- 0=no iniciado, 1-4=cuartos, 5+=overtime
    
    -- Marcador (desnormalizado para consultas rápidas)
    puntos_local SMALLINT DEFAULT 0,
    puntos_visitante SMALLINT DEFAULT 0,
    
    -- Puntos por cuarto (JSON para flexibilidad)
    puntos_por_cuarto JSONB DEFAULT '{"local": [], "visitante": []}',
    
    -- Faltas de equipo por cuarto
    faltas_equipo_local JSONB DEFAULT '[0, 0, 0, 0]',
    faltas_equipo_visitante JSONB DEFAULT '[0, 0, 0, 0]',
    
    -- Tiempos muertos usados
    tiempos_muertos_local SMALLINT DEFAULT 0,
    tiempos_muertos_visitante SMALLINT DEFAULT 0,
    
    -- Staff del partido
    arbitro_principal VARCHAR(100),
    arbitro_auxiliar_1 VARCHAR(100),
    arbitro_auxiliar_2 VARCHAR(100),
    planillero VARCHAR(100),
    cronometrista VARCHAR(100),
    
    -- Timestamps
    hora_inicio_real TIMESTAMPTZ,   -- Cuándo realmente empezó
    hora_fin_real TIMESTAMPTZ,      -- Cuándo realmente terminó
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK(equipo_local_id != equipo_visitante_id)
);

-- Tabla: acciones
-- Registro de cada evento durante el partido (event sourcing)
CREATE TABLE acciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    equipo_id UUID NOT NULL REFERENCES equipos(id),
    jugador_id UUID REFERENCES jugadores(id),  -- NULL para acciones de equipo

    tipo tipo_accion NOT NULL,
    cuarto SMALLINT NOT NULL,
    valor SMALLINT DEFAULT 0,          -- Puntos sumados (1, 2, 3) o 0 para faltas

    -- Para sincronización offline
    timestamp_local TIMESTAMPTZ NOT NULL,  -- Cuándo se registró en el dispositivo
    timestamp_servidor TIMESTAMPTZ DEFAULT NOW(),  -- Cuándo llegó al servidor
    cliente_id VARCHAR(50),            -- ID del dispositivo que registró

    -- Para sustituciones
    jugador_entra_id UUID REFERENCES jugadores(id),  -- Jugador que entra en sustitución
    jugador_sale_id UUID REFERENCES jugadores(id),   -- Jugador que sale en sustitución

    -- Metadata
    anulada BOOLEAN DEFAULT FALSE,     -- Para correcciones sin borrar
    notas TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: participaciones_partido
-- Qué jugadores participaron en cada partido (para el "E" de la planilla)
CREATE TABLE participaciones_partido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    jugador_id UUID NOT NULL REFERENCES jugadores(id),
    equipo_id UUID NOT NULL REFERENCES equipos(id),
    
    -- Estadísticas del jugador en este partido (desnormalizado)
    puntos SMALLINT DEFAULT 0,
    faltas SMALLINT DEFAULT 0,
    
    -- Control
    participo BOOLEAN DEFAULT FALSE,   -- El "E" de entrada
    es_titular BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(partido_id, jugador_id)
);

-- ============================================
-- VISTAS
-- ============================================

-- Vista: tabla_posiciones
-- Calcula la tabla de posiciones de un torneo
CREATE OR REPLACE VIEW tabla_posiciones AS
WITH estadisticas AS (
    SELECT 
        e.id AS equipo_id,
        e.torneo_id,
        e.nombre AS equipo_nombre,
        e.escudo_url,
        
        -- Partidos jugados (finalizados)
        COUNT(CASE WHEN p.estado = 'FINALIZADO' THEN 1 END) AS pj,
        
        -- Partidos ganados
        COUNT(CASE 
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_local_id AND p.puntos_local > p.puntos_visitante THEN 1
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_visitante_id AND p.puntos_visitante > p.puntos_local THEN 1
        END) AS pg,
        
        -- Partidos perdidos
        COUNT(CASE 
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_local_id AND p.puntos_local < p.puntos_visitante THEN 1
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_visitante_id AND p.puntos_visitante < p.puntos_local THEN 1
        END) AS pp,
        
        -- Puntos a favor
        COALESCE(SUM(CASE 
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_local_id THEN p.puntos_local
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_visitante_id THEN p.puntos_visitante
            ELSE 0
        END), 0) AS pf,
        
        -- Puntos en contra
        COALESCE(SUM(CASE 
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_local_id THEN p.puntos_visitante
            WHEN p.estado = 'FINALIZADO' AND e.id = p.equipo_visitante_id THEN p.puntos_local
            ELSE 0
        END), 0) AS pc
        
    FROM equipos e
    LEFT JOIN partidos p ON (e.id = p.equipo_local_id OR e.id = p.equipo_visitante_id)
    GROUP BY e.id, e.torneo_id, e.nombre, e.escudo_url
)
SELECT 
    equipo_id,
    torneo_id,
    equipo_nombre,
    escudo_url,
    pj,
    pg,
    pp,
    pf,
    pc,
    (pf - pc) AS dif,
    (pg * 2 + pp * 1) AS pts,  -- FIBA: 2 pts victoria, 1 pt derrota
    ROW_NUMBER() OVER (
        PARTITION BY torneo_id 
        ORDER BY (pg * 2 + pp * 1) DESC, (pf - pc) DESC, pf DESC
    ) AS posicion
FROM estadisticas
WHERE pj > 0  -- Solo equipos que han jugado al menos un partido
ORDER BY torneo_id, posicion;

-- Vista: marcador_partido
-- Información del marcador para mostrar en vivo
CREATE OR REPLACE VIEW marcador_partido AS
SELECT 
    p.id AS partido_id,
    p.estado,
    p.cuarto_actual,
    p.fecha,
    p.hora,
    p.lugar,
    
    -- Equipo local
    el.id AS local_id,
    el.nombre AS local_nombre,
    el.nombre_corto AS local_nombre_corto,
    el.escudo_url AS local_escudo,
    p.puntos_local,
    p.faltas_equipo_local,
    p.tiempos_muertos_local,
    
    -- Equipo visitante
    ev.id AS visitante_id,
    ev.nombre AS visitante_nombre,
    ev.nombre_corto AS visitante_nombre_corto,
    ev.escudo_url AS visitante_escudo,
    p.puntos_visitante,
    p.faltas_equipo_visitante,
    p.tiempos_muertos_visitante,
    
    -- Puntos por cuarto
    p.puntos_por_cuarto,
    
    -- Torneo
    t.nombre AS torneo_nombre,
    t.categoria AS torneo_categoria
    
FROM partidos p
JOIN equipos el ON p.equipo_local_id = el.id
JOIN equipos ev ON p.equipo_visitante_id = ev.id
JOIN torneos t ON p.torneo_id = t.id;

-- ============================================
-- FUNCIONES
-- ============================================

-- Función: Registrar una acción y actualizar marcador
CREATE OR REPLACE FUNCTION registrar_accion(
    p_partido_id UUID,
    p_equipo_id UUID,
    p_jugador_id UUID,
    p_tipo tipo_accion,
    p_cuarto SMALLINT,
    p_timestamp_local TIMESTAMPTZ,
    p_cliente_id VARCHAR(50) DEFAULT NULL
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
    
    -- Insertar la acción
    INSERT INTO acciones (
        partido_id, equipo_id, jugador_id, tipo, cuarto, 
        valor, timestamp_local, cliente_id
    ) VALUES (
        p_partido_id, p_equipo_id, p_jugador_id, p_tipo, p_cuarto,
        v_valor, p_timestamp_local, p_cliente_id
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

-- Función: Anular última acción
CREATE OR REPLACE FUNCTION anular_ultima_accion(p_partido_id UUID)
RETURNS UUID AS $$
DECLARE
    v_accion RECORD;
    v_es_local BOOLEAN;
BEGIN
    -- Obtener última acción no anulada
    SELECT a.*, p.equipo_local_id 
    INTO v_accion
    FROM acciones a
    JOIN partidos p ON a.partido_id = p.id
    WHERE a.partido_id = p_partido_id AND a.anulada = FALSE
    ORDER BY a.timestamp_local DESC
    LIMIT 1;
    
    IF v_accion IS NULL THEN
        RETURN NULL;
    END IF;
    
    v_es_local := (v_accion.equipo_id = v_accion.equipo_local_id);
    
    -- Marcar como anulada
    UPDATE acciones SET anulada = TRUE WHERE id = v_accion.id;
    
    -- Revertir puntos si corresponde
    IF v_accion.valor > 0 THEN
        IF v_es_local THEN
            UPDATE partidos SET 
                puntos_local = puntos_local - v_accion.valor,
                updated_at = NOW()
            WHERE id = p_partido_id;
        ELSE
            UPDATE partidos SET 
                puntos_visitante = puntos_visitante - v_accion.valor,
                updated_at = NOW()
            WHERE id = p_partido_id;
        END IF;
        
        -- Revertir puntos del jugador
        IF v_accion.jugador_id IS NOT NULL THEN
            UPDATE participaciones_partido SET
                puntos = puntos - v_accion.valor,
                updated_at = NOW()
            WHERE partido_id = p_partido_id AND jugador_id = v_accion.jugador_id;
        END IF;
    END IF;
    
    -- Revertir faltas si corresponde
    IF v_accion.tipo IN ('FALTA_PERSONAL', 'FALTA_TECNICA', 'FALTA_ANTIDEPORTIVA') THEN
        IF v_es_local THEN
            UPDATE partidos SET 
                faltas_equipo_local = jsonb_set(
                    faltas_equipo_local,
                    ARRAY[(v_accion.cuarto - 1)::TEXT],
                    to_jsonb(GREATEST(0, (faltas_equipo_local->(v_accion.cuarto - 1))::INT - 1))
                ),
                updated_at = NOW()
            WHERE id = p_partido_id;
        ELSE
            UPDATE partidos SET 
                faltas_equipo_visitante = jsonb_set(
                    faltas_equipo_visitante,
                    ARRAY[(v_accion.cuarto - 1)::TEXT],
                    to_jsonb(GREATEST(0, (faltas_equipo_visitante->(v_accion.cuarto - 1))::INT - 1))
                ),
                updated_at = NOW()
            WHERE id = p_partido_id;
        END IF;
        
        IF v_accion.jugador_id IS NOT NULL THEN
            UPDATE participaciones_partido SET
                faltas = GREATEST(0, faltas - 1),
                updated_at = NOW()
            WHERE partido_id = p_partido_id AND jugador_id = v_accion.jugador_id;
        END IF;
    END IF;
    
    RETURN v_accion.id;
END;
$$ LANGUAGE plpgsql;

-- Función: Finalizar partido
CREATE OR REPLACE FUNCTION finalizar_partido(p_partido_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE partidos SET
        estado = 'FINALIZADO',
        hora_fin_real = NOW(),
        updated_at = NOW()
    WHERE id = p_partido_id AND estado = 'EN_CURSO';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Función: Iniciar partido
CREATE OR REPLACE FUNCTION iniciar_partido(p_partido_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE partidos SET
        estado = 'EN_CURSO',
        cuarto_actual = 1,
        hora_inicio_real = NOW(),
        updated_at = NOW()
    WHERE id = p_partido_id AND estado = 'PROGRAMADO';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Función: Cambiar cuarto
CREATE OR REPLACE FUNCTION cambiar_cuarto(p_partido_id UUID, p_nuevo_cuarto SMALLINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_partido RECORD;
BEGIN
    SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
    
    -- Guardar puntos del cuarto anterior
    IF v_partido.cuarto_actual > 0 THEN
        -- Calcular puntos de este cuarto
        -- (Esta lógica se puede mejorar sumando desde acciones)
    END IF;
    
    UPDATE partidos SET
        cuarto_actual = p_nuevo_cuarto,
        updated_at = NOW()
    WHERE id = p_partido_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDICES
-- ============================================

CREATE INDEX idx_equipos_torneo ON equipos(torneo_id);
CREATE INDEX idx_jugadores_equipo ON jugadores(equipo_id);
CREATE INDEX idx_partidos_torneo ON partidos(torneo_id);
CREATE INDEX idx_partidos_fecha ON partidos(fecha);
CREATE INDEX idx_partidos_estado ON partidos(estado);
CREATE INDEX idx_acciones_partido ON acciones(partido_id);
CREATE INDEX idx_acciones_timestamp ON acciones(timestamp_local);
CREATE INDEX idx_participaciones_partido ON participaciones_partido(partido_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en tablas principales
ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE participaciones_partido ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública (todos pueden ver)
CREATE POLICY "Torneos visibles para todos" ON torneos FOR SELECT USING (true);
CREATE POLICY "Equipos visibles para todos" ON equipos FOR SELECT USING (true);
CREATE POLICY "Jugadores visibles para todos" ON jugadores FOR SELECT USING (true);
CREATE POLICY "Partidos visibles para todos" ON partidos FOR SELECT USING (true);
CREATE POLICY "Acciones visibles para todos" ON acciones FOR SELECT USING (true);
CREATE POLICY "Participaciones visibles para todos" ON participaciones_partido FOR SELECT USING (true);

-- Políticas de escritura (solo usuarios autenticados)
-- NOTA: En producción, agregar roles específicos (admin, planillero, etc.)
CREATE POLICY "Insertar torneos autenticados" ON torneos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar torneos autenticados" ON torneos FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Insertar equipos autenticados" ON equipos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar equipos autenticados" ON equipos FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Insertar jugadores autenticados" ON jugadores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar jugadores autenticados" ON jugadores FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Insertar partidos autenticados" ON partidos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar partidos autenticados" ON partidos FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Insertar acciones autenticados" ON acciones FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar acciones autenticados" ON acciones FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Insertar participaciones autenticados" ON participaciones_partido FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar participaciones autenticados" ON participaciones_partido FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- REALTIME
-- ============================================

-- Habilitar realtime para las tablas que necesitan actualización en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE partidos;
ALTER PUBLICATION supabase_realtime ADD TABLE acciones;

-- ============================================
-- DATOS DE PRUEBA (Opcional - comentar en producción)
-- ============================================

-- Insertar un torneo de ejemplo
/*
INSERT INTO torneos (nombre, categoria, temporada, estado)
VALUES ('Liga Metropolitana', 'Primera División', '2026', 'EN_CURSO');
*/
