// Paleta única de la app: tema oscuro con fondo negro mate. Todos los colores de las pantallas
// salen de aquí, así que cambiar el aspecto es tocar este archivo.
export const colors = {
  /** Fondo de todas las pantallas (negro mate). */
  background: '#0d0d0d',
  /** Barra superior y barra de pestañas. */
  bar: '#121212',
  /** Filas y tarjetas sobre el fondo. */
  surface: '#1a1a1a',
  /** Tarjetas de los cuadros de diálogo (formularios). */
  modal: '#1f1f1f',
  /** Etiquetas y filtros sin seleccionar. */
  chip: '#2a2a2a',
  border: '#2e2e2e',
  inputBorder: '#444444',
  text: '#ececec',
  placeholder: '#7a7a7a',
  backdrop: 'rgba(0, 0, 0, 0.65)',

  /** Fondo de botones y de las etiquetas seleccionadas. */
  accentStrong: '#2563eb',
  /** Enlaces y texto de acción sobre fondo oscuro. */
  accent: '#3b82f6',
  danger: '#f87171',

  success: '#4ade80',
  successBg: '#052e16',
  warningBg: '#422006',
  warningText: '#fcd34d',
  progressBg: '#713f12',
  doneBg: '#14532d',
} as const;
