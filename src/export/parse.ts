import { BUILDER_HUT_ID, TOWN_HALL_ID } from './ids';
import { ExportParseError, type ParsedExport, type ParsedUpgrade, type SlotType } from './types';

// Arreglos del export donde se ha visto un `timer`, y qué tipo de espacio ocupan.
// Los demás arreglos con timer (no observados todavía) se clasifican como 'other'
// en lugar de adivinar; los de la base del constructor (sufijo "2") son 'builder_base'.
const SLOT_BY_SOURCE: Record<string, SlotType> = {
  buildings: 'builder',
  heroes: 'builder',
  units: 'lab',
  pets: 'pet_house',
};

const TAG_PATTERN = /^#[0-9A-Z]{3,}$/;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function slotFor(source: string): SlotType {
  if (source in SLOT_BY_SOURCE) return SLOT_BY_SOURCE[source];
  if (source.endsWith('2')) return 'builder_base';
  return 'other';
}

function parseJson(text: string): unknown {
  // El portapapeles puede traer espacios, saltos de línea o un BOM al inicio.
  const trimmed = text.replace(/^﻿/, '').trim();
  if (trimmed === '') {
    throw new ExportParseError('empty', 'El portapapeles está vacío.');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new ExportParseError('invalid_json', 'El portapapeles no contiene un JSON válido.');
  }
}

function readTag(root: Json): string {
  const tag = typeof root.tag === 'string' ? root.tag.trim().toUpperCase() : '';
  if (!TAG_PATTERN.test(tag)) {
    throw new ExportParseError('not_an_export', 'El JSON no parece un export de Clash of Clans (falta el tag).');
  }
  return tag;
}

function readCapturedAt(root: Json, now: number): number {
  const { timestamp } = root;
  if (timestamp === undefined) return now;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    throw new ExportParseError('malformed', 'El campo "timestamp" del export no es válido.');
  }
  return Math.floor(timestamp);
}

/**
 * Convierte el texto del portapapeles en los datos que usa la app.
 *
 * @param text Contenido crudo del portapapeles.
 * @param options.now Hora actual (epoch, segundos). Se usa solo si el export no trae `timestamp`.
 * @throws {ExportParseError} Si el texto no es un export válido. No hay efectos secundarios.
 */
export function parseExport(
  text: string,
  options: { now?: number } = {},
): ParsedExport {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const root = parseJson(text);

  if (!isObject(root)) {
    throw new ExportParseError('not_an_export', 'El JSON no parece un export de Clash of Clans.');
  }
  const tag = readTag(root);
  if (!Array.isArray(root.buildings)) {
    throw new ExportParseError('not_an_export', 'El JSON no parece un export de Clash of Clans (falta "buildings").');
  }
  const capturedAt = readCapturedAt(root, now);

  const upgrades: ParsedUpgrade[] = [];
  let townHall: number | null = null;
  let hutCount = 0;
  let sawHut = false;

  for (const [source, value] of Object.entries(root)) {
    if (!Array.isArray(value)) continue;

    value.forEach((item, index) => {
      // Las listas de cosméticos (house_parts, skins...) son números sueltos.
      if (!isObject(item)) return;

      const { data, lvl, cnt, timer } = item;
      const where = `${source}[${index}]`;
      if (typeof data !== 'number') return;

      const level = typeof lvl === 'number' ? lvl : null;

      if (source === 'buildings') {
        if (data === TOWN_HALL_ID && level !== null) townHall = level;
        if (data === BUILDER_HUT_ID) {
          sawHut = true;
          hutCount += typeof cnt === 'number' ? cnt : 1;
        }
      }

      if (timer === undefined) return;
      if (typeof timer !== 'number' || !Number.isFinite(timer) || timer < 0) {
        throw new ExportParseError('malformed', `El temporizador de ${where} no es válido.`);
      }
      upgrades.push({
        slotType: slotFor(source),
        source,
        gameId: data,
        level,
        remainingSeconds: timer,
        endsAt: capturedAt + Math.floor(timer),
      });
    });
  }

  return {
    tag,
    capturedAt,
    townHall,
    builderCount: sawHut ? hutCount : null,
    upgrades,
  };
}
