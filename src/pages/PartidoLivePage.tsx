import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getPartidoCompleto, 
  iniciarPartido, 
  registrarAccion,
  cambiarCuarto,
  finalizarPartido,
  suscribirseAPartido,
  actualizarTiemposMuertos
} from '../services/partido.service';
import type { 
  Partido, 
  Equipo, 
  JugadorEnPartido, 
  TipoAccion 
} from '../types';

type Fase = 'cargando' | 'seleccion-titulares' | 'en-juego' | 'finalizado';

export function PartidoLivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Estado del partido
  const [partido, setPartido] = useState<Partido | null>(null);
  const [equipoLocal, setEquipoLocal] = useState<Equipo | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<Equipo | null>(null);
  const [jugadoresLocal, setJugadoresLocal] = useState<JugadorEnPartido[]>([]);
  const [jugadoresVisitante, setJugadoresVisitante] = useState<JugadorEnPartido[]>([]);
  
  // Titulares (IDs de los jugadores en cancha)
  const [titularesLocal, setTitularesLocal] = useState<Set<string>>(new Set());
  const [titularesVisitante, setTitularesVisitante] = useState<Set<string>>(new Set());
  
  // Estado de UI
  const [fase, setFase] = useState<Fase>('cargando');
  const [jugadorSeleccionadoLocal, setJugadorSeleccionadoLocal] = useState<JugadorEnPartido | null>(null);
  const [jugadorSeleccionadoVisitante, setJugadorSeleccionadoVisitante] = useState<JugadorEnPartido | null>(null);
  const [modoDescontar, setModoDescontar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarConfirmacionFin, setMostrarConfirmacionFin] = useState(false);
  const [ultimos2MinLocal, setUltimos2MinLocal] = useState(false);
  const [ultimos2MinVisitante, setUltimos2MinVisitante] = useState(false);

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
        
        if (data.partido.estado === 'PROGRAMADO') {
          setFase('seleccion-titulares');
        } else if (data.partido.estado === 'EN_CURSO') {
          // Recuperar titulares si ya está en curso
          const titularesL = new Set(data.jugadoresLocal.filter(j => j.participo).map(j => j.id));
          const titularesV = new Set(data.jugadoresVisitante.filter(j => j.participo).map(j => j.id));
          setTitularesLocal(titularesL.size > 0 ? titularesL : new Set(data.jugadoresLocal.slice(0, 5).map(j => j.id)));
          setTitularesVisitante(titularesV.size > 0 ? titularesV : new Set(data.jugadoresVisitante.slice(0, 5).map(j => j.id)));
          setFase('en-juego');
        } else {
          setFase('finalizado');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar partido');
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

  // Calcular tiempos muertos disponibles
  const getTiemposDisponibles = (esLocal: boolean) => {
    if (!partido) return { usados: 0, maximo: 2 };
    
    const cuarto = partido.cuarto_actual;
    const tiemposUsados = esLocal ? partido.tiempos_muertos_local : partido.tiempos_muertos_visitante;
    
    if (cuarto <= 2) {
      // Primer tiempo: 2 tiempos
      return { usados: tiemposUsados, maximo: 2 };
    } else if (cuarto <= 4) {
      // Segundo tiempo: 3 tiempos (o 2 si activamos últimos 2 min con 3 tiempos)
      const aplicaRegla2Min = esLocal ? ultimos2MinLocal : ultimos2MinVisitante;
      const maximo = aplicaRegla2Min && tiemposUsados === 0 ? 2 : 3;
      return { usados: tiemposUsados, maximo };
    } else {
      // Overtime: 1 tiempo por OT
      return { usados: tiemposUsados, maximo: 1 };
    }
  };

  // Toggle titular en selección
  const toggleTitular = (jugadorId: string, esLocal: boolean) => {
    const setTitulares = esLocal ? setTitularesLocal : setTitularesVisitante;
    const titulares = esLocal ? titularesLocal : titularesVisitante;
    
    const nuevoSet = new Set(titulares);
    if (nuevoSet.has(jugadorId)) {
      nuevoSet.delete(jugadorId);
    } else if (nuevoSet.size < 5) {
      nuevoSet.add(jugadorId);
    }
    setTitulares(nuevoSet);
  };

  // Iniciar el partido
  const handleIniciarPartido = async () => {
    if (!id || titularesLocal.size !== 5 || titularesVisitante.size !== 5) {
      setError('Debés seleccionar 5 titulares por equipo');
      return;
    }
    
    setProcesando(true);
    try {
      await iniciarPartido(id);
      setPartido(prev => prev ? { ...prev, estado: 'EN_CURSO', cuarto_actual: 1 } : null);
      setFase('en-juego');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar partido');
    } finally {
      setProcesando(false);
    }
  };

  // Sustitución
  const handleSustitucion = (entrando: JugadorEnPartido, saliendo: JugadorEnPartido, esLocal: boolean) => {
    const setTitulares = esLocal ? setTitularesLocal : setTitularesVisitante;
    
    setTitulares(prev => {
      const nuevoSet = new Set(prev);
      nuevoSet.delete(saliendo.id);
      nuevoSet.add(entrando.id);
      return nuevoSet;
    });
    
    // Limpiar selección
    if (esLocal) {
      setJugadorSeleccionadoLocal(null);
    } else {
      setJugadorSeleccionadoVisitante(null);
    }
  };

  // Registrar punto
  const handlePunto = async (valor: 1 | 2 | 3, esLocal: boolean) => {
    const jugador = esLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
    if (!id || !partido || !jugador) return;
    
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;

    setProcesando(true);
    try {
      const valorReal = modoDescontar ? -valor : valor;
      const tipo: TipoAccion = valor === 1 ? 'PUNTO_1' : valor === 2 ? 'PUNTO_2' : 'PUNTO_3';
      
      await registrarAccion(id, equipoId, jugador.id, tipo, partido.cuarto_actual, modoDescontar);
      
      // Actualizar UI
      const actualizarJugadores = (jugadores: JugadorEnPartido[]) =>
        jugadores.map(j => 
          j.id === jugador.id ? { ...j, puntos: Math.max(0, j.puntos + valorReal), participo: true } : j
        );
      
      if (esLocal) {
        setPartido(prev => prev ? { ...prev, puntos_local: Math.max(0, prev.puntos_local + valorReal) } : null);
        setJugadoresLocal(actualizarJugadores);
      } else {
        setPartido(prev => prev ? { ...prev, puntos_visitante: Math.max(0, prev.puntos_visitante + valorReal) } : null);
        setJugadoresVisitante(actualizarJugadores);
      }
      
      // Desactivar modo descontar después de usar
      if (modoDescontar) setModoDescontar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar punto');
    } finally {
      setProcesando(false);
    }
  };

  // Registrar falta
  const handleFalta = async (esLocal: boolean) => {
    const jugador = esLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
    if (!id || !partido || !jugador) return;
    
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;

    setProcesando(true);
    try {
      await registrarAccion(id, equipoId, jugador.id, 'FALTA_PERSONAL', partido.cuarto_actual, modoDescontar);
      
      const delta = modoDescontar ? -1 : 1;
      
      // Actualizar jugador
      const actualizarJugadores = (jugadores: JugadorEnPartido[]) =>
        jugadores.map(j => 
          j.id === jugador.id ? { ...j, faltas: Math.max(0, j.faltas + delta), participo: true } : j
        );
      
      // Actualizar faltas de equipo
      const actualizarFaltasEquipo = (faltas: number[]) => {
        const nuevasFaltas = [...faltas];
        const idx = Math.max(0, partido.cuarto_actual - 1);
        nuevasFaltas[idx] = Math.max(0, (nuevasFaltas[idx] || 0) + delta);
        return nuevasFaltas;
      };

      if (esLocal) {
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
      
      if (modoDescontar) setModoDescontar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar falta');
    } finally {
      setProcesando(false);
    }
  };

  // Registrar tiempo muerto
  const handleTiempoMuerto = async (esLocal: boolean) => {
    if (!id || !partido) return;
    
    const tiempos = getTiemposDisponibles(esLocal);
    const tiemposUsados = esLocal ? partido.tiempos_muertos_local : partido.tiempos_muertos_visitante;
    
    // Validar disponibilidad
    if (!modoDescontar && tiemposUsados >= tiempos.maximo) {
      setError('No hay tiempos muertos disponibles');
      return;
    }
    if (modoDescontar && tiemposUsados <= 0) {
      setError('No hay tiempos muertos para descontar');
      return;
    }

    setProcesando(true);
    try {
      const delta = modoDescontar ? -1 : 1;
      const nuevoValor = tiemposUsados + delta;
      
      await actualizarTiemposMuertos(id, esLocal, nuevoValor);
      
      setPartido(prev => {
        if (!prev) return null;
        return esLocal 
          ? { ...prev, tiempos_muertos_local: nuevoValor }
          : { ...prev, tiempos_muertos_visitante: nuevoValor };
      });
      
      if (modoDescontar) setModoDescontar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar tiempo muerto');
    } finally {
      setProcesando(false);
    }
  };

  // Cambiar cuarto
  const handleCambiarCuarto = async () => {
    if (!id || !partido) return;
    
    const nuevoCuarto = modoDescontar 
      ? Math.max(1, partido.cuarto_actual - 1)
      : partido.cuarto_actual + 1;
    
    // Detectar cambio de tiempo (1er tiempo -> 2do tiempo, o entrada a OT)
    const entrandoA2doTiempo = partido.cuarto_actual === 2 && nuevoCuarto === 3;
    const entrandoAOT = partido.cuarto_actual === 4 && nuevoCuarto === 5;
    const nuevoOT = partido.cuarto_actual >= 5 && nuevoCuarto > partido.cuarto_actual;
    
    const resetearTiempos = (entrandoA2doTiempo || entrandoAOT || nuevoOT) && !modoDescontar;
    
    setProcesando(true);
    try {
      // Actualizar cuarto en BD
      await cambiarCuarto(id, nuevoCuarto);
      
      // Si hay que resetear tiempos, actualizar en BD también
      if (resetearTiempos) {
        await actualizarTiemposMuertos(id, true, 0);
        await actualizarTiemposMuertos(id, false, 0);
      }
      
      // Actualizar estado local
      setPartido(prev => {
        if (!prev) return null;
        const updates: Partial<Partido> = { cuarto_actual: nuevoCuarto };
        if (resetearTiempos) {
          updates.tiempos_muertos_local = 0;
          updates.tiempos_muertos_visitante = 0;
        }
        return { ...prev, ...updates };
      });
      
      // Resetear regla 2 minutos al cambiar de cuarto
      setUltimos2MinLocal(false);
      setUltimos2MinVisitante(false);
      
      if (modoDescontar) setModoDescontar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar cuarto');
    } finally {
      setProcesando(false);
    }
  };

  // Activar regla últimos 2 minutos
  const handleUltimos2Min = (esLocal: boolean) => {
    if (esLocal) {
      setUltimos2MinLocal(true);
    } else {
      setUltimos2MinVisitante(true);
    }
  };

  // Finalizar partido
  const handleFinalizarPartido = async () => {
    if (!id) return;
    setProcesando(true);
    try {
      await finalizarPartido(id);
      navigate('/partidos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar partido');
    } finally {
      setProcesando(false);
      setMostrarConfirmacionFin(false);
    }
  };

  // Componentes auxiliares
  const jugadoresTitularesLocal = jugadoresLocal.filter(j => titularesLocal.has(j.id));
  const jugadoresSuplentesLocal = jugadoresLocal.filter(j => !titularesLocal.has(j.id));
  const jugadoresTitularesVisitante = jugadoresVisitante.filter(j => titularesVisitante.has(j.id));
  const jugadoresSuplentesVisitante = jugadoresVisitante.filter(j => !titularesVisitante.has(j.id));

  // === RENDER ===

  // Cargando
  if (fase === 'cargando') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando partido...</div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button 
            onClick={() => setError(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg mr-2"
          >
            Reintentar
          </button>
          <button 
            onClick={() => navigate('/partidos')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg"
          >
            Volver
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

  // Selección de titulares
  if (fase === 'seleccion-titulares') {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          Seleccionar Titulares (5 por equipo)
        </h1>
        
        <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Equipo Local */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              {equipoLocal.nombre_corto || equipoLocal.nombre}
              <span className="ml-2 text-sm text-gray-400">({titularesLocal.size}/5)</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {jugadoresLocal.map(jugador => (
                <button
                  key={jugador.id}
                  onClick={() => toggleTitular(jugador.id, true)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    titularesLocal.has(jugador.id)
                      ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl font-bold text-white">{jugador.numero_camiseta}</div>
                  <div className="text-xs text-gray-400">{jugador.apellido}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Equipo Visitante */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              {equipoVisitante.nombre_corto || equipoVisitante.nombre}
              <span className="ml-2 text-sm text-gray-400">({titularesVisitante.size}/5)</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {jugadoresVisitante.map(jugador => (
                <button
                  key={jugador.id}
                  onClick={() => toggleTitular(jugador.id, false)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    titularesVisitante.has(jugador.id)
                      ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl font-bold text-white">{jugador.numero_camiseta}</div>
                  <div className="text-xs text-gray-400">{jugador.apellido}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Botón iniciar */}
        <div className="mt-8 text-center">
          <button
            onClick={handleIniciarPartido}
            disabled={procesando || titularesLocal.size !== 5 || titularesVisitante.size !== 5}
            className="px-12 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xl font-bold rounded-xl transition-colors"
          >
            {procesando ? 'Iniciando...' : '▶ INICIAR PARTIDO'}
          </button>
        </div>
      </div>
    );
  }

  // Pantalla principal de carga (en juego)
  const tiemposLocal = getTiemposDisponibles(true);
  const tiemposVisitante = getTiemposDisponibles(false);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col relative">
      {/* Botón finalizar - Esquina superior derecha */}
      <button
        onClick={() => setMostrarConfirmacionFin(true)}
        className="absolute top-3 right-3 px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded transition-colors z-10"
      >
        FINALIZAR
      </button>
      
      {/* Header con marcador */}
      <header className="bg-gray-800 p-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Marcador Local */}
          <div className="text-center flex-1">
            <div className="text-sm text-gray-400">{equipoLocal.nombre_corto || equipoLocal.nombre}</div>
            <div className="text-5xl font-bold text-white">{partido.puntos_local}</div>
            <FaltasIndicator faltas={partido.faltas_equipo_local[Math.max(0, partido.cuarto_actual - 1)] || 0} />
          </div>
          
          {/* Centro - Cuarto y controles */}
          <div className="text-center px-4">
            <div className="text-xs text-gray-500 uppercase">Cuarto</div>
            <div className="text-3xl font-bold text-white">
              {partido.cuarto_actual > 4 ? `OT${partido.cuarto_actual - 4}` : `Q${partido.cuarto_actual}`}
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded mt-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              EN VIVO
            </div>
            <div className="mt-2">
              <button
                onClick={handleCambiarCuarto}
                disabled={procesando}
                className={`px-4 py-2 text-white text-sm font-bold rounded-lg transition-colors ${
                  modoDescontar 
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {modoDescontar 
                  ? `← Volver Q${partido.cuarto_actual > 1 ? partido.cuarto_actual - 1 : 1}`
                  : `Fin ${partido.cuarto_actual > 4 ? `OT${partido.cuarto_actual - 4}` : `Q${partido.cuarto_actual}`} →`
                }
              </button>
            </div>
          </div>
          
          {/* Marcador Visitante */}
          <div className="text-center flex-1">
            <div className="text-sm text-gray-400">{equipoVisitante.nombre_corto || equipoVisitante.nombre}</div>
            <div className="text-5xl font-bold text-white">{partido.puntos_visitante}</div>
            <FaltasIndicator faltas={partido.faltas_equipo_visitante[Math.max(0, partido.cuarto_actual - 1)] || 0} />
          </div>
        </div>
      </header>

      {/* Contenido principal - Dos equipos */}
      <main className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* EQUIPO LOCAL */}
          <EquipoPanel
            equipo={equipoLocal}
            titulares={jugadoresTitularesLocal}
            suplentes={jugadoresSuplentesLocal}
            jugadorSeleccionado={jugadorSeleccionadoLocal}
            onSeleccionarJugador={setJugadorSeleccionadoLocal}
            onPunto={(valor) => handlePunto(valor, true)}
            onFalta={() => handleFalta(true)}
            onTiempoMuerto={() => handleTiempoMuerto(true)}
            onSustitucion={(entrando, saliendo) => handleSustitucion(entrando, saliendo, true)}
            tiemposUsados={partido.tiempos_muertos_local}
            tiemposMaximo={tiemposLocal.maximo}
            modoDescontar={modoDescontar}
            procesando={procesando}
            cuartoActual={partido.cuarto_actual}
            onUltimos2Min={() => handleUltimos2Min(true)}
            ultimos2MinActivo={ultimos2MinLocal}
          />
          
          {/* EQUIPO VISITANTE */}
          <EquipoPanel
            equipo={equipoVisitante}
            titulares={jugadoresTitularesVisitante}
            suplentes={jugadoresSuplentesVisitante}
            jugadorSeleccionado={jugadorSeleccionadoVisitante}
            onSeleccionarJugador={setJugadorSeleccionadoVisitante}
            onPunto={(valor) => handlePunto(valor, false)}
            onFalta={() => handleFalta(false)}
            onTiempoMuerto={() => handleTiempoMuerto(false)}
            onSustitucion={(entrando, saliendo) => handleSustitucion(entrando, saliendo, false)}
            tiemposUsados={partido.tiempos_muertos_visitante}
            tiemposMaximo={tiemposVisitante.maximo}
            modoDescontar={modoDescontar}
            procesando={procesando}
            cuartoActual={partido.cuarto_actual}
            onUltimos2Min={() => handleUltimos2Min(false)}
            ultimos2MinActivo={ultimos2MinVisitante}
          />
        </div>
        
        {/* Toggle DESCONTAR */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setModoDescontar(!modoDescontar)}
            className={`px-8 py-3 font-bold rounded-xl transition-all ${
              modoDescontar
                ? 'bg-orange-500 text-white ring-4 ring-orange-300'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {modoDescontar ? '✓ MODO DESCONTAR ACTIVO' : 'DESCONTAR'}
          </button>
        </div>
      </main>

      {/* Modal confirmación finalizar */}
      {mostrarConfirmacionFin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center">
            <h2 className="text-xl font-bold text-white mb-4">¿Finalizar partido?</h2>
            <p className="text-gray-400 mb-6">
              {equipoLocal.nombre_corto} {partido.puntos_local} - {partido.puntos_visitante} {equipoVisitante.nombre_corto}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarConfirmacionFin(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizarPartido}
                disabled={procesando}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
              >
                {procesando ? 'Finalizando...' : 'Sí, Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === COMPONENTES AUXILIARES ===

function FaltasIndicator({ faltas }: { faltas: number }) {
  return (
    <div className="flex justify-center gap-1 mt-1">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`w-3 h-3 rounded-full border-2 transition-colors ${
            n <= faltas ? 'bg-red-500 border-red-500' : 'border-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

interface EquipoPanelProps {
  equipo: Equipo;
  titulares: JugadorEnPartido[];
  suplentes: JugadorEnPartido[];
  jugadorSeleccionado: JugadorEnPartido | null;
  onSeleccionarJugador: (j: JugadorEnPartido | null) => void;
  onPunto: (valor: 1 | 2 | 3) => void;
  onFalta: () => void;
  onTiempoMuerto: () => void;
  onSustitucion: (entrando: JugadorEnPartido, saliendo: JugadorEnPartido) => void;
  tiemposUsados: number;
  tiemposMaximo: number;
  modoDescontar: boolean;
  procesando: boolean;
  cuartoActual: number;
  onUltimos2Min: () => void;
  ultimos2MinActivo: boolean;
}

function EquipoPanel({
  equipo,
  titulares,
  suplentes,
  jugadorSeleccionado,
  onSeleccionarJugador,
  onPunto,
  onFalta,
  onTiempoMuerto,
  onSustitucion,
  tiemposUsados,
  tiemposMaximo,
  modoDescontar,
  procesando,
  cuartoActual,
  onUltimos2Min,
  ultimos2MinActivo
}: EquipoPanelProps) {
  const [modoSustitucion, setModoSustitucion] = useState(false);
  const [jugadorSaliendo, setJugadorSaliendo] = useState<JugadorEnPartido | null>(null);

  const handleClickTitular = (jugador: JugadorEnPartido) => {
    if (modoSustitucion) {
      setJugadorSaliendo(jugador);
    } else {
      onSeleccionarJugador(jugadorSeleccionado?.id === jugador.id ? null : jugador);
    }
  };

  const handleClickSuplente = (jugador: JugadorEnPartido) => {
    if (modoSustitucion && jugadorSaliendo) {
      onSustitucion(jugador, jugadorSaliendo);
      setModoSustitucion(false);
      setJugadorSaliendo(null);
    }
  };

  const tiemposDisponibles = tiemposMaximo - tiemposUsados;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      {/* Nombre equipo */}
      <h2 className="text-lg font-bold text-white text-center mb-3">
        {equipo.nombre_corto || equipo.nombre}
      </h2>
      
      {/* Titulares */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {titulares.map(jugador => (
          <button
            key={jugador.id}
            onClick={() => handleClickTitular(jugador)}
            disabled={jugador.faltas >= 5 && !modoDescontar}
            className={`p-2 rounded-lg border-2 transition-all text-center ${
              jugador.faltas >= 5
                ? 'bg-red-900/30 border-red-800 opacity-50'
                : modoSustitucion && jugadorSaliendo?.id === jugador.id
                  ? 'bg-yellow-900 border-yellow-500 ring-2 ring-yellow-400'
                  : modoSustitucion
                    ? 'bg-gray-700 border-yellow-600 hover:border-yellow-500'
                    : jugador.faltas === 4
                      ? 'bg-yellow-900/30 border-yellow-600'
                      : jugadorSeleccionado?.id === jugador.id
                        ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                        : 'bg-gray-700 border-gray-600 hover:border-gray-500'
            }`}
          >
            <div className="text-xl font-bold text-white">{jugador.numero_camiseta}</div>
            <div className="text-xs text-gray-400 truncate">{jugador.apellido}</div>
            <div className="text-xs mt-1">
              {jugador.puntos > 0 && <span className="text-green-400">{jugador.puntos}p </span>}
              {jugador.faltas > 0 && <span className="text-red-400">{jugador.faltas}f</span>}
            </div>
          </button>
        ))}
      </div>
      
      {/* Botones de acción */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <button
          onClick={() => onPunto(1)}
          disabled={!jugadorSeleccionado || procesando}
          className={`py-3 font-bold rounded-lg transition-colors ${
            modoDescontar
              ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700'
              : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-700'
          } text-white disabled:text-gray-500`}
        >
          {modoDescontar ? '-1' : '+1'}
        </button>
        <button
          onClick={() => onPunto(2)}
          disabled={!jugadorSeleccionado || procesando}
          className={`py-3 font-bold rounded-lg transition-colors ${
            modoDescontar
              ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700'
              : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-700'
          } text-white disabled:text-gray-500`}
        >
          {modoDescontar ? '-2' : '+2'}
        </button>
        <button
          onClick={() => onPunto(3)}
          disabled={!jugadorSeleccionado || procesando}
          className={`py-3 font-bold rounded-lg transition-colors ${
            modoDescontar
              ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700'
              : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-700'
          } text-white disabled:text-gray-500`}
        >
          {modoDescontar ? '-3' : '+3'}
        </button>
        <button
          onClick={onFalta}
          disabled={!jugadorSeleccionado || procesando}
          className={`py-3 font-bold rounded-lg transition-colors ${
            modoDescontar
              ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700'
              : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-700'
          } text-white disabled:text-gray-500`}
        >
          {modoDescontar ? '-F' : 'FALTA'}
        </button>
        <button
          onClick={onTiempoMuerto}
          disabled={procesando || (!modoDescontar && tiemposDisponibles <= 0)}
          className={`py-3 font-bold rounded-lg transition-colors text-xs ${
            modoDescontar
              ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700'
              : 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700'
          } text-white disabled:text-gray-500`}
        >
          {modoDescontar ? '-T' : `T (${tiemposDisponibles})`}
        </button>
      </div>
      
      {/* Regla 2 minutos (solo Q4) */}
      {cuartoActual === 4 && !ultimos2MinActivo && tiemposUsados === 0 && (
        <button
          onClick={onUltimos2Min}
          className="w-full py-2 mb-3 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg"
        >
          ⏱ Últimos 2 min (pierde 1 tiempo)
        </button>
      )}
      
      {/* Botón sustitución */}
      <button
        onClick={() => {
          setModoSustitucion(!modoSustitucion);
          setJugadorSaliendo(null);
        }}
        className={`w-full py-2 mb-3 font-bold rounded-lg transition-colors ${
          modoSustitucion
            ? 'bg-yellow-600 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        }`}
      >
        {modoSustitucion ? '✕ Cancelar Sustitución' : '⇄ Sustitución'}
      </button>
      
      {/* Instrucción sustitución */}
      {modoSustitucion && (
        <div className="text-xs text-yellow-400 text-center mb-2">
          {jugadorSaliendo 
            ? `Seleccioná el suplente que entra por #${jugadorSaliendo.numero_camiseta}`
            : 'Seleccioná el titular que sale'
          }
        </div>
      )}
      
      {/* Suplentes */}
      <div className="text-sm text-gray-400 mb-2">Suplentes:</div>
      <div className="grid grid-cols-5 gap-2">
        {suplentes.map(jugador => (
          <button
            key={jugador.id}
            onClick={() => handleClickSuplente(jugador)}
            disabled={!modoSustitucion || !jugadorSaliendo}
            className={`p-2 rounded-lg border-2 transition-all text-center ${
              modoSustitucion && jugadorSaliendo
                ? 'bg-gray-700 border-green-600 hover:border-green-500 hover:bg-green-900/30'
                : 'bg-gray-800 border-gray-700 opacity-60'
            }`}
          >
            <div className="text-lg font-bold text-white">{jugador.numero_camiseta}</div>
            <div className="text-xs text-gray-400 truncate">{jugador.apellido}</div>
            {(jugador.puntos > 0 || jugador.faltas > 0) && (
              <div className="text-xs mt-1">
                {jugador.puntos > 0 && <span className="text-green-400">{jugador.puntos}p </span>}
                {jugador.faltas > 0 && <span className="text-red-400">{jugador.faltas}f</span>}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
