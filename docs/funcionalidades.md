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
- Lista cada constructor ocupado: qué mejora, a qué nivel y cuenta regresiva en vivo.
- Muestra los constructores libres como "Libre".
- Muestra "Última actualización: hace X" y un aviso si el export tiene más de 24 h.
- Permite renombrar la cuenta (el alias no puede quedar vacío).
- Permite borrar la cuenta, con confirmación. Se borran sus exports, mejoras y sugerencias; sus bases y ejércitos quedan disponibles para todas las cuentas.

## F3. Vista general

- Lista todas las cuentas ordenadas por el constructor que queda libre primero.
- Cada fila: alias, cuántos constructores libres ahora, y cuándo se libera el siguiente.
- Tocar una fila abre el panel de esa cuenta.

## F4. Notificaciones

- Una notificación local cuando termina cada mejora: "Granja TH12: constructor libre".
- Se pueden activar o desactivar por cuenta.
- Al reimportar una cuenta se cancelan sus notificaciones anteriores y se crean las nuevas.
- Una mejora que ya terminó no avisa. Si el usuario niega el permiso del sistema, la app lo indica al importar o al activar el aviso.

## F5. Cola de mejoras sugeridas

Por cuenta, una lista que yo armo de lo que quiero mejorar después.

- Agregar, editar, borrar y reordenar (arrastrar).
- Cada sugerencia: descripción, nivel objetivo opcional, notas, estado (pendiente / en curso / hecha).
- Las hechas se pueden ocultar.

## F6. Bases

- Guardar un link de base con nombre, nivel de ayuntamiento, tipo (guerra, trofeos, farmeo, otro) y notas.
- Opcionalmente asociarla a una cuenta; si no, queda disponible para todas.
- Filtrar por nivel de ayuntamiento y tipo.
- Tocar la base abre el link en el juego.
- Al pegar un link, detectar si es de base y leer el nivel de ayuntamiento del propio link cuando venga ahí.

## F7. Ejércitos

- Igual que bases: nombre, nivel de ayuntamiento, uso (guerra, farmeo, etc.), notas y link.
- Tocar el ejército abre el link en el juego para copiarlo.

## F8. Respaldo

- Exportar todos los datos de la app a un archivo y compartirlo.
- Importar ese archivo para restaurar en otro teléfono o después de reinstalar.
