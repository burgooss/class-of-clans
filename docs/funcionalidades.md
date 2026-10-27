# Funcionalidades

Cada función tiene criterios de aceptación: está terminada cuando todos se cumplen.

## F1. Importar export del juego

Botón "Pegar export" que lee el portapapeles.

- Si el JSON es válido y trae un tag nuevo, crea la cuenta y pide un alias (ej. "Principal", "Granja TH12").
- Si el tag ya existe, actualiza esa cuenta y reemplaza sus mejoras activas por las del nuevo export.
- Si el portapapeles no tiene un export válido, muestra un mensaje claro y no cambia nada.
- Guarda el JSON crudo y la hora del import.
- Después de importar, reprograma las notificaciones de esa cuenta.

## F2. Panel de una cuenta

- Muestra alias, tag, nivel de ayuntamiento y número de constructores.
- Lista cada constructor ocupado: nombre de la mejora (del catálogo, en inglés), nivel al que sube y cuenta regresiva en vivo.
- Muestra los constructores libres como "Libre".
- Muestra también las demás mejoras en curso, en su propia sección y solo si hay alguna: laboratorio (tropas), casa de mascotas, base del constructor y otras.
- Las mejoras que ya terminaron según la hora actual (pero el export es anterior) aparecen como "✓ Terminó: …" dentro de su sección.
- Muestra "Última actualización: hace X" y un aviso si el export tiene más de 24 h.
- Permite renombrar la cuenta (el alias no puede quedar vacío).
- Permite borrar la cuenta, con confirmación. Se borran sus exports, mejoras y sugerencias; sus bases y ejércitos quedan disponibles para todas las cuentas.

## F3. Vista general

- Lista todas las cuentas ordenadas por el constructor que queda libre primero.
- Cada fila: alias, cuántos constructores libres ahora, y cuándo se libera el siguiente.
- Si la cuenta tiene algo en curso en el laboratorio o en la casa de mascotas, la fila también muestra cuándo termina lo más próximo de cada uno.
- Tocar una fila abre el panel de esa cuenta.

## F4. Notificaciones

- Una notificación local cuando termina cada mejora de constructores, laboratorio o casa de mascotas: "Granja TH12: constructor libre", "Granja TH12: laboratorio libre", "Granja TH12: casa de mascotas libre". El cuerpo dice qué terminó y a qué nivel.
- Se pueden activar o desactivar por cuenta.
- Al reimportar una cuenta se cancelan sus notificaciones anteriores y se crean las nuevas.
- Una mejora que ya terminó no avisa. Si el usuario niega el permiso del sistema, la app lo indica al importar o al activar el aviso.

## F5. Cola de mejoras sugeridas

Por cuenta, una lista que yo armo de lo que quiero mejorar después.

- Agregar, editar, borrar y reordenar. Por ahora se reordena con botones ▲▼; arrastrar queda pendiente (ver `docs/roadmap.md`).
- Cada sugerencia nueva se agrega al final de la cola. Tocar la etiqueta de estado lo cambia (pendiente → en curso → hecha); el estado también se edita en el formulario.
- Cada sugerencia: descripción, nivel objetivo opcional, notas, estado (pendiente / en curso / hecha).
- Las hechas se pueden ocultar.

### Recursos y costo de las sugerencias

El export del juego no trae los recursos, así que los escribe el usuario.

- En la pantalla de sugerencias de cada cuenta hay un recuadro "Tus recursos" (oro, elixir y elixir oscuro) con "Editar". Acepta `1.5M`, `850k` o `1,234,567`; vacío significa no registrado. Muestra cuándo se escribieron.
- Una sugerencia puede ligarse a un elemento del catálogo ("Elegir del catálogo", con búsqueda en español o inglés). Al elegirlo propone el nivel siguiente al que tiene en el último export.
- Las sugerencias con elemento muestran el costo hasta el nivel objetivo (con el tiempo total) y si alcanza ("✓ Te alcanza" o "Faltan 1.1M de elixir"). Encima de la lista se destaca la primera de la cola con costo por pagar.
- Las sugerencias de texto libre siguen funcionando como antes, sin costo.
- Limitaciones: el costo no incluye descuentos, y los recursos escritos se desactualizan: hay que volver a escribirlos. El costo de elementos de la base del constructor y del equipo de héroe no se calcula.

## F6. Bases

- Guardar un link de base con nombre, nivel de ayuntamiento, tipo (guerra, trofeos, farmeo, otro) y notas.
- Opcionalmente asociarla a una cuenta; si no, queda disponible para todas.
- Filtrar por nivel de ayuntamiento y tipo.
- Tocar la base abre el link en el juego.
- Al pegar un link, detectar si es de base y leer el nivel de ayuntamiento del propio link cuando venga ahí. **Pendiente**: requiere ver links reales; mientras tanto el ayuntamiento se escribe a mano y el link solo debe ser http(s).

## F7. Ejércitos

- Igual que bases: nombre, nivel de ayuntamiento, uso (guerra, farmeo, etc.), notas y link.
- Tocar el ejército abre el link en el juego para copiarlo.

## F8. Respaldo

- Exportar todos los datos de la app a un archivo y compartirlo.
- Importar ese archivo para restaurar en otro teléfono o después de reinstalar.
- Importar reemplaza todos los datos actuales: se muestra un resumen del archivo y se pide confirmación.
- Un archivo dañado, de otra app o de una versión incompatible se rechaza sin cambiar nada.
- Tras restaurar, las notificaciones se reprograman según las mejoras restauradas.
