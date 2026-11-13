import { useEffect, useRef } from 'react';

/** Resume failed reads only. Successful content and write actions never opt in. */
export function useReadRecovery(task: () => Promise<unknown> | void, enabled: boolean, identity: string) {
  const latest = useRef(task);
  latest.current = task;
  const state = useRef({ identity, running: false, lastStarted: -Infinity });
  if (state.current.identity !== identity) state.current = { identity, running: false, lastStarted: -Infinity };

  useEffect(() => {
    if (!enabled) return;
    const current = state.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const eligible = () => !disposed && navigator.onLine !== false && document.visibilityState !== 'hidden';
    const recover = () => {
      if (!eligible() || current.running || timer || Date.now() - current.lastStarted < 5000) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!eligible() || current.running || state.current !== current) return;
        current.lastStarted = Date.now();
        current.running = true;
        void Promise.resolve().then(() => {
          if (!disposed && state.current === current) return latest.current();
        }).catch(() => { /* The read owner retains its error and manual recovery. */ })
          .finally(() => { current.running = false; });
      }, 250);
    };
    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [enabled, identity]);
}
