-- ============================================
-- BuzzerLive - Database Schema Alignment
-- Generated: 2026-01-31
-- Purpose: Align database schema with TypeScript types
-- ============================================

-- ============================================
-- 1. CRITICAL: participaciones_partido - Add missing foul columns
-- ============================================
ALTER TABLE participaciones_partido
ADD COLUMN IF NOT EXISTS faltas_tecnicas smallint DEFAULT 0,
ADD COLUMN IF NOT EXISTS faltas_antideportivas smallint DEFAULT 0,
ADD COLUMN IF NOT EXISTS descalificado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS expulsado_directo boolean DEFAULT false;

COMMENT ON COLUMN participaciones_partido.faltas_tecnicas IS 'Technical fouls count';
COMMENT ON COLUMN participaciones_partido.faltas_antideportivas IS 'Unsportsmanlike fouls count';
COMMENT ON COLUMN participaciones_partido.descalificado IS 'Player disqualified (by accumulation)';
COMMENT ON COLUMN participaciones_partido.expulsado_directo IS 'Player directly expelled';

-- ============================================
-- 2. partidos - Add missing coach and club columns
-- ============================================
ALTER TABLE partidos
ADD COLUMN IF NOT EXISTS entrenador_local_id uuid REFERENCES entrenadores(id),
ADD COLUMN IF NOT EXISTS entrenador_visitante_id uuid REFERENCES entrenadores(id);

COMMENT ON COLUMN partidos.entrenador_local_id IS 'Local team coach ID';
COMMENT ON COLUMN partidos.entrenador_visitante_id IS 'Visitor team coach ID';

-- ============================================
-- 3. organizaciones - Add descripcion column (used in TypeScript)
-- ============================================
ALTER TABLE organizaciones
ADD COLUMN IF NOT EXISTS descripcion text;

COMMENT ON COLUMN organizaciones.descripcion IS 'Organization description';

-- ============================================
-- 4. Update marcador_partido view to include escudos
-- ============================================
DROP VIEW IF EXISTS marcador_partido;

CREATE OR REPLACE VIEW marcador_partido AS
SELECT
    p.id AS partido_id,
    p.estado,
    p.cuarto_actual,
    p.fecha,
    p.hora,
    p.lugar,
    p.observaciones,

    -- Local team
    el.id AS local_id,
    el.nombre AS local_nombre,
    el.nombre_corto AS local_nombre_corto,
    COALESCE(el.escudo_url, el.logo_url) AS local_escudo,
    p.puntos_local,
    p.faltas_equipo_local,
    p.tiempos_muertos_local,

    -- Visitor team
    ev.id AS visitante_id,
    ev.nombre AS visitante_nombre,
    ev.nombre_corto AS visitante_nombre_corto,
    COALESCE(ev.escudo_url, ev.logo_url) AS visitante_escudo,
    p.puntos_visitante,
    p.faltas_equipo_visitante,
    p.tiempos_muertos_visitante,

    -- Score by quarter
    p.puntos_por_cuarto,

    -- Tournament info
    t.nombre AS torneo_nombre,
    t.categoria AS torneo_categoria

FROM partidos p
LEFT JOIN equipos el ON p.equipo_local_id = el.id
LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
LEFT JOIN torneos t ON p.torneo_id = t.id;

COMMENT ON VIEW marcador_partido IS 'Public scoreboard view with team shields';

-- ============================================
-- 5. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_participaciones_partido_jugador
ON participaciones_partido(jugador_id);

CREATE INDEX IF NOT EXISTS idx_participaciones_partido_partido
ON participaciones_partido(partido_id);

CREATE INDEX IF NOT EXISTS idx_acciones_partido_cuarto
ON acciones(partido_id, cuarto);

CREATE INDEX IF NOT EXISTS idx_partidos_entrenador_local
ON partidos(entrenador_local_id) WHERE entrenador_local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partidos_entrenador_visitante
ON partidos(entrenador_visitante_id) WHERE entrenador_visitante_id IS NOT NULL;

-- ============================================
-- 6. Function to update participation stats from actions
-- ============================================
CREATE OR REPLACE FUNCTION actualizar_estadisticas_participacion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if action is not cancelled
    IF NEW.anulada = false AND NEW.jugador_id IS NOT NULL THEN
        -- Update participation based on action type
        UPDATE participaciones_partido
        SET
            participo = true,
            updated_at = NOW()
        WHERE partido_id = NEW.partido_id
          AND jugador_id = NEW.jugador_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trg_actualizar_participacion ON acciones;
CREATE TRIGGER trg_actualizar_participacion
    AFTER INSERT ON acciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_estadisticas_participacion();

-- ============================================
-- 7. Grant permissions for the new columns
-- ============================================
-- Note: Adjust these based on your RLS policies
GRANT SELECT ON marcador_partido TO anon, authenticated;

-- ============================================
-- Done!
-- ============================================
