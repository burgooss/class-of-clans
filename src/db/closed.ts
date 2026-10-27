/**
 * Al recargar la app en caliente (o al salir de ella) la base de datos se cierra, y las consultas que
 * seguían en curso fallan con "Access to closed resource". No es un fallo real: no hay nada que
 * mostrar ni que reintentar, porque la pantalla ya no existe.
 */
export function isClosedDbError(error: unknown): boolean {
  return error instanceof Error && /closed resource/i.test(error.message);
}

/**
 * Para cargas que no se esperan (por ejemplo al enfocar una pantalla): ignora el cierre de la base y
 * registra cualquier otro error, para que no quede como una promesa rechazada sin manejar.
 */
export function reportLoadError(error: unknown): void {
  if (isClosedDbError(error)) return;
  console.error('No se pudieron cargar los datos', error);
}
