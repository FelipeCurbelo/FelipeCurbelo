#!/usr/bin/env python3
"""Genera los iconos PNG de Kancha sin dependencias externas.
Dibuja la marca: contorno de cancha + línea de medio campo + círculo central,
en verde lima (#C8F04E) sobre fondo oscuro (#0A0D0B).
"""
import struct, zlib, math

ACC = (200, 240, 78)   # #C8F04E
BG = (10, 13, 11)      # #0A0D0B

def draw(size):
    px = bytearray()
    cx = cy = size / 2
    r_corner = size * 0.22
    sw = max(2, size * 0.028)         # grosor de línea
    # rectángulo de la cancha
    rx, ry = size * 0.30, size * 0.20
    x0, x1 = cx - rx, cx + rx
    y0, y1 = cy - ry, cy + ry
    field_r = size * 0.045            # esquinas del campo
    ring = size * 0.115               # círculo central
    dot = size * 0.028                # punto central

    def on_rrect(x, y):
        # ¿está sobre el borde del rectángulo redondeado del campo?
        if x < x0 - sw or x > x1 + sw or y < y0 - sw or y > y1 + sw:
            return False
        inside = (x0 - sw <= x <= x1 + sw) and (y0 - sw <= y <= y1 + sw)
        outside = (x0 + sw <= x <= x1 - sw) and (y0 + sw <= y <= y1 - sw)
        return inside and not outside

    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            col = BG
            a = 255
            # esquinas redondeadas del icono -> transparente
            if (x < r_corner or x > size - r_corner) and (y < r_corner or y > size - r_corner):
                ex = r_corner if x < r_corner else size - r_corner
                ey = r_corner if y < r_corner else size - r_corner
                if math.hypot(x - ex, y - ey) > r_corner:
                    a = 0
            # borde de la cancha (rect redondeado aproximado)
            if on_rrect(x, y):
                col = ACC
            # línea de medio campo
            if abs(x - cx) < sw / 2 and y0 <= y <= y1:
                col = ACC
            # círculo central
            d = math.hypot(x - cx, y - cy)
            if abs(d - ring) < sw / 2:
                col = ACC
            # punto central
            if d < dot:
                col = ACC
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
