import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { MarcadorPartido } from '../types';

export function HomePage() {
  const configured = isSupabaseConfigured();
  const [partidosEnVivo, setPartidosEnVivo] = useState<MarcadorPartido[]>([]);
  const [ultimosResultados, setUltimosResultados] = useState<MarcadorPartido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      // Partidos en vivo
      const { data: enVivo } = await supabase
        .from('marcador_partido')
        .select('*')
        .eq('estado', 'EN_CURSO')
        .limit(5);

      // Últimos resultados
      const { data: finalizados } = await supabase
        .from('marcador_partido')
        .select('*')
        .eq('estado', 'FINALIZADO')
        .order('fecha', { ascending: false })
        .limit(5);

      setPartidosEnVivo(enVivo || []);
      setUltimosResultados(finalizados || []);
      setLoading(false);
    }

    fetchData();
  }, [configured]);
  
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
          icon="📅"
          title="Partidos"
          description="Ver todos los partidos del torneo"
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
          icon="🔴"
          title="Partidos en Vivo"
          description="Seguí los partidos en curso"
          to="/partidos?estado=en_curso"
          color="red"
        />
      </section>
      
      {/* Live Games */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            🔴 Partidos en Vivo
          </h2>
          <Link to="/partidos?estado=en_curso" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Ver todos →
          </Link>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin text-4xl mb-2">🏀</div>
            <p className="text-gray-500">Cargando...</p>
          </div>
        ) : !configured ? (
          <p className="text-gray-500 text-center py-8">
            Configurá Supabase para ver los partidos
          </p>
        ) : partidosEnVivo.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay partidos en vivo en este momento
          </p>
        ) : (
          <div className="space-y-3">
            {partidosEnVivo.map((partido) => (
              <PartidoMiniCard key={partido.partido_id} partido={partido} />
            ))}
          </div>
        )}
      </section>
      
      {/* Recent Results */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            📅 Últimos Resultados
          </h2>
          <Link to="/partidos?estado=finalizados" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Ver todos →
          </Link>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin text-4xl mb-2">🏀</div>
            <p className="text-gray-500">Cargando...</p>
          </div>
        ) : !configured ? (
          <p className="text-gray-500 text-center py-8">
            Configurá Supabase para ver los resultados
          </p>
        ) : ultimosResultados.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay resultados recientes
          </p>
        ) : (
          <div className="space-y-3">
            {ultimosResultados.map((partido) => (
              <PartidoMiniCard key={partido.partido_id} partido={partido} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Mini card de partido para la home
function PartidoMiniCard({ partido }: { partido: MarcadorPartido }) {
  const esEnVivo = partido.estado === 'EN_CURSO';
  
  return (
    <Link 
      to={`/partido/${partido.partido_id}`}
      className={`
        block p-3 rounded-lg border-2 transition-all hover:shadow-md
        ${esEnVivo ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">
              {partido.local_nombre_corto || partido.local_nombre}
            </span>
            <span className="text-2xl font-bold text-gray-900">{partido.puntos_local}</span>
          </div>
        </div>
        
        <div className="px-3">
          {esEnVivo ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              VIVO
            </span>
          ) : (
            <span className="text-gray-400 text-sm">Final</span>
          )}
        </div>
        
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-2xl font-bold text-gray-900">{partido.puntos_visitante}</span>
            <span className="font-bold text-gray-900">
              {partido.visitante_nombre_corto || partido.visitante_nombre}
            </span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mt-2 text-center">
        {partido.torneo_nombre} • {new Date(partido.fecha).toLocaleDateString('es-AR', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        })}
      </div>
    </Link>
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