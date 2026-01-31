import { supabase, callRpcDirect } from './supabase';
import type { TipoAccion } from '../types';

interface AccionPendiente {
  id: string;
  partidoId: string;
  equipoId: string;
  jugadorId: string | null;
  tipo: TipoAccion;
  cuarto: number;
  esDescuento: boolean;
  timestamp: string;
  intentos: number;
}

const STORAGE_KEY = 'buzzer_offline_queue';
const MAX_INTENTOS = 5;

// Obtener cola de localStorage
export function getOfflineQueue(): AccionPendiente[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Guardar cola en localStorage
function saveOfflineQueue(queue: AccionPendiente[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

// Agregar acción a la cola
export function addToOfflineQueue(
  partidoId: string,
  equipoId: string,
  jugadorId: string | null,
  tipo: TipoAccion,
  cuarto: number,
  esDescuento: boolean = false
): AccionPendiente {
  const accion: AccionPendiente = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    partidoId,
    equipoId,
    jugadorId,
    tipo,
    cuarto,
    esDescuento,
    timestamp: new Date().toISOString(),
    intentos: 0,
  };

  const queue = getOfflineQueue();
  queue.push(accion);
  saveOfflineQueue(queue);

  return accion;
}

// Remover acción de la cola
export function removeFromOfflineQueue(accionId: string): void {
  const queue = getOfflineQueue();
  const newQueue = queue.filter(a => a.id !== accionId);
  saveOfflineQueue(newQueue);
}

// Sincronizar cola con el servidor
export async function syncOfflineQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const queue = getOfflineQueue();
  
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const accion = queue[i];
    
    try {
      if (accion.esDescuento) {
        await syncDescontarAccion(accion);
      } else {
        const { error } = await callRpcDirect('registrar_accion', {
          p_partido_id: accion.partidoId,
          p_equipo_id: accion.equipoId,
          p_jugador_id: accion.jugadorId,
          p_tipo: accion.tipo,
          p_cuarto: accion.cuarto,
          p_timestamp_local: accion.timestamp,
          p_cliente_id: getClienteId(),
        });

        if (error) throw error;
      }

      removeFromOfflineQueue(accion.id);
      success++;
    } catch (err) {
      accion.intentos++;
      
      if (accion.intentos >= MAX_INTENTOS) {
        removeFromOfflineQueue(accion.id);
        failed++;
      } else {
        const currentQueue = getOfflineQueue();
        const idx = currentQueue.findIndex(a => a.id === accion.id);
        if (idx !== -1) {
          currentQueue[idx] = accion;
          saveOfflineQueue(currentQueue);
        }
        failed++;
      }
    }

    onProgress?.(i + 1, queue.length);
  }

  return { success, failed };
}

// Sincronizar descuento
async function syncDescontarAccion(accion: AccionPendiente): Promise<void> {
  const { data: partido, error: errorPartido } = await supabase
    .from('partidos')
    .select('*')
    .eq('id', accion.partidoId)
    .single();

  if (errorPartido) throw errorPartido;

  const esLocal = accion.equipoId === partido.equipo_local_id;

  let valorPunto = 0;
  let valorFalta = 0;

  if (accion.tipo === 'PUNTO_1') valorPunto = 1;
  else if (accion.tipo === 'PUNTO_2') valorPunto = 2;
  else if (accion.tipo === 'PUNTO_3') valorPunto = 3;
  else if (accion.tipo === 'FALTA_PERSONAL') valorFalta = 1;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (valorPunto > 0) {
    if (esLocal) {
      updates.puntos_local = Math.max(0, partido.puntos_local - valorPunto);
    } else {
      updates.puntos_visitante = Math.max(0, partido.puntos_visitante - valorPunto);
    }
  }

  if (valorFalta > 0) {
    const faltasKey = esLocal ? 'faltas_equipo_local' : 'faltas_equipo_visitante';
    const faltasActuales = [...(partido[faltasKey] || [0, 0, 0, 0, 0, 0])];
    const idx = Math.max(0, accion.cuarto - 1);
    faltasActuales[idx] = Math.max(0, (faltasActuales[idx] || 0) - 1);
    updates[faltasKey] = faltasActuales;
  }

  const { error: errorUpdate } = await supabase
    .from('partidos')
    .update(updates)
    .eq('id', accion.partidoId);

  if (errorUpdate) throw errorUpdate;

  if (accion.jugadorId && (valorPunto > 0 || valorFalta > 0)) {
    const { data: participacion } = await supabase
      .from('participaciones_partido')
      .select('*')
      .eq('partido_id', accion.partidoId)
      .eq('jugador_id', accion.jugadorId)
      .single();

    if (participacion) {
      const updatesPart: Record<string, unknown> = {};
      if (valorPunto > 0) {
        updatesPart.puntos = Math.max(0, participacion.puntos - valorPunto);
      }
      if (valorFalta > 0) {
        updatesPart.faltas = Math.max(0, participacion.faltas - 1);
      }

      await supabase
        .from('participaciones_partido')
        .update(updatesPart)
        .eq('id', participacion.id);
    }
  }
}

// Verificar si hay conexión
export function isOnline(): boolean {
  return navigator.onLine;
}

// Escuchar cambios de conexión
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// Obtener ID del cliente
function getClienteId(): string {
  let clienteId = localStorage.getItem('buzzer_cliente_id');
  if (!clienteId) {
    clienteId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('buzzer_cliente_id', clienteId);
  }
  return clienteId;
}