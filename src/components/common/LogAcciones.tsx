import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';

// Tipos para las relaciones de Supabase
interface EquipoRelacion {
  nombre_corto: string;
}

interface JugadorRelacion {
  numero_camiseta: number;
  apellido: string;
}

interface AccionLog {
  id: string;
  tipo: string;
  cuarto: number;
  valor: number;
  equipo_nombre: string;
  jugador_numero: number | null;
  jugador_apellido: string | null;
  timestamp_local: string;
  tiros_libres: number;
  numero_falta: number | null;
  puntos_local: number | null;
  puntos_visitante: number | null;
  jugador_entra_numero: number | null;
  jugador_entra_apellido: string | null;
  jugador_sale_numero: number | null;
  jugador_sale_apellido: string | null;
  anulada: boolean;
}

interface LogAccionesProps {
  partidoId: string;
  equipoLocalId?: string;
  compact?: boolean;
}

export function LogAcciones({ partidoId, compact = false }: LogAccionesProps) {
  const [acciones, setAcciones] = useState<AccionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [usePolling, setUsePolling] = useState(false);
  const pollingIntervalRef = useRef<number | null>(null);
  const minimizedTimeRef = useRef<number>(0);

  // Helper para extraer datos de relaciones de Supabase
  const getEquipoNombre = (equipo: unknown): string => {
    if (!equipo) return 'Equipo';
    if (Array.isArray(equipo) && equipo.length > 0) return equipo[0]?.nombre_corto || 'Equipo';
    return (equipo as EquipoRelacion)?.nombre_corto || 'Equipo';
  };

  const getJugadorNumero = (jugador: unknown): number | null => {
    if (!jugador) return null;
    if (Array.isArray(jugador) && jugador.length > 0) return jugador[0]?.numero_camiseta || null;
    return (jugador as JugadorRelacion)?.numero_camiseta || null;
  };

  const getJugadorApellido = (jugador: unknown): string | null => {
    if (!jugador) return null;
    if (Array.isArray(jugador) && jugador.length > 0) return jugador[0]?.apellido || null;
    return (jugador as JugadorRelacion)?.apellido || null;
  };

  // Detectar minimización y activar polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        minimizedTimeRef.current = Date.now();
      } else {
        const timeMinimized = (Date.now() - minimizedTimeRef.current) / 1000;
        if (timeMinimized > 5) {
          console.log(`📊 [LogAcciones] Activando polling - estuvo minimizada ${timeMinimized.toFixed(0)}s`);
          setUsePolling(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cargar acciones inicialmente
  useEffect(() => {
    async function cargarAcciones() {
      const { data, error } = await supabase
        .from('acciones')
        .select(`
          id, tipo, cuarto, valor, timestamp_local, tiros_libres, numero_falta,
          puntos_local, puntos_visitante, anulada,
          equipo:equipos(nombre_corto),
          jugador:jugador_id(numero_camiseta, apellido),
          jugador_entra:jugador_entra_id(numero_camiseta, apellido),
          jugador_sale:jugador_sale_id(numero_camiseta, apellido)
        `)
        .eq('partido_id', partidoId)
        .order('timestamp_local', { ascending: false });

      if (error) {
        console.error('Error cargando acciones:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setAcciones(data.map(a => ({
          id: a.id, tipo: a.tipo, cuarto: a.cuarto, valor: a.valor,
          equipo_nombre: getEquipoNombre(a.equipo),
          jugador_numero: getJugadorNumero(a.jugador),
          jugador_apellido: getJugadorApellido(a.jugador),
          timestamp_local: a.timestamp_local,
          tiros_libres: a.tiros_libres || 0,
          numero_falta: a.numero_falta || null,
          puntos_local: a.puntos_local,
          puntos_visitante: a.puntos_visitante,
          jugador_entra_numero: getJugadorNumero(a.jugador_entra),
          jugador_entra_apellido: getJugadorApellido(a.jugador_entra),
          jugador_sale_numero: getJugadorNumero(a.jugador_sale),
          jugador_sale_apellido: getJugadorApellido(a.jugador_sale),
          anulada: a.anulada || false,
        })));
      }
      setLoading(false);
    }
    cargarAcciones();
  }, [partidoId]);

  // Polling cuando se detecta minimización
  useEffect(() => {
    if (!usePolling) return;

    console.log('🔄 [LogAcciones] Iniciando polling cada 3s');

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('acciones')
          .select(`
            id, tipo, cuarto, valor, timestamp_local, tiros_libres, numero_falta,
            puntos_local, puntos_visitante, anulada,
            equipo:equipos(nombre_corto),
            jugador:jugador_id(numero_camiseta, apellido),
            jugador_entra:jugador_entra_id(numero_camiseta, apellido),
            jugador_sale:jugador_sale_id(numero_camiseta, apellido)
          `)
          .eq('partido_id', partidoId)
          .order('timestamp_local', { ascending: false });

        if (!error && data) {
          setAcciones(data.map(a => ({
            id: a.id, tipo: a.tipo, cuarto: a.cuarto, valor: a.valor,
            equipo_nombre: getEquipoNombre(a.equipo),
            jugador_numero: getJugadorNumero(a.jugador),
            jugador_apellido: getJugadorApellido(a.jugador),
            timestamp_local: a.timestamp_local,
            tiros_libres: a.tiros_libres || 0,
            numero_falta: a.numero_falta || null,
            puntos_local: a.puntos_local,
            puntos_visitante: a.puntos_visitante,
            jugador_entra_numero: getJugadorNumero(a.jugador_entra),
            jugador_entra_apellido: getJugadorApellido(a.jugador_entra),
            jugador_sale_numero: getJugadorNumero(a.jugador_sale),
            jugador_sale_apellido: getJugadorApellido(a.jugador_sale),
            anulada: a.anulada || false,
          })));
        }
      } catch (err) {
        console.error('[LogAcciones] Error en polling:', err);
      }
    };

    pollingIntervalRef.current = window.setInterval(poll, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [usePolling, partidoId]);

  // Suscripción Realtime (solo si NO estamos en modo polling)
  useEffect(() => {
    if (usePolling) return; // Skip Realtime si estamos en polling

    const channel = supabase
      .channel(`acciones-log-${partidoId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'acciones',
        filter: `partido_id=eq.${partidoId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('acciones')
          .select(`
            id, tipo, cuarto, valor, timestamp_local, tiros_libres, numero_falta,
            puntos_local, puntos_visitante, anulada,
            equipo:equipos(nombre_corto),
            jugador:jugador_id(numero_camiseta, apellido),
            jugador_entra:jugador_entra_id(numero_camiseta, apellido),
            jugador_sale:jugador_sale_id(numero_camiseta, apellido)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          setAcciones(prev => [{
            id: data.id, tipo: data.tipo, cuarto: data.cuarto, valor: data.valor,
            equipo_nombre: getEquipoNombre(data.equipo),
            jugador_numero: getJugadorNumero(data.jugador),
            jugador_apellido: getJugadorApellido(data.jugador),
            timestamp_local: data.timestamp_local,
            tiros_libres: data.tiros_libres || 0,
            numero_falta: data.numero_falta || null,
            puntos_local: data.puntos_local,
            puntos_visitante: data.puntos_visitante,
            jugador_entra_numero: getJugadorNumero(data.jugador_entra),
            jugador_entra_apellido: getJugadorApellido(data.jugador_entra),
            jugador_sale_numero: getJugadorNumero(data.jugador_sale),
            jugador_sale_apellido: getJugadorApellido(data.jugador_sale),
            anulada: data.anulada || false,
          }, ...prev]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'acciones',
        filter: `partido_id=eq.${partidoId}`,
      }, (payload) => {
        // Cuando una acción se actualiza (ej: se marca como anulada), actualizar en el estado
        if (payload.new) {
          setAcciones(prev => prev.map(a =>
            a.id === payload.new.id ? { ...a, anulada: payload.new.anulada || false } : a
          ));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partidoId, usePolling]);

  const formatTipo = (accion: AccionLog): string => {
    const { tipo, valor, numero_falta, tiros_libres } = accion;
    const buildFaltaText = (nombre: string): string => {
      let texto = nombre;
      if (numero_falta) texto = `${numero_falta}ª ${nombre}`;
      if (tiros_libres > 0) texto += ` +${tiros_libres}TL`;
      return texto;
    };
    let texto = '';
    switch (tipo) {
      case 'PUNTO_1': texto = '+1'; break;
      case 'PUNTO_2': texto = '+2'; break;
      case 'PUNTO_3': texto = '+3'; break;
      case 'FALTA_PERSONAL': texto = buildFaltaText('F. Personal'); break;
      case 'FALTA_TECNICA': texto = buildFaltaText('F. Técnica'); break;
      case 'FALTA_ANTIDEPORTIVA': texto = buildFaltaText('F. Antideportiva'); break;
      case 'FALTA_DESCALIFICANTE': texto = 'Expulsado'; break;
      case 'FALTA_TECNICA_ENTRENADOR': texto = 'T. Entrenador'; break;
      case 'FALTA_TECNICA_BANCO': texto = 'T. Banco'; break;
      case 'FALTA_DESCALIFICANTE_ENTRENADOR': texto = 'DT Expulsado'; break;
      case 'TIEMPO_MUERTO': texto = '⏱️ TIEMPO'; break;
      case 'SUSTITUCION': texto = '🔄 CAMBIO'; break;
      case 'FIN_CUARTO': texto = `FIN Q${valor || ''}`; break;
      case 'INICIO_CUARTO': texto = `INICIO Q${valor || ''}`; break;
      default: texto = tipo;
    }
    return texto;
  };

  const getColorClase = (tipo: string): string => {
    if (tipo.startsWith('PUNTO')) return 'text-green-400';
    if (tipo === 'FALTA_PERSONAL') return 'text-red-400';
    if (tipo === 'FALTA_TECNICA') return 'text-yellow-400';
    if (tipo === 'FALTA_ANTIDEPORTIVA') return 'text-orange-500';
    if (tipo === 'FALTA_DESCALIFICANTE') return 'text-red-600 font-bold';
    if (tipo === 'FALTA_TECNICA_ENTRENADOR') return 'text-yellow-300';
    if (tipo === 'FALTA_TECNICA_BANCO') return 'text-orange-400';
    if (tipo === 'FALTA_DESCALIFICANTE_ENTRENADOR') return 'text-red-600 font-bold';
    if (tipo === 'TIEMPO_MUERTO') return 'text-purple-400 font-bold';
    if (tipo === 'SUSTITUCION') return 'text-cyan-400';
    if (tipo === 'FIN_CUARTO' || tipo === 'INICIO_CUARTO') return 'text-blue-400 font-bold';
    return 'text-gray-400';
  };

  const esAccionSistema = (tipo: string): boolean => {
    return tipo === 'FIN_CUARTO' || tipo === 'INICIO_CUARTO' || tipo === 'TIEMPO_MUERTO' || tipo === 'SUSTITUCION';
  };

  const esFaltaEntrenador = (tipo: string): boolean => {
    return tipo === 'FALTA_TECNICA_ENTRENADOR' || tipo === 'FALTA_TECNICA_BANCO' || tipo === 'FALTA_DESCALIFICANTE_ENTRENADOR';
  };

  if (loading) return <div className={`${compact ? 'p-2' : 'p-4'} text-gray-500 text-sm`}>Cargando...</div>;
  if (acciones.length === 0) return <div className={`${compact ? 'p-2' : 'p-4'} text-gray-500 text-sm text-center`}>Sin acciones</div>;

  return (
    <div className={`${compact ? '' : 'bg-gray-800/50 rounded-xl p-4'}`}>
      {!compact && <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Acciones</h3>}
      <div className={`space-y-1.5 ${compact ? 'max-h-32' : 'max-h-[400px]'} overflow-y-auto`}>
        {acciones.map((accion) => {
          const texto = formatTipo(accion);
          const tachado = accion.anulada;
          const mostrarParcial = (accion.tipo.startsWith('PUNTO') || accion.tipo === 'FIN_CUARTO') &&
            !tachado && accion.puntos_local !== null && accion.puntos_visitante !== null;
          
          return (
            <div key={accion.id} className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-300 ${
              esAccionSistema(accion.tipo) ? 'bg-blue-900/30 rounded px-2 py-1 justify-center flex-wrap' : ''
            }`}>
              {esAccionSistema(accion.tipo) ? (
                <>
                  <span className={`font-bold ${getColorClase(accion.tipo)}`}>{texto}</span>
                  {accion.tipo === 'TIEMPO_MUERTO' && <span className="text-gray-400">({accion.equipo_nombre})</span>}
                  {accion.tipo === 'SUSTITUCION' && (
                    <span className="text-gray-300">
                      {accion.equipo_nombre}: Sale #{accion.jugador_sale_numero} {accion.jugador_sale_apellido} → Entra #{accion.jugador_entra_numero} {accion.jugador_entra_apellido}
                    </span>
                  )}
                  {accion.tipo === 'FIN_CUARTO' && mostrarParcial && (
                    <span className="text-white font-medium ml-2">({accion.puntos_local} - {accion.puntos_visitante})</span>
                  )}
                </>
              ) : esFaltaEntrenador(accion.tipo) ? (
                <>
                  <span className="text-gray-500 w-6">Q{accion.cuarto}</span>
                  <span className="text-gray-400">{accion.equipo_nombre}</span>
                  <span className="text-white font-medium">👔 DT</span>
                  <span className={`font-bold ${getColorClase(accion.tipo)} ${tachado ? 'line-through opacity-60' : ''}`}>{texto}</span>
                </>
              ) : (
                <>
                  <span className="text-gray-500 w-6">Q{accion.cuarto}</span>
                  <span className="text-gray-400 truncate">{accion.equipo_nombre}</span>
                  {accion.jugador_numero && <span className="text-white font-medium truncate">#{accion.jugador_numero} {accion.jugador_apellido}</span>}
                  <span className={`font-bold ${getColorClase(accion.tipo)} ${tachado ? 'line-through opacity-60' : ''}`}>{texto}</span>
                  {mostrarParcial && <span className="text-gray-500 text-xs">({accion.puntos_local}-{accion.puntos_visitante})</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}