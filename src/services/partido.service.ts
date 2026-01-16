import { supabase } from './supabase';
import type { 
  Partido, 
  Equipo, 
  Jugador,
  TipoAccion,
  JugadorEnPartido
} from '../types';

// Obtener datos completos de un partido
export async function getPartidoCompleto(partidoId: string) {
  // Obtener partido con equipos
  const { data: partido, error: errorPartido } = await supabase
    .from('partidos')
    .select('*')
    .eq('id', partidoId)
    .single();

  if (errorPartido) throw errorPartido;
  if (!partido) throw new Error('Partido no encontrado');

  // Obtener equipos
  const { data: equipoLocal } = await supabase
    .from('equipos')
    .select('*')
    .eq('id', partido.equipo_local_id)
    .single();

  const { data: equipoVisitante } = await supabase
    .from('equipos')
    .select('*')
    .eq('id', partido.equipo_visitante_id)
    .single();

  // Obtener jugadores de ambos equipos
  const { data: jugadoresLocal } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', partido.equipo_local_id)
    .eq('activo', true)
    .order('numero_camiseta');

  const { data: jugadoresVisitante } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', partido.equipo_visitante_id)
    .eq('activo', true)
    .order('numero_camiseta');

  // Obtener participaciones (estadísticas de este partido)
  const { data: participaciones } = await supabase
    .from('participaciones_partido')
    .select('*')
    .eq('partido_id', partidoId);

  // Mapear jugadores con sus estadísticas del partido
  const mapJugadorConStats = (jugador: Jugador): JugadorEnPartido => {
    const participacion = participaciones?.find(p => p.jugador_id === jugador.id);
    return {
      ...jugador,
      puntos: participacion?.puntos || 0,
      faltas: participacion?.faltas || 0,
      participo: participacion?.participo || false,
    };
  };

  return {
    partido: partido as Partido,
    equipoLocal: equipoLocal as Equipo,
    equipoVisitante: equipoVisitante as Equipo,
    jugadoresLocal: (jugadoresLocal || []).map(mapJugadorConStats),
    jugadoresVisitante: (jugadoresVisitante || []).map(mapJugadorConStats),
  };
}

// Iniciar un partido
export async function iniciarPartido(partidoId: string) {
  const { data, error } = await supabase.rpc('iniciar_partido', {
    p_partido_id: partidoId
  });

  if (error) throw error;
  
  // Crear participaciones para todos los jugadores
  const partido = await getPartidoCompleto(partidoId);
  
  const participaciones = [
    ...partido.jugadoresLocal.map(j => ({
      partido_id: partidoId,
      jugador_id: j.id,
      equipo_id: partido.equipoLocal.id,
    })),
    ...partido.jugadoresVisitante.map(j => ({
      partido_id: partidoId,
      jugador_id: j.id,
      equipo_id: partido.equipoVisitante.id,
    })),
  ];

  await supabase.from('participaciones_partido').upsert(participaciones, {
    onConflict: 'partido_id,jugador_id'
  });

  return data;
}

// Registrar una acción (punto o falta)
export async function registrarAccion(
  partidoId: string,
  equipoId: string,
  jugadorId: string | null,
  tipo: TipoAccion,
  cuarto: number
) {
  const { data, error } = await supabase.rpc('registrar_accion', {
    p_partido_id: partidoId,
    p_equipo_id: equipoId,
    p_jugador_id: jugadorId,
    p_tipo: tipo,
    p_cuarto: cuarto,
    p_timestamp_local: new Date().toISOString(),
    p_cliente_id: getClienteId(),
  });

  if (error) throw error;
  return data;
}

// Anular última acción
export async function anularUltimaAccion(partidoId: string) {
  const { data, error } = await supabase.rpc('anular_ultima_accion', {
    p_partido_id: partidoId
  });

  if (error) throw error;
  return data;
}

// Cambiar cuarto
export async function cambiarCuarto(partidoId: string, nuevoCuarto: number) {
  const { error } = await supabase
    .from('partidos')
    .update({ 
      cuarto_actual: nuevoCuarto,
      updated_at: new Date().toISOString()
    })
    .eq('id', partidoId);

  if (error) throw error;
}

// Finalizar partido
export async function finalizarPartido(partidoId: string) {
  const { data, error } = await supabase.rpc('finalizar_partido', {
    p_partido_id: partidoId
  });

  if (error) throw error;
  return data;
}

// Obtener acciones de un partido (para el log)
export async function getAcciones(partidoId: string, limit = 10) {
  const { data, error } = await supabase
    .from('acciones')
    .select(`
      *,
      jugador:jugadores(numero_camiseta, nombre, apellido),
      equipo:equipos(nombre_corto)
    `)
    .eq('partido_id', partidoId)
    .eq('anulada', false)
    .order('timestamp_local', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// Suscribirse a cambios del partido en tiempo real
export function suscribirseAPartido(
  partidoId: string, 
  onUpdate: (partido: Partial<Partido>) => void
) {
  const channel = supabase
    .channel(`partido-${partidoId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'partidos',
        filter: `id=eq.${partidoId}`,
      },
      (payload) => {
        onUpdate(payload.new as Partial<Partido>);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Generar ID único para el cliente (para sincronización)
function getClienteId(): string {
  let clienteId = localStorage.getItem('buzzer_cliente_id');
  if (!clienteId) {
    clienteId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('buzzer_cliente_id', clienteId);
  }
  return clienteId;
}
