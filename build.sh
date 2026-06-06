
set -e

cd "$(dirname "$0")"

output="./build"

while getopts r:o:bdh args; do
    case "$args" in
        r)
            gresources_target=${OPTARG}
            ;;
        b)
            keep_gresource=true
            ;;
        o)
            output=${OPTARG}
            ;;
        d)
            is_devel=true
            ;;
        h)
            echo "\
novashell's build script.
use \`build:release\` for release builds.

options:
  -r \$file: specify gresource's target path (default: \`\$output/resources.gresource\`)
  -o \$path: specify the build's output directory (default: \`./build\`)
  -b: only target gresource in the build, keeping the file in the output dir
  -d: enable developer mode in the build
  -h: show this help message"
            exit 0
            ;;
    esac
done

mkdir -p "$output"

if [[ -n "$(ls -A "$output")" ]]; then
    echo "[info] cleaning previous build"
    rm -rf -- "$output"/*
fi

echo "[info] compiling gresource"
if [[ "$keep_gresource" ]]; then
    gres_target="$output/resources.gresource"
else
    gres_target="${gresources_target:-$output/resources.gresource}"
fi

mkdir -p "$(dirname "$gres_target")"
glib-compile-resources resources.gresource.xml \
    --sourcedir ./resources \
    --target "$gres_target"

echo "[info] bundling project"
devel_mode=false
if [[ "$is_devel" ]]; then
    devel_mode=true
fi

novashell_version="$(jq -r '.version' package.json)"

ags --gtk 4 bundle "src/app.ts" "$output/novashell" \
    -r ./src \
    --alias "~=$(pwd)/src" \
    -d "DEVEL=$devel_mode" \
    -d "NOVASHELL_VERSION='$novashell_version'" \
    -d "GRESOURCES_FILE='$(realpath "${gresources_target:-$output/resources.gresource}")'" \
    -d "SOURCE_DIR='$(pwd)'" \
|| rm -rf "src/node_modules"

echo "[info] creating nsh wrapper"
cat > "$output/nsh" << 'WRAPPER'
#!/bin/bash
DIR="$(cd "$(dirname "$(realpath "$0")")" && pwd)"

# nsh build outputs to terminal directly
if [[ "$1" == "build" ]]; then
    exec "$DIR/novashell" "$@"
fi

LOG="${XDG_CACHE_HOME:-$HOME/.cache}/novashell/novashell.log"
mkdir -p "$(dirname "$LOG")"

# Run command mode in foreground so users can see errors/help output.
if [[ $# -gt 0 ]]; then
    err_file="$(mktemp)"
    "$DIR/novashell" "$@" 2>"$err_file"
    status=$?

    if [[ -s "$err_file" ]]; then
        cat "$err_file" >&2
        rm -f "$err_file"
        [[ $status -eq 0 ]] && exit 1
        exit $status
    fi

    rm -f "$err_file"
    exit $status
fi

# Truncate log on fresh start (no args = primary instance)
: > "$LOG"

exec "$DIR/novashell" >>"$LOG" 2>&1
WRAPPER
chmod +x "$output/nsh"
