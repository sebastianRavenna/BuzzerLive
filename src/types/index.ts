// ============================================
// BuzzerLive - TypeScript Types
// ============================================

// Database types (matching Supabase schema)

export type EstadoTorneo = 'PLANIFICACION' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
export type EstadoPartido = 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO' | 'SUSPENDIDO' | 'POSTERGADO';
export type TipoAccion = 
  | 'PUNTO_1' 
  | 'PUNTO_2' 
  | 'PUNTO_3' 
  | 'FALTA_PERSONAL' 
  | 'FALTA_TECNICA' 
  | 'FALTA_ANTIDEPORTIVA' 
  | 'FALTA_DESCALIFICANTE'
  | 'TIEMPO_MUERTO'
  | 'INICIO_CUARTO'
  | 'FIN_CUARTO';

export type TipoFalta = 'FALTA_PERSONAL' | 'FALTA_TECNICA' | 'FALTA_ANTIDEPORTIVA' | 'FALTA_DESCALIFICANTE';

// Base entity interface
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// Torneo
export interface Torneo extends BaseEntity {
  nombre: string;
  categoria: string;
  temporada: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  estado: EstadoTorneo;
  puntos_victoria: number;
  puntos_derrota: number;
}

// Equipo
export interface Equipo extends BaseEntity {
  torneo_id: string;
  nombre: string;
  nombre_corto?: string;
  club?: string;
  escudo_url?: string;
  color_primario?: string;
  color_secundario?: string;
}

// Jugador
export interface Jugador extends BaseEntity {
  equipo_id: string;
  credencial?: string;
  numero_camiseta: number;
  nombre: string;
  apellido: string;
  dni?: string;
  fecha_nacimiento?: string;
  es_capitan: boolean;
  activo: boolean;
}

// Partido
export interface Partido extends BaseEntity {
  torneo_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  fecha: string;
  hora?: string;
  lugar?: string;
  jornada?: number;
  fase?: string;
  estado: EstadoPartido;
  cuarto_actual: number;
  puntos_local: number;
  puntos_visitante: number;
  puntos_por_cuarto: PuntosPorCuarto;
  faltas_equipo_local: number[];
  faltas_equipo_visitante: number[];
  tiempos_muertos_local: number;
  tiempos_muertos_visitante: number;
  arbitro_principal?: string;
  arbitro_auxiliar_1?: string;
  arbitro_auxiliar_2?: string;
  planillero?: string;
  cronometrista?: string;
  hora_inicio_real?: string;
  hora_fin_real?: string;
}

export interface PuntosPorCuarto {
  local: number[];
  visitante: number[];
}

// Accion
export interface Accion extends BaseEntity {
  partido_id: string;
  equipo_id: string;
  jugador_id?: string;
  tipo: TipoAccion;
  cuarto: number;
  valor: number;
  timestamp_local: string;
  timestamp_servidor?: string;
  cliente_id?: string;
  anulada: boolean;
  notas?: string;
}

// Participacion en partido
export interface ParticipacionPartido extends BaseEntity {
  partido_id: string;
  jugador_id: string;
  equipo_id: string;
  puntos: number;
  faltas: number;
  participo: boolean;
  es_titular: boolean;
}

// ============================================
// View types (for computed data)
// ============================================

export interface TablaPosicion {
  equipo_id: string;
  torneo_id: string;
  equipo_nombre: string;
  escudo_url?: string;
  pj: number;  // Partidos jugados
  pg: number;  // Partidos ganados
  pp: number;  // Partidos perdidos
  pf: number;  // Puntos a favor
  pc: number;  // Puntos en contra
  dif: number; // Diferencia
  pts: number; // Puntos tabla
  posicion: number;
}

export interface MarcadorPartido {
  partido_id: string;
  estado: EstadoPartido;
  cuarto_actual: number;
  fecha: string;
  hora?: string;
  lugar?: string;
  observaciones?: string;
  
  local_id: string;
  local_nombre: string;
  local_nombre_corto?: string;
  local_escudo?: string;
  puntos_local: number;
  faltas_equipo_local: number[];
  tiempos_muertos_local: number;
  
  visitante_id: string;
  visitante_nombre: string;
  visitante_nombre_corto?: string;
  visitante_escudo?: string;
  puntos_visitante: number;
  faltas_equipo_visitante: number[];
  tiempos_muertos_visitante: number;
  
  puntos_por_cuarto: PuntosPorCuarto;
  
  torneo_nombre: string;
  torneo_categoria: string;
}

// ============================================
// UI / App types
// ============================================

// Jugador con estadísticas en partido (para UI)
export interface JugadorEnPartido extends Jugador {
  puntos: number;
  faltas: number;
  faltas_tecnicas: number;
  faltas_antideportivas: number;
  descalificado: boolean;
  expulsado_directo: boolean; // true si fue por falta de expulsión directa
  participo: boolean;
  es_titular?: boolean;
}

// Para el selector de equipo activo
export type EquipoActivo = 'local' | 'visitante';

// Estado de conexión
export type ConnectionStatus = 'online' | 'offline' | 'syncing';

// Acción pendiente de sincronización (offline queue)
export interface AccionPendiente {
  id: string;
  accion: Omit<Accion, 'id' | 'created_at' | 'timestamp_servidor'>;
  timestamp: number;
  intentos: number;
}

// Respuesta de función RPC
export interface RegistrarAccionParams {
  p_partido_id: string;
  p_equipo_id: string;
  p_jugador_id: string | null;
  p_tipo: TipoAccion;
  p_cuarto: number;
  p_timestamp_local: string;
  p_cliente_id?: string;
}

// ============================================
// Form types
// ============================================

export interface CreateTorneoForm {
  nombre: string;
  categoria: string;
  temporada: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface CreateEquipoForm {
  torneo_id: string;
  nombre: string;
  nombre_corto?: string;
  club?: string;
  color_primario?: string;
  color_secundario?: string;
}

export interface CreateJugadorForm {
  equipo_id: string;
  numero_camiseta: number;
  nombre: string;
  apellido: string;
  credencial?: string;
  dni?: string;
  es_capitan?: boolean;
}

export interface CreatePartidoForm {
  torneo_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  fecha: string;
  hora?: string;
  lugar?: string;
  jornada?: number;
  fase?: string;
}