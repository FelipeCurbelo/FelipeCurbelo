#!/usr/bin/env python3
"""Genera los iconos PNG de CanchApp Arauca sin dependencias externas.
Dibuja un balón de fútbol sobre un campo verde con líneas de cancha.
"""
import struct, zlib, math

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def draw(size):
    top = (18, 184, 134)     # verde claro
    bot = (6, 48, 31)        # verde oscuro
    line = (210, 245, 230)   # líneas de cancha
    ball = (245, 250, 248)   # balón blanco
    spot = (20, 30, 26)      # pentágonos
    px = bytearray()
    cx = cy = size / 2
    r_corner = size * 0.22
    br = size * 0.24          # radio del balón
    for y in range(size):
        row = bytearray([0])  # filtro none
        t = y / size
        bg = lerp(top, bot, t)
        for x in range(size):
            col = bg
            a = 255
            # esquinas redondeadas -> transparente
            if (x < r_corner or x > size - r_corner) and (y < r_corner or y > size - r_corner):
                ex = r_corner if x < r_corner else size - r_corner
                ey = r_corner if y < r_corner else size - r_corner
                if math.hypot(x - ex, y - ey) > r_corner:
                    a = 0
            # línea de medio campo
            if abs(y - cy) < size * 0.012:
                col = line
            # círculo central de la cancha
            dc = math.hypot(x - cx, y - cy)
            if abs(dc - size * 0.30) < size * 0.012:
                col = line
            # balón central
            if dc < br:
                col = ball
                # pentágono central
                if dc < br * 0.34:
                    col = spot
                # 5 pentágonos alrededor
                for k in range(5):
                    ang = math.radians(-90 + k * 72)
                    sx = cx + math.cos(ang) * br * 0.66
                    sy = cy + math.sin(ang) * br * 0.66
                    if math.hypot(x - sx, y - sy) < br * 0.20:
                        col = spot
                # borde del balón
                if dc > br - size * 0.012:
                    col = spot
            row += bytes((col[0], col[1], col[2], a))
        px += row
    raw = bytes(px)

    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for s in (192, 512):
        with open(os.path.join(here, f"icon-{s}.png"), "wb") as f:
            f.write(draw(s))
        print(f"icon-{s}.png listo")
