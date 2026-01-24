import { supabase } from './supabase';

export type StorageBucket = 'logos' | 'fotos' | 'certificados';

export interface UploadResult {
  url: string | null;
  error: string | null;
}

const BUCKET_CONFIG: Record<StorageBucket, { maxSize: number; types: string[] }> = {
  logos: { maxSize: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
  fotos: { maxSize: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
  certificados: { maxSize: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'application/pdf'] },
};

function validateFile(file: File, bucket: StorageBucket): string | null {
  const config = BUCKET_CONFIG[bucket];
  if (file.size > config.maxSize) return `Máximo ${config.maxSize / (1024 * 1024)}MB`;
  if (!config.types.includes(file.type)) return `Tipo no permitido`;
  return null;
}

function generatePath(prefix: string, file: File): string {
  const ts = Date.now();
  const ext = file.name.split('.').pop();
  return `${prefix}/${ts}.${ext}`;
}

export async function uploadFile(file: File, bucket: StorageBucket, prefix: string): Promise<UploadResult> {
  const validationError = validateFile(file, bucket);
  if (validationError) return { url: null, error: validationError };

  const path = generatePath(prefix, file);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: true });
  
  if (error) return { url: null, error: error.message };
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function deleteFile(bucket: StorageBucket, url: string): Promise<boolean> {
  const path = url.split(`${bucket}/`)[1];
  if (!path) return false;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}

// Funciones específicas
export async function uploadClubLogo(file: File, clubId: string): Promise<UploadResult> {
  const result = await uploadFile(file, 'logos', `clubes/${clubId}`);
  if (result.url) await supabase.from('equipos').update({ logo_url: result.url }).eq('id', clubId);
  return result;
}

export async function uploadOrgLogo(file: File, orgId: string): Promise<UploadResult> {
  const result = await uploadFile(file, 'logos', `orgs/${orgId}`);
  if (result.url) await supabase.from('organizaciones').update({ logo_url: result.url }).eq('id', orgId);
  return result;
}

export async function uploadJugadorFoto(file: File, jugadorId: string): Promise<UploadResult> {
  const result = await uploadFile(file, 'fotos', `jugadores/${jugadorId}`);
  if (result.url) await supabase.from('jugadores').update({ foto_url: result.url }).eq('id', jugadorId);
  return result;
}

export async function uploadEntrenadorFoto(file: File, entrenadorId: string): Promise<UploadResult> {
  const result = await uploadFile(file, 'fotos', `entrenadores/${entrenadorId}`);
  if (result.url) await supabase.from('entrenadores').update({ foto_url: result.url }).eq('id', entrenadorId);
  return result;
}

export async function uploadJugadorCertificado(file: File, jugadorId: string): Promise<UploadResult> {
  const result = await uploadFile(file, 'certificados', `jugadores/${jugadorId}`);
  if (result.url) await supabase.from('jugadores').update({ certificado_medico_url: result.url }).eq('id', jugadorId);
  return result;
}

export async function uploadEntrenadorCertificado(file: File, entrenadorId: string): Promise<UploadResult> {
  const result = await uploadFile(file, 'certificados', `entrenadores/${entrenadorId}`);
  if (result.url) await supabase.from('entrenadores').update({ certificado_medico_url: result.url }).eq('id', entrenadorId);
  return result;
}
