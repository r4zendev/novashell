#!/usr/bin/env python3
import zipfile, sys, os

theme_path, colors_path, bg_path = sys.argv[1:4]

with zipfile.ZipFile(theme_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(colors_path, "colors.tdesktop-theme")
    z.write(bg_path, "background.jpg")

os.unlink(bg_path)
