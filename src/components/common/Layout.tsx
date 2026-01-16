import { Outlet, Link, useLocation } from 'react-router-dom';
import { usePartidoStore } from '../../store/partidoStore';

export function Layout() {
  const location = useLocation();
  const connectionStatus = usePartidoStore((state) => state.connectionStatus);
  
  // Don't show header on live scoring page (fullscreen)
  const isLivePage = location.pathname.includes('/live');
  
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
              <nav className="hidden md:flex items-center gap-6">
                <NavLink to="/">Inicio</NavLink>
                <NavLink to="/posiciones">Posiciones</NavLink>
                <NavLink to="/partidos">Partidos</NavLink>
              </nav>
              
              {/* Mobile menu button */}
              <button className="md:hidden p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
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
