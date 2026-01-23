// ============================================
// BuzzerLive - TypeScript Types
// Sprint 6: Multi-Tenant Architecture
// ============================================

// ============================================
// Auth & Roles
// ============================================

export type RolUsuario = 'superadmin' | 'admin' | 'club';

export type PlanOrganizacion = 'basico' | 'profesional' | 'enterprise';

// ============================================
// Database types (matching Supabase schema)
// ============================================

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
  | 'FALTA_TECNICA_ENTRENADOR'
  | 'FALTA_TECNICA_BANCO'
  | 'FALTA_DESCALIFICANTE_ENTRENADOR'
  | 'TIEMPO_MUERTO'
  | 'INICIO_CUARTO'
  | 'FIN_CUARTO';

export type TipoFalta = 'FALTA_PERSONAL' | 'FALTA_TECNICA' | 'FALTA_ANTIDEPORTIVA' | 'FALTA_DESCALIFICANTE';

export type TipoFaltaEntrenador = 'FALTA_TECNICA_ENTRENADOR' | 'FALTA_TECNICA_BANCO' | 'FALTA_DESCALIFICANTE_ENTRENADOR';

// Estado del entrenador (para UI)
export interface EntrenadorEstado {
  faltasTecnicasEntrenador: number;
  faltasTecnicasBanco: number;
  expulsadoDirecto: boolean;
  descalificado: boolean;
}

// Base entity interface
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// Multi-Tenant Entities
// ============================================

// Organización (Asociación/Federación)
export interface Organizacion extends BaseEntity {
  nombre: string;
  slug: string;
  descripcion?: string;
  logo_url?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  activa: boolean;
  // Límites del plan
  max_torneos: number;
  max_clubes: number;
  max_jugadores_por_club: number;
  plan: PlanOrganizacion;
}

// Usuario del sistema
export interface Usuario extends BaseEntity {
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  avatar_url?: string;
  rol: RolUsuario;
  organizacion_id?: string;
  activo: boolean;
  ultimo_acceso?: string;
}

// Usuario con datos expandidos
export interface UsuarioConOrg extends Usuario {
  organizacion?: Organizacion;
}

// Club
export interface Club extends BaseEntity {
  organizacion_id: string;
  nombre: string;
  nombre_corto?: string;
  escudo_url?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  colores_primario: string;
  colores_secundario: string;
  fecha_fundacion?: string;
  activo: boolean;
}

// Club con estadísticas
export interface ClubConStats extends Club {
  organizacion_nombre?: string;
  jugadores_count: number;
  entrenadores_count: number;
  equipos_count: number;
}

// Relación usuario-club
export interface UsuarioClub extends BaseEntity {
  usuario_id: string;
  club_id: string;
  es_principal: boolean;
  puede_editar_plantilla: boolean;
  puede_operar_partidos: boolean;
}

// Entrenador
export interface Entrenador extends BaseEntity {
  club_id: string;
  nombre: string;
  apellido: string;
  dni?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  foto_url?: string;
  licencia?: string;
  certificado_medico_url?: string;
  certificado_medico_vencimiento?: string;
  activo: boolean;
}

// ============================================
// Entidades actualizadas con multi-tenant
// ============================================

// Torneo
export interface Torneo extends BaseEntity {
  organizacion_id?: string;
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
  organizacion_id?: string;
  torneo_id: string;
  club_id?: string;
  nombre: string;
  nombre_corto?: string;
  club?: string;
  escudo_url?: string;
  color_primario?: string;
  color_secundario?: string;
}

// Jugador
export interface Jugador extends BaseEntity {
  organizacion_id?: string;
  equipo_id: string;
  club_id?: string;
  credencial?: string;
  numero_camiseta: number;
  nombre: string;
  apellido: string;
  dni?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  foto_url?: string;
  certificado_medico_url?: string;
  certificado_medico_vencimiento?: string;
  es_capitan: boolean;
  es_refuerzo: boolean;
  cuartos_jugados_torneo?: Record<string, number>;
  activo: boolean;
}

// Partido
export interface Partido extends BaseEntity {
  organizacion_id?: string;
  torneo_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  club_local_id?: string;
  club_visitante_id?: string;
  entrenador_local_id?: string;
  entrenador_visitante_id?: string;
  planillero_usuario_id?: string;
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
  organizacion_id?: string;
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
  pj: number;
  pg: number;
  pp: number;
  pf: number;
  pc: number;
  dif: number;
  pts: number;
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

// Stats para SuperAdmin
export interface StatsGlobales {
  total_organizaciones: number;
  total_usuarios: number;
  total_clubes: number;
  total_torneos: number;
  partidos_en_curso: number;
  partidos_finalizados: number;
  total_jugadores: number;
}

// Stats de organización
export interface OrganizacionConStats extends Organizacion {
  usuarios_count: number;
  clubes_count: number;
  torneos_count: number;
  jugadores_count: number;
  partidos_en_curso: number;
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
  expulsado_directo: boolean;
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
// Auth Context
// ============================================

export interface AuthState {
  usuario: Usuario | null;
  organizacion: Organizacion | null;
  clubes: Club[];
  loading: boolean;
  error: string | null;
}

// ============================================
// Form types
// ============================================

export interface CreateOrganizacionForm {
  nombre: string;
  slug: string;
  descripcion?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  sitio_web?: string;
  max_torneos?: number;
  max_clubes?: number;
  max_jugadores_por_club?: number;
  plan?: PlanOrganizacion;
}

export interface CreateUsuarioForm {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  rol: RolUsuario;
  organizacion_id?: string;
}

export interface CreateClubForm {
  organizacion_id: string;
  nombre: string;
  nombre_corto?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  colores_primario?: string;
  colores_secundario?: string;
  fecha_fundacion?: string;
}

export interface CreateEntrenadorForm {
  club_id: string;
  nombre: string;
  apellido: string;
  dni?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  licencia?: string;
}

export interface CreateTorneoForm {
  organizacion_id?: string;
  nombre: string;
  categoria: string;
  temporada: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface CreateEquipoForm {
  torneo_id: string;
  club_id?: string;
  nombre: string;
  nombre_corto?: string;
  color_primario?: string;
  color_secundario?: string;
}

export interface CreateJugadorForm {
  equipo_id: string;
  club_id?: string;
  numero_camiseta: number;
  nombre: string;
  apellido: string;
  credencial?: string;
  dni?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  es_capitan?: boolean;
  es_refuerzo?: boolean;
}

export interface CreatePartidoForm {
  torneo_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  club_local_id?: string;
  club_visitante_id?: string;
  fecha: string;
  hora?: string;
  lugar?: string;
  jornada?: number;
  fase?: string;
}
