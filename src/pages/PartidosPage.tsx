import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { MarcadorPartido } from '../types';

export function PartidosPage() {
  const [partidos, setPartidos] = useState<MarcadorPartido[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'en_curso' | 'programados' | 'finalizados'>('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const configured = isSupabaseConfigured();
  
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    
    async function fetchPartidos() {
      let query = supabase
        .from('marcador_partido')
        .select('*')
        .order('fecha', { ascending: false });
      
      if (filtro === 'en_curso') {
        query = query.eq('estado', 'EN_CURSO');
      } else if (filtro === 'programados') {
        query = query.eq('estado', 'PROGRAMADO');
      } else if (filtro === 'finalizados') {
        query = query.eq('estado', 'FINALIZADO');
      }
      
      const { data, error } = await query.limit(20);
      
      if (error) {
        setError(error.message);
      } else if (data) {
        setPartidos(data);
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
              onClick={() => setFiltro(f)}
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
  const esEnVivo = partido.estado === 'EN_CURSO';
  const esFinalizado = partido.estado === 'FINALIZADO';
  
  return (
    <div className={`card ${esEnVivo ? 'ring-2 ring-red-500' : ''}`}>
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
          {(esEnVivo || esFinalizado) && (
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
          ) : (
            <div className="text-2xl font-bold text-gray-400">-</div>
          )}
        </div>
        
        {/* Visitante */}
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-gray-900">
            {partido.visitante_nombre_corto || partido.visitante_nombre}
          </div>
          {(esEnVivo || esFinalizado) && (
            <div className="text-4xl font-bold mt-2">
              {partido.puntos_visitante}
            </div>
          )}
        </div>
      </div>
      
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
