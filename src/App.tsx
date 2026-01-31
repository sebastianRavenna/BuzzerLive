import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
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
import { supabase } from './services/supabase';

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Usuario | null>(null);
  const minimizedTimeRef = useRef<number>(0);

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

  // Refrescar sesión de auth cuando se minimiza y maximiza
  // Esto soluciona el problema de congelamiento solo cuando estás logueado
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // App minimizada
        minimizedTimeRef.current = Date.now();
        console.log('🔽 [App] App minimizada');
      } else {
        // App maximizada
        const timeMinimized = (Date.now() - minimizedTimeRef.current) / 1000;
        console.log(`🔼 [App] App maximizada después de ${timeMinimized.toFixed(0)}s`);

        if (timeMinimized > 5 && user) {
          // Si estuvo minimizada >5s y hay usuario logueado, refrescar sesión
          console.log('🔄 [App] Refrescando sesión de auth...');
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.warn('⚠️ [App] Error refrescando sesión:', error.message);
            } else if (data.session) {
              console.log('✅ [App] Sesión refrescada exitosamente');
            }
          } catch (err) {
            console.error('❌ [App] Error refrescando sesión:', err);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  // NOTA: Auto-reload removido - ahora las RPC usan fetch() directo con keepalive
  // que funciona correctamente incluso después de minimizar la app.

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
