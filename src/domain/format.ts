/** Un export de más de 24 h se considera desactualizado. */
export const STALE_EXPORT_SECONDS = 24 * 60 * 60;

/** Cuenta regresiva: "2d 3h 4m", "3h 4m 5s" o "4m 5s". */
export function formatRemaining(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** "hace unos segundos", "hace 5 min", "hace 3 h", "hace 2 d". */
export function formatAgo(elapsedSeconds: number): string {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds));
  if (elapsed < 60) return 'hace unos segundos';
  if (elapsed < 3600) return `hace ${Math.floor(elapsed / 60)} min`;
  if (elapsed < 86400) return `hace ${Math.floor(elapsed / 3600)} h`;
  return `hace ${Math.floor(elapsed / 86400)} d`;
}
