import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para auto-guardar formularios en localStorage.
 * Permite preservar datos del formulario incluso si la página se recarga.
 *
 * @param formId - ID único del formulario (ej: 'crear-jugador', 'editar-club-123')
 * @param initialData - Datos iniciales del formulario
 * @returns [formData, setFormData, clearSavedData] - Estado del formulario y función para limpiar
 *
 * @example
 * ```tsx
 * const [formData, setFormData, clearForm] = useFormAutoSave('crear-jugador', {
 *   nombre: '',
 *   apellido: '',
 *   dni: ''
 * });
 *
 * // Usar normalmente
 * <input
 *   value={formData.nombre}
 *   onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
 * />
 *
 * // Limpiar después de enviar exitosamente
 * const handleSubmit = async () => {
 *   await api.crearJugador(formData);
 *   clearForm(); // Limpia localStorage
 * };
 * ```
 */
export function useFormAutoSave<T>(formId: string, initialData: T) {
  const storageKey = `form-autosave-${formId}`;

  // Función para cargar datos guardados
  const loadSavedData = useCallback((): T => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`📋 [AutoSave] Restaurando formulario: ${formId}`);
        return parsed;
      }
    } catch (err) {
      console.warn(`⚠️ [AutoSave] Error cargando formulario ${formId}:`, err);
    }
    return initialData;
  }, [formId, initialData, storageKey]);

  // Estado del formulario (inicializa con datos guardados si existen)
  const [formData, setFormDataInternal] = useState<T>(loadSavedData);

  // Wrapper del setter que auto-guarda en localStorage
  const setFormData = useCallback((newData: T | ((prev: T) => T)) => {
    setFormDataInternal((prev) => {
      const updated = typeof newData === 'function' ? (newData as (prev: T) => T)(prev) : newData;

      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        console.log(`💾 [AutoSave] Guardado: ${formId}`);
      } catch (err) {
        console.warn(`⚠️ [AutoSave] Error guardando ${formId}:`, err);
      }

      return updated;
    });
  }, [formId, storageKey]);

  // Función para limpiar datos guardados
  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      console.log(`🗑️ [AutoSave] Limpiado: ${formId}`);
      setFormDataInternal(initialData);
    } catch (err) {
      console.warn(`⚠️ [AutoSave] Error limpiando ${formId}:`, err);
    }
  }, [formId, initialData, storageKey]);

  // Auto-guardar cuando el componente se desmonta
  useEffect(() => {
    return () => {
      try {
        const currentData = JSON.stringify(formData);
        localStorage.setItem(storageKey, currentData);
      } catch (err) {
        // Silencioso en cleanup
      }
    };
  }, [formData, storageKey]);

  return [formData, setFormData, clearSavedData] as const;
}

/**
 * Limpia TODOS los formularios guardados en localStorage.
 * Útil para testing o reset completo.
 */
export function clearAllSavedForms(): void {
  try {
    const keys = Object.keys(localStorage);
    const formKeys = keys.filter(key => key.startsWith('form-autosave-'));

    formKeys.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ [AutoSave] Limpiados ${formKeys.length} formularios`);
  } catch (err) {
    console.warn('⚠️ [AutoSave] Error limpiando todos los formularios:', err);
  }
}
