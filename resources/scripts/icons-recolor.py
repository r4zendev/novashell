import colorsys
import os
import re
import sys

theme_dir = sys.argv[1]
accent = sys.argv[2].strip().lstrip("#")
if len(accent) != 6:
    raise SystemExit(1)

ar = int(accent[0:2], 16)
ag = int(accent[2:4], 16)
ab = int(accent[4:6], 16)
accent_h, _, accent_s = colorsys.rgb_to_hls(ar / 255.0, ag / 255.0, ab / 255.0)
accent_s = max(accent_s, 0.35)

HEX_RE = re.compile(
    r"(?<![A-Za-z0-9_-])#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})(?![A-Za-z0-9_-])"
)
RGB_RE = re.compile(
    r"rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+)\s*)?\)"
)


def map_rgb(r, g, b):
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
    mapped_l = min(0.94, max(0.06, (lum * 0.9) + 0.04))
    nr, ng, nb = colorsys.hls_to_rgb(accent_h, mapped_l, accent_s)
    return int(round(nr * 255)), int(round(ng * 255)), int(round(nb * 255))


def parse_hex(token):
    value = token[1:]
    if len(value) == 3:
        r, g, b = [int(c * 2, 16) for c in value]
        return r, g, b, None
    if len(value) == 4:
        r, g, b, a = [int(c * 2, 16) for c in value]
        return r, g, b, a
    if len(value) == 6:
        return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), None
    if len(value) == 8:
        return (
            int(value[0:2], 16),
            int(value[2:4], 16),
            int(value[4:6], 16),
            int(value[6:8], 16),
        )
    return None


def replace_hex(content):
    def callback(match):
        start = match.start()
        prefix = content[max(0, start - 4) : start].lower()
        if prefix.endswith("url("):
            return match.group(0)

        parsed = parse_hex(match.group(0))
        if parsed is None:
            return match.group(0)

        r, g, b, a = parsed
        nr, ng, nb = map_rgb(r, g, b)
        if a is None:
            return f"#{nr:02x}{ng:02x}{nb:02x}"

        return f"#{nr:02x}{ng:02x}{nb:02x}{a:02x}"

    return HEX_RE.sub(callback, content)


def replace_rgb(content):
    def callback(match):
        r, g, b = [max(0, min(255, int(match.group(i)))) for i in [1, 2, 3]]
        alpha = match.group(4)
        nr, ng, nb = map_rgb(r, g, b)
        if alpha is None:
            return f"rgb({nr}, {ng}, {nb})"

        return f"rgba({nr}, {ng}, {nb}, {alpha})"

    return RGB_RE.sub(callback, content)


def should_skip(path):
    lower = path.lower()
    if lower.endswith("-symbolic.svg"):
        return True

    return "symbolic" in lower.split(os.sep)


def should_process(path):
    return path.lower().endswith((".svg", ".xml", ".css"))


changed = 0

for root, _, files in os.walk(theme_dir):
    for name in files:
        file_path = os.path.join(root, name)
        if os.path.islink(file_path):
            continue
        if should_skip(file_path) or not should_process(file_path):
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as handle:
                original = handle.read()
        except Exception:
            continue

        updated = replace_rgb(replace_hex(original))
        if updated == original:
            continue

        try:
            with open(file_path, "w", encoding="utf-8") as handle:
                handle.write(updated)
            changed += 1
        except Exception:
            continue

print(changed)
