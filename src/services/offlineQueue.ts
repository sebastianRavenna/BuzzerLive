import { supabase } from './supabase';
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

// 🔒 SEMÁFORO: Variable global para evitar ejecuciones simultáneas
let isSyncing = false;

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
  // 🛡️ 1. Protección contra doble ejecución
  if (isSyncing) {
    console.log("⚠️ Sincronización ya en curso, ignorando solicitud.");
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  let queue = getOfflineQueue(); // Lectura inicial

  if (queue.length === 0) {
    isSyncing = false;
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  // Clona la cola para iterar, pero usaremos 'queue' (fresco) para guardar
  const queueToProcess = [...queue];

  try {
    for (let i = 0; i < queueToProcess.length; i++) {
      const accion = queueToProcess[i];

      try {
        // Lógica de envío
        if (accion.esDescuento) {
          await syncDescontarAccion(accion);
        } else {
          const { error } = await supabase.rpc('registrar_accion', {
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

        // ✅ Éxito: Removemos de la memoria y actualizamos LS inmediatamente
        queue = queue.filter(a => a.id !== accion.id);
        saveOfflineQueue(queue);
        success++;

      } catch (err) {
        console.error(`Error sincronizando acción ${accion.tipo}:`, err);

        // ❌ Fallo: Actualizamos intentos
        // Volvemos a leer la cola fresca por si algo cambió externamente
        queue = getOfflineQueue();
        const currentAccionIndex = queue.findIndex(a => a.id === accion.id);

        if (currentAccionIndex !== -1) {
          const currentAccion = queue[currentAccionIndex];
          currentAccion.intentos++;

          if (currentAccion.intentos >= MAX_INTENTOS) {
            // Eliminar si superó intentos
            queue = queue.filter(a => a.id !== accion.id);
            failed++;
          }
          // Si no superó intentos, se mantiene en cola para próximo intento
          saveOfflineQueue(queue);
        }
      }

      // Notificar progreso
      onProgress?.(i + 1, queueToProcess.length);
    }
  } finally {
    // 🔓 Liberar el semáforo SIEMPRE, pase lo que pase
    isSyncing = false;
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