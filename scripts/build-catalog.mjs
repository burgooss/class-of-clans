// Genera src/catalog/catalog.json: nombre (en inglés), categoría, base y costo/tiempo por nivel de
// cada elemento del juego, por ID.
//
// Fuente: el paquete comunitario `clash-of-clans-data` (MIT). Cada entrada trae `dataId`, el mismo
// número que usa el export del juego. Solo se copian los campos mínimos (no imágenes ni estadísticas).
//
// Formato de cada elemento: [nombre, categoría, base, niveles]. `niveles[i]` es el nivel i+1 y
// vale [costo, recurso, segundos]; está vacío si el paquete no trae costos (ej. equipo de héroe).
//
// Uso:
//   npm pack clash-of-clans-data && tar -xzf clash-of-clans-data-*.tgz     # en una carpeta aparte
//   node scripts/build-catalog.mjs <ruta>/package/data
//
// Los nombres vienen en inglés. Para añadir traducciones, usar src/catalog/names.es.ts.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = process.argv[2];
if (!dataDir) {
  console.error('Uso: node scripts/build-catalog.mjs <ruta a clash-of-clans-data/data>');
  process.exit(1);
}

function* jsonFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* jsonFiles(path);
    else if (entry.endsWith('.json')) yield path;
  }
}

const RESOURCES = {
  Gold: 'gold',
  Elixir: 'elixir',
  'Dark Elixir': 'dark',
  'Gold or Elixir': 'gold_or_elixir',
  'Builder Gold': 'builder_gold',
  'Builder Elixir': 'builder_elixir',
  'Builder Gold or Builder Elixir': 'builder_gold_or_elixir',
};

function seconds(time) {
  return time.days * 86400 + time.hours * 3600 + time.minutes * 60 + time.seconds;
}

const skipped = [];

// El paquete usa build*, upgrade* o research* según el tipo de elemento.
function levelsOf(node) {
  if (!Array.isArray(node.levels)) return [];
  // Se usa solo el primer tramo consecutivo desde el nivel 1 (el índice es el nivel). Algunos
  // elementos traen después otro tramo que vuelve a empezar en 1 con costos y requisitos
  // distintos: es otra variante del elemento, no sus niveles siguientes, y se descarta.
  let length = 0;
  while (length < node.levels.length && node.levels[length].level === length + 1) length++;
  if (length === 0) {
    skipped.push(`${node.name} (${node.dataId}): los niveles no empiezan en 1`);
    return [];
  }
  if (length < node.levels.length) {
    skipped.push(`${node.name} (${node.dataId}): se descartan ${node.levels.length - length} niveles de otra variante`);
  }
  const out = [];
  for (const level of node.levels.slice(0, length)) {
    const kind = ['build', 'upgrade', 'research'].find((k) => typeof level[`${k}Cost`] === 'number');
    if (!kind) return []; // si algún nivel no trae costo, no se guarda ninguno
    const name = level[`${kind}CostResource`];
    if (name === undefined) {
      skipped.push(`${node.name} (${node.dataId}): costo sin tipo de recurso`);
      return [];
    }
    const resource = RESOURCES[name];
    if (!resource) throw new Error(`dataId ${node.dataId}: recurso desconocido "${name}"`);
    out.push([level[`${kind}Cost`], resource, seconds(level[`${kind}Time`])]);
  }
  return out;
}

const items = new Map();
function collect(node, file) {
  if (Array.isArray(node)) return node.forEach((child) => collect(child, file));
  if (node === null || typeof node !== 'object') return;
  // Los módulos de las defensas ensambladas ("Hitpoints", "Damage"…) no tienen categoría ni son mejoras.
  if (Number.isInteger(node.dataId) && typeof node.name === 'string' && node.category) {
    const entry = [node.name, String(node.category), String(node.base ?? ''), levelsOf(node)];
    const previous = items.get(node.dataId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) {
      throw new Error(`dataId ${node.dataId} repetido con datos distintos: "${previous[0]}" y "${entry[0]}" (${file})`);
    }
    items.set(node.dataId, entry);
  }
  for (const child of Object.values(node)) collect(child, file);
}

for (const file of jsonFiles(dataDir)) collect(JSON.parse(readFileSync(file, 'utf8')), file);

const pkg = JSON.parse(readFileSync(join(resolve(dataDir), '..', 'package.json'), 'utf8'));
const source = `${pkg.name}@${pkg.version} (${pkg.license})`;

const ids = [...items.keys()].sort((a, b) => a - b);
const lines = ids.map((id) => `    "${id}": ${JSON.stringify(items.get(id))}`);
const output = `{\n  "source": ${JSON.stringify(source)},\n  "items": {\n${lines.join(',\n')}\n  }\n}\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'catalog', 'catalog.json');
writeFileSync(out, output);
console.log(`${ids.length} elementos de ${source} -> ${out}`);
for (const line of skipped) console.warn(`  ${line}`);
