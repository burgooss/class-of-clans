// Tipos de salida del parser. Sin dependencias de React ni de Expo.
// Estructura del JSON de entrada: docs/formato-export.md

export type SlotType = 'builder' | 'lab' | 'pet_house' | 'builder_base' | 'other';

export type ParsedUpgrade = {
  slotType: SlotType;
  /** Clave del arreglo del export donde apareció (ej. "buildings", "heroes"). */
  source: string;
  gameId: number;
  /** `lvl` del export: el nivel actual, antes de terminar la mejora. */
  currentLevel: number | null;
  /**
   * Nivel al que sube la mejora: `currentLevel + 1`. Se comprobó con los tiempos del catálogo:
   * en 6 de 13 mejoras el `timer` es mayor que el tiempo total del nivel `lvl`, así que `lvl`
   * no puede ser el destino (ver docs/formato-export.md).
   */
  targetLevel: number | null;
  remainingSeconds: number;
  /** Epoch UTC en segundos: capturedAt + remainingSeconds. */
  endsAt: number;
};

export type ParsedExport = {
  /** Tag normalizado en mayúsculas, con `#`. */
  tag: string;
  /** Epoch UTC en segundos. Viene del export; si falta, la hora de import. */
  capturedAt: number;
  /** Nivel de ayuntamiento, o null si no se encontró. */
  townHall: number | null;
  /** Cantidad de cabañas de constructor, o null si no se encontró ninguna. */
  builderCount: number | null;
  upgrades: ParsedUpgrade[];
};

export type ExportErrorCode = 'empty' | 'invalid_json' | 'not_an_export' | 'malformed';

export class ExportParseError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.name = 'ExportParseError';
    this.code = code;
  }
}
