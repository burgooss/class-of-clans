# Compilar e instalar el APK

La app se prueba con Expo Go durante el desarrollo. Para usarla de verdad en el teléfono se compila un **APK** propio, que se instala como cualquier otra app, no necesita la computadora ni el servidor y tiene su propio ícono.

## Resumen

```bash
npm run build:apk
```

Deja el APK en `dist/clash-builders-<versión>-<versionCode>.apk` (la carpeta `dist/` está en `.gitignore`).

## Primera compilación (2026-10-27)

Con Java 25 compiló sin problemas en 19 min 40 s y el APK pesa 97 MB. Pesa tanto porque lleva el código nativo para las 4 arquitecturas (arm64-v8a, armeabi-v7a, x86 y x86_64); un teléfono moderno solo usa arm64-v8a. Se comprobó con `apksigner` que está firmado con la clave de `~/.clash-builders/` y no con la de depuración, y con `aapt2` que el paquete es `com.burgooss.clashbuilders` y que no declara los permisos de superponerse a otras apps ni de almacenamiento externo. Las compilaciones siguientes usan la caché de Gradle y son mucho más rápidas.

## Requisitos (ya cumplidos en esta computadora)

- **JDK** (Java 25 funciona) y el **Android SDK** en `~/Android/Sdk` (o la variable `ANDROID_HOME`).
- La **clave de firma** (ver abajo). Sin ella la compilación se detiene con un mensaje claro.
- Conexión a internet la primera vez: Gradle descarga sus dependencias, el NDK y un JDK compatible (a través de `foojay`, el servicio estándar de Gradle para eso). Las siguientes compilaciones usan la caché y son mucho más rápidas.

## La clave de firma (importante)

Android solo deja **actualizar** una app instalada si el APK nuevo está firmado con la misma clave que el anterior. Si se pierde la clave, hay que desinstalar la app para instalar una versión nueva, y se pierden sus datos (salvo que antes se haya hecho el respaldo de Ajustes → Exportar datos).

- Está en `~/.clash-builders/`: `release.keystore` (la clave) y `keystore.properties` (sus contraseñas, solo legible por tu usuario).
- **Haz una copia de esa carpeta** en un lugar seguro fuera de la computadora (un USB, un gestor de contraseñas…).
- **Nunca** la subas al repositorio, que es público. Está fuera de él a propósito.
- La lee el plugin `plugins/withReleaseSigning.js`. Si algún día hace falta crearla otra vez (otra computadora):

  ```bash
  mkdir -p ~/.clash-builders && chmod 700 ~/.clash-builders
  keytool -genkeypair -storetype PKCS12 -keystore ~/.clash-builders/release.keystore \
    -alias clash-builders -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Clash Builders"
  ```

  y crear `~/.clash-builders/keystore.properties` con `storeFile` (ruta absoluta), `storePassword`, `keyAlias=clash-builders` y `keyPassword`. Una clave nueva **no** puede actualizar una app instalada con la anterior.

## Instalar en el teléfono

1. Pasa el APK al teléfono: por cable USB, por Drive o por cualquier app de archivos. Con el teléfono conectado y la depuración USB activada también sirve `adb install dist/clash-builders-1.0.0-1.apk`.
2. Ábrelo desde el teléfono. Android pedirá permiso para "instalar apps desconocidas" a la app desde la que lo abres (el administrador de archivos, Drive…). Es normal: el APK no viene de la Play Store.
3. Abre **Clash Builders**.

## Pasar tus datos de Expo Go a la app instalada

La app instalada y Expo Go son aplicaciones distintas y **cada una tiene su propia base de datos**. Las cuentas que importaste en Expo Go no aparecen solas en la app nueva. Para pasarlas:

1. En la versión de **Expo Go**: Ajustes → **Exportar datos** y compártelo contigo (Drive, WhatsApp…).
2. En la app **instalada**: Ajustes → **Importar datos** y elige ese archivo.

El archivo incluye los tags de tus cuentas; no lo compartas con nadie más.

## Sacar una versión nueva

1. En `app.json` sube `version` (por ejemplo `1.0.1`) y **`android.versionCode`** (un entero que siempre debe aumentar: `2`, `3`…). Android rechaza instalar un APK con un `versionCode` menor o igual al instalado.
2. `npm run build:apk`.
3. Instala el APK nuevo encima: como está firmado con la misma clave, **conserva todos los datos**.

## Qué cambia respecto a Expo Go

- Los módulos nativos están incluidos completos. En Expo Go el canal de notificaciones de Android fallaba; en la app instalada debería crearse bien y los avisos usarán su propio canal ("Constructores libres").
- El fondo de arranque es negro (`expo-splash-screen`), igual que la app.
- Se quitan permisos que la plantilla trae solo para desarrollo (superponerse a otras apps y acceso a almacenamiento externo).
- Los íconos los genera `scripts/make-icons.py`; para usar uno propio basta con reemplazar los archivos de `assets/` (las medidas están en el script).

## Si algo falla

- **"Falta ~/.clash-builders/keystore.properties"**: falta la clave de firma (arriba).
- **Error de JDK o de Gradle**: la compilación usa el Java del sistema. Si falla por la versión, instala Java 21 (`sudo dnf install java-21-openjdk-devel`) y vuelve a lanzar con `JAVA_HOME=/usr/lib/jvm/java-21-openjdk npm run build:apk`.
- **"App no instalada" al instalar**: hay otra versión instalada firmada con otra clave. Desinstálala (haz antes el respaldo de datos) e instala de nuevo.
- **No actualiza e instala como una app distinta**: el `versionCode` no subió.

## Nota sobre el nombre

Es una app personal, instalada solo en tu teléfono. Si algún día se publicara (Play Store, GitHub Releases…), conviene revisar antes la política de contenido de fans de Supercell, que limita el uso de sus marcas (incluida la palabra "Clash") en nombres e íconos de apps ajenas.
