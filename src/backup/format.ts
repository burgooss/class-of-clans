// Formato del archivo de respaldo (F8) y su validación. Módulo puro: sin React ni Expo.
// Descripción del formato: docs/modelo-datos.md ("Respaldo").

export const BACKUP_FORMAT = 'clash-builders-backup';
export const BACKUP_VERSION = 1;

type Column = {
  name: string;
  type: 'int' | 'text';
  nullable?: boolean;
  /** Valores permitidos (para columnas con CHECK en la base). */
  oneOf?: readonly string[];
  /** Texto que no puede quedar vacío. */
  nonEmpty?: boolean;
};

// Orden = orden de inserción al restaurar (respeta las referencias). `notification_id` no se
// respalda: las notificaciones son del teléfono y se vuelven a programar al restaurar.
export const TABLES = {
  accounts: [
    { name: 'id', type: 'int' },
    { name: 'tag', type: 'text', nonEmpty: true },
    { name: 'alias', type: 'text', nonEmpty: true },
    { name: 'town_hall', type: 'int', nullable: true },
    { name: 'builder_count', type: 'int', nullable: true },
    { name: 'notifications_on', type: 'int', oneOf: ['0', '1'] },
    { name: 'last_export_id', type: 'int', nullable: true },
    { name: 'created_at', type: 'int' },
    { name: 'gold', type: 'int', nullable: true },
    { name: 'elixir', type: 'int', nullable: true },
    { name: 'dark_elixir', type: 'int', nullable: true },
    { name: 'resources_updated_at', type: 'int', nullable: true },
  ],
  exports: [
    { name: 'id', type: 'int' },
    { name: 'account_id', type: 'int' },
    { name: 'captured_at', type: 'int' },
    { name: 'imported_at', type: 'int' },
    { name: 'raw_json', type: 'text' },
  ],
  active_upgrades: [
    { name: 'id', type: 'int' },
    { name: 'account_id', type: 'int' },
    { name: 'export_id', type: 'int' },
    { name: 'slot_type', type: 'text', nonEmpty: true },
    { name: 'game_id', type: 'int' },
    { name: 'name', type: 'text', nullable: true },
    { name: 'target_level', type: 'int', nullable: true },
    { name: 'ends_at', type: 'int' },
  ],
  suggestions: [
    { name: 'id', type: 'int' },
    { name: 'account_id', type: 'int' },
    { name: 'description', type: 'text', nonEmpty: true },
    { name: 'target_level', type: 'int', nullable: true },
    { name: 'position', type: 'int' },
    { name: 'status', type: 'text', oneOf: ['pending', 'in_progress', 'done'] },
    { name: 'notes', type: 'text', nullable: true },
    { name: 'created_at', type: 'int' },
    { name: 'game_id', type: 'int', nullable: true },
  ],
  layouts: [
    { name: 'id', type: 'int' },
    { name: 'account_id', type: 'int', nullable: true },
    { name: 'name', type: 'text', nonEmpty: true },
    { name: 'url', type: 'text', nonEmpty: true },
    { name: 'town_hall', type: 'int', nullable: true },
    { name: 'kind', type: 'text', oneOf: ['war', 'trophy', 'farm', 'other'] },
    { name: 'notes', type: 'text', nullable: true },
    { name: 'created_at', type: 'int' },
  ],
  armies: [
    { name: 'id', type: 'int' },
    { name: 'account_id', type: 'int', nullable: true },
    { name: 'name', type: 'text', nonEmpty: true },
    { name: 'url', type: 'text', nonEmpty: true },
    { name: 'town_hall', type: 'int', nullable: true },
    { name: 'purpose', type: 'text', oneOf: ['war', 'farm', 'other'] },
    { name: 'notes', type: 'text', nullable: true },
    { name: 'created_at', type: 'int' },
  ],
} as const satisfies Record<string, readonly Column[]>;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

export type Row = Record<string, string | number | null>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** Versión del esquema SQLite con que se creó (`PRAGMA user_version`). */
  schemaVersion: number;
  /** Hora del respaldo, epoch en segundos. */
  exportedAt: number;
  tables: Record<TableName, Row[]>;
};

export type BackupErrorCode = 'invalid_json' | 'not_a_backup' | 'unsupported_version' | 'malformed' | 'inconsistent';

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

