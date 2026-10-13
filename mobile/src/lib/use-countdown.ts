import { useEffect, useState } from 'react';

/**
 * Cuenta regresiva en segundos, a partir de la hora del dispositivo (orientativa). Con
 * `initialSeconds`, empieza al montar el componente.
 */
export function useCountdown(initialSeconds?: number) {
  const [until, setUntil] = useState<number | null>(() =>
    initialSeconds ? Date.now() + initialSeconds * 1000 : null,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const remaining = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));

  return {
    remaining,
    start(seconds: number) {
      const current = Date.now();
      setNow(current);
      setUntil(current + seconds * 1000);
    },
  };
}
