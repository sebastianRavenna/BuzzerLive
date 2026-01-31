import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { getCurrentUser } from '../services/auth.service';
import type { MarcadorPartido, Organizacion } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const configured = isSupabaseConfigured();
  const user = getCurrentUser();
  const [partidosEnVivo, setPartidosEnVivo] = useState<MarcadorPartido[]>([]);
  const [ultimosResultados, setUltimosResultados] = useState<MarcadorPartido[]>([]);
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchData() {
      try {
        // Pequeño delay para asegurar que Supabase esté completamente inicializado
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        const { data: enVivo, error: errorEnVivo } = await supabase
          .from('marcador_partido')
          .select('*')
          .eq('estado', 'EN_CURSO')
          .limit(5);

        if (errorEnVivo) {
          console.error('Error cargando partidos en vivo:', errorEnVivo);
        }

        if (!isMounted) return;

        const { data: finalizados, error: errorFinalizados } = await supabase
          .from('marcador_partido')
          .select('*')
          .eq('estado', 'FINALIZADO')
          .order('fecha', { ascending: false })
          .limit(5);

        if (errorFinalizados) {
          console.error('Error cargando resultados:', errorFinalizados);
        }

        if (!isMounted) return;

        const { data: orgs, error: errorOrgs } = await supabase
          .from('organizaciones')
          .select('*')
          .eq('activa', true)
          .order('nombre', { ascending: true });

        if (errorOrgs) {
          console.error('Error cargando organizaciones:', errorOrgs);
        }

        if (!isMounted) return;

        setPartidosEnVivo(enVivo || []);
        setUltimosResultados(finalizados || []);
        setOrganizaciones(orgs || []);
      } catch (error) {
        console.error('Error en fetchData:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [configured]);

  const handleLoginClick = () => {
    if (user) {
      if (user.rol === 'superadmin') navigate('/superadmin');
      else if (user.rol === 'admin') navigate(`/${user.organizacion?.slug}`);
      else if (user.rol === 'club') navigate(`/${user.organizacion?.slug}/mi-club`);
    } else {
      navigate('/login');
    }
  };
  
  return (
    <div className="space-y-8">
      {!configured && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0"><span className="text-2xl">⚠️</span></div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Configuración pendiente</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Necesitás configurar las variables de entorno de Supabase.
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
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">🏀 BuzzerLive</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
          Sistema de gestión de partidos de básquet con seguimiento en tiempo real
        </p>
        
        {/* Botón Login/Panel */}
        <button
          onClick={handleLoginClick}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all hover:scale-105 cursor-pointer"
        >
          {user ? (
            <>👤 Ir a Mi Panel <span className="ml-2 text-sm opacity-75">({user.rol})</span></>
          ) : (
            <>🔐 Iniciar Sesión</>
          )}
        </button>
        
        {user && (
          <p className="mt-2 text-sm text-gray-500">
            Hola {user.nombre}{user.apellido ? ` ${user.apellido}` : ''}
          </p>
        )}
      </section>

      {/* Organizaciones */}
      {configured && organizaciones.length > 0 && (
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🏆 Organizaciones</h2>
            <p className="text-gray-600">Accedé a los torneos y estadísticas de cada organización</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizaciones.map((org) => (
              <Link
                key={org.id}
                to={`/${org.slug}/public`}
                className="block p-6 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-blue-300 transition-all hover:shadow-md"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.nombre}
                      className="w-16 h-16 object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                      🏀
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{org.nombre}</h3>
                    {org.descripcion && (
                      <p className="text-sm text-gray-600 line-clamp-2">{org.descripcion}</p>
                    )}
                  </div>
                  <div className="text-blue-600 text-sm font-medium">
                    Ver Dashboard →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Live Games */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">🔴 Partidos en Vivo</h2>
          <Link to="/partidos?estado=en_curso" className="text-blue-600 hover:text-blue-800 text-sm font-medium">Ver todos →</Link>
        </div>
        
        {loading ? (
          <div className="text-center py-8"><div className="animate-spin text-4xl mb-2">🏀</div><p className="text-gray-500">Cargando...</p></div>
        ) : !configured ? (
          <p className="text-gray-500 text-center py-8">Configurá Supabase para ver los partidos</p>
        ) : partidosEnVivo.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay partidos en vivo</p>
        ) : (
          <div className="space-y-3">{partidosEnVivo.map((p) => <PartidoMiniCard key={p.partido_id} partido={p} />)}</div>
        )}
      </section>
      
      {/* Recent Results */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">📅 Últimos Resultados</h2>
          <Link to="/partidos?estado=finalizados" className="text-blue-600 hover:text-blue-800 text-sm font-medium">Ver todos →</Link>
        </div>
        
        {loading ? (
          <div className="text-center py-8"><div className="animate-spin text-4xl mb-2">🏀</div><p className="text-gray-500">Cargando...</p></div>
        ) : !configured ? (
          <p className="text-gray-500 text-center py-8">Configurá Supabase para ver los resultados</p>
        ) : ultimosResultados.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay resultados recientes</p>
        ) : (
          <div className="space-y-3">{ultimosResultados.map((p) => <PartidoMiniCard key={p.partido_id} partido={p} />)}</div>
        )}
      </section>
    </div>
  );
}

function PartidoMiniCard({ partido }: { partido: MarcadorPartido }) {
  const esEnVivo = partido.estado === 'EN_CURSO';
  
  return (
    <Link 
      to={`/partido/${partido.partido_id}`}
      className={`block p-3 rounded-lg border-2 transition-all hover:shadow-md ${esEnVivo ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{partido.local_nombre_corto || partido.local_nombre}</span>
            <span className="text-2xl font-bold text-gray-900">{partido.puntos_local}</span>
          </div>
        </div>
        
        <div className="px-3">
          {esEnVivo ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>VIVO
            </span>
          ) : (
            <span className="text-gray-400 text-sm">Final</span>
          )}
        </div>
        
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-2xl font-bold text-gray-900">{partido.puntos_visitante}</span>
            <span className="font-bold text-gray-900">{partido.visitante_nombre_corto || partido.visitante_nombre}</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mt-2 text-center">
        {partido.torneo_nombre} • {new Date(partido.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </Link>
  );
}

