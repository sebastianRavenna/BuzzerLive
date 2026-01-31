import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Estado de una operación asíncrona
 */
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para manejar operaciones asíncronas con estado de loading y error
 *
 * @example
 * const { data, loading, error, execute } = useAsync(fetchData);
 *
 * // Ejecutar manualmente
 * const handleClick = () => execute(param1, param2);
 *
 * // O ejecutar automáticamente al montar
 * const { data, loading, error } = useAsync(fetchData, { immediate: true });
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: {
    immediate?: boolean;
    args?: Args;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { immediate = false, args, onSuccess, onError } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  // Ref para evitar actualizar estado después de desmontar
  const isMounted = useRef(true);

  // Función para ejecutar la operación async
  const execute = useCallback(
    async (...executeArgs: Args): Promise<T | null> => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFunction(...executeArgs);

        if (isMounted.current) {
          setState({ data: result, loading: false, error: null });
          onSuccess?.(result);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

        if (isMounted.current) {
          setState(prev => ({ ...prev, loading: false, error: errorMessage }));
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }

        return null;
      }
    },
    [asyncFunction, onSuccess, onError]
  );

  // Reset del estado
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  // Ejecutar inmediatamente si se especifica
  useEffect(() => {
    if (immediate && args) {
      execute(...args);
    } else if (immediate) {
      execute(...([] as unknown as Args));
    }
  }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar al desmontar
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
    isIdle: !state.loading && !state.error && !state.data,
  };
}

/**
 * Hook simplificado para cargar datos al montar el componente
 *
 * @example
 * const { data: partidos, loading, error, refetch } = useFetch(() => getPartidos());
 */
export function useFetch<T>(
  asyncFunction: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await asyncFunction();

      if (isMounted.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        }));
      }
    }
  }, [asyncFunction]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    return () => {
      isMounted.current = false;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    refetch: fetchData,
  };
}
