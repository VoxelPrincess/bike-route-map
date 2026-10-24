import { useEffect, useRef, useState } from 'react';
import { fetchRouteAB, RouteRequestError } from '../api/routeApi';
import type { Coordinates, RouteResult } from '../api/routeApi';

type RouteState = {
  selection: string | null;
  requestId: number;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  result: RouteResult | null;
  message: string | null;
};

export function useRoute(from: Coordinates | null, to: Coordinates | null) {
  const selection = from && to ? JSON.stringify([from, to]) : null;
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RouteState>({
    selection: null, requestId: 0, phase: 'idle', result: null, message: null,
  });

  useEffect(() => {
    const requestId = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    if (!selection) {
      setState({ selection, requestId, phase: 'idle', result: null, message: null });
    } else {
      const [start, end] = JSON.parse(selection) as [Coordinates, Coordinates];
      setState({ selection, requestId, phase: 'loading', result: null, message: null });
      fetchRouteAB(start, end, abort.signal).then(result => {
        if (abort.signal.aborted || requestId !== generation.current) return;
        if (result.status === 'partial') {
          console.warn('[route] Surface unavailable', { code: result.error.code, message: result.error.message });
        }
        setState({ selection, requestId, phase: 'ready', result, message: null });
      }).catch(error => {
        if (abort.signal.aborted || requestId !== generation.current) return;
        const message = error instanceof RouteRequestError ? error.message : 'Could not load the route. Please try again.';
        console.error('[route] Request failed', {
          code: error instanceof RouteRequestError ? error.code : 'route_failed', message,
        });
        setState({ selection, requestId, phase: 'error', result: null,
          message });
      });
    }
    return () => { abort.abort(); };
  }, [selection, attempt]);

  function clear() {
    ++generation.current;
    controller.current?.abort();
    setState({ selection: null, requestId: generation.current, phase: 'idle', result: null, message: null });
  }

  function retry() {
    ++generation.current;
    controller.current?.abort();
    setState({ selection, requestId: generation.current, phase: 'loading', result: null, message: null });
    setAttempt(value => value + 1);
  }

  // Hide the old route during the render before the new selection's effect runs.
  const current: RouteState = state.selection === selection ? state : {
    selection, requestId: generation.current, phase: selection ? 'loading' : 'idle', result: null, message: null,
  };
  return { ...current, clear, retry };
}
