#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NSH_SPEC_FILE="$ROOT_DIR/nsh.usage.kdl"
NSH_MSG_SPEC_FILE="$ROOT_DIR/nsh-msg.usage.kdl"
FISH_COMPLETION_DIR="$ROOT_DIR/../stow/linux/.config/fish/completions"
FISH_COMPLETION_NSH_FILE="$FISH_COMPLETION_DIR/nsh.fish"
FISH_COMPLETION_NSH_MSG_FILE="$FISH_COMPLETION_DIR/nsh-msg.fish"

if ! command -v usage >/dev/null 2>&1; then
	echo "usage CLI not found. Install it first to regenerate nsh completion artifacts."
	exit 1
fi

usage lint "$NSH_SPEC_FILE"
usage lint "$NSH_MSG_SPEC_FILE"
mkdir -p "$FISH_COMPLETION_DIR"
usage generate completion fish nsh -f "$NSH_SPEC_FILE" > "$FISH_COMPLETION_NSH_FILE"
usage generate completion fish nsh-msg -f "$NSH_MSG_SPEC_FILE" > "$FISH_COMPLETION_NSH_MSG_FILE"

FISH_COMPLETION_FILES="$FISH_COMPLETION_NSH_FILE:$FISH_COMPLETION_NSH_MSG_FILE" python - <<'PY'
import os
import re
from pathlib import Path

pattern = re.compile(
    r'# if "usage" is not installed show an error\n'
    r'if ! type -p usage &> /dev/null\n'
    r'(?:    .*\n)*?'
    r'end\n',
    re.MULTILINE,
)

new = """# quietly skip dynamic completions when usage is unavailable
if ! type -p usage &> /dev/null
    return 0
end
"""

for raw_path in os.environ["FISH_COMPLETION_FILES"].split(":"):
    path = Path(raw_path)
    text = path.read_text(encoding="utf-8")
    path.write_text(pattern.sub(new, text, count=1), encoding="utf-8")
PY

echo "Updated: $FISH_COMPLETION_NSH_FILE"
echo "Updated: $FISH_COMPLETION_NSH_MSG_FILE"
