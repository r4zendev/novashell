import colorsys
import os
import shutil
import sys

try:
    from PIL import Image
except Exception:
    Image = None

target = sys.argv[1]
overlay = sys.argv[2]
raw_names = sys.argv[3] if len(sys.argv) > 3 else ""
names = {n.strip().lower() for n in raw_names.split(",") if n.strip()}
accent = (sys.argv[4] if len(sys.argv) > 4 else "").strip().lstrip("#")


def recolor_png(path, accent_hex):
    if Image is None or len(accent_hex) != 6:
        return

    try:
        ar = int(accent_hex[0:2], 16)
        ag = int(accent_hex[2:4], 16)
        ab = int(accent_hex[4:6], 16)
        accent_h, _, accent_s = colorsys.rgb_to_hls(ar / 255.0, ag / 255.0, ab / 255.0)
        accent_s = max(accent_s, 0.35)

        image = Image.open(path).convert("RGBA")
    except Exception:
        return

    updated = []
    changed = False
    image_data = image.getdata()  # type: ignore[assignment]
    for pixel in image_data:  # type: ignore[misc]
        if not isinstance(pixel, tuple) or len(pixel) != 4:
            continue

        r, g, b, a = pixel
        if a == 0:
            updated.append((r, g, b, a))
            continue

        lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
        mapped_l = min(0.94, max(0.06, (lum * 0.9) + 0.04))
        nr, ng, nb = colorsys.hls_to_rgb(accent_h, mapped_l, accent_s)
        nr = int(round(nr * 255))
        ng = int(round(ng * 255))
        nb = int(round(nb * 255))
        if nr != r or ng != g or nb != b:
            changed = True
        updated.append((nr, ng, nb, a))

    if not changed:
        return

    try:
        image.putdata(updated)
        image.save(path)
    except Exception:
        return


if not names or not os.path.isdir(overlay):
    print(0)
    raise SystemExit(0)

search_dirs = [
    "16x16/apps",
    "16x16@2x/apps",
    "22x22/apps",
    "22x22@2x/apps",
    "24x24/apps",
    "24x24@2x/apps",
    "32x32/apps",
    "32x32@2x/apps",
    "48x48/apps",
    "48x48@2x/apps",
    "64x64/apps",
    "64x64@2x/apps",
    "96x96/apps",
    "128x128/apps",
    "256x256/apps",
    "512x512/apps",
    "scalable/apps",
]

extensions = {".svg", ".png", ".xpm"}
wanted_stems = set()
for icon_name in names:
    wanted_stems.add(icon_name)
    if not icon_name.endswith("-symbolic"):
        wanted_stems.add(f"{icon_name}-symbolic")

copied = 0

for rel_dir in search_dirs:
    abs_dir = os.path.join(overlay, rel_dir)
    if not os.path.isdir(abs_dir):
        continue

    size_dir = rel_dir.split("/", 1)[0]
    size_target = os.path.join(target, size_dir)
    if os.path.islink(size_target):
        try:
            os.unlink(size_target)
        except Exception:
            continue
        os.makedirs(size_target, exist_ok=True)

    target_dir = os.path.join(target, rel_dir)
    if not os.path.isdir(target_dir):
        if os.path.lexists(target_dir):
            try:
                if os.path.isdir(target_dir):
                    shutil.rmtree(target_dir)
                else:
                    os.unlink(target_dir)
            except Exception:
                continue
        os.makedirs(target_dir, exist_ok=True)

    try:
        for file_name in os.listdir(abs_dir):
            stem, ext = os.path.splitext(file_name)
            if stem.lower() not in wanted_stems:
                continue
            if ext.lower() not in extensions:
                continue

            src = os.path.join(abs_dir, file_name)
            dst = os.path.join(target_dir, file_name)
            try:
                shutil.copy2(src, dst)
                if dst.lower().endswith(".png"):
                    recolor_png(dst, accent)
                copied += 1
            except Exception:
                continue
    except Exception:
        continue

print(copied)
