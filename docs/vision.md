# Visión

## Problema

Juego Clash of Clans con varias cuentas y voy a crear más. Para saber cuándo queda libre un constructor tengo que entrar a cada cuenta y revisar. Además, mis ideas de qué mejorar después, las bases que me gustan y los ejércitos que quiero probar están dispersos.

## Usuario

Yo. Una sola persona, varias cuentas. La app no es pública en v1.

## Qué hace la app

1. Muestra, por cuenta, todo lo que se está mejorando y cuánto le falta: constructores, laboratorio, casa de mascotas y, si aparecen en el export, base del constructor y otras mejoras. Con el nombre real de cada mejora.
2. Muestra en una vista general cuál constructor queda libre primero entre todas las cuentas.
3. Avisa con una notificación cuando termina una mejora de constructor, de laboratorio o de casa de mascotas.
4. Guarda una lista ordenada de siguientes mejoras por cuenta.
5. Guarda links de bases y de ejércitos para usarlos después, abriéndolos directo en el juego.
6. Con los recursos que escribo, dice si me alcanza para la siguiente mejora de mi cola de sugerencias (el juego no los incluye en el export).

## Alcance de v1

- Constructores de la aldea principal (incluye el constructor B.O.B si aparece en el export).
- Importar export desde el portapapeles; alta automática de cuentas nuevas por tag.
- Notificaciones locales.
- Cola de mejoras sugeridas, bases y ejércitos.
- Respaldo: exportar e importar la base de datos de la app como archivo.

## Fuera de v1 (pero el parser debe guardar los datos)

- Avisos para el herrero y la base del constructor.
- Leer los recursos automáticamente: el export no los trae y la API oficial tampoco; por ahora se escriben a mano.
- Calcular niveles faltantes o "qué me falta para maxear" contra un catálogo del juego.
- Widget de pantalla de inicio.
- Sincronizar entre dispositivos.

## Por qué hacerla si existe Clash Ninja

Clash Ninja resuelve el seguimiento de mejoras desde el navegador. Esta app junta en un solo lugar del teléfono los constructores, mi propia cola de mejoras y mi colección de bases y ejércitos por cuenta, y es un proyecto para aprender.
