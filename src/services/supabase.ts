import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase environment variables!');
  console.error('Please create a .env file with:');
  console.error('  VITE_SUPABASE_URL=your-project-url');
  console.error('  VITE_SUPABASE_ANON_KEY=your-anon-key');
}

console.log('🚀 Inicializando cliente Supabase...');
console.log('📍 URL:', supabaseUrl);

// Create initial Supabase client
let _supabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

console.log('✅ Cliente Supabase creado');
console.log('🔌 Estado inicial Realtime:', _supabaseClient.realtime.connectionState());

/**
 * Obtiene el cliente de Supabase actual.
 * IMPORTANTE: Siempre usa getSupabase() en lugar de importar 'supabase' directamente
 * para garantizar que se use el cliente más reciente después de reinicializaciones.
 */
export const getSupabase = () => _supabaseClient;

// Export backward compatible - uses Proxy pattern to always return current client
// This ensures all references use the latest client instance after reinit
export const supabase = new Proxy(_supabaseClient, {
  get(_target, prop: keyof SupabaseClient) {
    return _supabaseClient[prop];
  }
}) as SupabaseClient;

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Reinicializa completamente el cliente de Supabase.
 * Cierra todas las conexiones existentes y crea un nuevo cliente.
 * IMPORTANTE: Solo actualiza la referencia interna, los imports existentes
 * seguirán usando el cliente antiguo.
 */
export function reinitializeSupabaseClient(): SupabaseClient {
  console.log('🔄 REINICIALIZANDO CLIENTE SUPABASE...');
  console.log('📊 Estado antes de reinicializar:');
  console.log('  - Realtime:', _supabaseClient.realtime.connectionState());
  console.log('  - Canales activos:', _supabaseClient.getChannels().length);

  try {
    // 1. Remover todos los canales de Realtime
    console.log('🧹 Limpiando canales de Realtime...');
    _supabaseClient.removeAllChannels();
    console.log('✅ Canales limpiados');

    // 2. Crear nuevo cliente
    console.log('🆕 Creando nuevo cliente...');
    const newClient = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );

    _supabaseClient = newClient;
    console.log('✅ Nuevo cliente creado');
    console.log('🔌 Nuevo estado Realtime:', newClient.realtime.connectionState());

    return newClient;
  } catch (err) {
    console.error('❌ Error reinicializando cliente Supabase:', err);
    throw err;
  }
}

/**
 * Prueba la conexión HTTP del cliente actual con timeout.
 * Prueba tanto auth como una query simple para validar que RPC funciona.
 * Útil para diagnosticar problemas de conexión después de minimizar.
 */
export async function testSupabaseConnection(timeoutMs: number = 5000): Promise<boolean> {
  console.log('🧪 Probando conexión HTTP de Supabase...');
  console.log('⏱️ Timeout:', timeoutMs, 'ms');

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log('⏰ Timeout alcanzado');
        reject(new Error('Connection test timeout'));
      }, timeoutMs);
    });

    // Probar tanto auth como una query simple para validar conexión completa
    const testPromise = Promise.all([
      _supabaseClient.auth.getSession(),
      _supabaseClient.from('partidos').select('id').limit(1)
    ]);

    const [authResult, queryResult] = await Promise.race([testPromise, timeoutPromise]);

    const authOk = !!authResult.data.session;
    const queryOk = !queryResult.error;

    console.log('✅ Conexión HTTP OK - Auth:', authOk, 'Query:', queryOk);
    return authOk || queryOk; // Al menos una debe funcionar
  } catch (err) {
    console.error('❌ Conexión HTTP FALLO:', err);
    return false;
  }
}

// Export types for Supabase
export type { User, Session } from '@supabase/supabase-js';