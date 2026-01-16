import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getPartidoCompleto, 
  iniciarPartido, 
  registrarAccion,
  anularUltimaAccion,
  cambiarCuarto,
  finalizarPartido,
  suscribirseAPartido
} from '../services/partido.service';
import type { 
  Partido, 
  Equipo, 
  JugadorEnPartido, 
  EquipoActivo,
  TipoAccion 
} from '../types';

export function PartidoLivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Estado del partido
  const [partido, setPartido] = useState<Partido | null>(null);
  const [equipoLocal, setEquipoLocal] = useState<Equipo | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<Equipo | null>(null);
  const [jugadoresLocal, setJugadoresLocal] = useState<JugadorEnPartido[]>([]);
  const [jugadoresVisitante, setJugadoresVisitante] = useState<JugadorEnPartido[]>([]);
  
  // Estado de UI
  const [equipoActivo, setEquipoActivo] = useState<EquipoActivo>('local');
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<JugadorEnPartido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Cargar datos del partido
  useEffect(() => {
    if (!id) return;

    async function cargarPartido() {
      try {
        const data = await getPartidoCompleto(id!);
        setPartido(data.partido);
        setEquipoLocal(data.equipoLocal);
        setEquipoVisitante(data.equipoVisitante);
        setJugadoresLocal(data.jugadoresLocal);
        setJugadoresVisitante(data.jugadoresVisitante);
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

    const unsubscribe = suscribirseAPartido(id!, (cambios) => {
      setPartido(prev => prev ? { ...prev, ...cambios } : null);
    });

    return unsubscribe;
  }, [id]);

  // Iniciar el partido
  const handleIniciarPartido = async () => {
    if (!id) return;
    setProcesando(true);
    try {
      await iniciarPartido(id);
      setPartido(prev => prev ? { ...prev, estado: 'EN_CURSO', cuarto_actual: 1 } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar partido');
    } finally {
      setProcesando(false);
    }
  };

  // Registrar punto
  const handlePunto = async (valor: 1 | 2 | 3) => {
    if (!id || !partido || !jugadorSeleccionado) return;
    
    const equipoId = equipoActivo === 'local' ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;

    setProcesando(true);
    try {
      const tipo: TipoAccion = valor === 1 ? 'PUNTO_1' : valor === 2 ? 'PUNTO_2' : 'PUNTO_3';
      await registrarAccion(id, equipoId, jugadorSeleccionado.id, tipo, partido.cuarto_actual);
      
      // Actualizar UI optimista
      if (equipoActivo === 'local') {
        setPartido(prev => prev ? { ...prev, puntos_local: prev.puntos_local + valor } : null);
        setJugadoresLocal(prev => prev.map(j => 
          j.id === jugadorSeleccionado.id ? { ...j, puntos: j.puntos + valor, participo: true } : j
        ));
      } else {
        setPartido(prev => prev ? { ...prev, puntos_visitante: prev.puntos_visitante + valor } : null);
        setJugadoresVisitante(prev => prev.map(j => 
          j.id === jugadorSeleccionado.id ? { ...j, puntos: j.puntos + valor, participo: true } : j
        ));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar punto');
    } finally {
      setProcesando(false);
    }
  };

  // Registrar falta personal
  const handleFalta = async () => {
    if (!id || !partido || !jugadorSeleccionado) return;
    
    const equipoId = equipoActivo === 'local' ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;

    setProcesando(true);
    try {
      await registrarAccion(id, equipoId, jugadorSeleccionado.id, 'FALTA_PERSONAL', partido.cuarto_actual);
      
      // Actualizar UI optimista
      const actualizarJugadores = (jugadores: JugadorEnPartido[]) =>
        jugadores.map(j => 
          j.id === jugadorSeleccionado.id ? { ...j, faltas: j.faltas + 1, participo: true } : j
        );
      
      const actualizarFaltasEquipo = (faltas: number[]) => {
        const nuevasFaltas = [...faltas];
        const idx = Math.max(0, partido.cuarto_actual - 1);
        nuevasFaltas[idx] = (nuevasFaltas[idx] || 0) + 1;
        return nuevasFaltas;
      };

      if (equipoActivo === 'local') {
        setJugadoresLocal(actualizarJugadores);
        setPartido(prev => prev ? { 
          ...prev, 
          faltas_equipo_local: actualizarFaltasEquipo(prev.faltas_equipo_local) 
        } : null);
      } else {
        setJugadoresVisitante(actualizarJugadores);
        setPartido(prev => prev ? { 
          ...prev, 
          faltas_equipo_visitante: actualizarFaltasEquipo(prev.faltas_equipo_visitante) 
        } : null);
      }
      
      // Deseleccionar si llegó a 5 faltas
      const jugadorActualizado = equipoActivo === 'local' 
        ? jugadoresLocal.find(j => j.id === jugadorSeleccionado.id)
        : jugadoresVisitante.find(j => j.id === jugadorSeleccionado.id);
      
      if (jugadorActualizado && jugadorActualizado.faltas >= 4) {
        setJugadorSeleccionado(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar falta');
    } finally {
      setProcesando(false);
    }
  };

  // Deshacer última acción
  const handleDeshacer = async () => {
    if (!id) return;
    setProcesando(true);
    try {
      await anularUltimaAccion(id);
      // Recargar datos del partido
      const data = await getPartidoCompleto(id);
      setPartido(data.partido);
      setJugadoresLocal(data.jugadoresLocal);
      setJugadoresVisitante(data.jugadoresVisitante);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al deshacer');
    } finally {
      setProcesando(false);
    }
  };

  // Cambiar cuarto
  const handleCambiarCuarto = async (nuevoCuarto: number) => {
    if (!id) return;
    setProcesando(true);
    try {
      await cambiarCuarto(id, nuevoCuarto);
      setPartido(prev => prev ? { ...prev, cuarto_actual: nuevoCuarto } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar cuarto');
    } finally {
      setProcesando(false);
    }
  };

  // Finalizar partido
  const handleFinalizarPartido = async () => {
    if (!id || !confirm('¿Seguro que querés finalizar el partido?')) return;
    setProcesando(true);
    try {
      await finalizarPartido(id);
      navigate('/partidos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar partido');
    } finally {
      setProcesando(false);
    }
  };

  // Jugadores del equipo activo
  const jugadoresActivos = equipoActivo === 'local' ? jugadoresLocal : jugadoresVisitante;
  const equipoActivoData = equipoActivo === 'local' ? equipoLocal : equipoVisitante;

  // Estados de carga y error
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando partido...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button 
            onClick={() => navigate('/partidos')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Volver a partidos
          </button>
        </div>
      </div>
    );
  }

  if (!partido || !equipoLocal || !equipoVisitante) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Partido no encontrado</div>
      </div>
    );
  }

  // Pantalla de inicio si el partido no empezó
  if (partido.estado === 'PROGRAMADO') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-6">
            {equipoLocal.nombre_corto || equipoLocal.nombre}
            <span className="text-gray-500 mx-3">vs</span>
            {equipoVisitante.nombre_corto || equipoVisitante.nombre}
          </h1>
          <p className="text-gray-400 mb-8">
            {partido.lugar} • {partido.hora}
          </p>
          <button
            onClick={handleIniciarPartido}
            disabled={procesando}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xl font-bold rounded-xl transition-colors"
          >
            {procesando ? 'Iniciando...' : '▶ INICIAR PARTIDO'}
          </button>
        </div>
      </div>
    );
  }

  // Pantalla principal de carga
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header - Marcador */}
      <header className="bg-gray-800 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Equipo Local */}
          <div 
            className={`flex-1 text-center cursor-pointer p-3 rounded-xl transition-colors ${
              equipoActivo === 'local' ? 'bg-blue-900/50 ring-2 ring-blue-500' : ''
            }`}
            onClick={() => { setEquipoActivo('local'); setJugadorSeleccionado(null); }}
          >
            <div className="text-sm text-gray-400 mb-1">
              {equipoLocal.nombre_corto || equipoLocal.nombre}
            </div>
            <div className="text-5xl font-bold text-white">
              {partido.puntos_local}
            </div>
            <FaltasIndicator 
              faltas={partido.faltas_equipo_local[Math.max(0, partido.cuarto_actual - 1)] || 0} 
            />
          </div>

          {/* Centro - Cuarto */}
          <div className="px-6 text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Cuarto</div>
            <div className="text-3xl font-bold text-white">
              {partido.cuarto_actual > 4 ? `OT${partido.cuarto_actual - 4}` : `Q${partido.cuarto_actual}`}
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded mt-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              EN VIVO
            </div>
          </div>

          {/* Equipo Visitante */}
          <div 
            className={`flex-1 text-center cursor-pointer p-3 rounded-xl transition-colors ${
              equipoActivo === 'visitante' ? 'bg-blue-900/50 ring-2 ring-blue-500' : ''
            }`}
            onClick={() => { setEquipoActivo('visitante'); setJugadorSeleccionado(null); }}
          >
            <div className="text-sm text-gray-400 mb-1">
              {equipoVisitante.nombre_corto || equipoVisitante.nombre}
            </div>
            <div className="text-5xl font-bold text-white">
              {partido.puntos_visitante}
            </div>
            <FaltasIndicator 
              faltas={partido.faltas_equipo_visitante[Math.max(0, partido.cuarto_actual - 1)] || 0} 
            />
          </div>
        </div>
      </header>

      {/* Selector de equipo móvil */}
      <div className="bg-gray-800/50 p-2 flex gap-2 md:hidden">
        <button
          onClick={() => { setEquipoActivo('local'); setJugadorSeleccionado(null); }}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            equipoActivo === 'local' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {equipoLocal.nombre_corto || equipoLocal.nombre}
        </button>
        <button
          onClick={() => { setEquipoActivo('visitante'); setJugadorSeleccionado(null); }}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            equipoActivo === 'visitante' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {equipoVisitante.nombre_corto || equipoVisitante.nombre}
        </button>
      </div>

      {/* Contenido principal */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        {/* Jugadores */}
        <div className="mb-4">
          <div className="text-sm text-gray-400 mb-2">
            Seleccioná un jugador de {equipoActivoData?.nombre_corto || equipoActivoData?.nombre}:
          </div>
          <div className="grid grid-cols-5 gap-2">
            {jugadoresActivos.map((jugador) => (
              <button
                key={jugador.id}
                onClick={() => setJugadorSeleccionado(jugador)}
                disabled={jugador.faltas >= 5}
                className={`
                  p-3 rounded-xl border-2 transition-all text-center
                  ${jugador.faltas >= 5 
                    ? 'bg-red-900/30 border-red-800 opacity-50 cursor-not-allowed' 
                    : jugador.faltas === 4
                      ? 'bg-yellow-900/30 border-yellow-600 hover:border-yellow-500'
                      : jugadorSeleccionado?.id === jugador.id
                        ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                        : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                  }
                `}
              >
                <div className="text-2xl font-bold text-white">
                  {jugador.numero_camiseta}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {jugador.apellido}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {jugador.puntos > 0 && <span className="text-green-400">{jugador.puntos}pts </span>}
                  {jugador.faltas > 0 && <span className="text-red-400">{jugador.faltas}f</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Jugador seleccionado */}
        {jugadorSeleccionado && (
          <div className="bg-gray-800 rounded-xl p-3 mb-4 text-center">
            <span className="text-gray-400">Anotando para: </span>
            <span className="text-white font-bold">
              #{jugadorSeleccionado.numero_camiseta} {jugadorSeleccionado.nombre} {jugadorSeleccionado.apellido}
            </span>
          </div>
        )}

        {/* Botones de acción */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <button
            onClick={() => handlePunto(1)}
            disabled={!jugadorSeleccionado || procesando}
            className="py-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-2xl font-bold rounded-xl transition-colors active:scale-95"
          >
            +1
          </button>
          <button
            onClick={() => handlePunto(2)}
            disabled={!jugadorSeleccionado || procesando}
            className="py-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-2xl font-bold rounded-xl transition-colors active:scale-95"
          >
            +2
          </button>
          <button
            onClick={() => handlePunto(3)}
            disabled={!jugadorSeleccionado || procesando}
            className="py-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-2xl font-bold rounded-xl transition-colors active:scale-95"
          >
            +3
          </button>
          <button
            onClick={handleFalta}
            disabled={!jugadorSeleccionado || procesando}
            className="py-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xl font-bold rounded-xl transition-colors active:scale-95"
          >
            FALTA
          </button>
        </div>

        {/* Controles secundarios */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleDeshacer}
            disabled={procesando}
            className="py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium rounded-xl transition-colors"
          >
            ↩ Deshacer
          </button>
          <button
            onClick={() => handleCambiarCuarto(partido.cuarto_actual + 1)}
            disabled={procesando}
            className="py-3 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 text-white font-medium rounded-xl transition-colors"
          >
            Fin {partido.cuarto_actual > 4 ? `OT${partido.cuarto_actual - 4}` : `Q${partido.cuarto_actual}`} →
          </button>
        </div>

        {/* Finalizar */}
        <button
          onClick={handleFinalizarPartido}
          disabled={procesando}
          className="w-full py-3 bg-gray-800 hover:bg-red-900 border border-gray-700 hover:border-red-700 text-gray-400 hover:text-white font-medium rounded-xl transition-colors"
        >
          🏁 Finalizar Partido
        </button>
      </main>
    </div>
  );
}

// Componente de indicador de faltas de equipo
function FaltasIndicator({ faltas }: { faltas: number }) {
  return (
    <div className="flex justify-center gap-1 mt-2">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`w-3 h-3 rounded-full border-2 transition-colors ${
            n <= faltas 
              ? 'bg-red-500 border-red-500' 
              : 'border-gray-600'
          }`}
        />
      ))}
    </div>
  );
}
