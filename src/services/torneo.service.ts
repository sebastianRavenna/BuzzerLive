import { restDirect } from './supabase';
import type { EstadoTorneo } from '../types';

export interface Torneo {
  id: string;
  organizacion_id: string;
  nombre: string;
  tipo: 'liga' | 'copa' | 'liga_copa';
  estado: EstadoTorneo;
  temporada: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  categoria: string | null;
  descripcion: string | null;
  config: TorneoConfig | null;
  created_at: string;
  // Datos expandidos
  _count?: {
    equipos: number;
    partidos: number;
  };
}

export interface TorneoConfig {
  puntos_victoria: number;
  puntos_empate: number;
  puntos_derrota: number;
  partidos_ida_vuelta: boolean;
  duracion_cuarto: number; // minutos
  cantidad_cuartos: number;
}

export interface TorneoEquipo {
  id: string;
  torneo_id: string;
  equipo_id: string;
  grupo: string | null;
  equipo?: {
    id: string;
    nombre: string;
    nombre_corto: string;
    logo_url: string | null;
  };
}

export interface TorneoInput {
  nombre: string;
  tipo: 'liga' | 'copa' | 'liga_copa';
  categoria?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  descripcion?: string;
  config?: Partial<TorneoConfig>;
}

const DEFAULT_CONFIG: TorneoConfig = {
  puntos_victoria: 2,
  puntos_empate: 1,
  puntos_derrota: 0,
  partidos_ida_vuelta: true,
  duracion_cuarto: 10,
  cantidad_cuartos: 4,
};

// Obtener torneos de una organización
export async function getTorneos(organizacionId: string): Promise<Torneo[]> {
  const { data, error } = await restDirect<Torneo[]>('torneos', {
    method: 'GET',
    select: '*',
    filters: { organizacion_id: organizacionId },
    order: { column: 'fecha_inicio', ascending: false },
  });

  if (error) {
    console.error('Error fetching torneos:', error);
    return [];
  }

  return data || [];
}

// Obtener un torneo por ID
export async function getTorneo(id: string): Promise<Torneo | null> {
  const { data, error } = await restDirect<Torneo>('torneos', {
    method: 'GET',
    select: '*',
    filters: { id },
    single: true,
  });

  if (error) {
    console.error('Error fetching torneo:', error);
    return null;
  }

  return data;
}

// Crear torneo
export async function createTorneo(
  organizacionId: string,
  input: TorneoInput
): Promise<{ torneo: Torneo | null; error: string | null }> {
  // Verificar límite de torneos
  const { data: org } = await restDirect<{ limite_torneos: number; torneos_count: number }>('organizaciones', {
    method: 'GET',
    select: 'limite_torneos, torneos_count',
    filters: { id: organizacionId },
    single: true,
  });

  if (org && org.torneos_count >= org.limite_torneos) {
    return { torneo: null, error: `Límite de torneos alcanzado (${org.limite_torneos}). Contacte al administrador para ampliar su plan.` };
  }

  const { data, error } = await restDirect<Torneo[]>('torneos', {
    method: 'POST',
    body: {
      organizacion_id: organizacionId,
      nombre: input.nombre,
      tipo: input.tipo,
      estado: 'PROGRAMADO',
      temporada: new Date().getFullYear().toString(),
      categoria: input.categoria || null,
      fecha_inicio: input.fecha_inicio || null,
      fecha_fin: input.fecha_fin || null,
      descripcion: input.descripcion || null,
      config: { ...DEFAULT_CONFIG, ...input.config },
    },
  });

  if (error) {
    return { torneo: null, error: error.message };
  }

  const torneo = Array.isArray(data) ? data[0] : data;

  // Actualizar contador de torneos
  await restDirect('organizaciones', {
    method: 'PATCH',
    filters: { id: organizacionId },
    body: { torneos_count: (org?.torneos_count || 0) + 1 },
  });

  return { torneo, error: null };
}

