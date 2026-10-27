// Nombres en español de los elementos del juego, por ID. Si un ID no está aquí, la app muestra el
// nombre en inglés del catálogo.
//
// Solo se incluyen los que se conocen con seguridad. NO se verificaron contra el juego en español
// (no hay una fuente oficial a mano); si alguno no coincide con el que ves en el juego, corrígelo
// aquí. Para añadir más, usa el ID de `catalog.json`.
export const NAMES_ES: Record<number, string> = {
  // Edificios
  1000000: 'Campamento',
  1000001: 'Ayuntamiento',
  1000002: 'Recolector de elixir',
  1000003: 'Almacén de elixir',
  1000004: 'Mina de oro',
  1000005: 'Almacén de oro',
  1000006: 'Cuartel',
  1000007: 'Laboratorio',
  1000008: 'Cañón',
  1000009: 'Torre de arqueras',
  1000010: 'Muro',
  1000011: 'Torre de magos',
  1000012: 'Defensa aérea',
  1000013: 'Mortero',
  1000014: 'Castillo del clan',
  1000015: 'Cabaña del constructor',
  1000019: 'Tesla oculta',
  1000020: 'Fábrica de hechizos',
  1000021: 'Ballesta',
  1000023: 'Taladro de elixir oscuro',
  1000024: 'Almacén de elixir oscuro',
  1000026: 'Cuartel oscuro',
  1000027: 'Torre infernal',
  1000029: 'Fábrica de hechizos oscuros',
  1000031: 'Artillería del águila',
  1000032: 'Torre de bombas',
  1000059: 'Taller',
  1000068: 'Casa de mascotas',
  1000070: 'Herrero',

  // Héroes
  28000000: 'Rey Bárbaro',
  28000001: 'Reina Arquera',
  28000002: 'Gran Centinela',
  28000003: 'Máquina Bélica',
  28000004: 'Luchadora Real',

  // Tropas
  4000000: 'Bárbaro',
  4000001: 'Arquera',
  4000002: 'Duende',
  4000003: 'Gigante',
  4000004: 'Rompemuros',
  4000005: 'Globo',
  4000006: 'Mago',
  4000007: 'Curandera',
  4000008: 'Dragón',
  4000009: 'P.E.K.K.A',
  4000010: 'Esbirro',
  4000011: 'Montapuercos',
  4000012: 'Valquiria',
  4000013: 'Golem',
  4000015: 'Bruja',
  4000017: 'Sabueso de lava',
  4000022: 'Lanzarrocas',
  4000023: 'Bebé dragón',
  4000024: 'Minero',
  4000053: 'Yeti',
  4000058: 'Golem de hielo',
  4000059: 'Dragón eléctrico',
  4000065: 'Jinete de dragón',

  // Hechizos
  26000000: 'Hechizo de rayo',
  26000001: 'Hechizo de curación',
  26000002: 'Hechizo de furia',
  26000003: 'Hechizo de salto',
  26000005: 'Hechizo de congelación',
  26000009: 'Hechizo de veneno',
  26000010: 'Hechizo de terremoto',
  26000016: 'Hechizo de clonación',
  26000017: 'Hechizo de esqueletos',
  26000028: 'Hechizo de murciélagos',
  26000035: 'Hechizo de invisibilidad',

  // Mascotas
  73000000: 'L.A.S.S.I',
  73000002: 'Búho eléctrico',
  73000003: 'Unicornio',
  73000004: 'Fénix',

  // Trampas
  12000000: 'Bomba',
  12000002: 'Bomba gigante',
  12000005: 'Bomba aérea',
};
