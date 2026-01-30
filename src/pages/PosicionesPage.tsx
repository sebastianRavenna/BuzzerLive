import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, withRetry } from '../services/supabase';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { TablaPosicion, Torneo } from '../types';

export function PosicionesPage() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoSeleccionado, setTorneoSeleccionado] = useState<string>('');
  const [posiciones, setPosiciones] = useState<TablaPosicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  // Cargar torneos
  const fetchTorneos = async () => {
    if (!configured) {
      setLoading(false);
      return;
    }

    try {
      const result = await withRetry(async () => {
        return await supabase
          .from('torneos')
          .select('*')
          .eq('estado', 'EN_CURSO')
          .order('nombre');
      });

      if (result.error) {
        setError(result.error.message);
      } else if (result.data) {
        setTorneos(result.data);
        if (result.data.length > 0) {
          setTorneoSeleccionado(result.data[0].id);
        }
      }
    } catch (error: any) {
      console.error('Error en fetchTorneos:', error);
      setError(error.message || 'Error al cargar torneos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar posiciones cuando cambia el torneo
  const fetchPosiciones = async () => {
    if (!torneoSeleccionado || !configured) return;

    try {
      const result = await withRetry(async () => {
        return await supabase
          .from('tabla_posiciones')
          .select('*')
          .eq('torneo_id', torneoSeleccionado)
          .order('posicion');
      });

      if (result.error) {
        setError(result.error.message);
      } else if (result.data) {
        setPosiciones(result.data);
      }
    } catch (error: any) {
      console.error('Error en fetchPosiciones:', error);
      setError(error.message || 'Error al cargar posiciones');
    }
  };

  useEffect(() => {
    fetchTorneos();
  }, [configured]);

  useEffect(() => {
    fetchPosiciones();
  }, [torneoSeleccionado, configured]);

  // Auto-refresh cuando vuelve de minimizar o recupera conexión
  useAutoRefresh(() => {
    if (configured) {
      fetchTorneos();
      fetchPosiciones();
    }
  });
  
  if (!configured) {
    return (
      <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
        <span className="text-6xl mb-4 block">⚙️</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Configuración Requerida
        </h2>
        <p className="text-gray-600">
          Configurá las variables de entorno de Supabase para ver las posiciones
        </p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
        <div className="animate-spin text-4xl mb-4">🏀</div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md p-4 bg-red-50 border-red-200 text-center py-12">
        <span className="text-4xl mb-4 block">❌</span>
        <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          📊 Tabla de Posiciones
        </h1>
        
        {torneos.length > 1 && (
          <select
            value={torneoSeleccionado}
            onChange={(e) => setTorneoSeleccionado(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {torneos.map((torneo) => (
              <option key={torneo.id} value={torneo.id}>
                {torneo.nombre} - {torneo.categoria}
              </option>
            ))}
          </select>
        )}
      </div>
      
      {torneos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
          <span className="text-6xl mb-4 block">🏆</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            No hay torneos activos
          </h2>
          <p className="text-gray-600">
            Creá un torneo para ver la tabla de posiciones
          </p>
        </div>
      ) : posiciones.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-4 text-center py-12">
          <span className="text-6xl mb-4 block">📋</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Sin partidos jugados
          </h2>
          <p className="text-gray-600">
            La tabla se actualizará cuando se jueguen partidos
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-4 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Equipo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    PJ
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    PG
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    PP
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    PF
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    PC
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    DIF
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    PTS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {posiciones.map((pos, index) => (
                  <tr 
                    key={pos.equipo_id}
                    className={`
                      ${index < 4 ? 'bg-green-50' : ''}
                      ${index >= posiciones.length - 2 ? 'bg-red-50' : ''}
                      hover:bg-gray-50
                    `}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`
                        inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                        ${pos.posicion === 1 ? 'bg-yellow-400 text-yellow-900' : ''}
                        ${pos.posicion === 2 ? 'bg-gray-300 text-gray-800' : ''}
                        ${pos.posicion === 3 ? 'bg-orange-400 text-orange-900' : ''}
                        ${pos.posicion > 3 ? 'bg-gray-100 text-gray-600' : ''}
                      `}>
                        {pos.posicion}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {pos.escudo_url ? (
                          <img 
                            src={pos.escudo_url} 
                            alt={pos.equipo_nombre}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            🏀
                          </div>
                        )}
                        <span className="font-medium text-gray-900">
                          {pos.equipo_nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{pos.pj}</td>
                    <td className="px-4 py-3 text-center font-medium text-green-600">{pos.pg}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-600">{pos.pp}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{pos.pf}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{pos.pc}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${pos.dif > 0 ? 'text-green-600' : pos.dif < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {pos.dif > 0 ? '+' : ''}{pos.dif}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-gray-900">{pos.pts}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 rounded"></div>
          <span>Clasificación</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 rounded"></div>
          <span>Descenso</span>
        </div>
        <div className="text-gray-400">|</div>
        <span>PJ: Partidos Jugados</span>
        <span>PG: Ganados</span>
        <span>PP: Perdidos</span>
        <span>PF: Puntos a Favor</span>
        <span>PC: En Contra</span>
        <span>DIF: Diferencia</span>
        <span>PTS: Puntos</span>
      </div>
    </div>
  );
}
