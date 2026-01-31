import { supabase } from './supabase';

export interface RefuerzoInfo {
  esRefuerzo: boolean;
  cuartosLimite: number | null;
  cuartosJugados: number[];
  puedeJugar: boolean;
}

// Obtener info de refuerzo para un jugador en un partido
export async function getRefuerzoInfo(
  partidoId: string,
  jugadorId: string,
  cuartoActual: number
): Promise<RefuerzoInfo> {
  // Obtener datos del jugador
  const { data: jugador } = await supabase
    .from('jugadores')
    .select('es_refuerzo, cuartos_limite')
    .eq('id', jugadorId)
    .single();

  if (!jugador || !jugador.es_refuerzo) {
    return { esRefuerzo: false, cuartosLimite: null, cuartosJugados: [], puedeJugar: true };
  }

  // Obtener cuartos ya jugados
  const { data: cuartos } = await supabase
    .from('jugador_cuartos')
    .select('cuarto')
    .eq('partido_id', partidoId)
    .eq('jugador_id', jugadorId);

  const cuartosJugados = cuartos?.map((c: any) => c.cuarto) || [];
  const limite = jugador.cuartos_limite || 4;

  // Ya jugó este cuarto? puede continuar
  const yaEnEsteCuarto = cuartosJugados.includes(cuartoActual);
  
  // Puede jugar si: ya está en este cuarto O no llegó al límite
  const puedeJugar = yaEnEsteCuarto || cuartosJugados.length < limite;

  return {
    esRefuerzo: true,
    cuartosLimite: limite,
    cuartosJugados,
    puedeJugar,
  };
}

// Registrar que un jugador jugó en un cuarto
export async function registrarCuartoJugado(
  partidoId: string,
  jugadorId: string,
  cuarto: number
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('jugador_cuartos')
    .upsert({
      partido_id: partidoId,
      jugador_id: jugadorId,
      cuarto,
    }, {
      onConflict: 'partido_id,jugador_id,cuarto'
    });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

// Obtener todos los refuerzos de un equipo con sus cuartos jugados en un partido
export async function getRefuerzosEquipo(
  equipoId: string,
  partidoId: string
): Promise<Map<string, RefuerzoInfo>> {
  const result = new Map<string, RefuerzoInfo>();

  // Obtener jugadores refuerzo del equipo
  const { data: jugadores } = await supabase
    .from('jugadores')
    .select('id, es_refuerzo, cuartos_limite')
    .eq('equipo_id', equipoId)
    .eq('es_refuerzo', true);

  if (!jugadores || jugadores.length === 0) return result;

  // Obtener cuartos jugados de todos
  const jugadorIds = jugadores.map((j: any) => j.id);
  const { data: cuartos } = await supabase
    .from('jugador_cuartos')
    .select('jugador_id, cuarto')
    .eq('partido_id', partidoId)
    .in('jugador_id', jugadorIds);

  // Construir mapa
  for (const j of jugadores) {
    const cuartosJugados = cuartos?.filter((c: any) => c.jugador_id === j.id).map((c: any) => c.cuarto) || [];
    const limite = j.cuartos_limite || 4;
    result.set(j.id, {
      esRefuerzo: true,
      cuartosLimite: limite,
      cuartosJugados,
      puedeJugar: cuartosJugados.length < limite,
    });
  }

  return result;
}

// Verificar si un jugador puede entrar en cancha
export async function verificarEntradaCancha(
  partidoId: string,
  jugadorId: string,
  cuartoActual: number
): Promise<{ permitido: boolean; mensaje?: string }> {
  const info = await getRefuerzoInfo(partidoId, jugadorId, cuartoActual);

  if (!info.esRefuerzo) {
    return { permitido: true };
  }

  if (!info.puedeJugar) {
    return {
      permitido: false,
      mensaje: `Refuerzo ya jugó ${info.cuartosJugados.length}/${info.cuartosLimite} cuartos permitidos`,
    };
  }

  return { permitido: true };
}

// Al poner un jugador en cancha, registrar el cuarto
export async function registrarEntradaCancha(
  partidoId: string,
  jugadorId: string,
  cuarto: number
): Promise<void> {
  // Solo registrar si es refuerzo
  const { data: jugador } = await supabase
    .from('jugadores')
    .select('es_refuerzo')
    .eq('id', jugadorId)
    .single();

  if (jugador?.es_refuerzo) {
    await registrarCuartoJugado(partidoId, jugadorId, cuarto);
  }
}
