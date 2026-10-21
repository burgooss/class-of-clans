# Formato del export del juego

## Cómo obtenerlo

En Clash of Clans: Ajustes → bajar hasta Data Export → Copiar. El JSON queda en el portapapeles.

## Base de este documento

Analizado con 3 exports reales tomados el 2026-10-20 (cuentas A, B y C; ayuntamiento 14, 8 y 4 según el ID `1000001`, ver pendientes), guardados en `samples/` (ignorado por git). **Ninguno tenía impulso activo ni constructores libres**, así que esos casos siguen sin verificar.

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
| 5 | ¿Cuántos constructores? | No hay campo. Se cuenta con las **cabañas de constructor**: elementos de `buildings` con `data = 1000015`, sumando `cnt` (o 1 si no trae). Resultado: A=5, B=3, C=2. | Probable (confirmar con el usuario; ver puntos pendientes) |
| 6 | ¿Qué cambia con impulso activo? | Sin datos: `boosts` vino vacío siempre. | Pendiente (falta `con-impulso.json`) |
| 7 | ¿Cómo se traducen los IDs a nombres? | Sin cambios: catálogo propio o paquete de datos (revisar licencia). | Pendiente |

### IDs observados (inferencia, no confirmada)

Deducidos de la estructura de los datos, no de una fuente oficial:

- `1000001`: Ayuntamiento (es el único con el campo `weapon`; niveles 14, 8 y 4 en las cuentas A, B y C).
- `1000015`: cabaña de constructor (la cantidad total coincide con los constructores esperados).

Cualquier otro nombre requiere el catálogo de la pregunta 7.

## Puntos pendientes de confirmar

1. **Ayuntamiento = `1000001`.** Confirmar con los niveles reales de las 3 cuentas.
2. **Número de constructores** de cada cuenta en el juego, y si alguna tiene B.O.B. En la cuenta A aparece `1000093` (nivel 1, cantidad 1), cuyo significado se desconoce.
3. **¿Mejorar una cabaña ocupa un constructor?** En la cuenta A hay 3 cabañas con `timer`. Si ocupan constructor, los 5 estaban ocupados (3 cabañas + 2 héroes); si no, solo 2 estaban ocupados. Cambia el cálculo de "constructores libres".
4. **Significado de `lvl` cuando hay `timer`:** ¿nivel actual (antes de terminar) o nivel destino? Afecta `active_upgrades.target_level`. Los héroes y los edificios en mejora son buenos casos de prueba.
5. **`helpers`** (`helper_cooldown`) y **`gear_up`**: significado. No bloquean v1.
6. **Impulso activo:** exportar una cuenta con poción de constructor y comparar.
7. **Constructor libre:** exportar una cuenta con algún constructor sin mejora y confirmar que simplemente no hay `timer` para él (los 3 ejemplos tenían todos los constructores ocupados, si el punto 3 resulta afirmativo).

## Ejemplos para pruebas

Guardados en `samples/` (ignorado por git):

- `cuenta-a.json`: ayuntamiento 14, 7 mejoras en curso (edificios, héroes, laboratorio, mascotas).
- `cuenta-b.json`: ayuntamiento 8, 4 mejoras en curso.
- `cuenta-c.json`: ayuntamiento 4, 2 mejoras en curso.
- Por conseguir: `con-impulso.json` (poción de constructor activa) y `sin-mejoras.json` (todos los constructores libres).
