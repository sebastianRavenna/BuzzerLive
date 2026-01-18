import { useState, useEffect } from 'react';

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // Escuchar mensajes del Service Worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setShowUpdate(true);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // También detectar cuando hay un nuevo SW esperando
    const detectUpdate = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Hay una nueva versión lista
                setShowUpdate(true);
              }
            });
          }
        });

        // Chequear actualizaciones cada 5 minutos
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      }
    };

    detectUpdate();

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleUpdate = () => {
    // Forzar recarga para obtener la nueva versión
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <div>
            <div className="font-bold">Nueva versión disponible</div>
            <div className="text-sm text-blue-100">Actualizá para obtener las mejoras</div>
          </div>
        </div>
        <button
          onClick={handleUpdate}
          className="px-4 py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}