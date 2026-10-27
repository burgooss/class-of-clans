import { Text as NativeText, type TextProps } from 'react-native';

import { colors } from '@/theme';

/** Text con el color claro del tema por defecto; el estilo que se pase lo puede sobrescribir. */
export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ color: colors.text }, style]} />;
}
