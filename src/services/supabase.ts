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

// Custom fetch with keepalive to prevent connection drops when app is backgrounded
const customFetch: typeof fetch = (input, init) => {
  return fetch(input, {
    ...init,
    keepalive: true, // Keep connection alive even when tab is backgrounded
    signal: init?.signal, // Preserve abort signal if provided
  });
};

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
    global: {
      fetch: customFetch,
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
 * Llama una función RPC de Supabase usando fetch() nativo en lugar del cliente.
 * Esto bypasea el cliente de Supabase que puede tener problemas después de minimizar.
 *
 * @param functionName - Nombre de la función RPC (ej: 'registrar_accion')
 * @param params - Parámetros de la función
 * @returns Respuesta de la RPC
 */
export async function callRpcDirect<T = any>(
  functionName: string,
  params: Record<string, any>
): Promise<{ data: T | null; error: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`⏰ [RPC Direct] Timeout de 10s alcanzado para ${functionName}`);
    controller.abort();
  }, 10000);

  try {
    console.log(`🎯 [RPC Direct] Llamando ${functionName}`);
    console.log(`📦 [RPC Direct] Parámetros:`, params);

    // 1. Obtener token de auth de la sesión actual
    console.log('🔑 [RPC Direct] Obteniendo token de auth...');
    const { data: { session } } = await _supabaseClient.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      console.warn('⚠️ [RPC Direct] Sin token de auth - usando anon key');
    } else {
      console.log('✅ [RPC Direct] Token de auth obtenido');
    }

    // 2. Construir URL del endpoint RPC
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/${functionName}`;
    console.log(`🌐 [RPC Direct] URL:`, rpcUrl);

    // 3. Hacer la llamada con fetch nativo + keepalive + timeout
    console.log('📡 [RPC Direct] Ejecutando fetch...');
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey || '',
        'Authorization': accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(params),
      keepalive: true,
      signal: controller.signal, // ⭐ Timeout control
    });

    clearTimeout(timeoutId);
    console.log(`📥 [RPC Direct] Respuesta recibida - Status: ${response.status}`);

    // 4. Parsear respuesta
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ [RPC Direct] Error ${response.status}:`, errorData);

      return {
        data: null,
        error: {
          message: errorData.message || `HTTP ${response.status}`,
          details: errorData.details || response.statusText,
          hint: errorData.hint || '',
          code: errorData.code || String(response.status),
        }
      };
    }

    const data = await response.json();
    console.log(`✅ [RPC Direct] ${functionName} exitoso`);

    return { data, error: null };

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      console.error(`❌ [RPC Direct] Timeout en ${functionName} después de 10s`);
      return {
        data: null,
        error: {
          message: 'Timeout: La operación tardó demasiado',
          details: 'El servidor no respondió en 10 segundos',
          hint: 'Verifica tu conexión',
          code: 'TIMEOUT',
        }
      };
    }

    console.error(`❌ [RPC Direct] Exception en ${functionName}:`, err);
    return {
      data: null,
      error: {
        message: err.message || 'Network error',
        details: err.toString(),
        hint: '',
        code: 'FETCH_ERROR',
      }
    };
  }
}

/**
 * Reconecta solo el Realtime del cliente actual sin crear un nuevo cliente.
 * Esto evita problemas de múltiples instancias de GoTrueClient y preserva la sesión.
 */
export async function reconnectSupabase(): Promise<void> {
  console.log('🔄 Reconectando Supabase después de minimizar...');

  try {
    // 1. Verificar estado de Realtime
    const realtimeState = _supabaseClient.realtime.connectionState();
    console.log('🔌 Estado Realtime antes:', realtimeState);

    // 2. Si está cerrado, reconectar
    if (realtimeState !== 'open') {
      console.log('🔌 Reconectando Realtime...');
      _supabaseClient.realtime.connect();

      // Esperar un poco para que se conecte
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newState = _supabaseClient.realtime.connectionState();
      console.log('🔌 Estado Realtime después:', newState);
    }

    // 3. Hacer una query simple para "despertar" la conexión HTTP/RPC
    console.log('💓 Haciendo query de warm-up...');
    const { error } = await _supabaseClient
      .from('partidos')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('⚠️ Query de warm-up falló:', error.message);
    } else {
      console.log('✅ Query de warm-up exitosa');
    }

    console.log('✅ Reconexión completada');
  } catch (err) {
    console.error('❌ Error en reconnectSupabase:', err);
    throw err;
  }
}

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

/**
 * Hace un warm-up del endpoint de RPC después de reconectar.
 * Los endpoints RPC de Supabase pueden necesitar una primera llamada para "despertarse"
 * después de que la app estuvo en background.
 */
export async function warmupRpcConnection(): Promise<boolean> {
  console.log('🔥 Haciendo warm-up de conexión RPC...');

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log('⏰ Warm-up RPC timeout');
        reject(new Error('RPC warmup timeout'));
      }, 5000);
    });

    // Hacer una query simple usando select para warm-up
    // No usamos RPC directamente porque no tenemos una función dummy
    const warmupPromise = _supabaseClient
      .from('partidos')
      .select('id, estado')
      .limit(1)
      .single();

    await Promise.race([warmupPromise, timeoutPromise]);

    console.log('✅ Warm-up RPC completado');
    return true;
  } catch (err) {
    console.warn('⚠️ Warm-up RPC falló (no crítico):', err);
    return false;
  }
}

// Export types for Supabase
export type { User, Session } from '@supabase/supabase-js';