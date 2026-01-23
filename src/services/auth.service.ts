import { supabase } from './supabase';

export type UserRole = 'superadmin' | 'admin' | 'club';

export interface Usuario {
  id: string;
  auth_id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  avatar_url: string | null;
  rol: UserRole;
  organizacion_id: string | null;
  club_id: string | null;
  activo: boolean;
  ultimo_acceso: string | null;
  created_at: string;
  organizacion?: {
    id: string;
    nombre: string;
    slug: string;
    logo_url: string | null;
    plan: string;
    limite_torneos: number;
    limite_clubes: number;
    limite_jugadores: number;
    torneos_count: number;
    clubes_count: number;
    jugadores_count: number;
  };
  club?: {
    id: string;
    nombre: string;
    nombre_corto: string;
    logo_url: string | null;
  };
}

let currentUser: Usuario | null = null;
let authListeners: ((user: Usuario | null) => void)[] = [];

function notifyListeners() {
  authListeners.forEach(listener => listener(currentUser));
}

export function onAuthChange(callback: (user: Usuario | null) => void) {
  authListeners.push(callback);
  callback(currentUser);
  return () => {
    authListeners = authListeners.filter(l => l !== callback);
  };
}

export function getCurrentUser(): Usuario | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

export function hasRole(roles: UserRole | UserRole[]): boolean {
  if (!currentUser) return false;
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(currentUser.rol);
}

async function loadUserData(authId: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      *,
      organizacion:organizaciones(
        id, nombre, slug, plan, 
        limite_torneos, limite_clubes, limite_jugadores, 
        torneos_count, clubes_count, jugadores_count
      ),
      club:equipos(id, nombre, nombre_corto)
    `)
    // Se quitó logo_url de aquí de organizacion porque no existe en la tabla organizaciones y de club:equipos
    .eq('auth_id', authId)
    .single();

  if (error || !data) {
    console.error('Error loading user data:', error);
    return null;
  }

  return data as Usuario;
}

export async function initAuth(): Promise<Usuario | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    currentUser = await loadUserData(session.user.id);
    
    if (currentUser) {
      await supabase
        .from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', currentUser.id);
    }
  }
  
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = await loadUserData(session.user.id);
      notifyListeners();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      notifyListeners();
    }
  });
  
  return currentUser;
}

export async function login(email: string, password: string): Promise<{ user: Usuario | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  if (data.user) {
    currentUser = await loadUserData(data.user.id);
    
    if (!currentUser) {
      await supabase.auth.signOut();
      return { user: null, error: 'Usuario no encontrado en el sistema. Contacte al administrador.' };
    }
    
    if (!currentUser.activo) {
      await supabase.auth.signOut();
      currentUser = null;
      return { user: null, error: 'Usuario desactivado. Contacte al administrador.' };
    }
    
    await supabase
      .from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', currentUser.id);
    
    notifyListeners();
    return { user: currentUser, error: null };
  }

  return { user: null, error: 'Error desconocido' };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  currentUser = null;
  notifyListeners();
}

export async function createAuthUser(
  email: string,
  password: string
): Promise<{ authId: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
    }
  });

  if (error) {
    return { authId: null, error: error.message };
  }

  return { authId: data.user?.id || null, error: null };
}

export async function updateUser(
  userId: string,
  updates: Partial<{
    nombre: string;
    apellido: string;
    telefono: string;
    avatar_url: string;
    activo: boolean;
    club_id: string;
  }>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('usuarios')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (currentUser && currentUser.id === userId) {
    currentUser = await loadUserData(currentUser.auth_id);
    notifyListeners();
  }

  return { success: true, error: null };
}

export async function changePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

export async function resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

export function getRedirectPath(user: Usuario): string {
  switch (user.rol) {
    case 'superadmin':
      return '/superadmin';
    case 'admin':
      return `/${user.organizacion?.slug || 'admin'}`;
    case 'club':
      return `/${user.organizacion?.slug || 'club'}/mi-club`;
    default:
      return '/';
  }
}
