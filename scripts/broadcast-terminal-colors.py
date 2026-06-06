#!/usr/bin/env python3
import glob, os, sys

seq = sys.argv[1].encode().decode("unicode_escape")

for t in glob.glob("/dev/pts/[0-9]*"):
    try:
        with open(t, "w") as f:
            f.write(seq)
    except:
        pass
