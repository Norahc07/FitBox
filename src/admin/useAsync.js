import { useCallback, useEffect, useState } from 'react';

/** Small data-loading helper for admin screens. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await run();
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState({ loading: false, error: err.message || String(err), data: null });
    }
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
