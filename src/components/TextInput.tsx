import { TextInput as NativeTextInput, type TextInputProps } from 'react-native';

import { colors } from '@/theme';

/** TextInput con texto claro, marcador gris y teclado oscuro; el estilo que se pase lo puede sobrescribir. */
export function TextInput({ style, ...props }: TextInputProps) {
  return (
    <NativeTextInput
      placeholderTextColor={colors.placeholder}
      selectionColor={colors.accent}
      keyboardAppearance="dark"
      {...props}
      style={[{ color: colors.text }, style]}
    />
  );
}
