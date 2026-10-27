# Formato del export del juego

## Cómo obtenerlo

En Clash of Clans: Ajustes → bajar hasta Data Export → Copiar. El JSON queda en el portapapeles.

## Base de este documento

Analizado con 3 exports reales tomados el 2026-10-20 (cuentas A, B y C; ayuntamiento 14, 8 y 4), guardados en `samples/` (ignorado por git). **Ninguno tenía impulso activo ni constructores libres**, así que esos casos siguen sin verificar.

Estado de cada afirmación: **Confirmado** (visto directamente en los datos), **Probable** (los datos lo sugieren, falta confirmar con el usuario o con un export más) o **Pendiente**.

## Estructura (Confirmado)

Un objeto JSON plano, en una sola línea. Claves de primer nivel:

| Clave | Contenido |
|---|---|
| `tag` | Tag del jugador, con `#` (ej. `#XXXXXXXXX`). |
| `timestamp` | Hora del export, epoch en **segundos**. |
| `helpers` | Solo aparece en cuentas con ayudantes. Elementos `{data, lvl, helper_cooldown}`. |
| `buildings`, `traps`, `decos`, `obstacles` | Aldea principal. |
| `units`, `siege_machines`, `spells`, `heroes`, `pets`, `equipment` | Tropas, máquinas, hechizos, héroes, mascotas, equipo. |
| `house_parts`, `skins`, `sceneries` | Listas de IDs numéricos sueltos (cosméticos). |
| `buildings2`, `traps2`, `decos2`, `obstacles2`, `units2`, `heroes2`, `skins2`, `sceneries2` | Base del constructor (sufijo `2`). |
| `boosts` | Objeto. Vacío `{}` en los 3 ejemplos. |

Todas las claves de lista aparecen siempre, aunque vengan vacías (`[]`), excepto `helpers`.

### Elementos

- `data`: ID numérico del juego (no hay nombres en el export).
- `lvl`: nivel.
- `cnt`: cantidad. Un mismo ID puede repetirse con distintos `lvl` (ej. muros por nivel).
- `timer`: **segundos restantes** de una mejora en curso. Solo aparece en elementos que se están mejorando.
- Un elemento sin `cnt` representa un edificio individual con estado propio (mejora en curso u otros campos). **Probable**: se suma a los agrupados con `cnt` (ej. un cañón con `gear_up` + 6 con `cnt` = 7 cañones).
- Campos que aparecen solo en edificios y que v1 ignora (pero quedan en el JSON crudo): `weapon`, `gear_up`, `types`/`modules` (anidados).

## Preguntas abiertas del diseño original

| # | Pregunta | Respuesta | Estado |
|---|---|---|---|
| 1 | Nombre de los campos | Ver tablas de arriba. | Confirmado |
| 2 | ¿Hora del export en el JSON? | Sí: `timestamp` (epoch, segundos). Los 3 exports, tomados uno tras otro, difieren 66 s y 41 s entre sí. | Confirmado |
| 3 | ¿`timer` es restante o fin? | **Segundos restantes.** Dos mejoras idénticas (mismo ID y nivel) tienen timers que difieren en 6 s, algo imposible si fueran duración total, y los valores son muy pequeños para ser epoch. Fin de la mejora = `timestamp + timer`. | Probable (comprobar re-exportando una cuenta y viendo que el timer baja) |
| 4 | ¿Cómo se distingue edificio / héroe / laboratorio? | **Por la clave del arreglo donde aparece el `timer`.** Observado: `buildings` y `heroes` (constructor), `units` (laboratorio), `pets` (casa de mascotas). No se vio ningún timer en `spells`, `siege_machines`, `equipment` ni en las claves con sufijo `2`. | Confirmado para lo observado |
| 5 | ¿Cuántos constructores? | No hay campo. Se cuenta con las **cabañas de constructor**: elementos de `buildings` con `data = 1000015`, sumando `cnt` (o 1 si no trae). Resultado: A=5, B=3, C=2. | Confirmado por el usuario (2026-10-20) |
| 6 | ¿Qué cambia con impulso activo? | Sin datos: `boosts` vino vacío siempre. | Pendiente (falta `con-impulso.json`) |
| 7 | ¿Cómo se traducen los IDs a nombres? | Con el catálogo `src/catalog/catalog.json`, generado por `scripts/build-catalog.mjs` a partir del paquete comunitario `clash-of-clans-data` (MIT), cuyo `dataId` es el mismo número que el export. Cubre los 332 elementos de los 3 ejemplos y los IDs vistos en el teléfono. Nombres en inglés. La licencia está en `src/catalog/LICENSE-clash-of-clans-data.txt`. | Confirmado |

