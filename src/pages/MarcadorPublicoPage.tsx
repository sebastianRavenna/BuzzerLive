import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { LogAcciones } from '../components/common/LogAcciones';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { Partido, Equipo } from '../types';

export function MarcadorPublicoPage() {
  const { id } = useParams<{ id: string }>();
  
  const [partido, setPartido] = useState<Partido | null>(null);
  const [equipoLocal, setEquipoLocal] = useState<Equipo | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toast de marcador para todas las acciones
  const [mostrarToast, setMostrarToast] = useState(false);
  const [toastMarcador, setToastMarcador] = useState({ local: 0, visitante: 0 });
  const [toastAccion, setToastAccion] = useState<string>('');

  // Auto-refresh cuando vuelve de minimizar o recupera conexión
  useAutoRefresh(async () => {
    if (id) {
      try {
        const { data: partidoData } = await supabase
          .from('partidos')
          .select('*')
          .eq('id', id)
          .single();
        if (partidoData) setPartido(partidoData as Partido);
      } catch (err) {
        console.error('Error refrescando partido:', err);
      }
    }
  });

  // Formatear tipo de acción para el toast
  const formatearAccion = (tipo: string, valor?: number): string => {
    switch (tipo) {
      case 'PUNTO_1': return '+1 PUNTO';
      case 'PUNTO_2': return '+2 PUNTOS';
      case 'PUNTO_3': return '+3 PUNTOS';
      case 'FALTA_PERSONAL': return 'FALTA PERSONAL';
      case 'FALTA_TECNICA': return 'FALTA TÉCNICA';
      case 'FALTA_ANTIDEPORTIVA': return 'FALTA ANTIDEPORTIVA';
      case 'FALTA_DESCALIFICANTE': return 'EXPULSIÓN';
      case 'FALTA_TECNICA_ENTRENADOR': return 'FALTA TÉCNICA DT';
      case 'FALTA_TECNICA_BANCO': return 'FALTA TÉCNICA BANCO';
      case 'FALTA_DESCALIFICANTE_ENTRENADOR': return 'DT EXPULSADO';
      case 'TIEMPO_MUERTO': return 'TIEMPO MUERTO';
      case 'SUSTITUCION': return 'CAMBIO';
      case 'FIN_CUARTO': return `FIN CUARTO ${valor || ''}`;
      case 'INICIO_CUARTO': return `INICIO CUARTO ${valor || ''}`;
      default: return tipo;
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (!id) return;

    let isMounted = true;

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

        if (isMounted) setPartido(partidoData as Partido);

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

        if (isMounted) {
          setEquipoLocal(localData as Equipo);
          setEquipoVisitante(visitanteData as Equipo);
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Error al cargar partido');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    cargarPartido();

    return () => { isMounted = false; };
  }, [id]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`marcador-publico-${id}-${Date.now()}`)
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'acciones',
          filter: `partido_id=eq.${id}`,
        },
        (payload) => {
          // Cuando se crea una nueva acción, mostrar el toast con el marcador actual
          if (payload.new && !payload.new.anulada) {
            // Formatear la acción para mostrar
            const tipoAccion = formatearAccion(payload.new.tipo, payload.new.valor);
            setToastAccion(tipoAccion);

            // Obtener marcador actualizado
            supabase
              .from('partidos')
              .select('puntos_local, puntos_visitante')
              .eq('id', id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setToastMarcador({ local: data.puntos_local, visitante: data.puntos_visitante });
                  setMostrarToast(true);
                  setTimeout(() => setMostrarToast(false), 2000);
                }
              });
          }
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
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header con botón volver */}
        <header className="p-4">
          <Link 
            to="/partidos" 
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a partidos
          </Link>
        </header>
        
        <div className="flex-1 flex items-center justify-center p-4">
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
      </div>
    );
  }

  // Partido finalizado
  if (partido.estado === 'FINALIZADO') {
    const ganoLocal = partido.puntos_local > partido.puntos_visitante;
    const empate = partido.puntos_local === partido.puntos_visitante;
    
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header con botón volver */}
        <header className="p-4">
          <Link 
            to="/partidos" 
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a partidos
          </Link>
        </header>
        
        <div className="flex-1 flex items-center justify-center p-4">
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
      <header className="bg-gray-800 p-4 flex items-center justify-between">
        <Link 
          to="/partidos" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Volver</span>
        </Link>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          EN VIVO
        </div>
        
        {/* Spacer para centrar el badge */}
        <div className="w-16"></div>
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

      {/* Toast de Marcador - Aparece en todas las acciones */}
      {mostrarToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900/95 rounded-3xl shadow-2xl p-8 border-4 border-blue-500 animate-pulse pointer-events-auto">
            <div className="text-center">
              {/* Tipo de acción */}
              <div className="text-yellow-400 text-2xl font-bold mb-4">{toastAccion}</div>

              {/* Marcador */}
              <div className="text-gray-400 text-sm font-bold mb-2">MARCADOR</div>
              <div className="flex items-center gap-8 justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-white mb-1">{toastMarcador.local}</div>
                  <div className="text-sm text-gray-400">{equipoLocal?.nombre_corto || equipoLocal?.nombre}</div>
                </div>
                <div className="text-4xl font-bold text-gray-500">-</div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-white mb-1">{toastMarcador.visitante}</div>
                  <div className="text-sm text-gray-400">{equipoVisitante?.nombre_corto || equipoVisitante?.nombre}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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