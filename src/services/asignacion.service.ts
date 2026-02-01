import { restDirect } from './supabase';

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
  // Obtener partidos programados sin planillero
  const { data: partidos, error } = await restDirect<any[]>('partidos', {
    method: 'GET',
    select: 'id, fecha, hora, lugar, equipo_local:equipos!equipo_local_id(id, nombre_corto), equipo_visitante:equipos!equipo_visitante_id(id, nombre_corto), torneo:torneos(nombre)',
    filters: { organizacion_id: organizacionId, estado: 'PROGRAMADO' },
    rawFilters: ['planillero_id=is.null'],
    order: { column: 'fecha', ascending: true },
  });

  if (error) {
    console.error('Error fetching partidos:', error);
    return [];
  }

  return (partidos || []) as unknown as PartidoSinAsignar[];
}

// Obtener asignaciones de un partido
export async function getAsignacionesPartido(partidoId: string): Promise<Asignacion[]> {
  const { data, error } = await restDirect<Asignacion[]>('asignaciones_planillero', {
    method: 'GET',
    select: '*, usuario:usuarios(id, nombre, apellido, email, club:equipos(id, nombre, nombre_corto))',
    filters: { partido_id: partidoId },
    order: { column: 'created_at', ascending: true },
  });

  if (error) {
    console.error('Error fetching asignaciones:', error);
    return [];
  }

  return (data || []) as Asignacion[];
}

// Obtener usuarios disponibles para asignar (rol club)
export async function getUsuariosDisponibles(organizacionId: string) {
  const { data, error } = await restDirect<any[]>('usuarios', {
    method: 'GET',
    select: 'id, nombre, apellido, email, club:equipos(id, nombre, nombre_corto)',
    filters: { organizacion_id: organizacionId, rol: 'club', activo: true },
    order: { column: 'nombre', ascending: true },
  });

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
  const { data: existing } = await restDirect<{ id: string }>('asignaciones_planillero', {
    method: 'GET',
    select: 'id',
    filters: { partido_id: partidoId, usuario_id: usuarioId },
    single: true,
  });

  if (existing) {
    return { success: false, error: 'Este usuario ya está asignado a este partido' };
  }

  // Crear asignación
  const { error } = await restDirect('asignaciones_planillero', {
    method: 'POST',
    body: {
      partido_id: partidoId,
      usuario_id: usuarioId,
      rol,
      notas: notas || null,
      confirmado: false,
    }
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Si es planillero principal, actualizar partido
  if (rol === 'planillero') {
    await restDirect('partidos', {
      method: 'PATCH',
      filters: { id: partidoId },
      body: { planillero_id: usuarioId }
    });
  }

  return { success: true, error: null };
}

// Quitar asignación
export async function quitarAsignacion(
  partidoId: string,
  usuarioId: string
): Promise<{ success: boolean; error: string | null }> {
  // Obtener la asignación para saber el rol
  const { data: asig } = await restDirect<{ rol: string }>('asignaciones_planillero', {
    method: 'GET',
    select: 'rol',
    filters: { partido_id: partidoId, usuario_id: usuarioId },
    single: true,
  });

  // Eliminar asignación
  const { error } = await restDirect('asignaciones_planillero', {
    method: 'DELETE',
    filters: { partido_id: partidoId, usuario_id: usuarioId },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Si era el planillero principal, limpiar partido
  if (asig?.rol === 'planillero') {
    await restDirect('partidos', {
      method: 'PATCH',
      filters: { id: partidoId },
      body: { planillero_id: null }
    });
  }

  return { success: true, error: null };
}

// Confirmar asignación (el usuario acepta)
export async function confirmarAsignacion(asignacionId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await restDirect('asignaciones_planillero', {
    method: 'PATCH',
    filters: { id: asignacionId },
    body: { confirmado: true },
  });

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
  const { data: usuarios } = await restDirect<{ id: string }[]>('usuarios', {
    method: 'GET',
    select: 'id',
    filters: { organizacion_id: organizacionId, club_id: equipoLocalId, rol: 'club', activo: true },
    limit: 1,
  });

  if (!usuarios || usuarios.length === 0) {
    return { success: false, error: 'No hay usuario activo para el club local' };
  }

  return asignarPlanillero(partidoId, usuarios[0].id, 'planillero', 'Auto-asignado al club local');
}

// Obtener partidos asignados a un usuario
export async function getMisPartidosAsignados(usuarioId: string) {
  const { data, error } = await restDirect<any[]>('asignaciones_planillero', {
    method: 'GET',
    select: 'id, rol, confirmado, partido:partidos(id, fecha, hora, estado, lugar, equipo_local:equipos!equipo_local_id(nombre_corto), equipo_visitante:equipos!equipo_visitante_id(nombre_corto), torneo:torneos(nombre))',
    filters: { usuario_id: usuarioId },
    order: { column: 'created_at', ascending: false },
  });

  if (error) {
    console.error('Error:', error);
    return [];
  }

  return data || [];
}

// Estadísticas de asignaciones
export async function getEstadisticasAsignaciones(organizacionId: string) {
  const partidosSinAsignar = await getPartidosSinPlanillero(organizacionId);

  // Obtener todos los partidos programados para contar
  const { data: partidosProgramados } = await restDirect<{ id: string }[]>('partidos', {
    method: 'GET',
    select: 'id',
    filters: { organizacion_id: organizacionId, estado: 'PROGRAMADO' },
  });

  const totalProgramados = partidosProgramados?.length || 0;

  return {
    sinAsignar: partidosSinAsignar.length,
    totalProgramados,
    asignados: totalProgramados - partidosSinAsignar.length,
  };
}