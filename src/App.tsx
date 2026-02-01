import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Layout } from './components/common/Layout';
import { HomePage } from './pages/HomePage';
import { PosicionesPage } from './pages/PosicionesPage';
import { PartidosPage } from './pages/PartidosPage';
import { PartidoLivePage } from './pages/PartidoLivePage';
import { MarcadorPublicoPage } from './pages/MarcadorPublicoPage';
import { PublicDashboardPage } from './pages/PublicDashboardPage';
import { InstallPWA } from './components/common/InstallPWA';
import { UpdatePrompt } from './components/common/UpdatePrompt';
import { VisibilityProvider } from './contexts/VisibilityContext';
import LoginPage from './pages/LoginPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AdminPage from './pages/AdminPage';
import ClubPage from './pages/ClubPage';
import { initAuth, getCurrentUser, onAuthChange, type Usuario } from './services/auth.service';

// Configurar StatusBar en app nativa
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#111827' });
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Usuario | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await initAuth();
        const currentUser = getCurrentUser();
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

    const unsubscribe = onAuthChange((u) => {
      if (isMounted) {
        setUser(u);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
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
    <VisibilityProvider>
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
    </VisibilityProvider>
  );
}

export default App;