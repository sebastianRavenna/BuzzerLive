import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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

  // 🔌 Handler GLOBAL de reconexión cuando la app vuelve de estar minimizada
  useEffect(() => {
    let hiddenTime: number | null = null;

    const handleGlobalVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Guardar timestamp cuando se oculta la app
        hiddenTime = Date.now();
        console.log('🌍 [GLOBAL] App minimizada en:', new Date().toISOString());
      } else if (document.visibilityState === 'visible') {
        console.log('🌍 [GLOBAL] App vuelve a ser visible');

        // Si estuvo oculta más de 5 segundos, refrescar automáticamente
        if (hiddenTime && Date.now() - hiddenTime > 5000) {
          const secondsHidden = Math.floor((Date.now() - hiddenTime) / 1000);
          console.log(`🔄 [GLOBAL] App estuvo minimizada ${secondsHidden}s - Refrescando para evitar problemas de conexión...`);

          // Pequeño delay para que el usuario vea que está pasando algo
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          console.log('✅ [GLOBAL] App estuvo minimizada poco tiempo - No es necesario refrescar');
        }

        hiddenTime = null;
      }
    };

    document.addEventListener('visibilitychange', handleGlobalVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleGlobalVisibilityChange);
    };
  }, []);

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