// src/hooks/useAutoRefresh.ts
import { useEffect, useRef } from 'react';

/**
 * Hook que ejecuta un callback cuando la app "despierta" después de estar minimizada
 * o cuando vuelve la conexión a internet.
 *
 * Útil para refrescar datos automáticamente sin que el usuario tenga que recargar.
 */
export function useAutoRefresh(callback: () => void) {
  // Usamos ref para evitar recrear el effect cuando cambia callback
  const callbackRef = useRef(callback);

  // Mantener la ref actualizada
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Handler que ejecuta la recarga
    const handleRefresh = () => {
      console.log("🔄 Auto-refresh disparado");
      callbackRef.current();
    };

    // 1. Escuchar evento personalizado desde App.tsx
    window.addEventListener('buzzer:wakeup', handleRefresh);

    // 2. Escuchar cuando vuelve internet
    window.addEventListener('online', handleRefresh);

    return () => {
      window.removeEventListener('buzzer:wakeup', handleRefresh);
      window.removeEventListener('online', handleRefresh);
    };
  }, []); // Sin dependencias, usa callbackRef en su lugar
}