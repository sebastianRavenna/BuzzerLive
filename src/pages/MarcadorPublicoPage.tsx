import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { LogAcciones } from '../components/common/LogAcciones';
import type { Partido, Equipo } from '../types';

export function MarcadorPublicoPage() {
  const { id } = useParams<{ id: string }>();
  
  const [partido, setPartido] = useState<Partido | null>(null);
  const [equipoLocal, setEquipoLocal] = useState<Equipo | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (!id) return;

    async function cargarPartido() {
      try {
        // Obtener partido
        const { data: partidoData, error: errorPartido } = await supabase
          .from('partidos')
          .select('*')
          .eq('id', id)
          .single();

        if (errorPartido) throw errorPartido;
        if (!partidoData) throw new Error('Partido no encontrado');

        setPartido(partidoData as Partido);

        // Obtener equipos
        const { data: localData } = await supabase
          .from('equipos')
          .select('*')
          .eq('id', partidoData.equipo_local_id)
          .single();

        const { data: visitanteData } = await supabase
          .from('equipos')
          .select('*')
          .eq('id', partidoData.equipo_visitante_id)
          .single();

        setEquipoLocal(localData as Equipo);
        setEquipoVisitante(visitanteData as Equipo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar partido');
      } finally {
        setLoading(false);
      }
    }

    cargarPartido();
  }, [id]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`marcador-publico-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'partidos',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setPartido(prev => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Estados de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando marcador...</div>
      </div>
    );
  }

  if (error || !partido || !equipoLocal || !equipoVisitante) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error || 'Partido no encontrado'}</div>
          <Link to="/partidos" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Ver partidos
          </Link>
        </div>
      </div>
    );
  }

  // Partido programado (aún no empezó)
  if (partido.estado === 'PROGRAMADO') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-lg w-full text-center">
          <div className="text-gray-400 text-sm uppercase tracking-wider mb-4">Próximo partido</div>
          
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {equipoLocal.nombre_corto || equipoLocal.nombre}
              </div>
            </div>
            <div className="text-2xl text-gray-500">vs</div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {equipoVisitante.nombre_corto || equipoVisitante.nombre}
              </div>
            </div>
          </div>
          
          <div className="text-gray-400 space-y-1">
            <div className="text-lg">{partido.fecha}</div>
            <div className="text-2xl font-bold text-white">{partido.hora}</div>
            <div>{partido.lugar}</div>
          </div>
          
          <div className="mt-8 text-sm text-gray-500">
            El marcador se actualizará automáticamente cuando comience el partido
          </div>
        </div>
      </div>
    );
  }

  // Partido finalizado
  if (partido.estado === 'FINALIZADO') {
    const ganoLocal = partido.puntos_local > partido.puntos_visitante;
    const empate = partido.puntos_local === partido.puntos_visitante;
    
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-full">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1 bg-gray-700 text-gray-300 text-sm font-bold rounded-full">
              FINALIZADO
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            {/* Equipo Local */}
            <div className={`flex-1 text-center ${ganoLocal && !empate ? 'opacity-100' : 'opacity-60'}`}>
              <div className="text-lg text-gray-400 mb-2">
                {equipoLocal.nombre_corto || equipoLocal.nombre}
              </div>
              <div className="text-7xl font-bold text-white">
                {partido.puntos_local}
              </div>
              {ganoLocal && !empate && (
                <div className="mt-2 text-green-500 font-bold">GANADOR</div>
              )}
            </div>
            
            {/* Separador */}
            <div className="px-8 text-4xl text-gray-600">-</div>
            
            {/* Equipo Visitante */}
            <div className={`flex-1 text-center ${!ganoLocal && !empate ? 'opacity-100' : 'opacity-60'}`}>
              <div className="text-lg text-gray-400 mb-2">
                {equipoVisitante.nombre_corto || equipoVisitante.nombre}
              </div>
              <div className="text-7xl font-bold text-white">
                {partido.puntos_visitante}
              </div>
              {!ganoLocal && !empate && (
                <div className="mt-2 text-green-500 font-bold">GANADOR</div>
              )}
            </div>
          </div>
          
          <div className="mt-8 text-center text-gray-500">
            {partido.lugar} • {partido.fecha}
          </div>
          
          <div className="mt-6 text-center">
            <Link to="/partidos" className="text-blue-400 hover:text-blue-300">
              ← Ver todos los partidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Partido en curso
  const cuartoTexto = partido.cuarto_actual > 4 
    ? `OT${partido.cuarto_actual - 4}` 
    : `Q${partido.cuarto_actual}`;
  
  const faltasLocal = partido.faltas_equipo_local[Math.max(0, partido.cuarto_actual - 1)] || 0;
  const faltasVisitante = partido.faltas_equipo_visitante[Math.max(0, partido.cuarto_actual - 1)] || 0;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 p-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          EN VIVO
        </div>
      </header>
      
      {/* Marcador principal */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Cuarto */}
          <div className="text-center mb-8">
            <div className="text-gray-500 text-sm uppercase tracking-wider">Cuarto</div>
            <div className="text-5xl font-bold text-white">{cuartoTexto}</div>
          </div>
          
          {/* Marcador */}
          <div className="flex items-center justify-between">
            {/* Equipo Local */}
            <div className="flex-1 text-center">
              <div className="text-xl md:text-2xl text-gray-400 mb-4">
                {equipoLocal.nombre_corto || equipoLocal.nombre}
              </div>
              <div className="text-8xl md:text-9xl font-bold text-white leading-none">
                {partido.puntos_local}
              </div>
              <FaltasIndicator faltas={faltasLocal} />
              <TiemposIndicator 
                usados={partido.tiempos_muertos_local} 
                maximo={partido.cuarto_actual <= 2 ? 2 : partido.cuarto_actual <= 4 ? 3 : 1} 
              />
            </div>
            
            {/* Separador */}
            <div className="px-4 md:px-8 text-4xl md:text-6xl text-gray-600">-</div>
            
            {/* Equipo Visitante */}
            <div className="flex-1 text-center">
              <div className="text-xl md:text-2xl text-gray-400 mb-4">
                {equipoVisitante.nombre_corto || equipoVisitante.nombre}
              </div>
              <div className="text-8xl md:text-9xl font-bold text-white leading-none">
                {partido.puntos_visitante}
              </div>
              <FaltasIndicator faltas={faltasVisitante} />
              <TiemposIndicator 
                usados={partido.tiempos_muertos_visitante} 
                maximo={partido.cuarto_actual <= 2 ? 2 : partido.cuarto_actual <= 4 ? 3 : 1} 
              />
            </div>
          </div>
          
          {/* Info del partido */}
          <div className="mt-12 text-center text-gray-500">
            {partido.lugar}
          </div>
          
          {/* Log de últimas acciones */}
          <div className="mt-8 max-w-md mx-auto">
            <LogAcciones 
              partidoId={id!} 
              equipoLocalId={equipoLocal.id} 
            />
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800/50 p-4 text-center text-gray-500 text-sm">
        Powered by <span className="text-white font-medium">BuzzerLive</span>
      </footer>
    </div>
  );
}

// Indicador de faltas de equipo
function FaltasIndicator({ faltas }: { faltas: number }) {
  return (
    <div className="mt-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Faltas</div>
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              n <= faltas ? 'bg-red-500 border-red-500' : 'border-gray-600'
            }`}
          />
        ))}
      </div>
      {faltas >= 4 && (
        <div className="text-xs text-red-400 mt-1">BONUS</div>
      )}
    </div>
  );
}

// Indicador de tiempos muertos
function TiemposIndicator({ usados, maximo }: { usados: number; maximo: number }) {
  const disponibles = maximo - usados;
  
  return (
    <div className="mt-3">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tiempos</div>
      <div className="flex justify-center gap-1">
        {Array.from({ length: maximo }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-sm transition-colors ${
              i < disponibles ? 'bg-purple-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}