// Conversiones de respaldos creados con un esquema anterior: la clave n convierte de n a n+1.
// Cada vez que se agregue una migración en src/db/migrations.ts que cambie datos, añadir aquí
// la conversión equivalente.
const CONVERSIONS: Record<number, (tables: Record<TableName, Row[]>) => void> = {
  // Esquema 2: target_level pasó de guardar el `lvl` del export (nivel actual) al nivel destino.
  1: (tables) => {
    for (const upgrade of tables.active_upgrades) {
      if (typeof upgrade.target_level === 'number') upgrade.target_level += 1;
    }
  },
  // Esquema 3: columnas nuevas y opcionales (recursos de las cuentas, game_id de las sugerencias).
  // Un respaldo anterior no las trae y se leen como null: no hay nada que convertir.
  2: () => {},
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function malformed(where: string, why: string): BackupError {
  return new BackupError('malformed', `El archivo está dañado (${where}: ${why}). No se cambió nada.`);
}

function inconsistent(why: string): BackupError {
  return new BackupError('inconsistent', `El archivo es inconsistente (${why}). No se cambió nada.`);
}

function checkRow(table: TableName, index: number, raw: unknown): Row {
  const where = `${table}[${index}]`;
  if (!isObject(raw)) throw malformed(where, 'no es un objeto');

  const row: Row = {};
  for (const column of TABLES[table] as readonly Column[]) {
    const value = raw[column.name];
    const at = `${where}.${column.name}`;

    if (value === null || value === undefined) {
      if (!column.nullable) throw malformed(at, 'falta el valor');
      row[column.name] = null;
      continue;
    }
    if (column.type === 'int') {
      if (typeof value !== 'number' || !Number.isInteger(value)) throw malformed(at, 'debe ser un entero');
    } else if (typeof value !== 'string') {
      throw malformed(at, 'debe ser texto');
    }
    if (column.nonEmpty && typeof value === 'string' && value.trim() === '') throw malformed(at, 'no puede estar vacío');
    if (column.oneOf && !column.oneOf.includes(String(value))) throw malformed(at, 'valor no permitido');
    row[column.name] = value;
  }
  if (typeof row.id === 'number' && row.id < 1) throw malformed(`${where}.id`, 'debe ser positivo');
  return row;
}

function idsOf(rows: Row[]): Set<number> {
  return new Set(rows.map((r) => r.id as number));
}

function checkIntegrity(tables: Record<TableName, Row[]>): void {
  for (const name of TABLE_NAMES) {
    if (idsOf(tables[name]).size !== tables[name].length) throw inconsistent(`ids repetidos en ${name}`);
  }
  const tags = tables.accounts.map((a) => a.tag);
  if (new Set(tags).size !== tags.length) throw inconsistent('tags de cuenta repetidos');

  const accountIds = idsOf(tables.accounts);
  const exportsById = new Map(tables.exports.map((e) => [e.id as number, e]));

  for (const e of tables.exports) {
    if (!accountIds.has(e.account_id as number)) throw inconsistent('un export apunta a una cuenta inexistente');
  }
  for (const a of tables.accounts) {
    if (a.last_export_id === null) continue;
    const last = exportsById.get(a.last_export_id as number);
    if (!last || last.account_id !== a.id) throw inconsistent('una cuenta apunta a un export que no es suyo');
  }
  for (const u of tables.active_upgrades) {
    const parent = exportsById.get(u.export_id as number);
    if (!accountIds.has(u.account_id as number) || !parent || parent.account_id !== u.account_id) {
      throw inconsistent('una mejora apunta a una cuenta o export inexistente');
    }
  }
  for (const s of tables.suggestions) {
    if (!accountIds.has(s.account_id as number)) throw inconsistent('una sugerencia apunta a una cuenta inexistente');
  }
  for (const name of ['layouts', 'armies'] as const) {
    for (const r of tables[name]) {
      if (r.account_id !== null && !accountIds.has(r.account_id as number)) {
        throw inconsistent(`${name === 'layouts' ? 'una base' : 'un ejército'} apunta a una cuenta inexistente`);
      }
    }
  }
}

/**
 * Valida el texto de un respaldo y devuelve su contenido ya depurado (solo las columnas
 * conocidas). No toca nada: lanza `BackupError` con un mensaje en español si algo no cuadra.
 *
 * @param options.schemaVersion Versión actual del esquema de la app. Un respaldo de un esquema
 *   anterior se convierte al actual; uno de un esquema más nuevo se rechaza.
 */
export function parseBackup(text: string, options: { schemaVersion: number }): Backup {
  let root: unknown;
  try {
    root = JSON.parse(text.replace(/^﻿/, '').trim());
  } catch {
    throw new BackupError('invalid_json', 'El archivo no es un JSON válido.');
  }
  if (!isObject(root) || root.format !== BACKUP_FORMAT) {
    throw new BackupError('not_a_backup', 'El archivo no es un respaldo de Clash Builders.');
  }

  const { version, schemaVersion, exportedAt } = root;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw malformed('version', 'debe ser un entero');
  }
  if (version > BACKUP_VERSION) {
    throw new BackupError('unsupported_version', 'El respaldo se creó con una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.');
  }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) throw malformed('schemaVersion', 'debe ser un entero');
  if (schemaVersion < 1 || schemaVersion > options.schemaVersion) {
    throw new BackupError('unsupported_version', 'El respaldo es de una versión incompatible de la base de datos.');
  }
  if (typeof exportedAt !== 'number' || !Number.isInteger(exportedAt)) throw malformed('exportedAt', 'debe ser un entero');

  const rawTables = root.tables;
  if (!isObject(rawTables)) throw malformed('tables', 'falta');

  const tables = {} as Record<TableName, Row[]>;
  for (const name of TABLE_NAMES) {
    const rows = rawTables[name];
    if (!Array.isArray(rows)) throw malformed(name, 'debe ser una lista');
    tables[name] = rows.map((row, index) => checkRow(name, index, row));
  }
  checkIntegrity(tables);

  for (let from = schemaVersion; from < options.schemaVersion; from++) {
    const convert = CONVERSIONS[from];
    if (!convert) {
      throw new BackupError('unsupported_version', 'El respaldo es de una versión incompatible de la base de datos.');
    }
    convert(tables);
  }

  return { format: BACKUP_FORMAT, version, schemaVersion: options.schemaVersion, exportedAt, tables };
}

/** Cantidad de filas por tabla, para mostrar un resumen antes de restaurar. */
export function summarize(backup: Backup): Record<TableName, number> {
  const counts = {} as Record<TableName, number>;
  for (const name of TABLE_NAMES) counts[name] = backup.tables[name].length;
  return counts;
}
