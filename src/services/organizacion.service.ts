import { supabase } from './supabase';

export interface Organizacion {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  activa: boolean;
  limite_torneos: number;
  limite_clubes: number;
  limite_jugadores: number;
  limite_partidos_mes: number;
  plan: string;
  torneos_count: number;
  clubes_count: number;
  jugadores_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizacionInput {
  nombre: string;
  slug: string;
  logo_url?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  activa?: boolean;
  limite_torneos?: number;
  limite_clubes?: number;
  limite_jugadores?: number;
  limite_partidos_mes?: number;
  plan?: string;
}

// Obtener todas las organizaciones (solo superadmin)
export async function getOrganizaciones(): Promise<Organizacion[]> {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('*')
    .order('nombre');

  if (error) {
    console.error('Error fetching organizaciones:', error);
    return [];
  }

  return data || [];
}

// Obtener una organización por ID
export async function getOrganizacion(id: string): Promise<Organizacion | null> {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching organizacion:', error);
    return null;
  }

  return data;
}

// Obtener una organización por slug
export async function getOrganizacionBySlug(slug: string): Promise<Organizacion | null> {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching organizacion by slug:', error);
    return null;
  }

  return data;
}

// Crear nueva organización
export async function createOrganizacion(input: OrganizacionInput): Promise<{ org: Organizacion | null; error: string | null }> {
  // Validar slug único
  const { data: existing } = await supabase
    .from('organizaciones')
    .select('id')
    .eq('slug', input.slug)
    .single();

  if (existing) {
    return { org: null, error: 'El slug ya está en uso' };
  }

  const { data, error } = await supabase
    .from('organizaciones')
    .insert({
      nombre: input.nombre,
      slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      logo_url: input.logo_url || null,
      direccion: input.direccion || null,
      telefono: input.telefono || null,
      email: input.email || null,
      sitio_web: input.sitio_web || null,
      activa: input.activa ?? true,
      limite_torneos: input.limite_torneos ?? 5,
      limite_clubes: input.limite_clubes ?? 20,
      limite_jugadores: input.limite_jugadores ?? 500,
      limite_partidos_mes: input.limite_partidos_mes ?? 100,
      plan: input.plan ?? 'basico',
    })
    .select()
    .single();

  if (error) {
    return { org: null, error: error.message };
  }

  return { org: data, error: null };
}

// Actualizar organización
export async function updateOrganizacion(
  id: string,
  updates: Partial<OrganizacionInput>
): Promise<{ success: boolean; error: string | null }> {
  // Si cambia el slug, verificar que sea único
  if (updates.slug) {
    const { data: existing } = await supabase
      .from('organizaciones')
      .select('id')
      .eq('slug', updates.slug)
      .neq('id', id)
      .single();

    if (existing) {
      return { success: false, error: 'El slug ya está en uso' };
    }
    updates.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  const { error } = await supabase
    .from('organizaciones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Eliminar organización
export async function deleteOrganizacion(id: string): Promise<{ success: boolean; error: string | null }> {
  // Verificar que no tenga datos asociados
  const { data: torneos } = await supabase
    .from('torneos')
    .select('id')
    .eq('organizacion_id', id)
    .limit(1);

  if (torneos && torneos.length > 0) {
    return { success: false, error: 'No se puede eliminar: tiene torneos asociados' };
  }

  const { error } = await supabase
    .from('organizaciones')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Obtener estadísticas de una organización
export async function getOrganizacionStats(id: string): Promise<{
  torneos: number;
  clubes: number;
  jugadores: number;
  partidosEsteMes: number;
  partidosTotal: number;
  usuarios: number;
} | null> {
  const [torneos, clubes, jugadores, partidos, usuarios] = await Promise.all([
    supabase.from('torneos').select('id', { count: 'exact', head: true }).eq('organizacion_id', id),
    supabase.from('equipos').select('id', { count: 'exact', head: true }).eq('organizacion_id', id),
    supabase.from('jugadores').select('id', { count: 'exact', head: true }).eq('organizacion_id', id),
    supabase.from('partidos').select('id, created_at', { count: 'exact' }).eq('organizacion_id', id),
    supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('organizacion_id', id),
  ]);

  // Calcular partidos de este mes
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  
  const partidosEsteMes = partidos.data?.filter(p => 
    new Date(p.created_at) >= inicioMes
  ).length || 0;

  return {
    torneos: torneos.count || 0,
    clubes: clubes.count || 0,
    jugadores: jugadores.count || 0,
    partidosEsteMes,
    partidosTotal: partidos.count || 0,
    usuarios: usuarios.count || 0,
  };
}

// Obtener usuarios de una organización
export async function getUsuariosOrganizacion(orgId: string) {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      *,
      club:equipos(id, nombre, nombre_corto)
    `)
    .eq('organizacion_id', orgId)
    .order('rol')
    .order('nombre');

  if (error) {
    console.error('Error fetching usuarios:', error);
    return [];
  }

  return data || [];
}

// Planes disponibles
export const PLANES = {
  basico: {
    nombre: 'Básico',
    limite_torneos: 5,
    limite_clubes: 20,
    limite_jugadores: 500,
    limite_partidos_mes: 100,
  },
  profesional: {
    nombre: 'Profesional',
    limite_torneos: 20,
    limite_clubes: 50,
    limite_jugadores: 1500,
    limite_partidos_mes: 300,
  },
  premium: {
    nombre: 'Premium',
    limite_torneos: 100,
    limite_clubes: 200,
    limite_jugadores: 5000,
    limite_partidos_mes: 1000,
  },
  ilimitado: {
    nombre: 'Ilimitado',
    limite_torneos: 99999,
    limite_clubes: 99999,
    limite_jugadores: 99999,
    limite_partidos_mes: 99999,
  },
};
