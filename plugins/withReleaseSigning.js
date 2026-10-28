// Plugin de Expo: firma la versión release del APK con una clave propia, guardada FUERA del
// repositorio, en lugar de la clave de depuración que trae la plantilla (la misma para todos los
// proyectos de Expo).
//
// La clave se lee de ~/.clash-builders/keystore.properties:
//   storeFile=/ruta/absoluta/release.keystore
//   storePassword=...
//   keyAlias=...
//   keyPassword=...
// Si el archivo no existe, compilar la versión release falla con un mensaje claro (no se firma en
// silencio con la clave de depuración). Las compilaciones de depuración no se ven afectadas.
// Ver docs/apk.md.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// clash-builders-release-signing';

const PREAMBLE = `${MARKER}
def releaseKeystoreFile = new File(System.getProperty('user.home'), '.clash-builders/keystore.properties')
def releaseKeystoreProps = new Properties()
if (releaseKeystoreFile.exists()) {
    releaseKeystoreFile.withInputStream { releaseKeystoreProps.load(it) }
}
gradle.taskGraph.whenReady { graph ->
    if (!releaseKeystoreFile.exists() && graph.allTasks.any { it.project.name == 'app' && it.name.toLowerCase().contains('release') }) {
        throw new GradleException("Falta \${releaseKeystoreFile}: crea la clave de firma antes de compilar la versión release (ver docs/apk.md).")
    }
}

`;

const RELEASE_SIGNING = `        release {
            if (releaseKeystoreFile.exists()) {
                storeFile file(releaseKeystoreProps['storeFile'])
                storePassword releaseKeystoreProps['storePassword']
                keyAlias releaseKeystoreProps['keyAlias']
                keyPassword releaseKeystoreProps['keyPassword']
            }
        }
`;

function replaceOnce(contents, pattern, replacement, what) {
  const next = contents.replace(pattern, replacement);
  if (next === contents) {
    // La plantilla de Expo cambió: mejor fallar aquí que firmar con la clave equivocada.
    throw new Error(`withReleaseSigning: no se encontró ${what} en android/app/build.gradle; hay que actualizar el plugin.`);
  }
  return next;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg; // ya aplicado

    gradle = replaceOnce(gradle, /^android \{/m, `${PREAMBLE}android {`, 'el bloque "android {"');
    gradle = replaceOnce(gradle, /(    signingConfigs \{\n)/, `$1${RELEASE_SIGNING}`, 'el bloque "signingConfigs"');
    gradle = replaceOnce(
      gradle,
      /(release \{\n\s*\/\/ Caution[^\n]*\n\s*\/\/ see[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
      'el "signingConfig" del buildType release',
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
