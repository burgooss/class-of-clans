# Modelo de datos (SQLite)

Nombres de tablas y columnas en inglés. Tiempos en epoch UTC (segundos).

## accounts

Una fila por cuenta del juego.

| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| tag | TEXT UNIQUE NOT NULL | Ej. `#8GGCUQGR9` |
| alias | TEXT NOT NULL | Nombre que le pongo |
| town_hall | INTEGER | Del último export |
| builder_count | INTEGER | Del último export |
| notifications_on | INTEGER | 0/1, default 1 |
| last_export_id | INTEGER FK → exports.id | |
| created_at | INTEGER | |

## exports

Historial de imports. Guarda el JSON crudo para poder re-procesarlo.

| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| account_id | INTEGER FK → accounts.id | |
| captured_at | INTEGER | Hora del export si viene en el JSON; si no, hora del import |
| imported_at | INTEGER | |
| raw_json | TEXT NOT NULL | |

Mantener solo los últimos N exports por cuenta (ej. 10) para no crecer sin límite.

## active_upgrades

Mejoras en curso, generadas por el parser a partir del último export de cada cuenta. Se borran y recrean en cada import.

| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| account_id | INTEGER FK → accounts.id | |
| export_id | INTEGER FK → exports.id | |
| slot_type | TEXT | `builder`, `lab`, `pet_house`, `builder_base`, `other`. Lo decide el parser por la lista del export donde aparece el `timer` (ver `docs/formato-export.md`). |
| game_id | INTEGER | ID del juego |
| name | TEXT | Nombre guardado, si lo hay; normalmente null: el nombre sale del catálogo (`src/catalog`) según `game_id` |
| target_level | INTEGER | Nivel al que sube la mejora: `lvl` del export + 1 (el parser lo expone como `targetLevel`, y como `currentLevel` el `lvl` original). |
| ends_at | INTEGER | `captured_at + segundos_restantes` |
| notification_id | TEXT | ID de la notificación programada. Lo escribe y limpia `syncNotifications`; se pierde junto con la fila al reimportar. |

## suggestions

Mi cola de siguientes mejoras por cuenta.

| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| account_id | INTEGER FK → accounts.id | |
| description | TEXT NOT NULL | Ej. "Torre infernal a 10" |
| target_level | INTEGER | Opcional |
| position | INTEGER | Orden en la cola |
| status | TEXT | `pending`, `in_progress`, `done` |
| notes | TEXT | |
| created_at | INTEGER | |

## layouts (bases)

| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| account_id | INTEGER FK → accounts.id, NULL | NULL = para todas las cuentas |
| name | TEXT NOT NULL | |
| url | TEXT NOT NULL | Link del juego |
| town_hall | INTEGER | |
| kind | TEXT | `war`, `trophy`, `farm`, `other` |
| notes | TEXT | |
| created_at | INTEGER | |

## armies

| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| account_id | INTEGER FK → accounts.id, NULL | NULL = para todas |
| name | TEXT NOT NULL | |
| url | TEXT NOT NULL | Link del juego |
| town_hall | INTEGER | |
| purpose | TEXT | `war`, `farm`, `other` |
| notes | TEXT | |
| created_at | INTEGER | |

## Reglas de cálculo

Suposición provisional (pendiente de confirmar, ver `docs/formato-export.md`):

- Mejorar una cabaña de constructor ocupa un constructor como cualquier otra mejora `builder` (`HUT_UPGRADE_OCCUPIES_BUILDER`).

Hecho comprobado: `lvl` de un elemento en mejora es su nivel **actual**; `active_upgrades.target_level` guarda el nivel destino (`lvl + 1`). Las filas guardadas antes de la migración 2 guardaban `lvl` tal cual y esa migración las corrigió.

Reglas:

- **Constructores libres ahora** = `builder_count` − mejoras con `slot_type = 'builder'` y `ends_at > ahora`.
- **Siguiente libre** = mínimo `ends_at` futuro de las mejoras `builder` de la cuenta.
- Una mejora con `ends_at ≤ ahora` se muestra como terminada aunque no se haya reimportado.
- Un import cuyo `captured_at` es menor al del último export de la cuenta se rechaza sin cambiar nada.
- Borrar una cuenta borra en cascada sus exports, mejoras y sugerencias; las bases y ejércitos asociados pasan a `account_id = NULL`.

## Respaldo (F8)

Un archivo JSON con todos los datos, que se comparte desde Ajustes → Exportar datos y se restaura con Importar datos.

```json
{
  "format": "clash-builders-backup",
  "version": 1,
  "schemaVersion": 1,
  "exportedAt": 1700000000,
  "tables": { "accounts": [], "exports": [], "active_upgrades": [], "suggestions": [], "layouts": [], "armies": [] }
}
```

- `version` es la versión del formato del archivo; `schemaVersion` es la del esquema SQLite (`PRAGMA user_version`). Un respaldo con un `schemaVersion` distinto al de la app se rechaza: cuando el esquema cambie habrá que escribir una conversión.
- Cada tabla lleva todas sus columnas (definidas en `src/backup/format.ts`), **menos** `active_upgrades.notification_id`: las notificaciones son del teléfono y se reprograman al restaurar.
- Importar **reemplaza todo** en una sola transacción. Antes se valida el archivo completo (formato, tipo de cada columna, valores permitidos y referencias entre tablas); si algo no cuadra, no se cambia nada.
- Los IDs se conservan, así que las referencias siguen válidas.
- El archivo incluye los JSON crudos de los exports y los tags de las cuentas: es información personal.
