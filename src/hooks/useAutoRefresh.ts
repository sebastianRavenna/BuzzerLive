
import { useEffect } from 'react';

export function useAutoRefresh(callback: () => void) {
  useEffect(() => {
    // Handler que ejecuta la recarga
    const handleRefresh = () => {
      console.log("🔄 Auto-refresh disparado en componente");
      callback();
    };

    // 1. Escuchar evento personalizado desde App.tsx
    window.addEventListener('buzzer:wakeup', handleRefresh);
    
    // 2. Escuchar cuando vuelve internet
    window.addEventListener('online', handleRefresh);

    return () => {
      window.removeEventListener('buzzer:wakeup', handleRefresh);
      window.removeEventListener('online', handleRefresh);
    };
  }, [callback]);
}