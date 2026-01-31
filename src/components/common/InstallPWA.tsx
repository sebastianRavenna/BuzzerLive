import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verificar si ya fue descartado en esta sesión
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    // Verificar si ya está instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      return; // Ya está instalada, no mostrar nada
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };

    const handleAppInstalled = () => {
      setShowInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowInstall(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showInstall || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
        {/* Icono */}
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🏀</span>
        </div>
        
        {/* Texto */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-sm">Instalar BuzzerLive</h3>
          <p className="text-white/80 text-xs">Acceso rápido desde tu pantalla de inicio</p>
        </div>
        
        {/* Botones */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="p-2 text-white/60 hover:text-white"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-white text-orange-600 font-bold text-sm rounded-xl hover:bg-orange-50 transition-colors"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}