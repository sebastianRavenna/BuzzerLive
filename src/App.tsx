import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './services/supabase'; // Importamos la instancia directa
import { Layout } from './components/common/Layout';
import { HomePage } from './pages/HomePage';
import { PosicionesPage } from './pages/PosicionesPage';
import { PartidosPage } from './pages/PartidosPage';
import { PartidoLivePage } from './pages/PartidoLivePage';
import { MarcadorPublicoPage } from './pages/MarcadorPublicoPage';
import { PublicDashboardPage } from './pages/PublicDashboardPage';
import { InstallPWA } from './components/common/InstallPWA';
import { UpdatePrompt } from './components/common/UpdatePrompt';
import LoginPage from './pages/LoginPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AdminPage from './pages/AdminPage';
import ClubPage from './pages/ClubPage';
import { initAuth, getCurrentUser, onAuthChange, type Usuario } from './services/auth.service';

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Usuario | null>(null);

  useEffect(() => {
    let isMounted = true; // 🛡️ Protección contra actualizaciones en componentes desmontados

    const init = async () => {
      try {
        await initAuth();
        const currentUser = getCurrentUser();
        // Solo actualizamos el estado si el componente sigue montado
        if (isMounted) {
          setUser(currentUser);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error inicializando auth:", error);
        if (isMounted) setLoading(false);
      }
    };

    init();

    // Escuchar cambios de sesión
    const unsubscribe = onAuthChange((u) => {
      if (isMounted) {
        setUser(u);
      }
    });

    // Cleanup robusto
    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // === 2. Lógica Global de "Wake Up" (El Watchdog) ===
  // Esto arregla el problema de "se cuelga al volver" en TODAS las páginas
  useEffect(() => {
    const handleWakeUp = async () => {
      if (document.visibilityState === 'visible') {
        console.log("👀 App despierta. Verificando estado...");

        // A. Verificar y Reconectar Socket (con espera hasta que esté abierto)
        const state = supabase.realtime.connectionState() as string;
        if (state !== 'open') {
          console.log(`🔌 Socket no está abierto (${state}). Reconectando...`);
          supabase.realtime.connect();

          // 🔑 CLAVE: Esperar a que el socket esté realmente abierto
          let attempts = 0;
          const maxAttempts = 20; // 2 segundos máximo (20 * 100ms)
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const currentState = supabase.realtime.connectionState() as string;
            if (currentState === 'open') {
              console.log("✅ Socket reconectado exitosamente");
              break;
            }
            attempts++;
          }

          if (attempts >= maxAttempts) {
            console.warn("⚠️ Socket no se pudo reconectar después de 2 segundos");
          }
        }

        // B. Verificar sesión BLINDADO contra AbortError
        try {
          // Pequeño delay adicional para que el navegador esté listo
          await new Promise(resolve => setTimeout(resolve, 200));

          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session) {
            console.warn("⚠️ Sesión inválida al despertar.");
            if (user) {
              window.location.href = '/login';
            }
          } else {
            console.log("✅ Sesión validada correctamente.");

            // 🔑 CLAVE: Otro delay antes de disparar el evento para asegurar estabilidad
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log("🚀 Disparando evento buzzer:wakeup");
            window.dispatchEvent(new Event('buzzer:wakeup'));
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            console.log("🛑 Petición cancelada por el navegador. Reintentando en 500ms...");

            // Reintentar después de un delay
            setTimeout(async () => {
              try {
                const { data, error } = await supabase.auth.getSession();
                if (!error && data.session) {
                  console.log("✅ Sesión validada en reintento.");
                  console.log("🚀 Disparando evento buzzer:wakeup");
                  window.dispatchEvent(new Event('buzzer:wakeup'));
                }
              } catch (retryErr) {
                console.error("❌ Error en reintento:", retryErr);
              }
            }, 500);
          } else {
            console.error("❌ Error inesperado al verificar sesión:", err);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas de autenticación */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Panel SuperAdmin */}
        <Route path="/superadmin" element={
          user?.rol === 'superadmin' ? <SuperAdminPage /> : <Navigate to="/login" />
        } />
        
        {/* Panel Admin por organización */}
        <Route path="/:orgSlug" element={
          user?.rol === 'admin' || user?.rol === 'superadmin' ? <AdminPage /> : <Navigate to="/login" />
        } />
        
        {/* Panel Club */}
        <Route path="/:orgSlug/mi-club" element={
          user?.rol === 'club' ? <ClubPage /> : <Navigate to="/login" />
        } />
        
        {/* Rutas de partido dentro de organización */}
        <Route path="/:orgSlug/partido/:id/live" element={<PartidoLivePage />} />
        <Route path="/:orgSlug/partido/:id" element={<MarcadorPublicoPage />} />
        <Route path="/:orgSlug/partidos" element={<PartidosPage />} />

        {/* Dashboard público por organización */}
        <Route path="/:orgSlug/public" element={<PublicDashboardPage />} />

        {/* Rutas públicas legacy (sin org) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="posiciones" element={<PosicionesPage />} />
          <Route path="partidos" element={<PartidosPage />} />
        </Route>
        <Route path="/partido/:id/live" element={<PartidoLivePage />} />
        <Route path="/partido/:id" element={<MarcadorPublicoPage />} />
      </Routes>
      
      {/* Banner de instalación PWA */}
      <InstallPWA />
      
      {/* Notificación de actualización */}
      <UpdatePrompt />
    </BrowserRouter>
  );
}

export default App;