// Actualizar torneo
export async function updateTorneo(
  id: string,
  updates: Partial<TorneoInput & { estado: Torneo['estado'] }>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await restDirect('torneos', {
    method: 'PATCH',
    filters: { id },
    body: updates,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Eliminar torneo
export async function deleteTorneo(id: string): Promise<{ success: boolean; error: string | null }> {
  // Obtener el torneo para saber la org
  const { data: torneo } = await restDirect<{ organizacion_id: string }>('torneos', {
    method: 'GET',
    select: 'organizacion_id',
    filters: { id },
    single: true,
  });

  // Verificar que no tenga partidos
  const { data: partidos } = await restDirect<{ id: string }[]>('partidos', {
    method: 'GET',
    select: 'id',
    filters: { torneo_id: id },
    limit: 1,
  });

  if (partidos && partidos.length > 0) {
    return { success: false, error: 'No se puede eliminar: tiene partidos asociados' };
  }

  // Eliminar equipos del torneo primero (tabla de relación torneo_equipos)
  const { error: equiposError } = await restDirect('torneo_equipos', {
    method: 'DELETE',
    filters: { torneo_id: id }
  });

  if (equiposError) {
    return { success: false, error: `Error al eliminar equipos del torneo: ${equiposError.message}` };
  }

  // Eliminar el torneo
  const { error } = await restDirect('torneos', {
    method: 'DELETE',
    filters: { id },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrementar contador de torneos
  if (torneo?.organizacion_id) {
    const { data: org } = await restDirect<{ torneos_count: number }>('organizaciones', {
      method: 'GET',
      select: 'torneos_count',
      filters: { id: torneo.organizacion_id },
      single: true,
    });

    await restDirect('organizaciones', {
      method: 'PATCH',
      filters: { id: torneo.organizacion_id },
      body: { torneos_count: Math.max(0, (org?.torneos_count || 1) - 1) },
    });
  }

  return { success: true, error: null };
}

// Obtener equipos de un torneo
export async function getTorneoEquipos(torneoId: string): Promise<TorneoEquipo[]> {
  const { data, error } = await restDirect<TorneoEquipo[]>('torneo_equipos', {
    method: 'GET',
    select: '*, equipo:equipos(id, nombre, nombre_corto, logo_url)',
    filters: { torneo_id: torneoId },
    order: { column: 'grupo', ascending: true },
  });

  if (error) {
    console.error('Error fetching torneo equipos:', error);
    return [];
  }

  return data || [];
}

// Agregar equipo a torneo
export async function addEquipoToTorneo(
  torneoId: string,
  equipoId: string,
  grupo?: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await restDirect('torneo_equipos', {
    method: 'POST',
    body: {
      torneo_id: torneoId,
      equipo_id: equipoId,
      grupo: grupo || null,
    },
  });

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'El equipo ya está en el torneo' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Remover equipo de torneo
export async function removeEquipoFromTorneo(
  torneoId: string,
  equipoId: string
): Promise<{ success: boolean; error: string | null }> {
  // Verificar que no tenga partidos
  const { data: partidos } = await restDirect<{ id: string }[]>('partidos', {
    method: 'GET',
    select: 'id',
    filters: { torneo_id: torneoId },
    rawFilters: [`or=(equipo_local_id.eq.${equipoId},equipo_visitante_id.eq.${equipoId})`],
    limit: 1,
  });

  if (partidos && partidos.length > 0) {
    return { success: false, error: 'No se puede quitar: tiene partidos en el torneo' };
  }

  const { error } = await restDirect('torneo_equipos', {
    method: 'DELETE',
    filters: { torneo_id: torneoId, equipo_id: equipoId },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Generar fixture automático (todos contra todos)
export async function generarFixture(
  torneoId: string,
  organizacionId: string,
  idaVuelta: boolean = true
): Promise<{ partidos: number; error: string | null }> {
  // Obtener equipos del torneo
  const equipos = await getTorneoEquipos(torneoId);
  
  if (equipos.length < 2) {
    return { partidos: 0, error: 'Se necesitan al menos 2 equipos' };
  }

  const torneo = await getTorneo(torneoId);
  if (!torneo) {
    return { partidos: 0, error: 'Torneo no encontrado' };
  }

  // Generar todos los enfrentamientos
  const partidos: {
    torneo_id: string;
    organizacion_id: string;
    equipo_local_id: string;
    equipo_visitante_id: string;
    fecha: string;
    hora: string;
    estado: string;
    cuarto_actual: number;
    puntos_local: number;
    puntos_visitante: number;
  }[] = [];

  const fechaBase = torneo.fecha_inicio ? new Date(torneo.fecha_inicio) : new Date();
  const fechaActual = new Date(fechaBase);

  // Round-robin: todos contra todos
  for (let i = 0; i < equipos.length; i++) {
    for (let j = i + 1; j < equipos.length; j++) {
      // Partido de ida
      partidos.push({
        torneo_id: torneoId,
        organizacion_id: organizacionId,
        equipo_local_id: equipos[i].equipo_id,
        equipo_visitante_id: equipos[j].equipo_id,
        fecha: fechaActual.toISOString().split('T')[0],
        hora: '20:00',
        estado: 'PROGRAMADO',
        cuarto_actual: 0,
        puntos_local: 0,
        puntos_visitante: 0,
      });

      // Partido de vuelta
      if (idaVuelta) {
        partidos.push({
          torneo_id: torneoId,
          organizacion_id: organizacionId,
          equipo_local_id: equipos[j].equipo_id,
          equipo_visitante_id: equipos[i].equipo_id,
          fecha: fechaActual.toISOString().split('T')[0],
          hora: '21:30',
          estado: 'PROGRAMADO',
          cuarto_actual: 0,
          puntos_local: 0,
          puntos_visitante: 0,
        });
      }
    }
    // Avanzar fecha cada ronda
    fechaActual.setDate(fechaActual.getDate() + 7);
  }

  // Insertar partidos
  const { error } = await restDirect('partidos', {
    method: 'POST',
    body: partidos
  });

  if (error) {
    return { partidos: 0, error: error.message };
  }

  // Actualizar estado del torneo
  await updateTorneo(torneoId, { estado: 'PROGRAMADO' });

  return { partidos: partidos.length, error: null };
}

// Obtener partidos de un torneo
export async function getPartidosTorneo(torneoId: string) {
  const { data, error } = await restDirect<any[]>('partidos', {
    method: 'GET',
    select: '*, equipo_local:equipos!equipo_local_id(id, nombre, nombre_corto, logo_url), equipo_visitante:equipos!equipo_visitante_id(id, nombre, nombre_corto, logo_url)',
    filters: { torneo_id: torneoId },
    order: { column: 'fecha', ascending: true },
  });

  if (error) {
    console.error('Error fetching partidos:', error);
    return [];
  }

  return data || [];
}

// Sincronizar equipos del torneo desde partidos
// Si hay partidos pero no hay equipos en torneo_equipos, los agrega automáticamente
async function syncEquiposFromPartidos(torneoId: string) {
  // Obtener todos los partidos del torneo
  const partidos = await getPartidosTorneo(torneoId);
  if (partidos.length === 0) return;

  // Obtener equipos únicos de los partidos
  const equipoIds = new Set<string>();
  partidos.forEach((p: any) => {
    equipoIds.add(p.equipo_local_id);
    equipoIds.add(p.equipo_visitante_id);
  });

  // Verificar cuáles equipos ya están en torneo_equipos
  const { data: existentes } = await restDirect<{ equipo_id: string }[]>('torneo_equipos', {
    method: 'GET',
    select: 'equipo_id',
    filters: { torneo_id: torneoId },
  });

  const existentesIds = new Set(existentes?.map((e: any) => e.equipo_id) || []);

  // Agregar los equipos que faltan
  const equiposNuevos = Array.from(equipoIds).filter(id => !existentesIds.has(id));

  if (equiposNuevos.length > 0) {
    console.log(`🔄 Sincronizando ${equiposNuevos.length} equipos al torneo ${torneoId}`);
    await restDirect('torneo_equipos', {
      method: 'POST',
      body: equiposNuevos.map(equipo_id => ({
        torneo_id: torneoId,
        equipo_id: equipo_id,
        grupo: null
      })),
    });
  }
}

// Obtener tabla de posiciones
export async function getTablaPosiciones(torneoId: string) {
  // Sincronizar equipos desde partidos si es necesario
  await syncEquiposFromPartidos(torneoId);

  const partidos = await getPartidosTorneo(torneoId);
  const equipos = await getTorneoEquipos(torneoId);
  const torneo = await getTorneo(torneoId);

  const config = torneo?.config as TorneoConfig || DEFAULT_CONFIG;

  // Inicializar tabla
  const tabla: Record<string, {
    equipo_id: string;
    nombre: string;
    nombre_corto: string;
    logo_url: string | null;
    pj: number;
    pg: number;
    pe: number;
    pp: number;
    pf: number;
    pc: number;
    dif: number;
    pts: number;
  }> = {};

  equipos.forEach((te) => {
    if (te.equipo) {
      tabla[te.equipo_id] = {
        equipo_id: te.equipo_id,
        nombre: te.equipo.nombre,
        nombre_corto: te.equipo.nombre_corto,
        logo_url: te.equipo.logo_url,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        pf: 0,
        pc: 0,
        dif: 0,
        pts: 0,
      };
    }
  });

  // Calcular estadísticas
  partidos.forEach((p: any) => {
    if (p.estado !== 'FINALIZADO') return;

    const local = tabla[p.equipo_local_id];
    const visitante = tabla[p.equipo_visitante_id];

    if (!local || !visitante) return;

    // Partidos jugados
    local.pj++;
    visitante.pj++;

    // Puntos a favor/contra
    local.pf += p.puntos_local;
    local.pc += p.puntos_visitante;
    visitante.pf += p.puntos_visitante;
    visitante.pc += p.puntos_local;

    // Resultado
    if (p.puntos_local > p.puntos_visitante) {
      local.pg++;
      local.pts += config.puntos_victoria;
      visitante.pp++;
      visitante.pts += config.puntos_derrota;
    } else if (p.puntos_local < p.puntos_visitante) {
      visitante.pg++;
      visitante.pts += config.puntos_victoria;
      local.pp++;
      local.pts += config.puntos_derrota;
    } else {
      local.pe++;
      visitante.pe++;
      local.pts += config.puntos_empate;
      visitante.pts += config.puntos_empate;
    }
  });

  // Calcular diferencia y ordenar
  const resultado = Object.values(tabla).map((t) => ({
    ...t,
    dif: t.pf - t.pc,
  }));

  resultado.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dif !== a.dif) return b.dif - a.dif;
    return b.pf - a.pf;
  });

  return resultado;
}

// Categorías disponibles
export const CATEGORIAS = [
  'U13',
  'U15',
  'U17',
  'U19',
  'U21',
  'Mayores',
  'Senior +35',
  'Senior +45',
  'Femenino',
  'Femenino U17',
  'Femenino U15',
];

// Tipos de torneo
export const TIPOS_TORNEO = [
  { value: 'liga', label: 'Liga (todos contra todos)' },
  { value: 'copa', label: 'Copa (eliminación directa)' },
  { value: 'liga_copa', label: 'Liga + Copa' },
];