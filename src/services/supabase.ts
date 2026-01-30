import { createClient } from '@supabase/supabase-js';

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

// Create Supabase client
export const supabase = createClient(
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

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Ejecuta una función async con retry automático en caso de AbortError
 * Útil para queries que pueden ser canceladas por el navegador al despertar
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 300
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      const isAbortError =
        (error as Error)?.name === 'AbortError' ||
        (error as Error)?.message?.includes('aborted') ||
        (error as Error)?.message?.includes('Failed to fetch') ||
        (error as { code?: string })?.code === 'ABORT_ERR';

      if (isAbortError && attempt < maxAttempts) {
        console.log(`🔄 Query cancelada, reintentando (${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        continue;
      }

      // Si no es AbortError o ya agotamos los intentos, lanzamos el error
      throw error;
    }
  }

  throw lastError;
}

// Export types for Supabase
export type { User, Session } from '@supabase/supabase-js';