import { create } from 'zustand';
import type { 
  Partido, 
  Equipo, 
  Accion, 
  EquipoActivo, 
  JugadorEnPartido,
  ConnectionStatus
} from '../types';

interface PartidoState {
  // Data
  partido: Partido | null;
  equipoLocal: Equipo | null;
  equipoVisitante: Equipo | null;
  jugadoresLocal: JugadorEnPartido[];
  jugadoresVisitante: JugadorEnPartido[];
  acciones: Accion[];
  
  // UI State
  equipoActivo: EquipoActivo;
  jugadorSeleccionado: JugadorEnPartido | null;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPartido: (partido: Partido) => void;
  setEquipos: (local: Equipo, visitante: Equipo) => void;
  setJugadores: (local: JugadorEnPartido[], visitante: JugadorEnPartido[]) => void;
  setAcciones: (acciones: Accion[]) => void;
  addAccion: (accion: Accion) => void;
  
  setEquipoActivo: (equipo: EquipoActivo) => void;
  setJugadorSeleccionado: (jugador: JugadorEnPartido | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed helpers
  getJugadoresEquipoActivo: () => JugadorEnPartido[];
  getEquipoActivo: () => Equipo | null;
  
  // Game actions (optimistic updates)
  registrarPunto: (valor: 1 | 2 | 3) => void;
  registrarFalta: () => void;
  registrarFaltaEquipo: () => void;
  deshacerUltimaAccion: () => void;
  cambiarCuarto: (cuarto: number) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  partido: null,
  equipoLocal: null,
  equipoVisitante: null,
  jugadoresLocal: [],
  jugadoresVisitante: [],
  acciones: [],
  equipoActivo: 'local' as EquipoActivo,
  jugadorSeleccionado: null,
  connectionStatus: 'online' as ConnectionStatus,
  isLoading: false,
  error: null,
};

export const usePartidoStore = create<PartidoState>((set, get) => ({
  ...initialState,
  
  // Setters
  setPartido: (partido) => set({ partido }),
  
  setEquipos: (local, visitante) => set({ 
    equipoLocal: local, 
    equipoVisitante: visitante 
  }),
  
  setJugadores: (local, visitante) => set({ 
    jugadoresLocal: local, 
    jugadoresVisitante: visitante 
  }),
  
  setAcciones: (acciones) => set({ acciones }),
  
  addAccion: (accion) => set((state) => ({ 
    acciones: [...state.acciones, accion] 
  })),
  
  setEquipoActivo: (equipo) => set({ 
    equipoActivo: equipo,
    jugadorSeleccionado: null // Reset selection when changing team
  }),
  
  setJugadorSeleccionado: (jugador) => set({ jugadorSeleccionado: jugador }),
  
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  // Computed helpers
  getJugadoresEquipoActivo: () => {
    const state = get();
    return state.equipoActivo === 'local' 
      ? state.jugadoresLocal 
      : state.jugadoresVisitante;
  },
  
  getEquipoActivo: () => {
    const state = get();
    return state.equipoActivo === 'local' 
      ? state.equipoLocal 
      : state.equipoVisitante;
  },
  
  // Game actions with optimistic updates
  registrarPunto: (valor) => {
    const state = get();
    if (!state.partido || !state.jugadorSeleccionado) return;
    
    const esLocal = state.equipoActivo === 'local';
    
    // Optimistic update - partido
    set((state) => ({
      partido: state.partido ? {
        ...state.partido,
        puntos_local: esLocal 
          ? state.partido.puntos_local + valor 
          : state.partido.puntos_local,
        puntos_visitante: !esLocal 
          ? state.partido.puntos_visitante + valor 
          : state.partido.puntos_visitante,
      } : null,
    }));
    
    // Optimistic update - jugador
    const updateJugadores = (jugadores: JugadorEnPartido[]) =>
      jugadores.map(j => 
        j.id === state.jugadorSeleccionado?.id 
          ? { ...j, puntos: j.puntos + valor, participo: true }
          : j
      );
    
    if (esLocal) {
      set((state) => ({ jugadoresLocal: updateJugadores(state.jugadoresLocal) }));
    } else {
      set((state) => ({ jugadoresVisitante: updateJugadores(state.jugadoresVisitante) }));
    }
    
    // TODO: Send to Supabase
  },
  
  registrarFalta: () => {
    const state = get();
    if (!state.partido || !state.jugadorSeleccionado) return;
    
    const esLocal = state.equipoActivo === 'local';
    const cuartoIndex = Math.max(0, state.partido.cuarto_actual - 1);
    
    // Optimistic update - jugador
    const updateJugadores = (jugadores: JugadorEnPartido[]) =>
      jugadores.map(j => 
        j.id === state.jugadorSeleccionado?.id 
          ? { ...j, faltas: j.faltas + 1, participo: true }
          : j
      );
    
    if (esLocal) {
      set((state) => ({ 
        jugadoresLocal: updateJugadores(state.jugadoresLocal),
        partido: state.partido ? {
          ...state.partido,
          faltas_equipo_local: state.partido.faltas_equipo_local.map((f, i) => 
            i === cuartoIndex ? f + 1 : f
          ),
        } : null,
      }));
    } else {
      set((state) => ({ 
        jugadoresVisitante: updateJugadores(state.jugadoresVisitante),
        partido: state.partido ? {
          ...state.partido,
          faltas_equipo_visitante: state.partido.faltas_equipo_visitante.map((f, i) => 
            i === cuartoIndex ? f + 1 : f
          ),
        } : null,
      }));
    }
    
    // TODO: Send to Supabase
  },
  
  registrarFaltaEquipo: () => {
    const state = get();
    if (!state.partido) return;
    
    const esLocal = state.equipoActivo === 'local';
    const cuartoIndex = Math.max(0, state.partido.cuarto_actual - 1);
    
    if (esLocal) {
      set((state) => ({
        partido: state.partido ? {
          ...state.partido,
          faltas_equipo_local: state.partido.faltas_equipo_local.map((f, i) => 
            i === cuartoIndex ? f + 1 : f
          ),
        } : null,
      }));
    } else {
      set((state) => ({
        partido: state.partido ? {
          ...state.partido,
          faltas_equipo_visitante: state.partido.faltas_equipo_visitante.map((f, i) => 
            i === cuartoIndex ? f + 1 : f
          ),
        } : null,
      }));
    }
    
    // TODO: Send to Supabase
  },
  
  deshacerUltimaAccion: () => {
    // TODO: Implement with Supabase RPC
    console.log('Deshacer última acción');
  },
  
  cambiarCuarto: (cuarto) => {
    set((state) => ({
      partido: state.partido ? {
        ...state.partido,
        cuarto_actual: cuarto,
      } : null,
    }));
    
    // TODO: Send to Supabase
  },
  
  reset: () => set(initialState),
}));
