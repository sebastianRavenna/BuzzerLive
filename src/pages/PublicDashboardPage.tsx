import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { getTablaPosiciones } from '../services/torneo.service';
import type { Organizacion, Torneo, MarcadorPartido } from '../types';

// Tipo para posiciones (coincide con lo que retorna getTablaPosiciones)
interface PosicionEquipo {
  equipo_id: string;
  nombre: string;
  nombre_corto: string;
  logo_url: string | null;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  pf: number;
  pc: number;
  dif: number;
  pts: number;
}

export function PublicDashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organizacion | null>(null);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [selectedTorneo, setSelectedTorneo] = useState<Torneo | null>(null);
  const [posiciones, setPosiciones] = useState<PosicionEquipo[]>([]);
  const [partidos, setPartidos] = useState<MarcadorPartido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar organización y torneos
  useEffect(() => {
    async function loadData() {
      if (!orgSlug) {
        setError('Organización no especificada');
        setLoading(false);
        return;
      }

      try {
        // Obtener organización
        const { data: orgData, error: orgError } = await supabase
          .from('organizaciones')
          .select('*')
          .eq('slug', orgSlug)
          .single();

        if (orgError) throw orgError;
        if (!orgData) {
          setError('Organización no encontrada');
          setLoading(false);
          return;
        }

        setOrg(orgData);
        console.log('Organización cargada:', orgData.nombre, 'ID:', orgData.id);

        // Debug: Ver TODOS los torneos de esta org (sin filtro de estado)
        const { data: allTorneosOrg } = await supabase
          .from('torneos')
          .select('*')
          .eq('organizacion_id', orgData.id);
        console.log('TODOS los torneos de la org (sin filtro):', allTorneosOrg);

        // Obtener SOLO torneos de esta organización (no NULL)
        const { data: torneosData, error: torneosError } = await supabase
          .from('torneos')
          .select('*')
          .eq('organizacion_id', orgData.id)
          .in('estado', ['EN_CURSO', 'PLANIFICACION'])
          .order('created_at', { ascending: false });

        if (torneosError) {
          console.error('Error cargando torneos:', torneosError);
          throw torneosError;
        }

        console.log('Torneos con filtro EN_CURSO/PLANIFICACION:', torneosData?.length || 0, torneosData);

        setTorneos(torneosData || []);
      } catch (err) {
        console.error('Error cargando datos:', err);
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orgSlug]);

  // Cargar datos del torneo seleccionado
  useEffect(() => {
    async function loadTorneoData() {
      if (!selectedTorneo) {
        setPosiciones([]);
        setPartidos([]);
        return;
      }

      try {
        // Obtener tabla de posiciones
        const posicionesData = await getTablaPosiciones(selectedTorneo.id);
        setPosiciones(posicionesData);

        // Obtener partidos del torneo
        const { data: partidosData, error: partidosError } = await supabase
          .from('marcador_partido')
          .select('*')
          .eq('torneo_id', selectedTorneo.id)
          .order('fecha', { ascending: true });

        if (partidosError) throw partidosError;

        setPartidos(partidosData || []);
      } catch (err) {
        console.error('Error cargando datos del torneo:', err);
      }
    }

    loadTorneoData();
  }, [selectedTorneo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error || 'Error al cargar'}</div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'EN_CURSO':
        return 'bg-green-600';
      case 'PLANIFICACION':
        return 'bg-yellow-600';
      case 'FINALIZADO':
        return 'bg-gray-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getEstadoPartidoColor = (estado: string) => {
    switch (estado) {
      case 'EN_CURSO':
        return 'bg-green-600 text-white';
      case 'FINALIZADO':
        return 'bg-gray-600 text-white';
      case 'PROGRAMADO':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            {org.logo_url && (
              <img
                src={org.logo_url}
                alt={org.nombre}
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {org.nombre}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">Dashboard Público</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Torneos Activos */}
        <section className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
            Torneos Activos
          </h2>

          {torneos.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">No hay torneos activos en este momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {torneos.map((torneo) => (
                <button
                  key={torneo.id}
                  onClick={() => setSelectedTorneo(selectedTorneo?.id === torneo.id ? null : torneo)}
                  className={`bg-gray-800 rounded-xl p-4 sm:p-6 text-left transition-all hover:bg-gray-750 border-2 ${
                    selectedTorneo?.id === torneo.id
                      ? 'border-blue-500 ring-2 ring-blue-400'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {torneo.nombre}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${getEstadoBadgeColor(torneo.estado)}`}>
                      {torneo.estado === 'EN_CURSO' ? 'En Curso' : 'Planificación'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">{torneo.categoria}</p>
                  <p className="text-gray-500 text-xs">{torneo.temporada}</p>
                  <div className="mt-3 text-blue-400 text-sm font-medium">
                    {selectedTorneo?.id === torneo.id ? '▼ Ver menos' : '▶ Ver más'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Detalles del Torneo Seleccionado */}
        {selectedTorneo && (
          <section className="space-y-8">
            {/* Tabla de Posiciones */}
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Posiciones - {selectedTorneo.nombre}
              </h3>

              {posiciones.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No hay datos de posiciones disponibles
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 text-xs sm:text-sm py-2 px-2">#</th>
                        <th className="text-left text-gray-400 text-xs sm:text-sm py-2 px-2">Equipo</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1">PJ</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1">PG</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1">PP</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1">PF</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1">PC</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1">Dif</th>
                        <th className="text-center text-gray-400 text-xs sm:text-sm py-2 px-1 font-bold">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posiciones.map((pos, index) => (
                        <tr
                          key={pos.equipo_id}
                          className={`border-b border-gray-700/50 ${
                            index < 3 ? 'bg-green-900/10' : ''
                          }`}
                        >
                          <td className="text-white text-sm py-3 px-2 font-medium">
                            {index + 1}
                          </td>
                          <td className="text-white text-sm py-3 px-2">
                            <div className="flex items-center gap-2">
                              {pos.logo_url && (
                                <img
                                  src={pos.logo_url}
                                  alt={pos.nombre_corto || pos.nombre}
                                  className="w-6 h-6 object-contain"
                                />
                              )}
                              <span className="truncate">{pos.nombre_corto || pos.nombre}</span>
                            </div>
                          </td>
                          <td className="text-gray-300 text-sm py-3 px-1 text-center">{pos.pj}</td>
                          <td className="text-green-400 text-sm py-3 px-1 text-center">{pos.pg}</td>
                          <td className="text-red-400 text-sm py-3 px-1 text-center">{pos.pp}</td>
                          <td className="text-gray-300 text-sm py-3 px-1 text-center">{pos.pf}</td>
                          <td className="text-gray-300 text-sm py-3 px-1 text-center">{pos.pc}</td>
                          <td className={`text-sm py-3 px-1 text-center ${
                            pos.dif > 0 ? 'text-green-400' : pos.dif < 0 ? 'text-red-400' : 'text-gray-300'
                          }`}>
                            {pos.dif > 0 ? '+' : ''}{pos.dif}
                          </td>
                          <td className="text-white text-sm py-3 px-1 text-center font-bold">
                            {pos.pts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Fixture */}
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
              <h3 className="text-xl font-bold text-white mb-4">Fixture</h3>

              {partidos.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No hay partidos programados
                </p>
              ) : (
                <div className="space-y-3">
                  {partidos.map((partido) => {
                    const esEnVivo = partido.estado === 'EN_CURSO';
                    const fecha = new Date(partido.fecha).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={partido.partido_id}
                        onClick={() => {
                          if (esEnVivo) {
                            navigate(`/${orgSlug}/partido/${partido.partido_id}`);
                          }
                        }}
                        className={`bg-gray-700 rounded-lg p-4 ${
                          esEnVivo ? 'cursor-pointer hover:bg-gray-650 border-2 border-green-500' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-xs text-gray-400 mb-2">
                              {fecha} {partido.hora && `- ${partido.hora}`}
                              {partido.lugar && ` | ${partido.lugar}`}
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              {/* Equipo Local */}
                              <div className="flex items-center gap-2 flex-1">
                                {partido.local_escudo && (
                                  <img
                                    src={partido.local_escudo}
                                    alt={partido.local_nombre_corto || partido.local_nombre}
                                    className="w-8 h-8 object-contain"
                                  />
                                )}
                                <span className="text-white font-medium truncate">
                                  {partido.local_nombre_corto || partido.local_nombre}
                                </span>
                              </div>

                              {/* Marcador o VS */}
                              <div className="flex items-center gap-3 px-4">
                                {partido.estado === 'FINALIZADO' || partido.estado === 'EN_CURSO' ? (
                                  <>
                                    <span className="text-2xl font-bold text-white">
                                      {partido.puntos_local}
                                    </span>
                                    <span className="text-gray-500">-</span>
                                    <span className="text-2xl font-bold text-white">
                                      {partido.puntos_visitante}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-gray-500 font-medium">vs</span>
                                )}
                              </div>

                              {/* Equipo Visitante */}
                              <div className="flex items-center gap-2 flex-1 justify-end">
                                <span className="text-white font-medium truncate">
                                  {partido.visitante_nombre_corto || partido.visitante_nombre}
                                </span>
                                {partido.visitante_escudo && (
                                  <img
                                    src={partido.visitante_escudo}
                                    alt={partido.visitante_nombre_corto || partido.visitante_nombre}
                                    className="w-8 h-8 object-contain"
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Estado */}
                          <div className="flex items-center justify-end sm:justify-start">
                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${getEstadoPartidoColor(partido.estado)}`}>
                              {partido.estado === 'EN_CURSO' && '🔴 '}
                              {partido.estado === 'EN_CURSO' ? 'EN VIVO' :
                               partido.estado === 'FINALIZADO' ? 'FINALIZADO' :
                               'PROGRAMADO'}
                            </span>
                          </div>
                        </div>

                        {esEnVivo && (
                          <div className="mt-2 text-center text-xs text-green-400">
                            Click para ver marcador en vivo
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}