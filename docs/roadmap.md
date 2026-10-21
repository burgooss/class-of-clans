# Roadmap

Trabajar una fase a la vez. Al terminar cada una: probar en el teléfono, marcarla y actualizar los docs si algo cambió.

## Fase 0 — Preparación (manual, sin código)

- [ ] Copiar el export de 2–4 cuentas y guardarlos en `samples/` (ver `docs/formato-export.md`).
- [ ] Incluir uno tomado con una poción de constructor activa.
- [x] Crear el repo y agregar `samples/` a `.gitignore`. (https://github.com/burgooss/class-of-clans — **público**, por eso `samples/` nunca se sube)

## Fase 1 — Entender el export

- [ ] Analizar los ejemplos de `samples/` y documentar la estructura real en `docs/formato-export.md`.
- [ ] Responder las preguntas abiertas de ese doc.
- [ ] Ajustar `docs/modelo-datos.md` si algo no encaja.

## Fase 2 — Esqueleto

- [x] Proyecto Expo (SDK 58) con TypeScript, expo-router y Jest (`jest-expo`).
- [x] Navegación: pestañas General, Bases, Ejércitos, Ajustes; pantallas de pila Cuenta y Sugerencias (las sugerencias son por cuenta, así que viven bajo `account/[id]/`).
- [x] SQLite con migraciones (`src/db/migrations.ts`) y las tablas del modelo.
- [ ] Probar el esqueleto en el teléfono con Expo Go.

## Fase 3 — Parser

- [ ] Módulo puro `src/export/` que recibe el texto del JSON y devuelve tag, nivel de ayuntamiento, número de constructores y mejoras activas.
- [ ] Pruebas unitarias con cada ejemplo de `samples/`.
- [ ] Errores claros para JSON inválido o que no es un export.

## Fase 4 — Importar y ver constructores (F1, F2, F3)

- [ ] Botón "Pegar export" con alta automática de cuenta nueva.
- [ ] Panel de cuenta con cuentas regresivas.
- [ ] Vista general ordenada por siguiente constructor libre.

## Fase 5 — Notificaciones (F4)

- [ ] Programar, cancelar y reprogramar al reimportar.
- [ ] Interruptor por cuenta.
- [ ] Probar con el teléfono bloqueado.

## Fase 6 — Cola de mejoras (F5)

## Fase 7 — Bases y ejércitos (F6, F7)

- [ ] Verificar el formato real de los links del juego antes de escribir la detección.

## Fase 8 — Respaldo (F8)

## Después de v1

- Laboratorio, mascotas, herrero y base del constructor.
- Catálogo de nombres para los IDs del juego.
- Widget de pantalla de inicio.
