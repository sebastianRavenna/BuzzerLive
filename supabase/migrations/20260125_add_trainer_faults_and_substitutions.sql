-- ============================================
-- Migración: Agregar faltas de entrenador y sustituciones
-- Fecha: 2026-01-25
-- ============================================

-- Paso 1: Agregar nuevos valores al enum tipo_accion
-- En PostgreSQL, agregar valores a un ENUM requiere comandos individuales

ALTER TYPE tipo_accion ADD VALUE IF NOT EXISTS 'FALTA_TECNICA_ENTRENADOR';
ALTER TYPE tipo_accion ADD VALUE IF NOT EXISTS 'FALTA_TECNICA_BANCO';
ALTER TYPE tipo_accion ADD VALUE IF NOT EXISTS 'FALTA_DESCALIFICANTE_ENTRENADOR';
ALTER TYPE tipo_accion ADD VALUE IF NOT EXISTS 'SUSTITUCION';

-- Paso 2: Agregar columnas para sustituciones en la tabla acciones
ALTER TABLE acciones
ADD COLUMN IF NOT EXISTS jugador_entra_id UUID REFERENCES jugadores(id);

ALTER TABLE acciones
ADD COLUMN IF NOT EXISTS jugador_sale_id UUID REFERENCES jugadores(id);

-- Paso 3: Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_acciones_jugador_entra ON acciones(jugador_entra_id);
CREATE INDEX IF NOT EXISTS idx_acciones_jugador_sale ON acciones(jugador_sale_id);

-- Paso 4: Agregar comentarios para documentación
COMMENT ON COLUMN acciones.jugador_entra_id IS 'Jugador que entra en la sustitución';
COMMENT ON COLUMN acciones.jugador_sale_id IS 'Jugador que sale en la sustitución';
