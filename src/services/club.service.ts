// ============================================
// BuzzerLive - Club Service
// Sprint 6: Club/Planillero Management
// ============================================

import { supabase } from './supabase';
import type { 
  Club,
  Jugador,
  Entrenador,
  Partido,
  CreateJugadorForm,
  CreateEntrenadorForm,
} from '../types';

// ============================================
// Club Data
// ============================================

export async function getClubData(clubId: string): Promise<Club | null> {
  const { data, error } = await supabase
    .from('clubes')
    .select('*')
    .eq('id', clubId)
    .single();
  
  if (error) return null;
  return data;
}

export async function updateClubData(
  clubId: string, 
  updates: Partial<Pick<Club, 'nombre' | 'nombre_corto' | 'direccion' | 'telefono' | 'email' | 'sitio_web' | 'colores_primario' | 'colores_secundario'>>
): Promise<Club> {
  const { data, error } = await supabase
    .from('clubes')
    .update(updates)
    .eq('id', clubId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function uploadEscudo(clubId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${clubId}/escudo.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('clubes')
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('clubes')
    .getPublicUrl(fileName);
  
  await supabase
    .from('clubes')
    .update({ escudo_url: publicUrl })
    .eq('id', clubId);
  
  return publicUrl;
}

// ============================================
// Jugadores del Club
// ============================================

export async function getJugadoresByClub(clubId: string): Promise<Jugador[]> {
  const { data, error } = await supabase
    .from('jugadores')
    .select(`
      *,
      equipo:equipos(nombre, nombre_corto)
    `)
    .eq('equipo_id', clubId)
    .eq('activo', true)
    .order('apellido');

  if (error) throw error;
  return data || [];
}

export async function createJugador(form: CreateJugadorForm, clubId: string, organizacionId: string): Promise<Jugador> {
  const { data, error } = await supabase
    .from('jugadores')
    .insert({
      ...form,
      equipo_id: clubId,
      organizacion_id: organizacionId,
      es_capitan: form.es_capitan || false,
      es_refuerzo: form.es_refuerzo || false,
      activo: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJugador(id: string, updates: Partial<Jugador>): Promise<Jugador> {
  const { data, error } = await supabase
    .from('jugadores')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteJugador(id: string): Promise<void> {
  const { error } = await supabase
    .from('jugadores')
    .update({ activo: false })
    .eq('id', id);
  
  if (error) throw error;
}

// Upload foto de jugador
export async function uploadFotoJugador(jugadorId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `jugadores/${jugadorId}/foto.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('jugadores')
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('jugadores')
    .getPublicUrl(fileName);
  
  await supabase
    .from('jugadores')
    .update({ foto_url: publicUrl })
    .eq('id', jugadorId);
  
  return publicUrl;
}

// Upload certificado médico
export async function uploadCertificadoMedico(
  jugadorId: string, 
  file: File, 
  vencimiento: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `jugadores/${jugadorId}/certificado.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('jugadores')
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('jugadores')
    .getPublicUrl(fileName);
  
  await supabase
    .from('jugadores')
    .update({ 
      certificado_medico_url: publicUrl,
      certificado_medico_vencimiento: vencimiento,
    })
    .eq('id', jugadorId);
  
  return publicUrl;
}

// ============================================
// Entrenadores del Club
// ============================================

export async function getEntrenadoresByClub(clubId: string): Promise<Entrenador[]> {
  const { data, error } = await supabase
    .from('entrenadores')
    .select('*')
    .eq('equipo_id', clubId)
    .eq('activo', true)
    .order('apellido');

  if (error) throw error;
  return data || [];
}

export async function createEntrenador(form: CreateEntrenadorForm): Promise<Entrenador> {
  const { data, error } = await supabase
    .from('entrenadores')
    .insert({
      ...form,
      activo: true,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateEntrenador(id: string, updates: Partial<Entrenador>): Promise<Entrenador> {
  const { data, error } = await supabase
    .from('entrenadores')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteEntrenador(id: string): Promise<void> {
  const { error } = await supabase
    .from('entrenadores')
    .update({ activo: false })
    .eq('id', id);
  
  if (error) throw error;
}

// Upload foto de entrenador
export async function uploadFotoEntrenador(entrenadorId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `entrenadores/${entrenadorId}/foto.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('entrenadores')
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('entrenadores')
    .getPublicUrl(fileName);
  
  await supabase
    .from('entrenadores')
    .update({ foto_url: publicUrl })
    .eq('id', entrenadorId);
  
  return publicUrl;
}

// Upload certificado médico de entrenador
export async function uploadCertificadoMedicoEntrenador(
  entrenadorId: string, 
  file: File, 
  vencimiento: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `entrenadores/${entrenadorId}/certificado.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('entrenadores')
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('entrenadores')
    .getPublicUrl(fileName);
  
  await supabase
    .from('entrenadores')
    .update({ 
      certificado_medico_url: publicUrl,
      certificado_medico_vencimiento: vencimiento,
    })
    .eq('id', entrenadorId);
  
  return publicUrl;
}

// ============================================
// Partidos del Club
// ============================================

export async function getPartidosDelClub(clubId: string, filtros?: {
  estado?: string;
  desde?: string;
  hasta?: string;
}): Promise<Partido[]> {
  let query = supabase
    .from('partidos')
    .select(`
      *,
      torneo:torneos(nombre, categoria),
      equipo_local:equipos!partidos_equipo_local_id_fkey(nombre, nombre_corto, escudo_url),
      equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre, nombre_corto, escudo_url)
    `)
    .or(`equipo_local_id.eq.${clubId},equipo_visitante_id.eq.${clubId}`)
    .order('fecha', { ascending: false });

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado);
  }
  if (filtros?.desde) {
    query = query.gte('fecha', filtros.desde);
  }
  if (filtros?.hasta) {
    query = query.lte('fecha', filtros.hasta);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// Partidos donde el usuario es planillero asignado
export async function getPartidosAsignados(usuarioId: string): Promise<Partido[]> {
  const { data, error } = await supabase
    .from('partidos')
    .select(`
      *,
      torneo:torneos(nombre, categoria),
      equipo_local:equipos!partidos_equipo_local_id_fkey(nombre, nombre_corto, escudo_url),
      equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre, nombre_corto, escudo_url)
    `)
    .eq('planillero_usuario_id', usuarioId)
    .in('estado', ['PROGRAMADO', 'EN_CURSO'])
    .order('fecha', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// ============================================
// Estadísticas del Club
// ============================================

export async function getClubStats(clubId: string) {
  const [jugadores, entrenadores, partidos] = await Promise.all([
    supabase
      .from('jugadores')
      .select('id', { count: 'exact', head: true })
      .eq('equipo_id', clubId)
      .eq('activo', true),
    supabase
      .from('entrenadores')
      .select('id', { count: 'exact', head: true })
      .eq('equipo_id', clubId)
      .eq('activo', true),
    supabase
      .from('partidos')
      .select('id, estado', { count: 'exact' })
      .or(`equipo_local_id.eq.${clubId},equipo_visitante_id.eq.${clubId}`),
  ]);

  const partidosData = partidos.data || [];

  return {
    jugadores: jugadores.count || 0,
    entrenadores: entrenadores.count || 0,
    partidos_total: partidos.count || 0,
    partidos_programados: partidosData.filter(p => p.estado === 'PROGRAMADO').length,
    partidos_en_curso: partidosData.filter(p => p.estado === 'EN_CURSO').length,
    partidos_finalizados: partidosData.filter(p => p.estado === 'FINALIZADO').length,
  };
}

// ============================================
// Certificados vencidos/por vencer
// ============================================

export async function getCertificadosPorVencer(clubId: string, diasAnticipacion: number = 30) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion);

  const [jugadores, entrenadores] = await Promise.all([
    supabase
      .from('jugadores')
      .select('id, nombre, apellido, certificado_medico_vencimiento')
      .eq('equipo_id', clubId)
      .eq('activo', true)
      .not('certificado_medico_vencimiento', 'is', null)
      .lte('certificado_medico_vencimiento', fechaLimite.toISOString().split('T')[0]),
    supabase
      .from('entrenadores')
      .select('id, nombre, apellido, certificado_medico_vencimiento')
      .eq('equipo_id', clubId)
      .eq('activo', true)
      .not('certificado_medico_vencimiento', 'is', null)
      .lte('certificado_medico_vencimiento', fechaLimite.toISOString().split('T')[0]),
  ]);

  const hoy = new Date().toISOString().split('T')[0];

  return {
    jugadores: (jugadores.data || []).map(j => ({
      ...j,
      tipo: 'jugador' as const,
      vencido: j.certificado_medico_vencimiento < hoy,
    })),
    entrenadores: (entrenadores.data || []).map(e => ({
      ...e,
      tipo: 'entrenador' as const,
      vencido: e.certificado_medico_vencimiento < hoy,
    })),
  };
}