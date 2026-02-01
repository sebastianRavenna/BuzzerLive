import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface VisibilityContextType {
  // Contador que se incrementa cada vez que la app vuelve de estar minimizada
  refreshTrigger: number;
  // Función para suscribirse a cambios de visibilidad
  subscribeToRefresh: (callback: () => void) => () => void;
}

const VisibilityContext = createContext<VisibilityContextType | null>(null);

export function VisibilityProvider({ children }: { children: ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [subscribers] = useState<Set<() => void>>(() => new Set());

  const subscribeToRefresh = useCallback((callback: () => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  }, [subscribers]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 [Visibility] App visible - notificando a componentes');
        setRefreshTrigger(t => t + 1);
        // Notificar a todos los suscriptores
        subscribers.forEach(callback => {
          try {
            callback();
          } catch (err) {
            console.error('Error en callback de visibilidad:', err);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [subscribers]);

  return (
    <VisibilityContext.Provider value={{ refreshTrigger, subscribeToRefresh }}>
      {children}
    </VisibilityContext.Provider>
  );
}

// Hook para recargar datos cuando la app vuelve a ser visible
export function useRefreshOnVisible(loadData: () => void, deps: any[] = []) {
  const context = useContext(VisibilityContext);

  useEffect(() => {
    if (!context) return;

    // Suscribirse a cambios de visibilidad
    const unsubscribe = context.subscribeToRefresh(() => {
      console.log('🔄 [useRefreshOnVisible] Recargando datos...');
      loadData();
    });

    return unsubscribe;
  }, [context, loadData, ...deps]);
}

// Hook simple que devuelve el trigger (para casos donde se necesite más control)
export function useVisibility() {
  const context = useContext(VisibilityContext);
  if (!context) {
    throw new Error('useVisibility debe usarse dentro de VisibilityProvider');
  }
  return context;
}
