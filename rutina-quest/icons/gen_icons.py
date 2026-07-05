#!/usr/bin/env python3
"""Genera los iconos PNG de Rutina Quest sin dependencias externas.
Dibuja una plantita (brote) sobre un fondo degradado lavanda.
"""
import struct, zlib, math, os

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def draw(size):
    top = (124, 108, 255)      # lavanda claro
    bot = (86, 70, 214)        # lavanda oscuro
    stem = (38, 194, 129)      # verde tallo
    leaf = (46, 210, 145)      # verde hoja
    leaf2 = (120, 230, 170)    # verde hoja claro
    pot = (255, 138, 91)       # maceta
    px = bytearray()
    cx = size / 2
    r_corner = size * 0.22
    for y in range(size):
        row = bytearray([0])  # filtro none
        t = y / size
        bg = lerp(top, bot, t)
        for x in range(size):
            col = bg
            # esquinas redondeadas -> transparente fuera del radio
            a = 255
            if (x < r_corner or x > size - r_corner) and (y < r_corner or y > size - r_corner):
                ex = r_corner if x < r_corner else size - r_corner
                ey = r_corner if y < r_corner else size - r_corner
                if math.hypot(x - ex, y - ey) > r_corner:
                    a = 0
            # maceta (trapecio) en la parte baja
            pot_top = size * 0.66
            pot_bot = size * 0.82
            if pot_top <= y <= pot_bot:
                w = (size * 0.16) + (y - pot_top) / (pot_bot - pot_top) * (size * 0.06)
                if abs(x - cx) < w:
                    col = pot
            # tallo
            if size * 0.32 < y < pot_top and abs(x - cx) < size * 0.02:
                col = stem
            # hoja izquierda (elipse)
            lx, ly = cx - size * 0.11, size * 0.42
            if ((x - lx) / (size * 0.11)) ** 2 + ((y - ly) / (size * 0.06)) ** 2 < 1:
                col = leaf
            # hoja derecha (elipse)
            rx, ry = cx + size * 0.11, size * 0.40
            if ((x - rx) / (size * 0.11)) ** 2 + ((y - ry) / (size * 0.06)) ** 2 < 1:
                col = leaf2
            # brote superior (circulo)
            if math.hypot(x - cx, y - size * 0.33) < size * 0.05:
                col = leaf2
            row += bytes((col[0], col[1], col[2], a))
        px += row
    raw = bytes(px)

    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

here = os.path.dirname(os.path.abspath(__file__))
for s in (192, 512):
    with open(os.path.join(here, f"icon-{s}.png"), "wb") as f:
        f.write(draw(s))
    print("wrote icon-%d.png" % s)
