import { supabase, callRpcDirect } from './supabase';
import type { 
  Partido, 
  Equipo, 
  Jugador,
  TipoAccion,
  JugadorEnPartido
} from '../types';

// Obtener datos completos de un partido
export async function getPartidoCompleto(partidoId: string) {
  console.log('📥 getPartidoCompleto() INICIO - Partido ID:', partidoId);
  console.log('⏱️ Timestamp:', new Date().toISOString());

  // Obtener partido con equipos
  console.log('🔍 Query 1/7: Obteniendo partido...');
  const startPartido = performance.now();
  const { data: partido, error: errorPartido } = await supabase
    .from('partidos')
    .select('*')
    .eq('id', partidoId)
    .single();
  const endPartido = performance.now();
  console.log(`✅ Query partido completada en ${(endPartido - startPartido).toFixed(2)}ms`);

  if (errorPartido) {
    console.error('❌ Error obteniendo partido:', errorPartido);
    throw errorPartido;
  }
  if (!partido) {
    console.error('❌ Partido no encontrado');
    throw new Error('Partido no encontrado');
  }
  console.log('📦 Partido cargado:', partido.id, '-', partido.estado);

  // Obtener equipos
  console.log('🔍 Query 2/7: Obteniendo equipo local...');
  const startEqLocal = performance.now();
  const { data: equipoLocal } = await supabase
    .from('equipos')
    .select('*')
    .eq('id', partido.equipo_local_id)
    .single();
  console.log(`✅ Equipo local en ${(performance.now() - startEqLocal).toFixed(2)}ms`);

  console.log('🔍 Query 3/7: Obteniendo equipo visitante...');
  const startEqVis = performance.now();
  const { data: equipoVisitante } = await supabase
    .from('equipos')
    .select('*')
    .eq('id', partido.equipo_visitante_id)
    .single();
  console.log(`✅ Equipo visitante en ${(performance.now() - startEqVis).toFixed(2)}ms`);

  // Obtener jugadores de ambos equipos
  console.log('🔍 Query 4/7: Obteniendo jugadores locales...');
  const startJugLocal = performance.now();
  const { data: jugadoresLocal } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', partido.equipo_local_id)
    .eq('activo', true)
    .order('numero_camiseta');
  console.log(`✅ Jugadores locales (${jugadoresLocal?.length || 0}) en ${(performance.now() - startJugLocal).toFixed(2)}ms`);

  console.log('🔍 Query 5/7: Obteniendo jugadores visitantes...');
  const startJugVis = performance.now();
  const { data: jugadoresVisitante } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', partido.equipo_visitante_id)
    .eq('activo', true)
    .order('numero_camiseta');
  console.log(`✅ Jugadores visitantes (${jugadoresVisitante?.length || 0}) en ${(performance.now() - startJugVis).toFixed(2)}ms`);

  // Obtener participaciones (estadísticas de este partido)
  console.log('🔍 Query 6/7: Obteniendo participaciones...');
  const startPartic = performance.now();
  const { data: participaciones } = await supabase
    .from('participaciones_partido')
    .select('*')
    .eq('partido_id', partidoId);
  console.log(`✅ Participaciones (${participaciones?.length || 0}) en ${(performance.now() - startPartic).toFixed(2)}ms`);

  // Obtener acciones de faltas para contar todas las faltas
  console.log('🔍 Query 7/7: Obteniendo acciones de faltas...');
  const startAcciones = performance.now();
  const { data: accionesFaltas } = await supabase
    .from('acciones')
    .select('jugador_id, tipo')
    .eq('partido_id', partidoId)
    .eq('anulada', false)
    .in('tipo', ['FALTA_PERSONAL', 'FALTA_TECNICA', 'FALTA_ANTIDEPORTIVA', 'FALTA_DESCALIFICANTE']);
  console.log(`✅ Acciones faltas (${accionesFaltas?.length || 0}) en ${(performance.now() - startAcciones).toFixed(2)}ms`);

  // Mapear jugadores con sus estadísticas del partido
  const mapJugadorConStats = (jugador: Jugador): JugadorEnPartido => {
    const participacion = participaciones?.find(p => p.jugador_id === jugador.id);
    
    // Contar faltas por tipo desde acciones
    const faltasJugador = accionesFaltas?.filter((a: any) => a.jugador_id === jugador.id) || [];
    const faltas_tecnicas = faltasJugador.filter((a: any) => a.tipo === 'FALTA_TECNICA').length;
    const faltas_antideportivas = faltasJugador.filter((a: any) => a.tipo === 'FALTA_ANTIDEPORTIVA').length;
    const faltas_personales = faltasJugador.filter((a: any) => a.tipo === 'FALTA_PERSONAL').length;
    const expulsado_directo = faltasJugador.some((a: any) => a.tipo === 'FALTA_DESCALIFICANTE');
    
    // Total de faltas = personales + técnicas + antideportivas
    const faltas_totales = faltas_personales + faltas_tecnicas + faltas_antideportivas;
    
    // Descalificado si: 2 técnicas, 2 antideportivas, 1T+1A, o 1 expulsión directa
    const descalificado = expulsado_directo || 
                          faltas_tecnicas >= 2 || 
                          faltas_antideportivas >= 2 ||
                          (faltas_tecnicas >= 1 && faltas_antideportivas >= 1);
    
    return {
      ...jugador,
      puntos: participacion?.puntos || 0,
      faltas: faltas_totales, // Ahora viene del conteo de acciones
      faltas_tecnicas,
      faltas_antideportivas,
      descalificado,
      expulsado_directo,
      participo: participacion?.participo || false,
      es_titular: participacion?.es_titular || false,
    };
  };

  console.log('✅ getPartidoCompleto() COMPLETADO');
  console.log('📊 Resumen:');
  console.log('  - Partido:', partido.id);
  console.log('  - Jugadores local:', jugadoresLocal?.length || 0);
  console.log('  - Jugadores visitante:', jugadoresVisitante?.length || 0);
  console.log('  - Participaciones:', participaciones?.length || 0);
  console.log('  - Acciones:', accionesFaltas?.length || 0);

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
  const { data, error } = await callRpcDirect('iniciar_partido', {
    p_partido_id: partidoId
  });

  if (error) throw error;
  
  // Crear participaciones para todos los jugadores
  const partido = await getPartidoCompleto(partidoId);
  
  const participaciones = [
    ...partido.jugadoresLocal.map((j: any) => ({
      partido_id: partidoId,
      jugador_id: j.id,
      equipo_id: partido.equipoLocal.id,
    })),
    ...partido.jugadoresVisitante.map((j: any) => ({
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
  cuarto: number,
  esDescuento: boolean = false,
  tirosLibres: number = 0,
  numeroFalta: number | null = null,
  puntosLocal: number | null = null,
  puntosVisitante: number | null = null
) {
  // Si es descuento, usamos una lógica diferente (actualización directa)
  if (esDescuento) {
    return await descontarAccion(partidoId, equipoId, jugadorId, tipo, cuarto);
  }

  const timestampLocal = new Date().toISOString();

  console.log('🎯 Registrando acción:', tipo, 'Jugador:', jugadorId);

  // Llamar RPC usando fetch directo con todos los campos (bypasea el cliente de Supabase)
  // Esto evita el bug de timeout después de minimizar la app
  const { data, error } = await callRpcDirect('registrar_accion', {
    p_partido_id: partidoId,
    p_equipo_id: equipoId,
    p_jugador_id: jugadorId,
    p_tipo: tipo,
    p_cuarto: cuarto,
    p_timestamp_local: timestampLocal,
    p_cliente_id: getClienteId(),
    p_tiros_libres: tirosLibres > 0 ? tirosLibres : null,
    p_numero_falta: numeroFalta,
    p_puntos_local: puntosLocal,
    p_puntos_visitante: puntosVisitante,
  });

  if (error) throw error;

  return data;
}

// Descontar una acción (restar punto o falta)
async function descontarAccion(
  partidoId: string,
  equipoId: string,
  jugadorId: string | null,
  tipo: TipoAccion,
  cuarto: number
) {
  // Obtener partido actual
  const { data: partido, error: errorPartido } = await supabase
    .from('partidos')
    .select('*')
    .eq('id', partidoId)
    .single();
  
  if (errorPartido) throw errorPartido;
  
  const esLocal = equipoId === partido.equipo_local_id;

  // Calcular valor a descontar
  let valorPunto = 0;

  if (tipo === 'PUNTO_1') valorPunto = 1;
  else if (tipo === 'PUNTO_2') valorPunto = 2;
  else if (tipo === 'PUNTO_3') valorPunto = 3;
  
  // Actualizar partido
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (valorPunto > 0) {
    if (esLocal) {
      updates.puntos_local = Math.max(0, partido.puntos_local - valorPunto);
    } else {
      updates.puntos_visitante = Math.max(0, partido.puntos_visitante - valorPunto);
    }
  }
  
  // Solo descontar falta de equipo para falta personal
  if (tipo === 'FALTA_PERSONAL') {
    const faltasKey = esLocal ? 'faltas_equipo_local' : 'faltas_equipo_visitante';
    const faltasActuales = [...(partido[faltasKey] || [0, 0, 0, 0, 0, 0])];
    const idx = Math.max(0, cuarto - 1);
    faltasActuales[idx] = Math.max(0, (faltasActuales[idx] || 0) - 1);
    updates[faltasKey] = faltasActuales;
  }
  
  const { error: errorUpdate } = await supabase
    .from('partidos')
    .update(updates)
    .eq('id', partidoId);
  
  if (errorUpdate) throw errorUpdate;
  
  // Actualizar participación del jugador si aplica (solo para puntos y falta personal)
  if (jugadorId && (valorPunto > 0 || tipo === 'FALTA_PERSONAL')) {
    const { data: participacion } = await supabase
      .from('participaciones_partido')
      .select('*')
      .eq('partido_id', partidoId)
      .eq('jugador_id', jugadorId)
      .single();
    
    if (participacion) {
      const updatesPart: Record<string, unknown> = {};
      if (valorPunto > 0) {
        updatesPart.puntos = Math.max(0, participacion.puntos - valorPunto);
      }
      if (tipo === 'FALTA_PERSONAL') {
        updatesPart.faltas = Math.max(0, participacion.faltas - 1);
      }
      
      await supabase
        .from('participaciones_partido')
        .update(updatesPart)
        .eq('id', participacion.id);
    }
  }
  
  // Buscar la última acción no anulada del jugador con el mismo tipo y marcarla como anulada
  const { data: acciones, error: errorBusqueda } = await supabase
    .from('acciones')
    .select('*')
    .eq('partido_id', partidoId)
    .eq('equipo_id', equipoId)
    .eq('jugador_id', jugadorId)
    .eq('tipo', tipo)
    .eq('anulada', false)
    .order('timestamp_local', { ascending: false })
    .limit(1);

  if (errorBusqueda) throw errorBusqueda;

  // Si encontramos una acción, marcarla como anulada
  if (acciones && acciones.length > 0) {
    const { error: errorAnular } = await supabase
      .from('acciones')
      .update({ anulada: true })
      .eq('id', acciones[0].id);

    if (errorAnular) {
      console.error('Error anulando acción:', errorAnular);
      throw errorAnular;
    }
  }

  return true;
}

// Anular última acción
export async function anularUltimaAccion(partidoId: string) {
  const { data, error } = await callRpcDirect('anular_ultima_accion', {
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

// Actualizar tiempos muertos y registrar en log
export async function actualizarTiemposMuertos(
  partidoId: string, 
  esLocal: boolean, 
  nuevoValor: number,
  equipoId: string,
  cuartoActual: number,
  esDescuento: boolean = false
) {
  const campo = esLocal ? 'tiempos_muertos_local' : 'tiempos_muertos_visitante';
  
  const { error } = await supabase
    .from('partidos')
    .update({ 
      [campo]: nuevoValor,
      updated_at: new Date().toISOString()
    })
    .eq('id', partidoId);

  if (error) throw error;

  // Registrar en el log de acciones (solo si no es descuento)
  if (!esDescuento) {
    const { error: errorAccion } = await supabase
      .from('acciones')
      .insert({
        partido_id: partidoId,
        equipo_id: equipoId,
        jugador_id: null,
        tipo: 'TIEMPO_MUERTO',
        cuarto: cuartoActual,
        valor: 1,
        timestamp_local: new Date().toISOString(),
        cliente_id: getClienteId(),
        anulada: false,
      });
    
    if (errorAccion) {
      console.error('Error registrando tiempo muerto en log:', errorAccion);
    }
  }
}

// Finalizar partido
export async function finalizarPartido(partidoId: string) {
  const { data, error } = await callRpcDirect('finalizar_partido', {
    p_partido_id: partidoId
  });

  if (error) throw error;
  return data;
}

// Suspender partido
export async function suspenderPartido(partidoId: string, observaciones: string) {
  const { error } = await supabase
    .from('partidos')
    .update({ 
      estado: 'SUSPENDIDO',
      observaciones: observaciones,
      updated_at: new Date().toISOString()
    })
    .eq('id', partidoId);

  if (error) throw error;
}

// Reanudar partido suspendido
export async function reanudarPartido(partidoId: string) {
  const { error } = await supabase
    .from('partidos')
    .update({ 
      estado: 'EN_CURSO',
      observaciones: null, // Limpiar observaciones de suspensión
      updated_at: new Date().toISOString()
    })
    .eq('id', partidoId);

  if (error) throw error;
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
// ✅ FUNCIÓN CORREGIDA: Devuelve cleanup y usa ID único
export function suscribirseAPartido(
  partidoId: string,
  onUpdate: (partido: Partial<Partido>) => void
) {
  // 1. Generamos ID único para el canal
  const uniqueChannelId = `partido-${partidoId}-${Date.now()}`;

  const channel = supabase
    .channel(uniqueChannelId)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'partidos',
        filter: `id=eq.${partidoId}`,
      },
      (payload: any) => {
        onUpdate(payload.new as Partial<Partido>);
      }
    )
    .subscribe();

  // 2. Retornamos la función de limpieza que usará el useEffect
  return () => {
    supabase.removeChannel(channel);
  };
}

// Registrar acción de sistema (cambio de cuarto) con resultado parcial
export async function registrarAccionSistema(
  partidoId: string,
  equipoId: string,
  tipo: 'FIN_CUARTO' | 'INICIO_CUARTO',
  cuarto: number,
  puntosLocal?: number,
  puntosVisitante?: number
) {
  const { error } = await supabase
    .from('acciones')
    .insert({
      partido_id: partidoId,
      equipo_id: equipoId, // Usamos equipo local como referencia
      jugador_id: null,
      tipo: tipo,
      cuarto: cuarto,
      valor: cuarto, // Guardamos el número de cuarto en valor
      timestamp_local: new Date().toISOString(),
      cliente_id: getClienteId(),
      anulada: false,
      puntos_local: puntosLocal ?? null,
      puntos_visitante: puntosVisitante ?? null,
    });
  
  if (error) {
    console.error('Error registrando acción de sistema:', error);
    throw error;
  }
}

// Registrar sustitución (múltiple) en el log
export async function registrarSustitucion(
  partidoId: string,
  equipoId: string,
  cuartoActual: number,
  sustituciones: Array<{ jugadorEntraId: string; jugadorSaleId: string }>
) {
  const acciones = sustituciones.map(s => ({
    partido_id: partidoId,
    equipo_id: equipoId,
    jugador_id: null,
    tipo: 'SUSTITUCION',
    cuarto: cuartoActual,
    valor: 1,
    timestamp_local: new Date().toISOString(),
    cliente_id: getClienteId(),
    anulada: false,
    jugador_entra_id: s.jugadorEntraId,
    jugador_sale_id: s.jugadorSaleId,
  }));

  const { error } = await supabase
    .from('acciones')
    .insert(acciones);
  
  if (error) {
    console.error('Error registrando sustitución:', error);
    throw error;
  }
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