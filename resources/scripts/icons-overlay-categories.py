import os
import shutil
import sys

target = sys.argv[1]
overlay = sys.argv[2]

paths = [
    "status",
    "panel",
    "places",
    "devices",
    "symbolic/status",
    "symbolic/panel",
    "symbolic/places",
    "symbolic/devices",
]

for size_name in os.listdir(overlay):
    size_dir = os.path.join(overlay, size_name)
    if not os.path.isdir(size_dir):
        continue

    target_size = os.path.join(target, size_name)
    if os.path.islink(target_size):
        try:
            os.unlink(target_size)
            os.makedirs(target_size, exist_ok=True)
        except Exception:
            continue

    for rel_path in paths:
        src = os.path.join(size_dir, rel_path)
        if not os.path.isdir(src):
            continue

        dst = os.path.join(target_size, rel_path)
        try:
            if os.path.lexists(dst):
                if os.path.isdir(dst) and not os.path.islink(dst):
                    shutil.rmtree(dst)
                else:
                    os.unlink(dst)

            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copytree(src, dst, symlinks=True)
        except Exception:
            continue
