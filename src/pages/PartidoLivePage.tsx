import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { 
  getPartidoCompleto, 
  iniciarPartido, 
  registrarAccion,
  registrarAccionSistema,
  cambiarCuarto,
  finalizarPartido,
  suspenderPartido,
  suscribirseAPartido,
  actualizarTiemposMuertos,
  registrarSustitucion
} from '../services/partido.service';
import {
  isOnline,
  onConnectionChange,
  addToOfflineQueue,
  getOfflineQueue,
  syncOfflineQueue
} from '../services/offlineQueue';
import { LogAcciones } from '../components/common/LogAcciones';
import { getEntrenadoresByClub } from '../services/club.service';
import type {
  Partido,
  Equipo,
  JugadorEnPartido,
  TipoAccion,
  EntrenadorEstado,
  TipoFaltaEntrenador,
  Entrenador
} from '../types';

type Fase = 'cargando' | 'seleccion-citados' | 'seleccion-titulares' | 'en-juego' | 'finalizado';

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
  
  // Citados (IDs de los 12 jugadores citados para el partido)
  const [citadosLocal, setCitadosLocal] = useState<Set<string>>(new Set());
  const [citadosVisitante, setCitadosVisitante] = useState<Set<string>>(new Set());

  // Entrenadores
  const [entrenadoresLocal, setEntrenadoresLocal] = useState<Entrenador[]>([]);
  const [entrenadoresVisitante, setEntrenadoresVisitante] = useState<Entrenador[]>([]);
  const [entrenadoresSeleccionadosLocal, setEntrenadoresSeleccionadosLocal] = useState<Set<string>>(new Set());
  const [entrenadoresSeleccionadosVisitante, setEntrenadoresSeleccionadosVisitante] = useState<Set<string>>(new Set());
  
  // Estado de UI
  const [fase, setFase] = useState<Fase>('cargando');
  const [jugadorSeleccionadoLocal, setJugadorSeleccionadoLocal] = useState<JugadorEnPartido | null>(null);
  const [jugadorSeleccionadoVisitante, setJugadorSeleccionadoVisitante] = useState<JugadorEnPartido | null>(null);
  const [modoDescontar, setModoDescontar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarConfirmacionFin, setMostrarConfirmacionFin] = useState(false);
  const [mostrarConfirmacionSalir, setMostrarConfirmacionSalir] = useState(false);
  const [mostrarSuspender, setMostrarSuspender] = useState(false);
  const [observacionesSuspension, setObservacionesSuspension] = useState('');
  
  // Modal de falta
  const [mostrarModalFalta, setMostrarModalFalta] = useState(false);
  const [faltaEsLocal, setFaltaEsLocal] = useState(true);
  const [tipoFaltaSeleccionado, setTipoFaltaSeleccionado] = useState<'FALTA_PERSONAL' | 'FALTA_TECNICA' | 'FALTA_ANTIDEPORTIVA' | 'FALTA_DESCALIFICANTE'>('FALTA_PERSONAL');
  const [tirosLibres, setTirosLibres] = useState(0);
  
  // Modal de alerta (5ta falta, expulsión, descalificación)
  const [mostrarAlertaFalta, setMostrarAlertaFalta] = useState(false);
  const [tipoAlerta, setTipoAlerta] = useState<'5F' | 'EXPULSADO' | 'DESCALIFICADO'>('5F');
  const [jugadorAlerta, setJugadorAlerta] = useState<string>('');
  
  // Editar número de camiseta
  const [mostrarEditarNumero, setMostrarEditarNumero] = useState(false);
  const [jugadorEditando, setJugadorEditando] = useState<JugadorEnPartido | null>(null);
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [esLocalEditando, setEsLocalEditando] = useState(true);
  
  const [ultimos2MinLocal, setUltimos2MinLocal] = useState(false);
  const [ultimos2MinVisitante, setUltimos2MinVisitante] = useState(false);
  
  // Estado del entrenador
  const [entrenadorLocal, setEntrenadorLocal] = useState<EntrenadorEstado>({
    faltasTecnicasEntrenador: 0,
    faltasTecnicasBanco: 0,
    expulsadoDirecto: false,
    descalificado: false,
  });
  const [entrenadorVisitante, setEntrenadorVisitante] = useState<EntrenadorEstado>({
    faltasTecnicasEntrenador: 0,
    faltasTecnicasBanco: 0,
    expulsadoDirecto: false,
    descalificado: false,
  });
  const [mostrarModalEntrenador, setMostrarModalEntrenador] = useState(false);
  const [entrenadorEsLocal, setEntrenadorEsLocal] = useState(true);
  
  // Estado de conexión y cola offline
  const [online, setOnline] = useState(isOnline());
  const [pendientes, setPendientes] = useState(getOfflineQueue().length);
  const [sincronizando, setSincronizando] = useState(false);

  // Cargar datos del partido
  useEffect(() => {
    if (!id) return;

    // 🛡️ Bandera para saber si el componente sigue vivo
    let isMounted = true;

    async function cargarPartido() {
      try {
        const data = await getPartidoCompleto(id!);

        // Solo actualizamos el estado si el usuario sigue en esta pantalla
        if (isMounted) {
          setPartido(data.partido);
          setEquipoLocal(data.equipoLocal);
          setEquipoVisitante(data.equipoVisitante);
          setJugadoresLocal(data.jugadoresLocal);
          setJugadoresVisitante(data.jugadoresVisitante);

          // === Cargar entrenadores (Ahora dentro del check de isMounted) ===
          try {
            const entrenadoresL = await getEntrenadoresByClub(data.partido.equipo_local_id);
            if (isMounted) setEntrenadoresLocal(entrenadoresL);
          } catch (error) {
            console.error('❌ Error cargando entrenadores locales:', error);
            if (isMounted) setEntrenadoresLocal([]);
          }

          try {
            const entrenadoresV = await getEntrenadoresByClub(data.partido.equipo_visitante_id);
            if (isMounted) setEntrenadoresVisitante(entrenadoresV);
          } catch (error) {
            console.error('❌ Error cargando entrenadores visitantes:', error);
            if (isMounted) setEntrenadoresVisitante([]);
          }

          // === Lógica de Estado (Mantenemos la lógica original) ===
          if (data.partido.estado === 'PROGRAMADO') {
            const necesitaCitadosLocal = data.jugadoresLocal.length > 12;
            const necesitaCitadosVisitante = data.jugadoresVisitante.length > 12;

            if (necesitaCitadosLocal || necesitaCitadosVisitante) {
              setFase('seleccion-citados');
              if (!necesitaCitadosLocal) setCitadosLocal(new Set(data.jugadoresLocal.map(j => j.id)));
              if (!necesitaCitadosVisitante) setCitadosVisitante(new Set(data.jugadoresVisitante.map(j => j.id)));
            } else {
              setCitadosLocal(new Set(data.jugadoresLocal.map(j => j.id)));
              setCitadosVisitante(new Set(data.jugadoresVisitante.map(j => j.id)));
              setFase('seleccion-titulares');
            }
          } else if (data.partido.estado === 'EN_CURSO') {
            // Función auxiliar para recuperar titulares
            const obtenerTitulares = (jugadores: JugadorEnPartido[]) => {
              const titulares = jugadores.filter(j => j.es_titular);
              if (titulares.length === 5) return new Set(titulares.map(j => j.id));
              const participaron = jugadores.filter(j => j.participo);
              if (participaron.length >= 5) return new Set(participaron.slice(0, 5).map(j => j.id));
              const ids = new Set(participaron.map(j => j.id));
              for (const j of jugadores) {
                if (ids.size >= 5) break;
                ids.add(j.id);
              }
              return ids;
            };

            setCitadosLocal(new Set(data.jugadoresLocal.slice(0, 12).map(j => j.id)));
            setCitadosVisitante(new Set(data.jugadoresVisitante.slice(0, 12).map(j => j.id)));
            setTitularesLocal(obtenerTitulares(data.jugadoresLocal));
            setTitularesVisitante(obtenerTitulares(data.jugadoresVisitante));
            setFase('en-juego');
          } else {
            setFase('finalizado');
          }
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Error al cargar partido');
      }
    }

    cargarPartido();

    return () => { isMounted = false; };
  }, [id]);

  // Cargar estado de faltas del entrenador
  useEffect(() => {
    // ⚠️ Ahora esperamos a que los equipos estén cargados
    if (!id || !equipoLocal?.id || !equipoVisitante?.id) return;

    let isMounted = true;

    async function cargarFaltasEntrenador() {
      try {
        const { data: acciones } = await supabase
          .from('acciones')
          .select('equipo_id, tipo')
          .eq('partido_id', id)
          .eq('anulada', false)
          .in('tipo', ['FALTA_TECNICA_ENTRENADOR', 'FALTA_TECNICA_BANCO', 'FALTA_DESCALIFICANTE_ENTRENADOR']);

        if (acciones && isMounted) {
          const faltasLocal = acciones.filter(a => a.equipo_id === equipoLocal!.id);
          const faltasVisitante = acciones.filter(a => a.equipo_id === equipoVisitante!.id);

          // Lógica entrenador LOCAL
          const ftEntrenadorLocal = faltasLocal.filter(a => a.tipo === 'FALTA_TECNICA_ENTRENADOR').length;
          const ftBancoLocal = faltasLocal.filter(a => a.tipo === 'FALTA_TECNICA_BANCO').length;
          const expulsadoDirectoLocal = faltasLocal.some(a => a.tipo === 'FALTA_DESCALIFICANTE_ENTRENADOR');
          const descalificadoLocal = expulsadoDirectoLocal || ftEntrenadorLocal >= 2 || (ftEntrenadorLocal + ftBancoLocal) >= 3;

          if (isMounted) {
            setEntrenadorLocal({
              faltasTecnicasEntrenador: ftEntrenadorLocal,
              faltasTecnicasBanco: ftBancoLocal,
              expulsadoDirecto: expulsadoDirectoLocal,
              descalificado: descalificadoLocal,
            });
          }

          // Lógica entrenador VISITANTE
          const ftEntrenadorVisitante = faltasVisitante.filter(a => a.tipo === 'FALTA_TECNICA_ENTRENADOR').length;
          const ftBancoVisitante = faltasVisitante.filter(a => a.tipo === 'FALTA_TECNICA_BANCO').length;
          const expulsadoDirectoVisitante = faltasVisitante.some(a => a.tipo === 'FALTA_DESCALIFICANTE_ENTRENADOR');
          const descalificadoVisitante = expulsadoDirectoVisitante || ftEntrenadorVisitante >= 2 || (ftEntrenadorVisitante + ftBancoVisitante) >= 3;

          if (isMounted) {
            setEntrenadorVisitante({
              faltasTecnicasEntrenador: ftEntrenadorVisitante,
              faltasTecnicasBanco: ftBancoVisitante,
              expulsadoDirecto: expulsadoDirectoVisitante,
              descalificado: descalificadoVisitante,
            });
          }
        }
      } catch (err) {
        console.error('Error cargando faltas del entrenador:', err);
      }
    }

    cargarFaltasEntrenador();

    return () => { isMounted = false; };
  }, [id, equipoLocal?.id, equipoVisitante?.id]); // ✅ Dependencias corregidas

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!id) return;

    // Guardamos la función de limpieza que nos devuelve el servicio
    const unsubscribe = suscribirseAPartido(id!, (cambios) => {
      setPartido(prev => prev ? { ...prev, ...cambios } : null);
    });

    // React ejecutará esto al desmontar o si cambia el ID
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [id]);

  // Detectar cambios de conexión
  useEffect(() => {
    const unsubscribe = onConnectionChange((isOnlineNow) => {
      setOnline(isOnlineNow);

      // Sincronizar cuando vuelve la conexión
      if (isOnlineNow && getOfflineQueue().length > 0) {
        handleSyncOffline();
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔌 Reconectar Supabase Realtime cuando la app vuelve de estar minimizada
  useEffect(() => {
    if (!id) return;

    const handleVisibilityChange = async () => {
      // Solo actuar cuando la página vuelve a ser visible
      if (document.visibilityState !== 'visible') return;

      console.log('👀 PartidoLivePage: App vuelve a ser visible');

      // 1. Verificar estado del WebSocket de Supabase Realtime
      const connectionState = supabase.realtime.connectionState() as string;
      console.log(`🔌 Estado de Realtime: ${connectionState}`);

      // 2. Reconectar WebSocket si está cerrado
      if (connectionState !== 'open') {
        console.log('🔄 Reconectando Supabase Realtime...');
        supabase.realtime.connect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 3. Verificar cliente HTTP (sin auto-reload)
      console.log('🔄 Verificando cliente HTTP con query a BD...');
      try {
        const { error: errorPing } = await supabase
          .from('partidos')
          .select('id, estado')
          .eq('id', id)
          .single();

        if (errorPing) {
          console.error('❌ Error en ping a BD:', errorPing);
        } else {
          console.log('✅ Cliente HTTP verificado');
        }
      } catch (err) {
        console.error('❌ Error verificando cliente HTTP:', err);
      }

      // 4. Recargar datos completos solo si el WebSocket estaba cerrado
      if (connectionState !== 'open') {
        console.log('🔄 Recargando datos del partido...');
        try {
          const data = await getPartidoCompleto(id);
          setPartido(data.partido);
          setEquipoLocal(data.equipoLocal);
          setEquipoVisitante(data.equipoVisitante);
          setJugadoresLocal(data.jugadoresLocal);
          setJugadoresVisitante(data.jugadoresVisitante);
          console.log('✅ Datos recargados exitosamente');
        } catch (err) {
          console.error('❌ Error recargando datos:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id]);

  // Sincronizar cola offline
  const handleSyncOffline = async () => {
    if (sincronizando) return;
    
    setSincronizando(true);
    try {
      const result = await syncOfflineQueue();
      setPendientes(getOfflineQueue().length);
      
      if (result.success > 0 && id) {
        // Recargar datos del partido después de sincronizar
        const data = await getPartidoCompleto(id);
        setPartido(data.partido);
        setJugadoresLocal(data.jugadoresLocal);
        setJugadoresVisitante(data.jugadoresVisitante);
      }
    } catch (err) {
      console.error('Error sincronizando:', err);
    } finally {
      setSincronizando(false);
    }
  };

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

  // Abrir modal para editar número de camiseta
  const abrirEditarNumero = (jugador: JugadorEnPartido, esLocal: boolean) => {
    setJugadorEditando(jugador);
    setNuevoNumero(jugador.numero_camiseta.toString());
    setEsLocalEditando(esLocal);
    setMostrarEditarNumero(true);
  };

  // Guardar nuevo número de camiseta
  const guardarNumero = () => {
    if (!jugadorEditando || !nuevoNumero) return;
    
    const numero = parseInt(nuevoNumero);
    if (isNaN(numero) || numero < 0 || numero > 99) {
      setError('Número inválido (0-99)');
      setTimeout(() => setError(null), 2000);
      return;
    }
    
    const setJugadores = esLocalEditando ? setJugadoresLocal : setJugadoresVisitante;
    setJugadores(prev => prev.map(j => 
      j.id === jugadorEditando.id ? { ...j, numero_camiseta: numero } : j
    ));
    
    setMostrarEditarNumero(false);
    setJugadorEditando(null);
  };

  // Iniciar el partido
  const handleIniciarPartido = async () => {
    if (!id || titularesLocal.size !== 5 || titularesVisitante.size !== 5) {
      setError('Debés seleccionar 5 titulares por equipo');
      return;
    }

    if (!equipoLocal || !equipoVisitante) {
      setError('Error: equipos no cargados');
      return;
    }

    // Verificar si algún equipo tiene menos de 5 jugadores citados
    const mensajesAdvertencia: string[] = [];
    if (citadosLocal.size < 5) {
      mensajesAdvertencia.push(`${equipoLocal.nombre_corto || equipoLocal.nombre} no completa el mínimo de jugadores necesarios (${citadosLocal.size}/5)`);
    }
    if (citadosVisitante.size < 5) {
      mensajesAdvertencia.push(`${equipoVisitante.nombre_corto || equipoVisitante.nombre} no completa el mínimo de jugadores necesarios (${citadosVisitante.size}/5)`);
    }

    if (mensajesAdvertencia.length > 0) {
      const mensaje = mensajesAdvertencia.join('\n');
      if (!confirm(`ADVERTENCIA:\n\n${mensaje}\n\n¿Desea continuar de todas formas?`)) {
        return;
      }
    }

    setProcesando(true);
    try {
      await iniciarPartido(id);

      // Guardar entrenadores seleccionados (primer entrenador de cada equipo)
      const entrenadorLocalId = entrenadoresSeleccionadosLocal.size > 0
        ? Array.from(entrenadoresSeleccionadosLocal)[0]
        : null;
      const entrenadorVisitanteId = entrenadoresSeleccionadosVisitante.size > 0
        ? Array.from(entrenadoresSeleccionadosVisitante)[0]
        : null;

      if (entrenadorLocalId || entrenadorVisitanteId) {
        const updates: any = {};
        if (entrenadorLocalId) updates.entrenador_local_id = entrenadorLocalId;
        if (entrenadorVisitanteId) updates.entrenador_visitante_id = entrenadorVisitanteId;

        await supabase
          .from('partidos')
          .update(updates)
          .eq('id', id);
      }

      setPartido(prev => prev ? { ...prev, estado: 'EN_CURSO', cuarto_actual: 1 } : null);
      setFase('en-juego');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar partido');
    } finally {
      setProcesando(false);
    }
  };

  // Sustitución
  const handleSustitucionMultiple = async (sustituciones: Array<{ entrando: JugadorEnPartido; saliendo: JugadorEnPartido }>, esLocal: boolean) => {
    const setTitulares = esLocal ? setTitularesLocal : setTitularesVisitante;
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    
    setTitulares(prev => {
      const nuevoSet = new Set(prev);
      sustituciones.forEach(s => {
        nuevoSet.delete(s.saliendo.id);
        nuevoSet.add(s.entrando.id);
      });
      return nuevoSet;
    });
    
    // Limpiar selección
    if (esLocal) {
      setJugadorSeleccionadoLocal(null);
    } else {
      setJugadorSeleccionadoVisitante(null);
    }

    // Registrar sustituciones en el log
    if (id && partido && equipoId) {
      try {
        await registrarSustitucion(id, equipoId, partido.cuarto_actual, 
          sustituciones.map(s => ({ jugadorEntraId: s.entrando.id, jugadorSaleId: s.saliendo.id }))
        );
      } catch (err) {
        console.error('Error registrando sustitución:', err);
      }
    }
  };

  // Registrar punto
  const handlePunto = async (valor: 1 | 2 | 3, esLocal: boolean) => {
    const jugador = esLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
    if (!id || !partido || !jugador) return;
    
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;

    // Validar que el jugador tenga suficientes puntos para descontar
    if (modoDescontar && jugador.puntos < valor) {
      setError(`${jugador.apellido} no tiene ${valor} puntos para descontar`);
      setTimeout(() => setError(null), 2000);
      return;
    }

    const valorReal = modoDescontar ? -valor : valor;
    const tipo: TipoAccion = valor === 1 ? 'PUNTO_1' : valor === 2 ? 'PUNTO_2' : 'PUNTO_3';

    // Calcular nuevo resultado parcial
    const nuevoPuntosLocal = esLocal ? partido.puntos_local + valorReal : partido.puntos_local;
    const nuevoPuntosVisitante = !esLocal ? partido.puntos_visitante + valorReal : partido.puntos_visitante;

    // Actualizar UI optimista inmediatamente
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
    
    if (modoDescontar) setModoDescontar(false);

    // Si está offline, guardar en cola
    if (!online) {
      addToOfflineQueue(id, equipoId, jugador.id, tipo, partido.cuarto_actual, modoDescontar);
      setPendientes(getOfflineQueue().length);
      return;
    }

    // Si está online, enviar al servidor con resultado parcial
    setProcesando(true);
    try {
      await registrarAccion(id, equipoId, jugador.id, tipo, partido.cuarto_actual, modoDescontar, 0, null, nuevoPuntosLocal, nuevoPuntosVisitante);
    } catch {
      // Si falla, agregar a la cola offline
      addToOfflineQueue(id, equipoId, jugador.id, tipo, partido.cuarto_actual, modoDescontar);
      setPendientes(getOfflineQueue().length);
    } finally {
      setProcesando(false);
    }
  };

  // Abrir modal de falta
  const handleFalta = (esLocal: boolean) => {
    const jugador = esLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
    if (!partido || !jugador) return;
    
    // Si está en modo descontar, verificar que tenga alguna falta
    if (modoDescontar) {
      const totalFaltas = jugador.faltas + jugador.faltas_tecnicas + jugador.faltas_antideportivas;
      if (totalFaltas <= 0) {
        setError(`${jugador.apellido} no tiene faltas para descontar`);
        setTimeout(() => setError(null), 2000);
        return;
      }
    }
    
    // Abrir modal para seleccionar tipo de falta
    setFaltaEsLocal(esLocal);
    setTipoFaltaSeleccionado('FALTA_PERSONAL');
    setTirosLibres(0);
    setMostrarModalFalta(true);
  };

  // Confirmar y registrar falta
  const handleConfirmarFalta = async (
    esLocal: boolean, 
    tipoFalta: 'FALTA_PERSONAL' | 'FALTA_TECNICA' | 'FALTA_ANTIDEPORTIVA' | 'FALTA_DESCALIFICANTE',
    tiros: number,
    esDescuento: boolean = false
  ) => {
    const jugador = esLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
    if (!id || !partido || !jugador) return;
    
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;

    // Obtener valores actuales del jugador desde el estado
    const jugadores = esLocal ? jugadoresLocal : jugadoresVisitante;
    const jugadorActual = jugadores.find(j => j.id === jugador.id);
    if (!jugadorActual) return;

    const delta = esDescuento ? -1 : 1;
    
    // Calcular nuevos valores
    // IMPORTANTE: faltas = total de todas las faltas (personales + técnicas + antideportivas)
    let nuevasFaltas = jugadorActual.faltas;
    let nuevasFaltasTecnicas = jugadorActual.faltas_tecnicas;
    let nuevasFaltasAntideportivas = jugadorActual.faltas_antideportivas;
    let nuevoExpulsadoDirecto = jugadorActual.expulsado_directo;
    let quedaDescalificado = jugadorActual.descalificado;
    
    // Calcular número de falta (para el log)
    let numeroFalta: number | null = null;
    
    if (esDescuento) {
      // Descontar según tipo - TODAS las faltas descuentan del total
      if (tipoFalta === 'FALTA_PERSONAL') {
        nuevasFaltas = Math.max(0, nuevasFaltas - 1);
      } else if (tipoFalta === 'FALTA_TECNICA') {
        nuevasFaltasTecnicas = Math.max(0, nuevasFaltasTecnicas - 1);
        nuevasFaltas = Math.max(0, nuevasFaltas - 1); // También resta del total
      } else if (tipoFalta === 'FALTA_ANTIDEPORTIVA') {
        nuevasFaltasAntideportivas = Math.max(0, nuevasFaltasAntideportivas - 1);
        nuevasFaltas = Math.max(0, nuevasFaltas - 1); // También resta del total
      } else if (tipoFalta === 'FALTA_DESCALIFICANTE') {
        nuevoExpulsadoDirecto = false;
        quedaDescalificado = false;
      }
      
      // Al descontar, verificar si el jugador puede desbloquearse
      // Ya no tiene 5 faltas Y ya no está descalificado por acumulación
      if (tipoFalta !== 'FALTA_DESCALIFICANTE') {
        const yaSinDescalificacion = !(
          nuevasFaltasTecnicas >= 2 || 
          nuevasFaltasAntideportivas >= 2 || 
          (nuevasFaltasTecnicas >= 1 && nuevasFaltasAntideportivas >= 1)
        );
        if (yaSinDescalificacion && !nuevoExpulsadoDirecto) {
          quedaDescalificado = false;
        }
      }
    } else {
      // Sumar falta - TODAS las faltas suman al total
      nuevasFaltas += 1;
      numeroFalta = nuevasFaltas; // Número de falta es el total
      
      if (tipoFalta === 'FALTA_TECNICA') {
        nuevasFaltasTecnicas += 1;
      } else if (tipoFalta === 'FALTA_ANTIDEPORTIVA') {
        nuevasFaltasAntideportivas += 1;
      } else if (tipoFalta === 'FALTA_DESCALIFICANTE') {
        nuevoExpulsadoDirecto = true;
        quedaDescalificado = true;
      }
      
      // Reglas de descalificación por acumulación:
      // - 2 técnicas
      // - 2 antideportivas  
      // - 1 técnica + 1 antideportiva
      if (!nuevoExpulsadoDirecto && (
          nuevasFaltasTecnicas >= 2 || 
          nuevasFaltasAntideportivas >= 2 || 
          (nuevasFaltasTecnicas >= 1 && nuevasFaltasAntideportivas >= 1))) {
        quedaDescalificado = true;
      }
    }
    
    // Actualizar UI optimista inmediatamente
    const actualizarJugadores = (jugadoresArr: JugadorEnPartido[]) =>
      jugadoresArr.map(j => 
        j.id === jugador.id ? { 
          ...j, 
          faltas: nuevasFaltas,
          faltas_tecnicas: nuevasFaltasTecnicas,
          faltas_antideportivas: nuevasFaltasAntideportivas,
          descalificado: quedaDescalificado,
          expulsado_directo: nuevoExpulsadoDirecto,
          participo: true 
        } : j
      );
    
    // Solo sumar falta de equipo para falta personal
    const actualizarFaltasEquipo = (faltas: number[]) => {
      if (tipoFalta !== 'FALTA_PERSONAL') return faltas;
      const nuevasFaltasEquipo = [...faltas];
      const idx = Math.max(0, partido.cuarto_actual - 1);
      nuevasFaltasEquipo[idx] = Math.max(0, (nuevasFaltasEquipo[idx] || 0) + delta);
      return nuevasFaltasEquipo;
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
    
    if (esDescuento) setModoDescontar(false);
    setMostrarModalFalta(false);

    // Mostrar alertas según el caso (solo si no es descuento)
    if (!esDescuento) {
      // 5ta falta personal
      if (tipoFalta === 'FALTA_PERSONAL' && nuevasFaltas === 5 && !quedaDescalificado) {
        setJugadorAlerta(jugador.apellido);
        setTipoAlerta('5F');
        setMostrarAlertaFalta(true);
      }
      // Expulsión directa
      else if (tipoFalta === 'FALTA_DESCALIFICANTE') {
        setJugadorAlerta(jugador.apellido);
        setTipoAlerta('EXPULSADO');
        setMostrarAlertaFalta(true);
      }
      // Descalificación por acumulación (solo si no estaba ya descalificado)
      else if (quedaDescalificado && !jugadorActual.descalificado) {
        setJugadorAlerta(jugador.apellido);
        setTipoAlerta('DESCALIFICADO');
        setMostrarAlertaFalta(true);
      }
    }

    // Si está offline, guardar en cola
    if (!online) {
      addToOfflineQueue(id, equipoId, jugador.id, tipoFalta, partido.cuarto_actual, esDescuento);
      setPendientes(getOfflineQueue().length);
      return;
    }

    // Si está online, enviar al servidor
    setProcesando(true);
    try {
      await registrarAccion(id, equipoId, jugador.id, tipoFalta, partido.cuarto_actual, esDescuento, tiros, numeroFalta);
    } catch {
      addToOfflineQueue(id, equipoId, jugador.id, tipoFalta, partido.cuarto_actual, esDescuento);
      setPendientes(getOfflineQueue().length);
    } finally {
      setProcesando(false);
    }
  };

  // Registrar tiempo muerto
  const handleTiempoMuerto = async (esLocal: boolean) => {
    if (!id || !partido) return;
    
    const tiempos = getTiemposDisponibles(esLocal);
    const tiemposUsados = esLocal ? partido.tiempos_muertos_local : partido.tiempos_muertos_visitante;
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    
    // Validar disponibilidad
    if (!modoDescontar && tiemposUsados >= tiempos.maximo) {
      setError('No hay tiempos muertos disponibles');
      return;
    }
    if (modoDescontar && tiemposUsados <= 0) {
      setError('No hay tiempos muertos para descontar');
      return;
    }

    if (!equipoId) return;

    setProcesando(true);
    try {
      const delta = modoDescontar ? -1 : 1;
      const nuevoValor = tiemposUsados + delta;
      
      await actualizarTiemposMuertos(id, esLocal, nuevoValor, equipoId, partido.cuarto_actual, modoDescontar);
      
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

  // Manejar falta al entrenador
  const handleFaltaEntrenador = async (
    tipoFalta: TipoFaltaEntrenador,
    esDescuento: boolean = false
  ) => {
    if (!id || !partido) return;
    
    const esLocal = entrenadorEsLocal;
    const equipoId = esLocal ? equipoLocal?.id : equipoVisitante?.id;
    if (!equipoId) return;
    
    const entrenador = esLocal ? entrenadorLocal : entrenadorVisitante;
    const setEntrenador = esLocal ? setEntrenadorLocal : setEntrenadorVisitante;
    
    // Calcular nuevos valores
    let nuevosFTEntrenador = entrenador.faltasTecnicasEntrenador;
    let nuevosFTBanco = entrenador.faltasTecnicasBanco;
    let nuevoExpulsado = entrenador.expulsadoDirecto;
    let nuevoDescalificado = entrenador.descalificado;
    
    if (esDescuento) {
      if (tipoFalta === 'FALTA_TECNICA_ENTRENADOR') {
        nuevosFTEntrenador = Math.max(0, nuevosFTEntrenador - 1);
      } else if (tipoFalta === 'FALTA_TECNICA_BANCO') {
        nuevosFTBanco = Math.max(0, nuevosFTBanco - 1);
      } else if (tipoFalta === 'FALTA_DESCALIFICANTE_ENTRENADOR') {
        nuevoExpulsado = false;
        nuevoDescalificado = false;
      }
      
      // Verificar si puede desbloquearse
      if (!nuevoExpulsado) {
        const totalFT = nuevosFTEntrenador + nuevosFTBanco;
        if (nuevosFTEntrenador < 2 && totalFT < 3) {
          nuevoDescalificado = false;
        }
      }
    } else {
      if (tipoFalta === 'FALTA_TECNICA_ENTRENADOR') {
        nuevosFTEntrenador += 1;
      } else if (tipoFalta === 'FALTA_TECNICA_BANCO') {
        nuevosFTBanco += 1;
      } else if (tipoFalta === 'FALTA_DESCALIFICANTE_ENTRENADOR') {
        nuevoExpulsado = true;
        nuevoDescalificado = true;
      }
      
      // Reglas de descalificación:
      // - 2 F.T. al Entrenador
      // - Suma de 3 F.T. (banco + entrenador)
      const totalFT = nuevosFTEntrenador + nuevosFTBanco;
      if (nuevosFTEntrenador >= 2 || totalFT >= 3) {
        nuevoDescalificado = true;
      }
    }
    
    // Actualizar estado local
    setEntrenador({
      faltasTecnicasEntrenador: nuevosFTEntrenador,
      faltasTecnicasBanco: nuevosFTBanco,
      expulsadoDirecto: nuevoExpulsado,
      descalificado: nuevoDescalificado,
    });
    
    setMostrarModalEntrenador(false);
    if (esDescuento) setModoDescontar(false);
    
    // Mostrar alerta si quedó descalificado
    if (nuevoDescalificado && !entrenador.descalificado && !esDescuento) {
      setJugadorAlerta('ENTRENADOR');
      setTipoAlerta(nuevoExpulsado ? 'EXPULSADO' : 'DESCALIFICADO');
      setMostrarAlertaFalta(true);
    }
    
    // Registrar en la BD
    if (online) {
      setProcesando(true);
      try {
        await registrarAccion(id, equipoId, null, tipoFalta, partido.cuarto_actual, esDescuento);
      } catch (err) {
        console.error('Error registrando falta de entrenador:', err);
      } finally {
        setProcesando(false);
      }
    }
  };

  // Abrir modal de falta al entrenador
  const abrirModalEntrenador = (esLocal: boolean) => {
    setEntrenadorEsLocal(esLocal);
    setMostrarModalEntrenador(true);
  };

  // Cambiar cuarto
  const handleCambiarCuarto = async () => {
    if (!id || !partido || !equipoLocal) return;
    
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
      // Registrar FIN_CUARTO con resultado parcial (solo si no es descuento)
      if (!modoDescontar) {
        await registrarAccionSistema(id, equipoLocal.id, 'FIN_CUARTO', partido.cuarto_actual, partido.puntos_local, partido.puntos_visitante);
      }

      // Actualizar cuarto en BD
      await cambiarCuarto(id, nuevoCuarto);
      
      // Registrar INICIO_CUARTO (solo si no es descuento)
      if (!modoDescontar) {
        await registrarAccionSistema(id, equipoLocal.id, 'INICIO_CUARTO', nuevoCuarto);
      }
      
      // Si hay que resetear tiempos, actualizar en BD también (sin registrar en log)
      if (resetearTiempos) {
        const { error: e1 } = await supabase.from('partidos').update({ tiempos_muertos_local: 0 }).eq('id', id);
        const { error: e2 } = await supabase.from('partidos').update({ tiempos_muertos_visitante: 0 }).eq('id', id);
        if (e1 || e2) console.error('Error reseteando tiempos:', e1 || e2);
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

  // Verificar si el partido está empatado
  const estaEmpatado = partido?.puntos_local === partido?.puntos_visitante;

  // Finalizar partido
  const handleFinalizarPartido = async () => {
    if (!id || !partido) return;
    
    // No permitir finalizar si está empatado
    if (estaEmpatado) {
      setError('No se puede finalizar un partido empatado. Debe jugarse overtime.');
      setMostrarConfirmacionFin(false);
      setTimeout(() => setError(null), 3000);
      return;
    }
    
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

  const handleSuspenderPartido = async () => {
    if (!id || !partido) return;
    
    if (!observacionesSuspension.trim()) {
      setError('Debés ingresar las observaciones de la suspensión');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setProcesando(true);
    try {
      await suspenderPartido(id, observacionesSuspension.trim());
      navigate('/partidos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al suspender partido');
    } finally {
      setProcesando(false);
      setMostrarSuspender(false);
      setObservacionesSuspension('');
    }
  };

  // Componentes auxiliares - filtrar solo jugadores citados
  const jugadoresTitularesLocal = jugadoresLocal.filter(j => titularesLocal.has(j.id));
  const jugadoresSuplentesLocal = jugadoresLocal.filter(j => citadosLocal.has(j.id) && !titularesLocal.has(j.id));
  const jugadoresTitularesVisitante = jugadoresVisitante.filter(j => titularesVisitante.has(j.id));
  const jugadoresSuplentesVisitante = jugadoresVisitante.filter(j => citadosVisitante.has(j.id) && !titularesVisitante.has(j.id));

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

  // Función para toggle de citado
  const toggleCitado = (jugadorId: string, esLocal: boolean) => {
    const setCitados = esLocal ? setCitadosLocal : setCitadosVisitante;
    const citados = esLocal ? citadosLocal : citadosVisitante;

    const nuevosCitados = new Set(citados);
    if (nuevosCitados.has(jugadorId)) {
      nuevosCitados.delete(jugadorId);
    } else if (nuevosCitados.size < 12) {
      nuevosCitados.add(jugadorId);
    }
    setCitados(nuevosCitados);
  };

  // Función para toggle de entrenador
  const toggleEntrenador = (entrenadorId: string, esLocal: boolean) => {
    const setSeleccionados = esLocal ? setEntrenadoresSeleccionadosLocal : setEntrenadoresSeleccionadosVisitante;
    const seleccionados = esLocal ? entrenadoresSeleccionadosLocal : entrenadoresSeleccionadosVisitante;

    const nuevosSeleccionados = new Set(seleccionados);
    if (nuevosSeleccionados.has(entrenadorId)) {
      nuevosSeleccionados.delete(entrenadorId);
    } else {
      nuevosSeleccionados.add(entrenadorId);
    }
    setSeleccionados(nuevosSeleccionados);
  };

  // Selección de citados (1 a 12 por equipo)
  if (fase === 'seleccion-citados') {
    const localNecesitaSeleccion = jugadoresLocal.length > 12;
    const visitanteNecesitaSeleccion = jugadoresVisitante.length > 12;
    const puedeAvanzar = citadosLocal.size >= 1 && citadosLocal.size <= 12 &&
                         citadosVisitante.size >= 1 && citadosVisitante.size <= 12;
    
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        {/* Botón volver */}
        <button
          onClick={() => navigate('/partidos')}
          className="mb-4 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a partidos
        </button>
        
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Seleccionar Citados (1 a 12 por equipo)
        </h1>
        <p className="text-gray-400 text-center mb-6">
          Seleccione entre 1 y 12 jugadores que participarán del partido
        </p>
        
        <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Equipo Local */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              {equipoLocal.nombre_corto || equipoLocal.nombre}
              <span className={`ml-2 text-sm ${citadosLocal.size >= 1 && citadosLocal.size <= 12 ? 'text-green-400' : 'text-gray-400'}`}>
                ({citadosLocal.size}/12)
              </span>
            </h2>
            {localNecesitaSeleccion ? (
              <div className="grid grid-cols-4 gap-2">
                {jugadoresLocal.map(jugador => (
                  <button
                    key={jugador.id}
                    onClick={() => toggleCitado(jugador.id, true)}
                    disabled={!citadosLocal.has(jugador.id) && citadosLocal.size >= 12}
                    className={`p-2 rounded-xl border-2 transition-all ${
                      citadosLocal.has(jugador.id)
                        ? 'bg-green-900 border-green-500 ring-2 ring-green-400'
                        : citadosLocal.size >= 12
                          ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed'
                          : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-xl font-bold text-white">{jugador.numero_camiseta}</div>
                    <div className="text-[10px] text-gray-400 truncate">{jugador.apellido}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-green-400 py-4">
                ✓ Todos los jugadores citados automáticamente
              </div>
            )}
          </div>
          
          {/* Equipo Visitante */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              {equipoVisitante.nombre_corto || equipoVisitante.nombre}
              <span className={`ml-2 text-sm ${citadosVisitante.size >= 1 && citadosVisitante.size <= 12 ? 'text-green-400' : 'text-gray-400'}`}>
                ({citadosVisitante.size}/12)
              </span>
            </h2>
            {visitanteNecesitaSeleccion ? (
              <div className="grid grid-cols-4 gap-2">
                {jugadoresVisitante.map(jugador => (
                  <button
                    key={jugador.id}
                    onClick={() => toggleCitado(jugador.id, false)}
                    disabled={!citadosVisitante.has(jugador.id) && citadosVisitante.size >= 12}
                    className={`p-2 rounded-xl border-2 transition-all ${
                      citadosVisitante.has(jugador.id)
                        ? 'bg-green-900 border-green-500 ring-2 ring-green-400'
                        : citadosVisitante.size >= 12
                          ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed'
                          : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-xl font-bold text-white">{jugador.numero_camiseta}</div>
                    <div className="text-[10px] text-gray-400 truncate">{jugador.apellido}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-green-400 py-4">
                ✓ Todos los jugadores citados automáticamente
              </div>
            )}
          </div>
        </div>

        {/* Sección de Entrenadores */}
        <div className="mt-8 max-w-6xl mx-auto">
          <h2 className="text-xl font-bold text-white text-center mb-4">Seleccionar Entrenadores</h2>
          <p className="text-gray-400 text-center mb-6 text-sm">Seleccione los entrenadores que dirigirán el partido</p>

          <div className="grid grid-cols-2 gap-8">
            {/* Entrenadores Local */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3 text-center">
                {equipoLocal.nombre_corto || equipoLocal.nombre}
                <span className="ml-2 text-sm text-gray-400">
                  ({entrenadoresSeleccionadosLocal.size} seleccionado{entrenadoresSeleccionadosLocal.size !== 1 ? 's' : ''})
                </span>
              </h3>
              {entrenadoresLocal.length > 0 ? (
                <div className="space-y-2">
                  {entrenadoresLocal.map(entrenador => (
                    <button
                      key={entrenador.id}
                      onClick={() => toggleEntrenador(entrenador.id, true)}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                        entrenadoresSeleccionadosLocal.has(entrenador.id)
                          ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                          : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">👔</div>
                        <div>
                          <div className="text-white font-medium">{entrenador.nombre} {entrenador.apellido}</div>
                          {entrenador.licencia && <div className="text-xs text-gray-400">Lic: {entrenador.licencia}</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4 text-sm">
                  No hay entrenadores registrados para este equipo
                </div>
              )}
            </div>

            {/* Entrenadores Visitante */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3 text-center">
                {equipoVisitante.nombre_corto || equipoVisitante.nombre}
                <span className="ml-2 text-sm text-gray-400">
                  ({entrenadoresSeleccionadosVisitante.size} seleccionado{entrenadoresSeleccionadosVisitante.size !== 1 ? 's' : ''})
                </span>
              </h3>
              {entrenadoresVisitante.length > 0 ? (
                <div className="space-y-2">
                  {entrenadoresVisitante.map(entrenador => (
                    <button
                      key={entrenador.id}
                      onClick={() => toggleEntrenador(entrenador.id, false)}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                        entrenadoresSeleccionadosVisitante.has(entrenador.id)
                          ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                          : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">👔</div>
                        <div>
                          <div className="text-white font-medium">{entrenador.nombre} {entrenador.apellido}</div>
                          {entrenador.licencia && <div className="text-xs text-gray-400">Lic: {entrenador.licencia}</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4 text-sm">
                  No hay entrenadores registrados para este equipo
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botón continuar */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setFase('seleccion-titulares')}
            disabled={!puedeAvanzar}
            className="px-12 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xl font-bold rounded-xl transition-colors"
          >
            Continuar → Seleccionar Titulares
          </button>
        </div>
      </div>
    );
  }

  // Selección de titulares
  if (fase === 'seleccion-titulares') {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        {/* Botón volver */}
        <button
          onClick={() => setFase('seleccion-citados')}
          className="mb-4 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Seleccionar Citados
        </button>

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
              {jugadoresLocal.filter(j => citadosLocal.has(j.id)).map(jugador => (
                <div
                  key={jugador.id}
                  className={`p-3 rounded-xl border-2 transition-all relative ${
                    titularesLocal.has(jugador.id)
                      ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <button
                    onClick={() => toggleTitular(jugador.id, true)}
                    className="w-full"
                  >
                    <div className="text-2xl font-bold text-white">{jugador.numero_camiseta}</div>
                    <div className="text-xs text-gray-400">{jugador.apellido}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditarNumero(jugador, true);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white text-xs"
                    title="Editar número"
                  >
                    ✎
                  </button>
                </div>
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
              {jugadoresVisitante.filter(j => citadosVisitante.has(j.id)).map(jugador => (
                <div
                  key={jugador.id}
                  className={`p-3 rounded-xl border-2 transition-all relative ${
                    titularesVisitante.has(jugador.id)
                      ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <button
                    onClick={() => toggleTitular(jugador.id, false)}
                    className="w-full"
                  >
                    <div className="text-2xl font-bold text-white">{jugador.numero_camiseta}</div>
                    <div className="text-xs text-gray-400">{jugador.apellido}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditarNumero(jugador, false);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white text-xs"
                    title="Editar número"
                  >
                    ✎
                  </button>
                </div>
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
        
        {/* Modal editar número */}
        {mostrarEditarNumero && jugadorEditando && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-xs w-full text-center">
              <h2 className="text-lg font-bold text-white mb-2">Editar Número</h2>
              <p className="text-gray-400 mb-4 text-sm">{jugadorEditando.apellido}, {jugadorEditando.nombre}</p>
              <input
                type="number"
                min="0"
                max="99"
                value={nuevoNumero}
                onChange={(e) => setNuevoNumero(e.target.value)}
                className="w-full p-4 bg-gray-700 border border-gray-600 rounded-xl text-white text-center text-3xl font-bold focus:outline-none focus:border-blue-500 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMostrarEditarNumero(false);
                    setJugadorEditando(null);
                  }}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarNumero}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pantalla principal de carga (en juego)
  const tiemposLocal = getTiemposDisponibles(true);
  const tiemposVisitante = getTiemposDisponibles(false);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col relative">
      {/* Botón salir - Esquina superior izquierda */}
      <button
        onClick={() => setMostrarConfirmacionSalir(true)}
        className="absolute top-3 left-3 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded transition-colors z-10"
      >
        ← SALIR
      </button>
      
      {/* Botones superiores derechos */}
      <div className="absolute top-3 right-3 flex gap-2 z-10">
        <button
          onClick={() => setMostrarSuspender(true)}
          className="px-3 py-2 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold rounded transition-colors"
        >
          SUSPENDER
        </button>
        <button
          onClick={() => setMostrarConfirmacionFin(true)}
          className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded transition-colors"
        >
          FINALIZAR
        </button>
      </div>
      
      {/* Indicador de conexión */}
      {(!online || pendientes > 0) && (
        <div className={`px-4 py-2 text-center text-sm font-medium ${
          online ? 'bg-yellow-600' : 'bg-red-600'
        } text-white`}>
          {!online ? (
            <span>⚠ Sin conexión - Las acciones se guardarán localmente</span>
          ) : sincronizando ? (
            <span>🔄 Sincronizando {pendientes} acciones pendientes...</span>
          ) : (
            <button onClick={handleSyncOffline} className="underline">
              📤 {pendientes} acciones pendientes - Toca para sincronizar
            </button>
          )}
        </div>
      )}
      
      {/* Header con marcador */}
      <header className="bg-gray-800 p-2 sm:p-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Marcador Local */}
          <div className="text-center flex-1">
            <div className="text-xs sm:text-sm text-gray-400 truncate">{equipoLocal.nombre_corto || equipoLocal.nombre}</div>
            <div className="text-4xl sm:text-5xl font-bold text-white">{partido.puntos_local}</div>
            <FaltasIndicator faltas={partido.faltas_equipo_local[Math.max(0, partido.cuarto_actual - 1)] || 0} />
          </div>
          
          {/* Centro - Cuarto y controles */}
          <div className="text-center px-2 sm:px-4">
            <div className="text-[10px] sm:text-xs text-gray-500 uppercase">Cuarto</div>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {partido.cuarto_actual > 4 ? `OT${partido.cuarto_actual - 4}` : `Q${partido.cuarto_actual}`}
            </div>
            <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded mt-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></span>
              VIVO
            </div>
            <div className="mt-1 sm:mt-2">
              <button
                onClick={handleCambiarCuarto}
                disabled={procesando}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 text-white text-xs sm:text-sm font-bold rounded-lg transition-colors ${
                  modoDescontar 
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {modoDescontar 
                  ? `← Q${partido.cuarto_actual > 1 ? partido.cuarto_actual - 1 : 1}`
                  : `Fin ${partido.cuarto_actual > 4 ? `OT${partido.cuarto_actual - 4}` : `Q${partido.cuarto_actual}`} →`
                }
              </button>
            </div>
          </div>
          
          {/* Marcador Visitante */}
          <div className="text-center flex-1">
            <div className="text-xs sm:text-sm text-gray-400 truncate">{equipoVisitante.nombre_corto || equipoVisitante.nombre}</div>
            <div className="text-4xl sm:text-5xl font-bold text-white">{partido.puntos_visitante}</div>
            <FaltasIndicator faltas={partido.faltas_equipo_visitante[Math.max(0, partido.cuarto_actual - 1)] || 0} />
          </div>
        </div>
      </header>

      {/* Contenido principal - Dos equipos */}
      <main className="flex-1 p-2 sm:p-4 overflow-auto">
        <div className="grid grid-cols-2 gap-2 sm:gap-6 max-w-6xl mx-auto">
          {/* EQUIPO LOCAL */}
          <EquipoPanel
            equipo={equipoLocal}
            titulares={jugadoresTitularesLocal}
            suplentes={jugadoresSuplentesLocal}
            entrenadores={entrenadoresLocal.filter(e => entrenadoresSeleccionadosLocal.has(e.id))}
            jugadorSeleccionado={jugadorSeleccionadoLocal}
            onSeleccionarJugador={setJugadorSeleccionadoLocal}
            onPunto={(valor) => handlePunto(valor, true)}
            onFalta={() => handleFalta(true)}
            onTiempoMuerto={() => handleTiempoMuerto(true)}
            onSustitucionMultiple={(subs) => handleSustitucionMultiple(subs, true)}
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
            entrenadores={entrenadoresVisitante.filter(e => entrenadoresSeleccionadosVisitante.has(e.id))}
            jugadorSeleccionado={jugadorSeleccionadoVisitante}
            onSeleccionarJugador={setJugadorSeleccionadoVisitante}
            onPunto={(valor) => handlePunto(valor, false)}
            onFalta={() => handleFalta(false)}
            onTiempoMuerto={() => handleTiempoMuerto(false)}
            onSustitucionMultiple={(subs) => handleSustitucionMultiple(subs, false)}
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
            className={`px-4 sm:px-8 py-2 sm:py-3 text-sm sm:text-base font-bold rounded-xl transition-all ${
              modoDescontar
                ? 'bg-orange-500 text-white ring-4 ring-orange-300'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {modoDescontar ? '✓ DESCONTAR ACTIVO' : 'DESCONTAR'}
          </button>
        </div>
        
        {/* Botones falta al entrenador */}
        <div className="mt-3 flex justify-center gap-4">
          <button
            onClick={() => abrirModalEntrenador(true)}
            disabled={procesando}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              entrenadorLocal.descalificado
                ? 'bg-red-900/50 text-red-400 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            👔 {equipoLocal?.nombre_corto} DT
            {entrenadorLocal.descalificado && ' (GD)'}
            {!entrenadorLocal.descalificado && (entrenadorLocal.faltasTecnicasEntrenador + entrenadorLocal.faltasTecnicasBanco > 0) && 
              ` (${entrenadorLocal.faltasTecnicasEntrenador + entrenadorLocal.faltasTecnicasBanco}T)`
            }
          </button>
          <button
            onClick={() => abrirModalEntrenador(false)}
            disabled={procesando}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              entrenadorVisitante.descalificado
                ? 'bg-red-900/50 text-red-400 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            👔 {equipoVisitante?.nombre_corto} DT
            {entrenadorVisitante.descalificado && ' (GD)'}
            {!entrenadorVisitante.descalificado && (entrenadorVisitante.faltasTecnicasEntrenador + entrenadorVisitante.faltasTecnicasBanco > 0) && 
              ` (${entrenadorVisitante.faltasTecnicasEntrenador + entrenadorVisitante.faltasTecnicasBanco}T)`
            }
          </button>
        </div>
        
        {/* Log de últimas acciones */}
        <div className="mt-3 sm:mt-6">
          <LogAcciones 
            partidoId={id!} 
            equipoLocalId={equipoLocal.id} 
            compact={true} 
          />
        </div>
      </main>

      {/* Modal confirmación finalizar */}
      {mostrarConfirmacionFin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center">
            <h2 className="text-xl font-bold text-white mb-4">¿Finalizar partido?</h2>
            <p className="text-gray-400 mb-4">
              {equipoLocal.nombre_corto} {partido.puntos_local} - {partido.puntos_visitante} {equipoVisitante.nombre_corto}
            </p>
            {estaEmpatado && (
              <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-600 rounded-lg">
                <p className="text-yellow-400 text-sm font-medium">
                  ⚠️ El partido está empatado. Debe jugarse overtime.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarConfirmacionFin(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
              >
                {estaEmpatado ? 'Continuar partido' : 'Cancelar'}
              </button>
              {!estaEmpatado && (
                <button
                  onClick={handleFinalizarPartido}
                  disabled={procesando}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                >
                  {procesando ? 'Finalizando...' : 'Sí, Finalizar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación salir */}
      {mostrarConfirmacionSalir && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center">
            <h2 className="text-xl font-bold text-white mb-4">¿Salir del partido?</h2>
            <p className="text-gray-400 mb-6">
              El partido seguirá en curso. Podés volver a entrar en cualquier momento.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarConfirmacionSalir(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => navigate('/partidos')}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
              >
                Sí, Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suspender partido */}
      {mostrarSuspender && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Suspender Partido</h2>
            <p className="text-gray-400 mb-4 text-center text-sm">
              {equipoLocal?.nombre_corto} {partido?.puntos_local} - {partido?.puntos_visitante} {equipoVisitante?.nombre_corto}
            </p>
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">
                Motivo de la suspensión: <span className="text-red-400">*</span>
              </label>
              <textarea
                value={observacionesSuspension}
                onChange={(e) => setObservacionesSuspension(e.target.value)}
                placeholder="Ej: Lluvia, falta de luz, incidentes..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarSuspender(false);
                  setObservacionesSuspension('');
                }}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSuspenderPartido}
                disabled={procesando || !observacionesSuspension.trim()}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl"
              >
                {procesando ? 'Suspendiendo...' : 'Suspender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal selección tipo de falta */}
      {mostrarModalFalta && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2 text-center">
              {modoDescontar ? 'Descontar Falta' : 'Registrar Falta'}
            </h2>
            <p className="text-gray-400 mb-4 text-center text-sm">
              #{faltaEsLocal ? jugadorSeleccionadoLocal?.numero_camiseta : jugadorSeleccionadoVisitante?.numero_camiseta}{' '}
              {faltaEsLocal ? jugadorSeleccionadoLocal?.apellido : jugadorSeleccionadoVisitante?.apellido}
            </p>
            
            {/* Tipo de falta */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">Tipo de falta:</label>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const jugador = faltaEsLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
                  // Calcular faltas personales (total - técnicas - antideportivas)
                  const faltasPersonales = jugador ? jugador.faltas - jugador.faltas_tecnicas - jugador.faltas_antideportivas : 0;
                  
                  const tiposFalta = [
                    { tipo: 'FALTA_PERSONAL', label: 'Personal', color: 'blue', cantidad: faltasPersonales },
                    { tipo: 'FALTA_TECNICA', label: 'Técnica', color: 'yellow', cantidad: jugador?.faltas_tecnicas || 0 },
                    { tipo: 'FALTA_ANTIDEPORTIVA', label: 'Antideportiva', color: 'orange', cantidad: jugador?.faltas_antideportivas || 0 },
                    { tipo: 'FALTA_DESCALIFICANTE', label: 'Expulsión', color: 'red', cantidad: jugador?.expulsado_directo ? 1 : 0 },
                  ];
                  
                  return tiposFalta.map(({ tipo, label, color, cantidad }) => {
                    // En modo descontar, deshabilitar si no tiene ese tipo de falta
                    const deshabilitado = modoDescontar && cantidad <= 0;
                    
                    return (
                      <button
                        key={tipo}
                        onClick={() => setTipoFaltaSeleccionado(tipo as typeof tipoFaltaSeleccionado)}
                        disabled={deshabilitado}
                        className={`py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                          deshabilitado
                            ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            : tipoFaltaSeleccionado === tipo
                              ? color === 'blue' ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : color === 'yellow' ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                              : color === 'orange' ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                              : 'bg-red-600 text-white ring-2 ring-red-400'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {label}
                        {modoDescontar && (
                          <span className="ml-1 text-xs opacity-70">({cantidad})</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
            
            {/* Tiros libres - solo si no es descontar */}
            {!modoDescontar && (
              <div className="mb-6">
                <label className="block text-gray-300 text-sm mb-2">Tiros libres:</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTirosLibres(n)}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        tirosLibres === n
                          ? 'bg-green-600 text-white ring-2 ring-green-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advertencia si será expulsado */}
            {!modoDescontar && (() => {
              const jugador = faltaEsLocal ? jugadorSeleccionadoLocal : jugadorSeleccionadoVisitante;
              if (!jugador || jugador.descalificado) return null;
              
              const tecnicasResultantes = jugador.faltas_tecnicas + (tipoFaltaSeleccionado === 'FALTA_TECNICA' ? 1 : 0);
              const antideportivasResultantes = jugador.faltas_antideportivas + (tipoFaltaSeleccionado === 'FALTA_ANTIDEPORTIVA' ? 1 : 0);
              
              const seraExpulsado = 
                tipoFaltaSeleccionado === 'FALTA_DESCALIFICANTE' ||
                tecnicasResultantes >= 2 ||
                antideportivasResultantes >= 2 ||
                (tecnicasResultantes >= 1 && antideportivasResultantes >= 1);
              
              if (seraExpulsado) {
                return (
                  <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded-lg">
                    <p className="text-red-400 text-sm font-medium text-center">
                      ⚠️ Esta falta EXPULSARÁ al jugador
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarModalFalta(false);
                  if (modoDescontar) setModoDescontar(false);
                }}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmarFalta(faltaEsLocal, tipoFaltaSeleccionado, tirosLibres, modoDescontar)}
                disabled={procesando}
                className={`flex-1 py-3 ${modoDescontar ? 'bg-orange-600 hover:bg-orange-500' : 'bg-red-600 hover:bg-red-500'} text-white font-bold rounded-xl`}
              >
                {procesando ? (modoDescontar ? 'Descontando...' : 'Registrando...') : (modoDescontar ? 'Descontar' : 'Confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de alerta (5ta falta, expulsión, descalificación) */}
      {mostrarAlertaFalta && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center">
            {tipoAlerta === '5F' && (
              <>
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-yellow-500 mb-2">5ª FALTA PERSONAL</h2>
                <p className="text-gray-400 text-sm mb-2">El jugador debe abandonar el campo</p>
              </>
            )}
            {tipoAlerta === 'EXPULSADO' && (
              <>
                <div className="text-6xl mb-4">🚫</div>
                <h2 className="text-xl font-bold text-red-500 mb-2">{jugadorAlerta === 'ENTRENADOR' ? 'ENTRENADOR EXPULSADO' : 'JUGADOR EXPULSADO'}</h2>
                <p className="text-gray-400 text-sm mb-2">Expulsión directa</p>
              </>
            )}
            {tipoAlerta === 'DESCALIFICADO' && (
              <>
                <div className="text-6xl mb-4">❌</div>
                <h2 className="text-xl font-bold text-red-500 mb-2">{jugadorAlerta === 'ENTRENADOR' ? 'ENTRENADOR DESCALIFICADO' : 'JUGADOR DESCALIFICADO'}</h2>
                <p className="text-gray-400 text-sm mb-2">Por acumulación de faltas</p>
              </>
            )}
            <p className="text-white text-lg mb-6">{jugadorAlerta}</p>
            <button
              onClick={() => setMostrarAlertaFalta(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Modal falta al entrenador */}
      {mostrarModalEntrenador && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2 text-center">
              {modoDescontar ? 'Descontar Falta al Entrenador' : 'Falta al Entrenador'}
            </h2>
            <p className="text-gray-400 mb-4 text-center text-sm">
              {entrenadorEsLocal ? equipoLocal?.nombre_corto : equipoVisitante?.nombre_corto}
            </p>
            
            {/* Estado actual del entrenador */}
            {(() => {
              const entrenador = entrenadorEsLocal ? entrenadorLocal : entrenadorVisitante;
              return (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg text-center">
                  <div className="text-sm text-gray-400">Estado actual:</div>
                  {entrenador.descalificado ? (
                    <div className="text-red-500 font-bold">
                      {entrenador.expulsadoDirecto ? 'EXPULSADO' : 'DESCALIFICADO (GD)'}
                    </div>
                  ) : (
                    <div className="flex justify-center gap-4 mt-1">
                      <span className="text-yellow-400">T.Entrenador: {entrenador.faltasTecnicasEntrenador}</span>
                      <span className="text-orange-400">T.Banco: {entrenador.faltasTecnicasBanco}</span>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Tipos de falta */}
            <div className="grid grid-cols-1 gap-2 mb-6">
              {(() => {
                const entrenador = entrenadorEsLocal ? entrenadorLocal : entrenadorVisitante;
                const tiposFalta = [
                  { 
                    tipo: 'FALTA_TECNICA_ENTRENADOR' as TipoFaltaEntrenador, 
                    label: 'T. al Entrenador', 
                    color: 'yellow',
                    cantidad: entrenador.faltasTecnicasEntrenador 
                  },
                  { 
                    tipo: 'FALTA_TECNICA_BANCO' as TipoFaltaEntrenador, 
                    label: 'T. al Banco', 
                    color: 'orange',
                    cantidad: entrenador.faltasTecnicasBanco 
                  },
                  { 
                    tipo: 'FALTA_DESCALIFICANTE_ENTRENADOR' as TipoFaltaEntrenador, 
                    label: 'Expulsión', 
                    color: 'red',
                    cantidad: entrenador.expulsadoDirecto ? 1 : 0 
                  },
                ];
                
                return tiposFalta.map(({ tipo, label, color, cantidad }) => {
                  const deshabilitado = modoDescontar 
                    ? cantidad <= 0 
                    : entrenador.descalificado;
                  
                  return (
                    <button
                      key={tipo}
                      onClick={() => {
                        handleFaltaEntrenador(tipo, modoDescontar);
                      }}
                      disabled={deshabilitado}
                      className={`py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                        deshabilitado
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : color === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : color === 'orange' ? 'bg-orange-600 hover:bg-orange-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {label}
                      {modoDescontar && <span className="ml-2 opacity-70">({cantidad})</span>}
                    </button>
                  );
                });
              })()}
            </div>
            
            <button
              onClick={() => setMostrarModalEntrenador(false)}
              className="w-full py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl"
            >
              Cancelar
            </button>
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
  entrenadores: Entrenador[];
  jugadorSeleccionado: JugadorEnPartido | null;
  onSeleccionarJugador: (j: JugadorEnPartido | null) => void;
  onPunto: (valor: 1 | 2 | 3) => void;
  onFalta: () => void;
  onTiempoMuerto: () => void;
  onSustitucionMultiple: (sustituciones: Array<{ entrando: JugadorEnPartido; saliendo: JugadorEnPartido }>) => void;
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
  entrenadores,
  jugadorSeleccionado,
  onSeleccionarJugador,
  onPunto,
  onFalta,
  onTiempoMuerto,
  onSustitucionMultiple,
  tiemposUsados,
  tiemposMaximo,
  modoDescontar,
  procesando,
  cuartoActual,
  onUltimos2Min,
  ultimos2MinActivo
}: EquipoPanelProps) {
  const [modoSustitucion, setModoSustitucion] = useState(false);
  const [titularesSaliendo, setTitularesSaliendo] = useState<Set<string>>(new Set());
  const [suplentesEntrando, setSuplentesEntrando] = useState<Set<string>>(new Set());

  const handleClickTitular = (jugador: JugadorEnPartido) => {
    if (modoSustitucion) {
      // Toggle selección de titular que sale
      setTitularesSaliendo(prev => {
        const nuevoSet = new Set(prev);
        if (nuevoSet.has(jugador.id)) {
          nuevoSet.delete(jugador.id);
        } else {
          nuevoSet.add(jugador.id);
        }
        return nuevoSet;
      });
    } else {
      onSeleccionarJugador(jugadorSeleccionado?.id === jugador.id ? null : jugador);
    }
  };

  const handleClickSuplente = (jugador: JugadorEnPartido) => {
    if (modoSustitucion) {
      // Toggle selección de suplente que entra
      setSuplentesEntrando(prev => {
        const nuevoSet = new Set(prev);
        if (nuevoSet.has(jugador.id)) {
          nuevoSet.delete(jugador.id);
        } else {
          nuevoSet.add(jugador.id);
        }
        return nuevoSet;
      });
    } else if (modoDescontar) {
      onSeleccionarJugador(jugadorSeleccionado?.id === jugador.id ? null : jugador);
    }
  };

  const handleConfirmarSustitucion = () => {
    if (titularesSaliendo.size === 0 || titularesSaliendo.size !== suplentesEntrando.size) return;
    
    const salenArray = titulares.filter(j => titularesSaliendo.has(j.id));
    const entranArray = suplentes.filter(j => suplentesEntrando.has(j.id));
    
    const sustituciones = salenArray.map((saliendo, i) => ({
      entrando: entranArray[i],
      saliendo
    }));
    
    onSustitucionMultiple(sustituciones);
    setModoSustitucion(false);
    setTitularesSaliendo(new Set());
    setSuplentesEntrando(new Set());
  };

  const handleCancelarSustitucion = () => {
    setModoSustitucion(false);
    setTitularesSaliendo(new Set());
    setSuplentesEntrando(new Set());
  };

  const tiemposDisponibles = tiemposMaximo - tiemposUsados;

  return (
    <div className="bg-gray-800/50 rounded-xl p-2 sm:p-4">
      {/* Nombre equipo */}
      <h2 className="text-base sm:text-lg font-bold text-white text-center mb-2 sm:mb-3">
        {equipo.nombre_corto || equipo.nombre}
      </h2>
      
      {/* Titulares */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-2 sm:mb-3">
        {titulares.map(jugador => {
          const eliminado = jugador.faltas >= 5 || jugador.descalificado;
          const deshabilitado = eliminado && !modoDescontar && !modoSustitucion;
          const estaSaliendoSeleccionado = titularesSaliendo.has(jugador.id);
          
          const getEstadoJugador = () => {
            if (jugador.expulsado_directo) return 'Expulsado';
            if (jugador.descalificado) return 'GD';
            if (jugador.faltas >= 5) return '5F';
            return null;
          };
          const estadoJugador = getEstadoJugador();
          
          return (
            <button
              key={jugador.id}
              onClick={() => handleClickTitular(jugador)}
              disabled={deshabilitado}
              className={`p-1 sm:p-2 rounded-lg border-2 transition-all text-center ${
                eliminado
                  ? modoDescontar
                    ? jugadorSeleccionado?.id === jugador.id
                      ? 'bg-orange-900 border-orange-500 ring-2 ring-orange-400'
                      : 'bg-red-900/50 border-red-600 hover:border-orange-500 cursor-pointer'
                    : modoSustitucion
                      ? estaSaliendoSeleccionado
                        ? 'bg-yellow-900 border-yellow-500 ring-2 ring-yellow-400'
                        : 'bg-red-900/50 border-red-600 hover:border-red-500'
                      : 'bg-red-900/30 border-red-800 opacity-50'
                  : modoSustitucion && estaSaliendoSeleccionado
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
              {modoSustitucion && estaSaliendoSeleccionado && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-xs">✓</div>
              )}
              <div className="text-lg sm:text-xl font-bold text-white">{jugador.numero_camiseta}</div>
              <div className="text-[10px] sm:text-xs text-gray-400 truncate">{jugador.apellido}</div>
              {estadoJugador ? (
                <div className={`text-[10px] sm:text-xs font-bold ${
                  estadoJugador === '5F' ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {estadoJugador}
                </div>
              ) : (
                <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 flex flex-wrap justify-center gap-x-1">
                  {jugador.puntos > 0 && <span className="text-green-400">{jugador.puntos}p</span>}
                  {jugador.faltas > 0 && <span className="text-red-400">{jugador.faltas}f</span>}
                  {jugador.faltas_tecnicas > 0 && <span className="text-yellow-400">T{jugador.faltas_tecnicas}</span>}
                  {jugador.faltas_antideportivas > 0 && <span className="text-orange-400">A{jugador.faltas_antideportivas}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Botones de acción */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-2 sm:mb-3">
        <button
          onClick={() => onPunto(1)}
          disabled={!jugadorSeleccionado || procesando}
          className={`py-2 sm:py-3 text-sm sm:text-base font-bold rounded-lg transition-colors ${
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
          className={`py-2 sm:py-3 text-sm sm:text-base font-bold rounded-lg transition-colors ${
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
          className={`py-2 sm:py-3 text-sm sm:text-base font-bold rounded-lg transition-colors ${
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
          className={`py-2 sm:py-3 text-xs sm:text-base font-bold rounded-lg transition-colors ${
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
          className={`py-2 sm:py-3 font-bold rounded-lg transition-colors text-xs ${
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
          className="w-full py-1.5 sm:py-2 mb-2 sm:mb-3 bg-yellow-700 hover:bg-yellow-600 text-white text-[10px] sm:text-xs font-bold rounded-lg"
        >
          ⏱ Últ. 2 min (-1 tiempo)
        </button>
      )}
      
      {/* Botón sustitución */}
      <button
        onClick={() => {
          if (modoSustitucion) {
            handleCancelarSustitucion();
          } else {
            setModoSustitucion(true);
          }
        }}
        className={`w-full py-1.5 sm:py-2 mb-2 sm:mb-3 text-sm sm:text-base font-bold rounded-lg transition-colors ${
          modoSustitucion
            ? 'bg-yellow-600 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        }`}
      >
        {modoSustitucion ? '✕ Cancelar' : '⇄ Sustitución'}
      </button>
      
      {/* Instrucción y botón confirmar sustitución */}
      {modoSustitucion && (
        <div className="mb-2 sm:mb-3 p-2 bg-yellow-900/30 rounded-lg border border-yellow-700">
          <div className="text-[10px] sm:text-xs text-yellow-400 text-center mb-2">
            Salen: {titularesSaliendo.size} | Entran: {suplentesEntrando.size}
            {titularesSaliendo.size !== suplentesEntrando.size && titularesSaliendo.size > 0 && suplentesEntrando.size > 0 && (
              <span className="text-red-400 ml-2">⚠️ Deben ser iguales</span>
            )}
          </div>
          {titularesSaliendo.size > 0 && titularesSaliendo.size === suplentesEntrando.size && (
            <button
              onClick={handleConfirmarSustitucion}
              className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm"
            >
              ✓ Confirmar {titularesSaliendo.size} cambio{titularesSaliendo.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
      
      {/* Suplentes */}
      <div className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Suplentes:</div>
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
        {suplentes.map(jugador => {
          const eliminado = jugador.faltas >= 5 || jugador.descalificado;
          const estaEntrandoSeleccionado = suplentesEntrando.has(jugador.id);
          const puedeEntrar = modoSustitucion && !eliminado;
          const tieneQueDescontar = jugador.faltas > 0 || jugador.faltas_tecnicas > 0 || jugador.faltas_antideportivas > 0 || jugador.puntos > 0;
          const puedeDescontar = modoDescontar && tieneQueDescontar;
          const estaSeleccionado = jugadorSeleccionado?.id === jugador.id;
          
          const getEstadoJugador = () => {
            if (jugador.expulsado_directo) return 'Expulsado';
            if (jugador.descalificado) return 'GD';
            if (jugador.faltas >= 5) return '5F';
            return null;
          };
          const estadoJugador = getEstadoJugador();
          
          const habilitado = puedeEntrar || puedeDescontar;
          
          return (
            <button
              key={jugador.id}
              onClick={() => handleClickSuplente(jugador)}
              disabled={!habilitado}
              className={`relative p-1 sm:p-2 rounded-lg border-2 transition-all text-center ${
                modoSustitucion && estaEntrandoSeleccionado
                  ? 'bg-green-900 border-green-500 ring-2 ring-green-400'
                  : modoDescontar && puedeDescontar
                    ? estaSeleccionado
                      ? 'bg-orange-900 border-orange-500 ring-2 ring-orange-400'
                      : 'bg-gray-700 border-orange-600 hover:border-orange-500 cursor-pointer'
                    : eliminado
                      ? 'bg-red-900/30 border-red-800 opacity-50 cursor-not-allowed'
                      : puedeEntrar
                        ? 'bg-gray-700 border-green-600 hover:border-green-500 hover:bg-green-900/30'
                        : 'bg-gray-800 border-gray-700 opacity-60'
              }`}
            >
              {modoSustitucion && estaEntrandoSeleccionado && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-xs text-white">✓</div>
              )}
              <div className="text-base sm:text-lg font-bold text-white">{jugador.numero_camiseta}</div>
              <div className="text-[10px] sm:text-xs text-gray-400 truncate">{jugador.apellido}</div>
              {estadoJugador ? (
                <div className={`text-[10px] sm:text-xs font-bold ${
                  estadoJugador === '5F' ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {estadoJugador}
                </div>
              ) : (jugador.puntos > 0 || jugador.faltas > 0 || jugador.faltas_tecnicas > 0 || jugador.faltas_antideportivas > 0) ? (
                <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 flex flex-wrap justify-center gap-x-1">
                  {jugador.puntos > 0 && <span className="text-green-400">{jugador.puntos}p</span>}
                  {jugador.faltas > 0 && <span className="text-red-400">{jugador.faltas}f</span>}
                  {jugador.faltas_tecnicas > 0 && <span className="text-yellow-400">T{jugador.faltas_tecnicas}</span>}
                  {jugador.faltas_antideportivas > 0 && <span className="text-orange-400">A{jugador.faltas_antideportivas}</span>}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Entrenadores */}
      {entrenadores.length > 0 && (
        <>
          <div className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2 mt-2 sm:mt-3">Entrenadores:</div>
          <div className="space-y-1">
            {entrenadores.map(entrenador => (
              <div
                key={entrenador.id}
                className="p-2 bg-gray-700/50 rounded-lg border border-gray-600"
              >
                <div className="text-xs sm:text-sm font-medium text-white truncate">
                  👔 {entrenador.nombre} {entrenador.apellido}
                </div>
                {entrenador.licencia && (
                  <div className="text-[10px] sm:text-xs text-gray-400">
                    Lic: {entrenador.licencia}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}