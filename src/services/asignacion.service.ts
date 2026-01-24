import { supabase } from './supabase';

export interface Asignacion {
  id: string;
  partido_id: string;
  usuario_id: string;
  rol: 'planillero' | 'arbitro_mesa';
  confirmado: boolean;
  notas: string | null;
  created_at: string;
  usuario?: {
    id: string;
    nombre: string;
    apellido: string | null;
    email: string;
    club?: { id: string; nombre: string; nombre_corto: string };
  };
}

export interface PartidoSinAsignar {
  id: string;
  fecha: string;
  hora: string;
  lugar: string | null;
  equipo_local: { id: string; nombre_corto: string };
  equipo_visitante: { id: string; nombre_corto: string };
  torneo?: { nombre: string };
}

// Obtener partidos sin planillero asignado
export async function getPartidosSinPlanillero(organizacionId: string): Promise<PartidoSinAsignar[]> {
  // Obtener partidos programados
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select(`
      id, fecha, hora, lugar,
      equipo_local:equipos!equipo_local_id(id, nombre_corto),
      equipo_visitante:equipos!equipo_visitante_id(id, nombre_corto),
      torneo:torneos(nombre)
    `)
    .eq('organizacion_id', organizacionId)
    .eq('estado', 'PROGRAMADO')
    .is('planillero_id', null)
    .order('fecha')
    .order('hora');

  if (error) {
    console.error('Error fetching partidos:', error);
    return [];
  }

  return (partidos || []) as unknown as PartidoSinAsignar[];
}

// Obtener asignaciones de un partido
export async function getAsignacionesPartido(partidoId: string): Promise<Asignacion[]> {
  const { data, error } = await supabase
    .from('asignaciones_planillero')
    .select(`
      *,
      usuario:usuarios(
        id, nombre, apellido, email,
        club:equipos(id, nombre, nombre_corto)
      )
    `)
    .eq('partido_id', partidoId)
    .order('created_at');

  if (error) {
    console.error('Error fetching asignaciones:', error);
    return [];
  }

  return (data || []) as Asignacion[];
}

// Obtener usuarios disponibles para asignar (rol club)
export async function getUsuariosDisponibles(organizacionId: string) {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id, nombre, apellido, email,
      club:equipos(id, nombre, nombre_corto)
    `)
    .eq('organizacion_id', organizacionId)
    .eq('rol', 'club')
    .eq('activo', true)
    .order('nombre');

  if (error) {
    console.error('Error fetching usuarios:', error);
    return [];
  }

  return data || [];
}

// Asignar planillero a partido
export async function asignarPlanillero(
  partidoId: string,
  usuarioId: string,
  rol: 'planillero' | 'arbitro_mesa' = 'planillero',
  notas?: string
): Promise<{ success: boolean; error: string | null }> {
  // Verificar si ya está asignado
  const { data: existing } = await supabase
    .from('asignaciones_planillero')
    .select('id')
    .eq('partido_id', partidoId)
    .eq('usuario_id', usuarioId)
    .single();

  if (existing) {
    return { success: false, error: 'Este usuario ya está asignado a este partido' };
  }

  // Crear asignación
  const { error } = await supabase.from('asignaciones_planillero').insert({
    partido_id: partidoId,
    usuario_id: usuarioId,
    rol,
    notas: notas || null,
    confirmado: false,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Si es planillero principal, actualizar partido
  if (rol === 'planillero') {
    await supabase.from('partidos').update({ planillero_id: usuarioId }).eq('id', partidoId);
  }

  return { success: true, error: null };
}

// Quitar asignación
export async function quitarAsignacion(
  partidoId: string,
  usuarioId: string
): Promise<{ success: boolean; error: string | null }> {
  // Obtener la asignación para saber el rol
  const { data: asig } = await supabase
    .from('asignaciones_planillero')
    .select('rol')
    .eq('partido_id', partidoId)
    .eq('usuario_id', usuarioId)
    .single();

  // Eliminar asignación
  const { error } = await supabase
    .from('asignaciones_planillero')
    .delete()
    .eq('partido_id', partidoId)
    .eq('usuario_id', usuarioId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Si era el planillero principal, limpiar partido
  if (asig?.rol === 'planillero') {
    await supabase.from('partidos').update({ planillero_id: null }).eq('id', partidoId);
  }

  return { success: true, error: null };
}

// Confirmar asignación (el usuario acepta)
export async function confirmarAsignacion(asignacionId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('asignaciones_planillero')
    .update({ confirmado: true })
    .eq('id', asignacionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Asignar automáticamente al club local
export async function autoAsignarClubLocal(
  partidoId: string,
  equipoLocalId: string,
  organizacionId: string
): Promise<{ success: boolean; error: string | null }> {
  // Buscar usuario del club local
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id')
    .eq('organizacion_id', organizacionId)
    .eq('club_id', equipoLocalId)
    .eq('rol', 'club')
    .eq('activo', true)
    .limit(1);

  if (!usuarios || usuarios.length === 0) {
    return { success: false, error: 'No hay usuario activo para el club local' };
  }

  return asignarPlanillero(partidoId, usuarios[0].id, 'planillero', 'Auto-asignado al club local');
}

// Obtener partidos asignados a un usuario
export async function getMisPartidosAsignados(usuarioId: string) {
  const { data, error } = await supabase
    .from('asignaciones_planillero')
    .select(`
      id, rol, confirmado,
      partido:partidos(
        id, fecha, hora, estado, lugar,
        equipo_local:equipos!equipo_local_id(nombre_corto),
        equipo_visitante:equipos!equipo_visitante_id(nombre_corto),
        torneo:torneos(nombre)
      )
    `)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return [];
  }

  return data || [];
}

// Estadísticas de asignaciones
export async function getEstadisticasAsignaciones(organizacionId: string) {
  const partidosSinAsignar = await getPartidosSinPlanillero(organizacionId);

  const { count: totalProgramados } = await supabase
    .from('partidos')
    .select('id', { count: 'exact', head: true })
    .eq('organizacion_id', organizacionId)
    .eq('estado', 'PROGRAMADO');

  return {
    sinAsignar: partidosSinAsignar.length,
    totalProgramados: totalProgramados || 0,
    asignados: (totalProgramados || 0) - partidosSinAsignar.length,
  };
}
