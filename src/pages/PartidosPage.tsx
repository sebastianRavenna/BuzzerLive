import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { reanudarPartido } from '../services/partido.service';
import type { MarcadorPartido } from '../types';

type FiltroPartido = 'todos' | 'en_curso' | 'programados' | 'finalizados';

export function PartidosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [partidos, setPartidos] = useState<MarcadorPartido[]>([]);
  
  // Leer filtro inicial del URL o usar 'todos'
  const estadoParam = searchParams.get('estado');
  const filtroInicial: FiltroPartido = 
    estadoParam === 'en_curso' || estadoParam === 'programados' || estadoParam === 'finalizados' 
      ? estadoParam 
      : 'todos';
  
  const [filtro, setFiltro] = useState<FiltroPartido>(filtroInicial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const configured = isSupabaseConfigured();

  // Actualizar URL cuando cambia el filtro
  const handleFiltroChange = (nuevoFiltro: FiltroPartido) => {
    setFiltro(nuevoFiltro);
    if (nuevoFiltro === 'todos') {
      setSearchParams({});
    } else {
      setSearchParams({ estado: nuevoFiltro });
    }
  };
  
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    
    async function fetchPartidos() {
      let query = supabase
        .from('marcador_partido')
        .select('*');
      
      if (filtro === 'en_curso') {
        query = query.eq('estado', 'EN_CURSO');
      } else if (filtro === 'programados') {
        query = query.eq('estado', 'PROGRAMADO');
      } else if (filtro === 'finalizados') {
        query = query.eq('estado', 'FINALIZADO');
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) {
        setError(error.message);
      } else if (data) {
        // Ordenar partidos: EN_CURSO primero, luego SUSPENDIDOS/PROGRAMADOS (más próximo primero), luego FINALIZADOS (más reciente primero)
        const ordenados = [...data].sort((a, b) => {
          // Prioridad por estado: SUSPENDIDO se trata como PROGRAMADO
          const prioridad: Record<string, number> = {
            'EN_CURSO': 0,
            'SUSPENDIDO': 1, // Junto con programados para que se vean
            'PROGRAMADO': 1,
            'FINALIZADO': 2,
            'POSTERGADO': 3
          };
          
          const prioridadA = prioridad[a.estado] ?? 5;
          const prioridadB = prioridad[b.estado] ?? 5;
          
          if (prioridadA !== prioridadB) {
            return prioridadA - prioridadB;
          }
          
          // Dentro del mismo estado, ordenar por fecha
          const fechaA = new Date(a.fecha).getTime();
          const fechaB = new Date(b.fecha).getTime();
          
          if (a.estado === 'PROGRAMADO' || a.estado === 'SUSPENDIDO') {
            // Programados y suspendidos: más próximo primero (fecha ascendente)
            return fechaA - fechaB;
          } else {
            // Finalizados y en curso: más reciente primero (fecha descendente)
            return fechaB - fechaA;
          }
        });
        
        setPartidos(ordenados);
      }
      setLoading(false);
    }
    
    fetchPartidos();
  }, [filtro, configured]);
  
  if (!configured) {
    return (
      <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
        <span className="text-6xl mb-4 block">⚙️</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Configuración Requerida
        </h2>
        <p className="text-gray-600">
          Configurá las variables de entorno de Supabase para ver los partidos
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          📅 Partidos
        </h1>
        
        {/* Filtros */}
        <div className="flex gap-2">
          {(['todos', 'en_curso', 'programados', 'finalizados'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFiltroChange(f)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${filtro === f 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {f === 'todos' && 'Todos'}
              {f === 'en_curso' && '🔴 En Vivo'}
              {f === 'programados' && 'Próximos'}
              {f === 'finalizados' && 'Finalizados'}
            </button>
          ))}
        </div>
      </div>
      
      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
          <div className="animate-spin text-4xl mb-4">🏀</div>
          <p className="text-gray-600">Cargando partidos...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-md p-4 bg-red-50 border-red-200 text-center py-12">
          <span className="text-4xl mb-4 block">❌</span>
          <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      ) : partidos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
          <span className="text-6xl mb-4 block">📋</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            No hay partidos
          </h2>
          <p className="text-gray-600">
            {filtro === 'en_curso' && 'No hay partidos en vivo en este momento'}
            {filtro === 'programados' && 'No hay partidos programados'}
            {filtro === 'finalizados' && 'No hay partidos finalizados'}
            {filtro === 'todos' && 'Todavía no se cargaron partidos'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {partidos.map((partido) => (
            <PartidoCard key={partido.partido_id} partido={partido} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartidoCard({ partido }: { partido: MarcadorPartido }) {
  const navigate = useNavigate();
  const [reanudando, setReanudando] = useState(false);
  
  const esEnVivo = partido.estado === 'EN_CURSO';
  const esFinalizado = partido.estado === 'FINALIZADO';
  const esSuspendido = partido.estado === 'SUSPENDIDO';
  const tieneMarcador = esEnVivo || esFinalizado || esSuspendido;

  const handleReanudar = async () => {
    if (reanudando) return;
    setReanudando(true);
    try {
      await reanudarPartido(partido.partido_id);
      // Redirigir al planillero para continuar
      navigate(`/partido/${partido.partido_id}/live`);
    } catch (err) {
      console.error('Error al reanudar:', err);
      setReanudando(false);
    }
  };
  
  return (
    <div className={`
      bg-white rounded-xl shadow-md p-4 border-2
      ${esEnVivo 
        ? 'border-red-500 bg-red-50/30' 
        : esFinalizado 
          ? 'border-gray-300 bg-gray-50/50' 
          : esSuspendido
            ? 'border-yellow-500 bg-yellow-50/30'
            : 'border-blue-200 bg-blue-50/20'
      }
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          {partido.torneo_nombre} - {partido.torneo_categoria}
        </div>
        {esEnVivo && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded uppercase">En Vivo</span>
        )}
        {esFinalizado && (
          <span className="inline-flex items-center px-2 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded">
            Final
          </span>
        )}
        {esSuspendido && (
          <span className="inline-flex items-center px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
            Suspendido
          </span>
        )}
        {partido.estado === 'PROGRAMADO' && (
          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
            Próximo
          </span>
        )}
      </div>
      
      {/* Equipos y marcador */}
      <div className="flex items-center justify-between">
        {/* Local */}
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-gray-900">
            {partido.local_nombre_corto || partido.local_nombre}
          </div>
          {tieneMarcador && (
            <div className="text-4xl font-bold mt-2">
              {partido.puntos_local}
            </div>
          )}
        </div>
        
        {/* VS / Hora */}
        <div className="px-4 text-center">
          {partido.estado === 'PROGRAMADO' ? (
            <div>
              <div className="text-2xl font-bold text-gray-400">VS</div>
              <div className="text-sm text-gray-500 mt-1">
                {partido.hora || 'Hora a confirmar'}
              </div>
            </div>
          ) : esSuspendido ? (
            <div>
              <div className="text-2xl font-bold text-yellow-500">-</div>
              <div className="text-xs text-yellow-600 mt-1">
                Q{partido.cuarto_actual}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-gray-400">-</div>
          )}
        </div>
        
        {/* Visitante */}
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-gray-900">
            {partido.visitante_nombre_corto || partido.visitante_nombre}
          </div>
          {tieneMarcador && (
            <div className="text-4xl font-bold mt-2">
              {partido.puntos_visitante}
            </div>
          )}
        </div>
      </div>

      {/* Observaciones de suspensión */}
      {esSuspendido && partido.observaciones && (
        <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
          <div className="text-xs text-yellow-700 font-medium mb-1">Motivo de suspensión:</div>
          <div className="text-sm text-yellow-800">{partido.observaciones}</div>
        </div>
      )}
      
      {/* Info adicional */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          📍 {partido.lugar || 'Lugar a confirmar'}
          <span className="mx-2">•</span>
          📅 {new Date(partido.fecha).toLocaleDateString('es-AR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          })}
        </div>
        
        <div className="flex gap-2">
          {esEnVivo && (
            <>
              <Link
                to={`/partido/${partido.partido_id}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Ver
              </Link>
              <Link
                to={`/partido/${partido.partido_id}/live`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Cargar
              </Link>
            </>
          )}
          {partido.estado === 'PROGRAMADO' && (
            <Link
              to={`/partido/${partido.partido_id}/live`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Iniciar
            </Link>
          )}
          {esSuspendido && (
            <>
              <Link
                to={`/partido/${partido.partido_id}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Ver
              </Link>
              <button
                onClick={handleReanudar}
                disabled={reanudando}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:bg-yellow-400"
              >
                {reanudando ? 'Reanudando...' : 'Reanudar'}
              </button>
            </>
          )}
          {esFinalizado && (
            <Link
              to={`/partido/${partido.partido_id}`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Ver detalle
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}