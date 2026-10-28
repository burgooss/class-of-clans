#!/usr/bin/env python3
"""Genera los íconos de la app en assets/: un martillo azul sobre negro mate.

Uso:  python3 scripts/make-icons.py      (requiere Pillow)

Para usar un ícono propio basta con reemplazar los archivos de assets/ (icon.png 1024x1024 sin
transparencia; android-icon-foreground.png y android-icon-monochrome.png 1024x1024 con
transparencia y el dibujo dentro del 66% central; splash-icon.png con transparencia).
Los colores son los de src/theme.ts.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
BACKGROUND = (13, 13, 13, 255)  # colors.background  #0d0d0d
HEAD = (59, 130, 246, 255)  # colors.accent  #3b82f6
HEAD_SHADE = (37, 99, 235, 255)  # colors.accentStrong  #2563eb
HANDLE = (229, 231, 235, 255)  # texto claro
SUPER = 2  # se dibuja al doble de tamaño y se reduce, para bordes suaves
SIZE = 1024


def hammer(color_override=None):
    """Martillo en un lienzo transparente de SIZE x SIZE, centrado y sin salirse del 66% central."""
    s = SIZE * SUPER
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    k = SUPER

    def rrect(box, radius, fill):
        d.rounded_rectangle([v * k for v in box], radius=radius * k, fill=color_override or fill)

    # Mango y cabeza dibujados verticales; luego se gira todo el conjunto.
    rrect((470, 400, 554, 860), 36, HANDLE)
    rrect((290, 170, 734, 410), 44, HEAD)
    rrect((290, 300, 734, 410), 44, HEAD_SHADE)  # franja inferior de la cabeza
    rrect((290, 170, 734, 300), 44, HEAD)

    layer = layer.rotate(-40, resample=Image.BICUBIC, center=(s // 2, int(s * 0.5)))
    # Se recorta al dibujo, se escala para que ocupe ~62% del lienzo y se centra.
    bbox = layer.getbbox()
    layer = layer.crop(bbox)
    target = int(SIZE * 0.62 * SUPER)
    scale = target / max(layer.size)
    layer = layer.resize((int(layer.width * scale), int(layer.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    canvas.paste(layer, ((s - layer.width) // 2, (s - layer.height) // 2), layer)
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    drawing = hammer()
    drawing.save(ASSETS / "android-icon-foreground.png")
    drawing.save(ASSETS / "splash-icon.png")
    hammer((255, 255, 255, 255)).save(ASSETS / "android-icon-monochrome.png")

    icon = Image.new("RGBA", (SIZE, SIZE), BACKGROUND)
    icon.alpha_composite(drawing)
    icon.convert("RGB").save(ASSETS / "icon.png")
    print("Íconos generados en", ASSETS)


main()
