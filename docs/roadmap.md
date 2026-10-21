# Roadmap

Trabajar una fase a la vez. Al terminar cada una: probar en el teléfono, marcarla y actualizar los docs si algo cambió.

## Fase 0 — Preparación (manual, sin código)

- [ ] Copiar el export de 2–4 cuentas y guardarlos en `samples/` (ver `docs/formato-export.md`).
- [ ] Incluir uno tomado con una poción de constructor activa.
- [x] Crear el repo y agregar `samples/` a `.gitignore`. (https://github.com/burgooss/class-of-clans — **público**, por eso `samples/` nunca se sube)

## Fase 1 — Entender el export

- [x] Analizar los ejemplos de `samples/` y documentar la estructura real en `docs/formato-export.md`.
- [ ] Responder las preguntas abiertas de ese doc.
- [ ] Ajustar `docs/modelo-datos.md` si algo no encaja.

## Fase 2 — Esqueleto

- [x] Proyecto Expo (SDK 58) con TypeScript, expo-router y Jest (`jest-expo`).
- [x] Navegación: pestañas General, Bases, Ejércitos, Ajustes; pantallas de pila Cuenta y Sugerencias (las sugerencias son por cuenta, así que viven bajo `account/[id]/`).
- [x] SQLite con migraciones (`src/db/migrations.ts`) y las tablas del modelo.
- [ ] Probar el esqueleto en el teléfono con Expo Go.

## Fase 3 — Parser

- [x] Módulo puro `src/export/` que recibe el texto del JSON y devuelve tag, nivel de ayuntamiento, número de constructores y mejoras activas. (Versión inicial; ver pendientes en `docs/formato-export.md`.)
- [x] Pruebas unitarias con cada ejemplo de `samples/` (se saltan solas si la carpeta no existe).
- [x] Errores claros para JSON inválido o que no es un export (`ExportParseError` con código y mensaje en español).

## Fase 4 — Importar y ver constructores (F1, F2, F3)

- [x] Botón "Pegar export" con alta automática de cuenta nueva (pide alias).
- [x] Panel de cuenta con cuentas regresivas.
- [x] Vista general ordenada por siguiente constructor libre.
- [ ] Probar en el teléfono con Expo Go y con exports reales.
- [ ] Quitar las suposiciones provisionales cuando se confirmen las dudas 3 y 4 de `docs/formato-export.md` (constantes en `src/domain/builders.ts`).

Notas:
- La reprogramación de notificaciones al reimportar (F1) queda para la Fase 5.
- Un export más antiguo que el último importado de esa cuenta se rechaza, para no pisar datos recientes con un portapapeles viejo.
- Renombrar y borrar cuentas está en el panel de cuenta (`src/db/accounts.ts`). Al borrar, `deleteAccount` devuelve los IDs de notificación de esa cuenta para que la Fase 5 los cancele.

## Fase 5 — Notificaciones (F4)

- [x] Programar, cancelar y reprogramar al reimportar y al borrar una cuenta (`syncNotifications`, `src/notifications/sync.ts`).
- [x] Interruptor por cuenta en el panel de cuenta.
- [ ] Probar con el teléfono bloqueado (ver puntualidad abajo).

Notas:
- Las notificaciones locales funcionan en Expo Go en Android (SDK 58); lo que Expo Go no soporta es el push remoto, que la app no usa. No hace falta development build.
- `syncNotifications` es declarativa e idempotente: compara lo que debería estar programado según la base con lo que el sistema tiene programado y corrige la diferencia. Se llama tras importar, renombrar, borrar, cambiar el interruptor y al abrir la app.
- Solo avisan las mejoras de tipo `builder` (mismas suposiciones provisionales que el cálculo de constructores libres).
- **Puntualidad:** sin el permiso `SCHEDULE_EXACT_ALARM`, Android puede retrasar el aviso unos minutos con el teléfono en reposo. Ese permiso no se puede añadir dentro de Expo Go; exigiría una development build. Decidir después de probar con el teléfono bloqueado.

## Fase 6 — Cola de mejoras (F5)

- [x] Agregar, editar y borrar sugerencias por cuenta (descripción, nivel objetivo opcional, notas, estado).
- [x] Reordenar con botones ▲▼ (`moveSuggestion`; salta las hechas cuando están ocultas).
- [x] Ocultar las hechas.
- [ ] Reordenar arrastrando. Se dejó con botones: SDK 58 trae `react-native-gesture-handler` 3.x y `react-native-draggable-flatlist` no se actualiza desde mayo de 2025, así que no se pudo garantizar sin probar en el teléfono. La lógica de orden (`moveWithin` en `src/domain/suggestions.ts` y `moveSuggestion` en `src/db/suggestions.ts`) no depende de la interfaz; para arrastrar habría que añadir una función que reciba el orden completo y dejar la pantalla como único cambio grande.
- [ ] Probar en el teléfono.

## Fase 7 — Bases y ejércitos (F6, F7)

- [x] Guardar, editar y borrar bases y ejércitos (nombre, link, ayuntamiento opcional, tipo/uso, cuenta opcional, notas).
- [x] Filtrar por ayuntamiento y tipo/uso. Tocar un elemento abre su link (`Linking.openURL`); el botón "Editar" abre el formulario.
- [x] Botón "Pegar del portapapeles" en el formulario para traer el link.
- [ ] **Verificar el formato real de los links del juego** (copiar de la app un link de base y uno de ejército y pegarlos en el chat).
- [ ] **Detección al pegar** (F6): reconocer si el link es de base y leer el ayuntamiento del propio link. No se escribió porque no se ha visto ningún link real; hoy solo se exige que sea http(s).
- [ ] Probar en el teléfono que el link abre el juego.

## Fase 8 — Respaldo (F8)

- [x] Exportar todos los datos a un archivo JSON y compartirlo (`expo-file-system` + `expo-sharing`).
- [x] Importar el archivo (`expo-document-picker`): valida todo antes de tocar nada, pide confirmación y reemplaza en una transacción.
- [x] Reprogramar las notificaciones tras restaurar.
- [ ] Probar en el teléfono: exportar, desinstalar o borrar datos de la app, e importar. Comprobar también que el selector de archivos encuentra el respaldo (se acepta cualquier tipo de archivo).

## Después de v1

- Laboratorio, mascotas, herrero y base del constructor.
- Catálogo de nombres para los IDs del juego.
- Widget de pantalla de inicio.
