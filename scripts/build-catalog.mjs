// Genera src/catalog/catalog.json: nombre, categoría y base de cada elemento del juego, por ID.
//
// Fuente: el paquete comunitario `clash-of-clans-data` (MIT). Cada entrada trae `dataId`, el mismo
// número que usa el export del juego. Solo se copian los campos mínimos (no costos ni imágenes).
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

const items = new Map();
function collect(node, file) {
  if (Array.isArray(node)) return node.forEach((child) => collect(child, file));
  if (node === null || typeof node !== 'object') return;
  if (Number.isInteger(node.dataId) && typeof node.name === 'string') {
    const entry = [node.name, String(node.category ?? ''), String(node.base ?? '')];
    const previous = items.get(node.dataId);
    if (previous && previous[0] !== entry[0]) {
      throw new Error(`dataId ${node.dataId} repetido con nombres distintos: "${previous[0]}" y "${entry[0]}" (${file})`);
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
