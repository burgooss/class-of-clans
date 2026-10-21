export type OptionalIntParse = { ok: true; value: number | null } | { ok: false };

/** Entero opcional escrito por el usuario: vacío es válido (null); si no, entero entre min y max. */
export function parseOptionalInt(text: string, min: number, max: number): OptionalIntParse {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (value < min || value > max) return { ok: false };
  return { ok: true, value };
}
