import { Link } from 'react-router-dom';
import { isSupabaseConfigured } from '../services/supabase';

export function HomePage() {
  const configured = isSupabaseConfigured();
  
  return (
    <div className="space-y-8">
      {/* Setup Warning */}
      {!configured && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Configuración pendiente
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Necesitás configurar las variables de entorno de Supabase.
                Creá un archivo <code className="bg-yellow-100 px-1 rounded">.env</code> con:
              </p>
              <pre className="mt-2 text-xs bg-yellow-100 p-2 rounded overflow-x-auto">
{`VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key`}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          🏀 BuzzerLive
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Sistema de gestión de partidos de básquet con seguimiento en tiempo real
        </p>
      </section>
      
      {/* Quick Actions */}
      <section className="grid md:grid-cols-3 gap-6">
        <QuickActionCard
          icon="📋"
          title="Cargar Partido"
          description="Registrar puntos y faltas en tiempo real"
          to="/partidos"
          color="blue"
        />
        <QuickActionCard
          icon="📊"
          title="Ver Posiciones"
          description="Tabla de posiciones actualizada"
          to="/posiciones"
          color="green"
        />
        <QuickActionCard
          icon="📺"
          title="Partidos en Vivo"
          description="Seguí los partidos en curso"
          to="/partidos?estado=en_curso"
          color="red"
        />
      </section>
      
      {/* Live Games Placeholder */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            🔴 Partidos en Vivo
          </h2>
          <Link to="/partidos" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Ver todos →
          </Link>
        </div>
        
        {configured ? (
          <p className="text-gray-500 text-center py-8">
            No hay partidos en vivo en este momento
          </p>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Configurá Supabase para ver los partidos
          </p>
        )}
      </section>
      
      {/* Recent Results Placeholder */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            📅 Últimos Resultados
          </h2>
        </div>
        
        {configured ? (
          <p className="text-gray-500 text-center py-8">
            No hay resultados recientes
          </p>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Configurá Supabase para ver los resultados
          </p>
        )}
      </section>
    </div>
  );
}

interface QuickActionCardProps {
  icon: string;
  title: string;
  description: string;
  to: string;
  color: 'blue' | 'green' | 'red';
}

function QuickActionCard({ icon, title, description, to, color }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    green: 'bg-green-50 hover:bg-green-100 border-green-200',
    red: 'bg-red-50 hover:bg-red-100 border-red-200',
  };
  
  return (
    <Link
      to={to}
      className={`
        block p-6 rounded-xl border-2 transition-all hover:shadow-md
        ${colorClasses[color]}
      `}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}
