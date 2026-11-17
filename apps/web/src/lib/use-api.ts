import { useEffect, useState } from 'react';

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Run an async loader and re-run it whenever `deps` change (or `reload` is
 * called). Deliberately tiny: the app only needs loading/error/data, not a full
 * caching layer.
 */
export function useApiQuery<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    loader()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Something went wrong';
        setState({ data: null, error: message, loading: false });
      });

    return () => {
      active = false;
    };
  }, [...deps, nonce]);

  return {
    ...state,
    reload: () => setNonce((value) => value + 1),
  };
}
