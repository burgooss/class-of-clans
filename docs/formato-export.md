# Formato del export del juego

## Cómo obtenerlo

En Clash of Clans: Ajustes → bajar hasta Data Export → Copiar. El JSON queda en el portapapeles.

## Lo que sabemos con certeza

- Existe desde la actualización de junio de 2025.
- Incluye niveles de estructuras y mejoras activas.
- Es una foto del momento en que se presiona Copiar.
- Si hay pociones o impulsos activos al exportar, los tiempos restantes pueden quedar desajustados.

## Hipótesis a verificar con exports reales

Esto es lo que se espera encontrar, pero **no está confirmado**. La fase 1 del roadmap consiste en revisarlo contra ejemplos reales y reescribir esta sección con lo que de verdad trae.

- Un campo con el tag del jugador.
- Un campo con la hora del export (si no existe, se usa la hora del import).
- Listas por categoría (edificios, héroes, tropas, hechizos, mascotas, equipo, y equivalentes de la base del constructor).
- Cada elemento identificado por un ID numérico del juego, no por nombre, con su nivel y cantidad.
- Las mejoras en curso con un tiempo restante en segundos.
- Los constructores (cabañas, B.O.B) aparecen como edificios, de donde se puede sacar cuántos hay.

## Preguntas abiertas

1. ¿Cómo se llama exactamente cada campo?
2. ¿Hay hora del export dentro del JSON?
3. ¿El temporizador está en segundos restantes o es una hora de fin?
4. ¿Cómo se distingue una mejora de edificio, de héroe y de laboratorio?
5. ¿Cuántos constructores tiene la cuenta? ¿Se cuenta por cabañas o hay un campo?
6. ¿Qué cambia si hay un impulso activo?
7. ¿Cómo se traducen los IDs a nombres? Opciones: un catálogo propio en JSON, o un paquete de datos del juego (revisar licencia antes de usarlo).

## Ejemplos para pruebas

Guardar en `samples/` (ignorado por git):

- `cuenta-a.json`: cuenta con varios constructores ocupados.
- `cuenta-b.json`: otra cuenta, idealmente otro nivel de ayuntamiento.
- `con-impulso.json`: export tomado con una poción de constructor activa.
- `sin-mejoras.json`: cuenta con todos los constructores libres.
