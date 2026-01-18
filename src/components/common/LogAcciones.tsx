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
}

interface LogAccionesProps {
  partidoId: string;
  equipoLocalId?: string;
  compact?: boolean;
}

export function LogAcciones({ partidoId, compact = false }: LogAccionesProps) {
  const [acciones, setAcciones] = useState<AccionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar acciones iniciales
  useEffect(() => {
    async function cargarAcciones() {
      const { data, error } = await supabase
        .from('acciones')
        .select(`
          id,
          tipo,
          cuarto,
          valor,
          timestamp_local,
          tiros_libres,
          numero_falta,
          equipo:equipos(nombre_corto),
          jugador:jugadores(numero_camiseta, apellido)
        `)
        .eq('partido_id', partidoId)
        .eq('anulada', false)
        .order('timestamp_local', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error cargando acciones:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setAcciones(data.map(a => ({
          id: a.id,
          tipo: a.tipo,
          cuarto: a.cuarto,
          valor: a.valor,
          equipo_nombre: (a.equipo as any)?.nombre_corto || 'Equipo',
          jugador_numero: (a.jugador as any)?.numero_camiseta || null,
          jugador_apellido: (a.jugador as any)?.apellido || null,
          timestamp_local: a.timestamp_local,
          tiros_libres: a.tiros_libres || 0,
          numero_falta: a.numero_falta || null,
        })));
      }
      setLoading(false);
    }

    cargarAcciones();
  }, [partidoId]);

  // Suscribirse a nuevas acciones en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel(`acciones-log-${partidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'acciones',
          filter: `partido_id=eq.${partidoId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('acciones')
            .select(`
              id,
              tipo,
              cuarto,
              valor,
              timestamp_local,
              tiros_libres,
              numero_falta,
              equipo:equipos(nombre_corto),
              jugador:jugadores(numero_camiseta, apellido)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const nuevaAccion: AccionLog = {
              id: data.id,
              tipo: data.tipo,
              cuarto: data.cuarto,
              valor: data.valor,
              equipo_nombre: (data.equipo as any)?.nombre_corto || 'Equipo',
              jugador_numero: (data.jugador as any)?.numero_camiseta || null,
              jugador_apellido: (data.jugador as any)?.apellido || null,
              timestamp_local: data.timestamp_local,
              tiros_libres: data.tiros_libres || 0,
              numero_falta: data.numero_falta || null,
            };
            
            setAcciones(prev => [nuevaAccion, ...prev].slice(0, 10));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partidoId]);

  const formatTipo = (accion: AccionLog): string => {
    const { tipo, valor, numero_falta, tiros_libres } = accion;
    
    // Si valor es negativo, es un descuento
    if (valor < 0) {
      switch (tipo) {
        case 'PUNTO_1': return '−1';
        case 'PUNTO_2': return '−2';
        case 'PUNTO_3': return '−3';
        case 'FALTA_PERSONAL': return '−FP';
        case 'FALTA_TECNICA': return '−FT';
        case 'FALTA_ANTIDEPORTIVA': return '−FA';
        case 'FALTA_DESCALIFICANTE': return '−EXP';
        default: return `−${tipo}`;
      }
    }
    
    // Construir texto para faltas con número y tiros
    const buildFaltaText = (sigla: string): string => {
      let texto = sigla;
      if (numero_falta) texto = `${numero_falta}ª ${sigla}`;
      if (tiros_libres > 0) texto += ` +${tiros_libres}TL`;
      return texto;
    };
    
    switch (tipo) {
      case 'PUNTO_1': return '+1';
      case 'PUNTO_2': return '+2';
      case 'PUNTO_3': return '+3';
      case 'FALTA_PERSONAL': return buildFaltaText('FP');
      case 'FALTA_TECNICA': return buildFaltaText('FT');
      case 'FALTA_ANTIDEPORTIVA': return buildFaltaText('FA');
      case 'FALTA_DESCALIFICANTE': return 'EXPULSIÓN';
      case 'TIEMPO_MUERTO': return 'TIEMPO';
      case 'FIN_CUARTO': return `FIN Q${valor || ''}`;
      case 'INICIO_CUARTO': return `INICIO Q${valor || ''}`;
      default: return tipo;
    }
  };

  const getColorClase = (tipo: string, valor: number): string => {
    // Descuentos en naranja
    if (valor < 0) return 'text-orange-400';
    
    if (tipo.startsWith('PUNTO')) return 'text-green-400';
    if (tipo === 'FALTA_PERSONAL') return 'text-red-400';
    if (tipo === 'FALTA_TECNICA') return 'text-yellow-400';
    if (tipo === 'FALTA_ANTIDEPORTIVA') return 'text-orange-500';
    if (tipo === 'FALTA_DESCALIFICANTE') return 'text-red-600 font-bold';
    if (tipo === 'TIEMPO_MUERTO') return 'text-purple-400';
    if (tipo === 'FIN_CUARTO' || tipo === 'INICIO_CUARTO') return 'text-blue-400 font-bold';
    return 'text-gray-400';
  };

  // Determinar si la acción es de sistema (no tiene jugador)
  const esAccionSistema = (tipo: string): boolean => {
    return tipo === 'FIN_CUARTO' || tipo === 'INICIO_CUARTO';
  };

  if (loading) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} text-gray-500 text-sm`}>
        Cargando acciones...
      </div>
    );
  }

  if (acciones.length === 0) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} text-gray-500 text-sm text-center`}>
        Sin acciones registradas
      </div>
    );
  }

  return (
    <div className={`${compact ? '' : 'bg-gray-800/50 rounded-xl p-4'}`}>
      {!compact && (
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          Últimas Acciones
        </h3>
      )}
      <div className={`space-y-1.5 ${compact ? 'max-h-32' : 'max-h-48'} overflow-y-auto`}>
        {acciones.map((accion) => (
          <div 
            key={accion.id} 
            className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-300 ${
              esAccionSistema(accion.tipo) ? 'bg-blue-900/30 rounded px-2 py-1 justify-center' : ''
            }`}
          >
            {esAccionSistema(accion.tipo) ? (
              // Acciones de sistema (cambio de cuarto)
              <span className={`font-bold ${getColorClase(accion.tipo, accion.valor)}`}>
                {formatTipo(accion)}
              </span>
            ) : (
              // Acciones normales
              <>
                <span className="text-gray-500 w-6 flex-shrink-0">Q{accion.cuarto}</span>
                <span className="text-gray-400 truncate">{accion.equipo_nombre}</span>
                {accion.jugador_numero && (
                  <span className="text-white font-medium truncate">
                    #{accion.jugador_numero} {accion.jugador_apellido}
                  </span>
                )}
                <span className={`font-bold flex-shrink-0 ${getColorClase(accion.tipo, accion.valor)}`}>
                  {formatTipo(accion)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}