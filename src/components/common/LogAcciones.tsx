import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

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
}

interface LogAccionesProps {
  partidoId: string;
  equipoLocalId?: string;
  compact?: boolean;
}

export function LogAcciones({ partidoId, compact = false }: LogAccionesProps) {
  const [acciones, setAcciones] = useState<AccionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarAcciones() {
      const { data, error } = await supabase
        .from('acciones')
        .select(`
          id, tipo, cuarto, valor, timestamp_local, tiros_libres, numero_falta,
          puntos_local, puntos_visitante,
          equipo:equipos(nombre_corto),
          jugador:jugador_id(numero_camiseta, apellido)
        `)
        .eq('partido_id', partidoId)
        .eq('anulada', false)
        .order('timestamp_local', { ascending: false });

      if (error) {
        console.error('Error cargando acciones:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setAcciones(data.map(a => ({
          id: a.id, tipo: a.tipo, cuarto: a.cuarto, valor: a.valor,
          equipo_nombre: (a.equipo as any)?.nombre_corto || 'Equipo',
          jugador_numero: (a.jugador as any)?.numero_camiseta || null,
          jugador_apellido: (a.jugador as any)?.apellido || null,
          timestamp_local: a.timestamp_local,
          tiros_libres: a.tiros_libres || 0,
          numero_falta: a.numero_falta || null,
          puntos_local: a.puntos_local,
          puntos_visitante: a.puntos_visitante,
        })));
      }
      setLoading(false);
    }
    cargarAcciones();
  }, [partidoId]);

  useEffect(() => {
    const channel = supabase
      .channel(`acciones-log-${partidoId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'acciones',
        filter: `partido_id=eq.${partidoId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('acciones')
          .select(`
            id, tipo, cuarto, valor, timestamp_local, tiros_libres, numero_falta,
            puntos_local, puntos_visitante,
            equipo:equipos(nombre_corto),
            jugador:jugador_id(numero_camiseta, apellido)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          setAcciones(prev => [{
            id: data.id, tipo: data.tipo, cuarto: data.cuarto, valor: data.valor,
            equipo_nombre: (data.equipo as any)?.nombre_corto || 'Equipo',
            jugador_numero: (data.jugador as any)?.numero_camiseta || null,
            jugador_apellido: (data.jugador as any)?.apellido || null,
            timestamp_local: data.timestamp_local,
            tiros_libres: data.tiros_libres || 0,
            numero_falta: data.numero_falta || null,
            puntos_local: data.puntos_local,
            puntos_visitante: data.puntos_visitante,
          }, ...prev]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partidoId]);

  const formatTipo = (accion: AccionLog): { texto: string; tachado: boolean } => {
    const { tipo, valor, numero_falta, tiros_libres } = accion;
    const esDescuento = valor < 0;
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
      case 'FIN_CUARTO': texto = `FIN Q${valor || ''}`; break;
      case 'INICIO_CUARTO': texto = `INICIO Q${valor || ''}`; break;
      default: texto = tipo;
    }
    return { texto, tachado: esDescuento };
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
    if (tipo === 'FIN_CUARTO' || tipo === 'INICIO_CUARTO') return 'text-blue-400 font-bold';
    return 'text-gray-400';
  };

  const esAccionSistema = (tipo: string): boolean => {
    return tipo === 'FIN_CUARTO' || tipo === 'INICIO_CUARTO' || tipo === 'TIEMPO_MUERTO';
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
          const { texto, tachado } = formatTipo(accion);
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