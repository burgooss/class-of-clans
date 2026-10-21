import { useEffect, useState } from 'react';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Hora actual en epoch (segundos). Se actualiza cada segundo para las cuentas regresivas. */
export function useNow(): number {
  const [now, setNow] = useState(nowSeconds);

  useEffect(() => {
    const id = setInterval(() => setNow(nowSeconds()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}