### IDs confirmados

Deducidos de la estructura de los datos y confirmados por el usuario con sus cuentas:

- `1000001`: Ayuntamiento (es el único con el campo `weapon`; niveles 14, 8 y 4 en las cuentas A, B y C).
- `1000015`: cabaña de constructor (la cantidad total coincide con los constructores de cada cuenta: 5, 3 y 2).

Los demás nombres salen del catálogo de la pregunta 7.

## Puntos pendientes de confirmar

1. ~~Ayuntamiento = `1000001`~~ y ~~número de constructores~~: confirmados.
2. ~~**B.O.B.**~~ Resuelto con el catálogo: `1000093` es la **Casa de ayudantes** (Helper Hut), donde viven los ayudantes (`helpers`: Aprendiz de constructor, Asistente de laboratorio, Prospector). La cabaña de B.O.B es `1000064` y no aparece en ningún ejemplo, así que ninguna de esas cuentas la tiene.
3. **¿Mejorar una cabaña ocupa un constructor?** En la cuenta A hay 3 cabañas con `timer`. Si ocupan constructor, los 5 estaban ocupados (3 cabañas + 2 héroes); si no, solo 2 estaban ocupados. Cambia el cálculo de "constructores libres".
4. ~~**Significado de `lvl` cuando hay `timer`**~~ **Resuelto (2026-10-27): es el nivel ACTUAL; la mejora sube a `lvl + 1`.** Con los tiempos de construcción del catálogo se comprobó que el `timer` restante nunca puede superar el tiempo total de la mejora. En 6 de las 13 mejoras de los ejemplos el `timer` es mayor que el tiempo del nivel `lvl` (Castillo del clan `lvl` 3: 15,2 h restantes contra 12 h de construcción; almacenes de elixir `lvl` 6: 1,9 h contra 1 h; cabañas `lvl` 3: 73 h contra 72 h), lo que descarta "`lvl` = destino". Las 13 son compatibles con "`lvl` = actual" y ninguna lo contradice. Los héroes, tropas y mascotas no discriminan (sus tiempos de `lvl` y `lvl + 1` coinciden o sobran), así que se asume la misma regla.
5. **`helpers`** (`helper_cooldown`) y **`gear_up`**: significado. No bloquean v1.
6. **Impulso activo:** exportar una cuenta con poción de constructor y comparar.
7. **Constructor libre:** exportar una cuenta con algún constructor sin mejora y confirmar que simplemente no hay `timer` para él (los 3 ejemplos tenían todos los constructores ocupados, si el punto 3 resulta afirmativo).

Mientras tanto la app usa una suposición provisional, en una constante de `src/domain/builders.ts`: la del punto 3 (`HUT_UPGRADE_OCCUPIES_BUILDER = true`).

## Ejemplos para pruebas

Guardados en `samples/` (ignorado por git):

- `cuenta-a.json`: ayuntamiento 14, 7 mejoras en curso (edificios, héroes, laboratorio, mascotas).
- `cuenta-b.json`: ayuntamiento 8, 4 mejoras en curso.
- `cuenta-c.json`: ayuntamiento 4, 2 mejoras en curso.
- Por conseguir: `con-impulso.json` (poción de constructor activa) y `sin-mejoras.json` (todos los constructores libres).
