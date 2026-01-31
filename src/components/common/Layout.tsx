import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { usePartidoStore } from '../../store/partidoStore';
import { getCurrentUser, logout } from '../../services/auth.service';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const connectionStatus = usePartidoStore((state) => state.connectionStatus);
  const user = getCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show header on live scoring page (fullscreen)
  const isLivePage = location.pathname.includes('/live');

  const handlePanelClick = () => {
    if (user?.rol === 'superadmin') navigate('/superadmin');
    else if (user?.rol === 'admin') navigate(`/${user.organizacion?.slug}`);
    else if (user?.rol === 'club') navigate(`/${user.organizacion?.slug}/mi-club`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    window.location.reload();
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Offline Banner */}
      {connectionStatus === 'offline' && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-2 font-semibold z-50">
          ⚠️ Sin conexión - Los datos se sincronizarán cuando vuelvas a estar online
        </div>
      )}
      
      {connectionStatus === 'syncing' && (
        <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white text-center py-2 font-semibold z-50">
          🔄 Sincronizando...
        </div>
      )}
      
      {/* Header */}
      {!isLivePage && (
        <header className="bg-blue-900 text-white shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2">
                <span className="text-2xl">🏀</span>
                <span className="text-xl font-bold">BuzzerLive</span>
              </Link>
              
              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-4">
                <NavLink to="/">Inicio</NavLink>
                {!user && (
                  <NavLink to="/login">Iniciar Sesión</NavLink>
                )}
                {user && (
                  <>
                    <button
                      onClick={handlePanelClick}
                      className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-blue-100 hover:bg-blue-800 hover:text-white"
                    >
                      Ir a Mi Panel
                    </button>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-blue-100 hover:bg-blue-800 hover:text-white"
                    >
                      Cerrar Sesión
                    </button>
                  </>
                )}
              </nav>
              
              {/* Mobile menu button */}
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>

            {/* Mobile menu */}
            {mobileMenuOpen && (
              <nav className="md:hidden py-4 border-t border-blue-800">
                <div className="flex flex-col gap-2">
                  <MobileNavLink to="/" onClick={() => setMobileMenuOpen(false)}>
                    Inicio
                  </MobileNavLink>
                  {!user && (
                    <MobileNavLink to="/login" onClick={() => setMobileMenuOpen(false)}>
                      Iniciar Sesión
                    </MobileNavLink>
                  )}
                  {user && (
                    <>
                      <button
                        onClick={() => {
                          handlePanelClick();
                          setMobileMenuOpen(false);
                        }}
                        className="px-3 py-2 text-left text-sm font-medium transition-colors text-blue-100 hover:bg-blue-800 hover:text-white rounded-md"
                      >
                        Ir a Mi Panel
                      </button>
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="px-3 py-2 text-left text-sm font-medium transition-colors text-blue-100 hover:bg-blue-800 hover:text-white rounded-md"
                      >
                        Cerrar Sesión
                      </button>
                    </>
                  )}
                </div>
              </nav>
            )}
          </div>
        </header>
      )}
      
      {/* Main content */}
      <main className={`flex-1 ${!isLivePage ? 'container mx-auto px-4 py-6' : ''}`}>
        <Outlet />
      </main>
      
      {/* Footer */}
      {!isLivePage && (
        <footer className="bg-gray-800 text-gray-400 py-4">
          <div className="container mx-auto px-4 text-center text-sm">
            <p>BuzzerLive © 2026 - Sistema de gestión de partidos</p>
          </div>
        </footer>
      )}
    </div>
  );
}

// Nav link component with active state
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`
        px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${isActive
          ? 'bg-blue-800 text-white'
          : 'text-blue-100 hover:bg-blue-800 hover:text-white'
        }
      `}
    >
      {children}
    </Link>
  );
}

// Mobile nav link component
function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        px-3 py-2 rounded-md text-sm font-medium transition-colors block
        ${isActive
          ? 'bg-blue-800 text-white'
          : 'text-blue-100 hover:bg-blue-800 hover:text-white'
        }
      `}
    >
      {children}
    </Link>
  );
}