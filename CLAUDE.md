# Clash Builders — contexto para Claude Code

App personal para Android que permite supervisar los constructores de varias cuentas de Clash of Clans sin abrir el juego, organizar las siguientes mejoras de cada cuenta y guardar links de bases y ejércitos.

## Cómo obtiene los datos (importante)

- **No hay conexión en vivo con el juego.** La API oficial de Supercell no expone temporizadores de constructores y no se debe intentar leer el juego, su tráfico o su memoria.
- La fuente de datos es la **exportación de aldea** del propio juego: Ajustes → Data Export → Copiar. Eso pone un JSON en el portapapeles.
- La app lee ese JSON desde el portapapeles, identifica la cuenta por su tag y calcula a qué hora termina cada mejora.
- Cada export es una foto de ese momento. El usuario vuelve a exportar cuando inicia mejoras nuevas.
- Detalle del formato y lo que falta verificar: `docs/formato-export.md`.

## Documentación

| Archivo | Contenido |
|---|---|
| `docs/vision.md` | Problema, usuario, alcance de v1 y qué queda fuera |
| `docs/funcionalidades.md` | Funciones con criterios de aceptación |
| `docs/formato-export.md` | Lo que sabemos del JSON del juego y cómo verificarlo |
| `docs/modelo-datos.md` | Tablas SQLite y reglas de cálculo |
| `docs/roadmap.md` | Fases de trabajo en orden |

Lee el archivo relevante antes de trabajar en una fase. Si una decisión cambia, actualiza el doc correspondiente en el mismo cambio.

## Stack

- React Native + Expo (TypeScript), objetivo Android.
- `expo-sqlite` para datos locales, `expo-clipboard` para leer el export, `expo-notifications` para avisos locales.
- Todo vive en el teléfono. Sin backend, sin cuentas, sin login en v1.
- Desarrollo en Linux, pruebas en un teléfono Android real con **Expo Go**. Si una librería necesita código nativo que Expo Go no trae, avisar antes de agregarla (obligaría a usar una development build).
- Navegación con expo-router: las rutas viven en `src/app/`; el resto del código (`db/`, `export/`, `components/`) fuera de esa carpeta. Alias `@/` apunta a `src/`.
- Instalar dependencias siempre con `npx expo install <paquete>` para que la versión sea compatible con el SDK.

## Comandos

```bash
npm start            # servidor de desarrollo (escanear el QR con Expo Go)
npm run typecheck    # tsc --noEmit
npm test             # Jest
npx expo-doctor      # diagnóstico de dependencias
```

Antes de dar una tarea por terminada: typecheck y pruebas.

## Convenciones

- Interfaz en español. Código (variables, funciones, tablas) en inglés. Docs en español.
- El parser del export va en un módulo puro (`src/export/`), sin dependencias de React, con pruebas unitarias contra los ejemplos de `samples/`.
- Guardar siempre el JSON crudo de cada import para poder re-procesarlo si el parser cambia.
- Las horas se guardan en UTC (epoch en segundos) y se muestran en la zona del teléfono.
- No inventar campos del export: si algo no aparece en los ejemplos reales, preguntar o dejarlo documentado como pendiente.

## Datos personales

`samples/` contiene exports reales de las cuentas del usuario. Está en `.gitignore`; no subirlo a un repositorio público.
